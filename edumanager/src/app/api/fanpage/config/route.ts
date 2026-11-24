// GET /api/fanpage/config?month=YYYY-MM — cấu hình tháng (extension + web đều gọi được)
// PUT /api/fanpage/config                — BGH/Admin lưu cấu hình tháng
import { adminDb } from "@/lib/firebase/admin";
import {
  assertMonth, authenticate, corsHeaders, errorResponse, getCampaign, HttpError, normalizePostUrl, optionsResponse,
} from "@/lib/fanpage/server";
import { currentMonthKey, FANPAGE_MANAGER_ROLES, FanpageCampaignPost } from "@/lib/fanpage/types";

const FB_URL_RE = /^https:\/\/(www\.|web\.|m\.)?facebook\.com\//;

function isValidCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

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
    if (!FB_URL_RE.test(pageUrl)) throw new HttpError(400, "Link fanpage không hợp lệ");

    let posts: FanpageCampaignPost[] | undefined;
    if (body.posts !== undefined) {
      if (!Array.isArray(body.posts)) throw new HttpError(400, "Danh sách bài viết không hợp lệ");
      if (body.posts.length > 100) throw new HttpError(400, "Danh sách bài viết tối đa 100 bài");
      const seen = new Set<string>();
      posts = [];
      for (let i = 0; i < body.posts.length; i++) {
        const row = body.posts[i] as Record<string, unknown> | null;
        const line = i + 1;
        if (!row || typeof row !== "object") {
          throw new HttpError(400, `Dòng ${line}: dữ liệu bài viết không hợp lệ`);
        }
        const rawUrl = typeof row.url === "string" ? row.url.trim() : "";
        if (!FB_URL_RE.test(rawUrl)) {
          throw new HttpError(400, `Dòng ${line}: link bài viết Facebook không hợp lệ`);
        }
        const date = typeof row.date === "string" ? row.date.trim() : "";
        if (!isValidCalendarDate(date)) {
          throw new HttpError(400, `Dòng ${line}: ngày đăng không hợp lệ (định dạng YYYY-MM-DD)`);
        }
        if (date.slice(0, 7) !== month) {
          throw new HttpError(400, `Dòng ${line}: ngày đăng (${date}) không thuộc tháng ${month}`);
        }
        const url = normalizePostUrl(rawUrl);
        if (seen.has(url)) continue;
        seen.add(url);
        const note = typeof row.note === "string" ? row.note.trim().slice(0, 200) : "";
        posts.push(note ? { url, date, note } : { url, date });
      }
    }

    const ra = body.requiredActions || {};
    const data: Record<string, unknown> = {
      month,
      pageUrl,
      comments,
      pointsPerPost: Math.max(0, Number(body.pointsPerPost) || 0),
      maxPoints: Math.max(0, Number(body.maxPoints) || 0),
      requiredActions: { like: !!ra.like, share: !!ra.share, comment: !!ra.comment },
      updatedAt: new Date().toISOString(),
      updatedBy: me.fullName,
    };
    if (typeof body.allowManual === "boolean") {
      data.allowManual = body.allowManual;
    }
    if (posts !== undefined) {
      data.posts = posts;
    }
    await adminDb.collection("fanpage_campaigns").doc(month).set(data, { merge: true });
    return Response.json({ success: true, campaign: await getCampaign(month) });
  } catch (e) {
    return errorResponse(e);
  }
}
