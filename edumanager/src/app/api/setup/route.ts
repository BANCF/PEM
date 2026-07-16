import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    // 1. Kiểm tra xem đã có tài khoản ADMIN nào trong Firestore chưa
    const adminDocs = await adminDb.collection("users").where("role", "==", "ADMIN").limit(1).get();
    
    if (!adminDocs.empty) {
      return NextResponse.json(
        { message: "Hệ thống đã được khởi tạo Admin trước đó." },
        { status: 403 }
      );
    }

    // 2. Thông tin Admin mặc định
    const adminEmail = "admin@school.com";
    const adminPassword = "AdminPassword123!"; // Mật khẩu an toàn
    const adminName = "Hệ thống Admin";

    // 3. Tạo User trên Firebase Authentication
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(adminEmail);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: adminName,
        });
      } else {
        throw error;
      }
    }

    // 4. Lưu thông tin User vào Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      email: adminEmail,
      fullName: adminName,
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      message: "Khởi tạo Admin thành công!",
      credentials: {
        email: adminEmail,
        password: adminPassword,
      },
      note: "VUI LÒNG LƯU LẠI MẬT KHẨU NÀY VÀ ĐĂNG NHẬP VÀO HỆ THỐNG",
    });

  } catch (error: any) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
