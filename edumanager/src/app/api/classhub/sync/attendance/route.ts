import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    let forceSync = false;
    try {
        const body = await request.json();
        forceSync = !!body.forceSync;
    } catch (e) {}

    const result = await ClassHubService.pushAttendance(uid, forceSync);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Attendance API Error]:", error);
    return NextResponse.json({ 
      error: error.message || "Lỗi đồng bộ điểm danh"
    }, { status: 500 });
  }
}
