import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";

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
    const forceSync = Boolean(body.forceSync);
    const dryRun = Boolean(body.dryRun);
    const targetKeys = Array.isArray(body.targetKeys) ? body.targetKeys : undefined;
    const targetClasses = Array.isArray(body.targetClasses) ? body.targetClasses : undefined;

    const result = await ClassHubService.pushAttendance(uid, {
      forceSync,
      dryRun,
      targetKeys,
      targetClasses
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Auto Attendance Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi hệ thống khi điểm danh tự động" },
      { status: 500 }
    );
  }
}
