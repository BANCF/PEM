// POST /api/fanpage/manual — giáo viên tự khai tương tác fanpage trên web PEM (điện thoại/máy tính)
// Body: { month, postUrl, liked, shared, commented }
import { adminDb } from "@/lib/firebase/admin";
import {
  assertMonth, authenticate, errorResponse, getCampaign, HttpError, normalizePostUrl, postIdFromUrl,
} from "@/lib/fanpage/server";
import { loadMonthEngagements, mergeMonthPosts, MonthPostEntry } from "@/lib/fanpage/summary";
import { FanpageChecklistItem } from "@/lib/fanpage/types";

export async function POST(req: Request) {
  try {
    const me = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const month = assertMonth(body.month);

    const rawUrl = typeof body.postUrl === "string" ? body.postUrl.trim() : "";
    if (!rawUrl) throw new HttpError(400, "Thiếu link bài viết");
    if (
      typeof body.liked !== "boolean" ||
      typeof body.shared !== "boolean" ||
      typeof body.commented !== "boolean"
    ) {
      throw new HttpError(400, "Trạng thái tương tác không hợp lệ");
    }

    const campaign = await getCampaign(month);
    if (campaign.allowManual === false) {
      throw new HttpError(403, "BGH chưa mở tự khai cho tháng này");
    }
    if (campaign.finalizedAt) {
      throw new HttpError(400, "Tháng đã chốt điểm");
    }

    const postUrl = normalizePostUrl(rawUrl);
    let entry: MonthPostEntry | undefined;
    const cfgPost = (campaign.posts || []).find((p) => normalizePostUrl(p.url) === postUrl);
    if (cfgPost) {
      entry = cfgPost.note
        ? { postUrl, postDate: cfgPost.date, note: cfgPost.note }
        : { postUrl, postDate: cfgPost.date };
    } else {
      const engagements = await loadMonthEngagements(month);
      entry = mergeMonthPosts(campaign, engagements).find((p) => p.postUrl === postUrl);
    }
    if (!entry) {
      throw new HttpError(400, "Bài viết không nằm trong danh sách tháng này");
    }

    const docRef = adminDb.collection("fanpage_engagements").doc(`${me.uid}_${postIdFromUrl(postUrl)}`);
    const prevSnap = await docRef.get();
    const prev = prevSnap.exists ? (prevSnap.data() || {}) : {};
    const byExtension = prevSnap.exists && (!prev.via || !!prev.via.extension);

    const liked = byExtension ? !!prev.liked || body.liked : body.liked;
    const shared = byExtension ? !!prev.shared || body.shared : body.shared;
    const commented = byExtension ? !!prev.commented || body.commented : body.commented;
    const now = new Date().toISOString();

    await docRef.set({
      uid: me.uid,
      teacherName: me.fullName,
      department: me.department,
      month,
      postUrl,
      postDate: entry.postDate,
      liked,
      shared,
      commented,
      via: { ...(prev.via || {}), ...(byExtension ? { extension: true } : {}), manual: true },
      createdAt: prev.createdAt || now,
      updatedAt: now,
    });

    const item: FanpageChecklistItem = {
      postUrl,
      postDate: entry.postDate,
      ...(entry.note ? { note: entry.note } : {}),
      liked,
      shared,
      commented,
      byExtension,
    };
    return Response.json({ success: true, item });
  } catch (e) {
    return errorResponse(e);
  }
}
