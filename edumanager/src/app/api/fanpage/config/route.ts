// GET /api/fanpage/config?month=YYYY-MM — cấu hình tháng (extension + web đều gọi được)
// PUT /api/fanpage/config                — BGH/Admin lưu cấu hình tháng
import { adminDb } from "@/lib/firebase/admin";
import {
  assertMonth, authenticate, corsHeaders, errorResponse, getCampaign, HttpError, optionsResponse,
} from "@/lib/fanpage/server";
import { currentMonthKey, FANPAGE_MANAGER_ROLES } from "@/lib/fanpage/types";

export const OPTIONS = optionsResponse;

export async function GET(req: Request) {
  try {
    const me = await authenticate(req, true);
    const month = assertMonth(new URL(req.url).searchParams.get("month") || currentMonthKey());
    const campaign = await getCampaign(month);
    return Response.json(
      { success: true, campaign, me: { fullName: me.fullName, department: me.department, role: me.role } },
      { headers: corsHeaders() }
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const me = await authenticate(req);
    if (!FANPAGE_MANAGER_ROLES.includes(me.role)) throw new HttpError(403, "Chỉ BGH/Admin được sửa cấu hình");
    const body = await req.json().catch(() => ({}));
    const month = assertMonth(body.month);

    const comments: string[] = Array.isArray(body.comments)
      ? body.comments.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 50)
      : [];
    if (!comments.length) throw new HttpError(400, "Cần ít nhất 1 câu bình luận mẫu");

    const pageUrl = String(body.pageUrl || "").trim();
    if (!/^https:\/\/(www\.|web\.|m\.)?facebook\.com\//.test(pageUrl)) throw new HttpError(400, "Link fanpage không hợp lệ");

    const ra = body.requiredActions || {};
    const data = {
      month,
      pageUrl,
      comments,
      pointsPerPost: Math.max(0, Number(body.pointsPerPost) || 0),
      maxPoints: Math.max(0, Number(body.maxPoints) || 0),
      requiredActions: { like: !!ra.like, share: !!ra.share, comment: !!ra.comment },
      updatedAt: new Date().toISOString(),
      updatedBy: me.fullName,
    };
    await adminDb.collection("fanpage_campaigns").doc(month).set(data, { merge: true });
    return Response.json({ success: true, campaign: await getCampaign(month) });
  } catch (e) {
    return errorResponse(e);
  }
}
