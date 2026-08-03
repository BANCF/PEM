import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const result = await ClassHubService.fetchClasses(uid);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Sync Classes Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi hệ thống khi lấy danh sách lớp" },
      { status: 500 }
    );
  }
}
