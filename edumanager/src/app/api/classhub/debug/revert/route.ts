import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const body = await req.json().catch(() => ({}));

    const result = await ClassHubService.revertFutureClassesDev(decoded.uid, {
      includeMyTick: Boolean(body.includeMyTick),
      includeStudentTicks: Boolean(body.includeStudentTicks),
      targetKeys: Array.isArray(body.targetKeys) ? body.targetKeys : undefined,
      fromYmd: typeof body.fromYmd === "string" ? body.fromYmd : undefined,
      untilTs: body.untilTs !== undefined ? Number(body.untilTs) : undefined,
      previewOnly: Boolean(body.previewOnly)
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
