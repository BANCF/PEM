import { NextResponse } from "next/server";
import { ClassHubService } from "@/lib/services/classhub.service";

// Endpoint ẩn dành riêng cho DEV để gỡ lỗi "Hủy chốt sổ tương lai"
// Cú pháp gọi (ví dụ qua Postman hoặc trình duyệt): GET /api/classhub/debug/revert?uid=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "Missing uid parameter" },
        { status: 400 }
      );
    }

    console.log(`[Dev-Debug] Running revertFutureClasses for UID: ${uid}`);
    
    // Gọi trực tiếp hàm debug trong Service
    const result = await ClassHubService.revertFutureClassesDev(uid);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[ClassHub Revert Error]", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
