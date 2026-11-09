import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";

// Vercel Hobby mặc định timeout 10s — nâng lên 60s để đủ xử lý Cold Session retry
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = await request.json().catch(() => ({}));
    const forceSync = body.forceSync === true;
    const dryRun = body.dryRun === true;
    const catchUpDays = body.catchUpDays ? Number(body.catchUpDays) : undefined;
    const targetClasses = Array.isArray(body.targetClasses) ? body.targetClasses : [];
    const targetKeys = Array.isArray(body.targetKeys) ? body.targetKeys : [];
    const classId = body.classId ? String(body.classId) : undefined;
    const triggerSource = body.triggerSource || "manual";

    const result = await ClassHubService.pushAttendance(uid, {
      forceSync,
      dryRun,
      catchUpDays,
      targetClasses,
      targetKeys,
      classId,
      triggerSource,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Attendance API Error]:", error);
    return NextResponse.json({ 
      success: false,
      error: error.message || "Lỗi đồng bộ điểm danh",
      message: error.message || "Lỗi đồng bộ điểm danh"
    }, { status: 500 });
  }
}
