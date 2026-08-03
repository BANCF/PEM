import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { headers } from "next/headers";

const IDCLOUD_LOGIN_URL = "https://idcloud.vn/61892/appstart/digitalismspace/jsonPostSignIn";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    if (!userData?.classhubUsername || !userData?.classhubPassword) {
      return NextResponse.json({ success: false, message: "Chưa cấu hình tài khoản ClassHub" }, { status: 400 });
    }

    const username = userData.classhubUsername;
    const rawPassword = Buffer.from(userData.classhubPassword, "base64").toString("utf8");

    // Mã hóa SHA-256 giống như trình duyệt client của Ohke Engine
    const crypto = require("crypto");
    const password = crypto.createHash("sha256").update(rawPassword).digest("hex");

    // Giả lập trình duyệt gọi RPC của Ohke Engine
    const response = await fetch(IDCLOUD_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "ohke-ajax": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        "login-form": {
          username: username,
          password: password,
          remember_me: "1"
        }
      })
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, message: "ClassHub Server Error" }, { status: response.status });
    }

    const textResponse = await response.text();
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(textResponse);
    } catch (e) {
      return NextResponse.json({ success: false, message: "ClassHub trả về dữ liệu không hợp lệ" }, { status: 500 });
    }

    if (jsonResponse.type === "success") {
      // Đăng nhập thành công, trích xuất Cookie để lưu trữ
      const setCookieHeader = response.headers.get("set-cookie");
      let classhubCookie = "";
      
      if (setCookieHeader) {
        // Có thể có nhiều Set-Cookie (phân cách bằng dấu phẩy), nhưng fetch API thường gộp lại
        // ClassHub thường sử dụng PHPSESSID hoặc ohke_session
        classhubCookie = setCookieHeader; 
      }
      
      // Cập nhật trạng thái liên kết thành công
      await adminDb.collection("users").doc(uid).update({
        classhubStatus: "CONNECTED",
        classhubLastVerified: new Date().toISOString(),
        classhubCookie: classhubCookie
      });

      return NextResponse.json({ 
        success: true, 
        message: "Kết nối ClassHub thành công!",
        cookieExtracted: !!classhubCookie
      });
    } else {
      let errorMsg = "Tài khoản hoặc mật khẩu ClassHub không đúng";
      if (jsonResponse.data && jsonResponse.data.error) {
        errorMsg = jsonResponse.data.error;
      } else if (jsonResponse.message) {
        errorMsg = jsonResponse.message;
      }
      return NextResponse.json({ success: false, message: errorMsg }, { status: 400 });
    }

  } catch (error: any) {
    console.error("ClassHub Verify API Error:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi hệ thống: " + error.message },
      { status: 500 }
    );
  }
}
