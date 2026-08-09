const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+?)[=:](.*)/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function run() {
  try {
    const usersSnapshot = await db.collection("users").where("classhubStatus", "==", "CONNECTED").limit(1).get();
    if (usersSnapshot.empty) {
      console.log("Không tìm thấy user nào đã kết nối ClassHub.");
      return;
    }
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log("Tìm thấy user đã kết nối:", userDoc.id);

    const username = userData.classhubUsername;
    const rawPassword = Buffer.from(userData.classhubPassword, "base64").toString("utf8");
    const password = crypto.createHash("sha256").update(rawPassword).digest("hex");

    console.log("Đang đăng nhập vào ClassHub...");
    const loginRes = await fetch("https://idcloud.vn/61892/appstart/digitalismspace/jsonPostSignIn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "ohke-ajax": "1",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        "login-form": { username, password, remember_me: "1" }
      })
    });

    const loginData = await loginRes.clone().json();
    console.log("Login Data:", JSON.stringify(loginData, null, 2));

    const setCookieHeader = loginRes.headers.get("set-cookie");
    if (!setCookieHeader) {
      console.log("Không lấy được cookie.");
      return;
    }

    console.log("Đã lấy được Cookie, đang truy cập URL Attendance Center...");
    const classRes = await fetch("https://idcloud.vn/47817/appstart/classroom_pro/x24208_Editor", {
      method: "POST",
      headers: {
        "Cookie": setCookieHeader,
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ "id": "84305" })
    });

    const classHtml = await classRes.text();
    console.log("--- KẾT QUẢ TRẢ VỀ (HTML TRUNCATED) ---");
    console.log(classHtml.substring(0, 500));
    
    if (!fs.existsSync('scratch')) {
      fs.mkdirSync('scratch');
    }
    fs.writeFileSync('scratch/attendance_center.html', classHtml);
    console.log("Đã lưu HTML vào scratch/attendance_center.html để phân tích.");

  } catch (err) {
    console.error("Lỗi:", err);
  }
}

run();
