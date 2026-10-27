import { NextResponse } from "next/server";
import { parseScheduleExcel } from "@/lib/services/scheduleParser";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    // 1. Kiểm tra secret key bảo mật
    const authHeader = request.headers.get("x-import-secret") || request.headers.get("authorization");
    const expectedSecret = process.env.TKB_AUTO_IMPORT_SECRET || "PEM_TKB_SECRET_2026";

    const cleanToken = authHeader?.replace("Bearer ", "").trim();
    if (cleanToken !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing x-import-secret" },
        { status: 401 }
      );
    }

    // 2. Lấy dữ liệu file Excel từ Request (FormData hoặc JSON Base64)
    let buffer: Buffer | null = null;
    let fileName = "TKB_Imported.xlsx";
    let weekName: string | undefined = undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded in form data" }, { status: 400 });
      }
      fileName = file.name || fileName;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body.fileBase64) {
        buffer = Buffer.from(body.fileBase64, "base64");
      }
      if (body.fileName) fileName = body.fileName;
      if (body.weekName) weekName = body.weekName;
    } else {
      // Fallback read binary body directly
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        buffer = Buffer.from(arrayBuffer);
      }
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json(
        { error: "Rỗng: Không tìm thấy dữ liệu file Excel TKB" },
        { status: 400 }
      );
    }

    // Extract week name from filename if not explicitly provided (e.g. "TKB Tuần 8 năm 2026.xlsx")
    if (!weekName && fileName) {
      const match = fileName.match(/tuần\s*(\d+)/i);
      if (match) {
        weekName = `Tuần ${match[1]}`;
      }
    }

    // 3. Lấy cấu hình Giáo viên CLB từ Firestore (nếu có)
    let clbTeachers: string[] = [];
    try {
      if (adminDb) {
        const settingsDoc = await adminDb.collection("settings").doc("schedule").get();
        if (settingsDoc.exists && settingsDoc.data()?.clbTeachers) {
          clbTeachers = settingsDoc.data().clbTeachers;
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not fetch clbTeachers settings from adminDb:", e);
    }

    // 4. Phân tích file Excel TKB
    const parsedSchedule = parseScheduleExcel(buffer, {
      clbTeachers,
      updatedBy: "Email Automation (GAS)",
      weekName: weekName || "TKB Chính thức",
    });

    const teachersCount = Object.keys(parsedSchedule.teachers || {}).length;
    const classesCount = Object.keys(parsedSchedule.classes || {}).length;

    // 5. Lưu trực tiếp vào Firestore schedules/current
    if (!adminDb) {
      return NextResponse.json(
        { error: "Firebase Admin DB is not initialized on server" },
        { status: 500 }
      );
    }

    await adminDb.collection("schedules").doc("current").set(parsedSchedule);

    console.log(`✅ [Auto-Import TKB] Successfully updated TKB from ${fileName}. (${classesCount} lớp, ${teachersCount} giáo viên)`);

    return NextResponse.json({
      success: true,
      message: "Tự động cập nhật TKB chính thức từ Email thành công!",
      fileName,
      weekName: parsedSchedule.weekName,
      classesCount,
      teachersCount,
      updatedAt: parsedSchedule.updatedAt,
    });
  } catch (error: any) {
    console.error("❌ Lỗi khi tự động import TKB:", error);
    return NextResponse.json(
      { error: "Lỗi xử lý file TKB", details: error.message },
      { status: 500 }
    );
  }
}
