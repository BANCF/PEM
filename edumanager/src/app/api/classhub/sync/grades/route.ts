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

    const body = await request.json();
    
    // Gọi Core Service để đẩy điểm
    const result = await ClassHubService.pushGrades(uid, body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Sync Grades Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi hệ thống khi đẩy điểm lên ClassHub" },
      { status: 500 }
    );
  }
}
