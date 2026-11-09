import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const { state, hasCredentials } = await ClassHubService.getAutoConfig(decoded.uid);
    return NextResponse.json({ success: true, state, data: state, hasCredentials });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await req.json().catch(() => ({}));

    const state = await ClassHubService.updateAutoConfig(decoded.uid, {
      dailyCronEnabled: body.dailyCronEnabled,
      inClassAutoEnabled: body.inClassAutoEnabled,
      catchUpDays: body.catchUpDays,
      lastRunDate: body.lastRunDate,
      lastScoutDate: body.lastScoutDate
    });

    return NextResponse.json({ success: true, state, data: state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 500 });
  }
}

