// POST /api/fanpage/report — extension gửi kết quả tương tác
// Body: { items: [{ postUrl, postDate: "YYYY-MM-DD", liked, shared, commented }] }
// Trạng thái chỉ được nâng lên (đã true thì không bị ghi đè thành false).
import { adminDb } from "@/lib/firebase/admin";
import {
  authenticate, corsHeaders, errorResponse, HttpError, normalizePostUrl, optionsResponse, postIdFromUrl,
} from "@/lib/fanpage/server";

export const OPTIONS = optionsResponse;

interface IncomingItem {
  postUrl?: unknown;
  postDate?: unknown;
  liked?: unknown;
  shared?: unknown;
  commented?: unknown;
}

export async function POST(req: Request) {
  try {
    const me = await authenticate(req, true);
    const body = await req.json().catch(() => ({}));
    const items: IncomingItem[] = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (!items.length) throw new HttpError(400, "Không có dữ liệu");

    const valid = items.filter(
      (it) =>
        typeof it.postUrl === "string" &&
        /^https:\/\/(www\.|web\.|m\.)?facebook\.com\//.test(it.postUrl) &&
        typeof it.postDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(it.postDate)
    );
    if (!valid.length) throw new HttpError(400, "Dữ liệu không hợp lệ");

    const refs = valid.map((it) =>
      adminDb.collection("fanpage_engagements").doc(`${me.uid}_${postIdFromUrl(it.postUrl as string)}`)
    );
    const existing = await adminDb.getAll(...refs);
    const now = new Date().toISOString();
    const batch = adminDb.batch();

    valid.forEach((it, i) => {
      const prev = existing[i].exists ? existing[i].data() : {};
      const postDate = it.postDate as string;
      batch.set(refs[i], {
        uid: me.uid,
        teacherName: me.fullName,
        department: me.department,
        month: postDate.slice(0, 7),
        postUrl: normalizePostUrl(it.postUrl as string),
        postDate,
        liked: !!prev.liked || it.liked === true,
        shared: !!prev.shared || it.shared === true,
        commented: !!prev.commented || it.commented === true,
        createdAt: prev.createdAt || now,
        updatedAt: now,
      });
    });
    await batch.commit();
    return Response.json({ success: true, saved: valid.length, skipped: items.length - valid.length }, { headers: corsHeaders() });
  } catch (e) {
    return errorResponse(e);
  }
}
