const puppeteer = require('puppeteer');
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
  const usersSnapshot = await db.collection("users").where("classhubStatus", "==", "CONNECTED").limit(1).get();
  if (usersSnapshot.empty) return console.log("No user connected");
  
  const userData = usersSnapshot.docs[0].data();
  const username = userData.classhubUsername;
  const rawPassword = Buffer.from(userData.classhubPassword, "base64").toString("utf8");
  const password = crypto.createHash("sha256").update(rawPassword).digest("hex");

  console.log("Logging in via API...");
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

  const cookieHeader = loginRes.headers.get("set-cookie");
  const sessionCookie = cookieHeader.split(';')[0].split('=');
  const cookieName = sessionCookie[0];
  const cookieValue = sessionCookie[1];

  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Attach request interceptor
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (request.method() === 'POST' && url.includes('idcloud.vn')) {
      const postData = request.postData();
      if (postData && (postData.includes('present') || postData.includes('attendance') || postData.includes('mark'))) {
        console.log("-----------------------------------------");
        console.log("INTERCEPTED ATTENDANCE POST REQUEST!");
        console.log("URL:", url);
        console.log("Payload:", postData);
        console.log("-----------------------------------------");
        fs.appendFileSync('attendance_payload.txt', `URL: ${url}\nPayload: ${postData}\n\n`);
      }
    }
    request.continue();
  });

  await page.setCookie({
    name: cookieName,
    value: cookieValue,
    domain: 'idcloud.vn'
  });

  console.log("Navigating to class viewer...");
  await page.goto("https://idcloud.vn/47817/appstart/classroom_pro/Viewer/84305", { waitUntil: 'networkidle2' });

  console.log("Clicking Attendance tab...");
  // Find the Attendance tab and click it
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.ohke-tab-btn'));
    const attendanceTab = tabs.find(t => t.innerText.includes('Attendance'));
    if (attendanceTab) attendanceTab.click();
  });
  
  console.log("Waiting for Attendance Center to load...");
  // Wait until the Mark All As Present button appears
  try {
    await page.waitForFunction(() => {
      return document.body.innerText.includes("TEACHER'S ATTENDANCE") || document.body.innerText.includes("Mark All As Present");
    }, { timeout: 15000 });
  } catch (e) {
    console.log("Timeout waiting for attendance tab content.");
    await browser.close();
    return;
  }

  console.log("Looking for Teacher's Attendance button...");
  const clickedTeacher = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button, div, span'));
    const btn = btns.find(b => b.innerText.includes("TEACHER'S ATTENDANCE NOT YET MARKED"));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (clickedTeacher) {
    console.log("Clicked Teacher Attendance button. Waiting for modal...");
    await new Promise(r => setTimeout(r, 2000));
    
    const clickedPresent = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button, div'));
      // Find the blue PRESENT button
      const btn = btns.find(b => b.innerText.includes('PRESENT') && !b.innerText.includes('NOT YET MARKED'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (clickedPresent) console.log("Clicked PRESENT!");
    else console.log("Could not find PRESENT button in modal.");
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log("Teacher attendance button not found.");
  }

  console.log("Looking for Mark All As Present button...");
  const clickedMarkAll = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button, div'));
    const btn = btns.find(b => b.innerText.includes('Mark All As Present'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (clickedMarkAll) console.log("Clicked Mark All As Present!");
  else console.log("Mark All As Present button not found.");
  
  await new Promise(r => setTimeout(r, 5000));
  console.log("Done. Closing browser...");
  await browser.close();
}

run().catch(console.error);
