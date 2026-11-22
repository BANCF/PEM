// POST /api/fanpage/finalize { month } — BGH/Admin chốt điểm KPI tương tác fanpage của tháng.
// Mỗi giáo viên có 1 phiếu KUDOS (id cố định fanpage_{month}_{uid}) trong collection "evaluations",
// nên chốt lại nhiều lần chỉ cập nhật chứ không cộng trùng.
// createdAt đặt trong tháng được chốt để cron monthly-kpi tính đúng tháng.
import { adminDb } from "@/lib/firebase/admin";
import { assertMonth, authenticate, errorResponse, getCampaign, HttpError } from "@/lib/fanpage/server";
import { loadConnectedUids, loadMonthEngagements, loadTeachers, summarize } from "@/lib/fanpage/summary";
import { currentMonthKey, FANPAGE_MANAGER_ROLES } from "@/lib/fanpage/types";

export async function POST(req: Request) {
  try {
    const me = await authenticate(req);
    if (!FANPAGE_MANAGER_ROLES.includes(me.role)) throw new HttpError(403, "Chỉ BGH/Admin được chốt điểm");
    const body = await req.json().catch(() => ({}));
    const month = assertMonth(body.month);
    if (month > currentMonthKey()) throw new HttpError(400, "Không thể chốt tháng chưa tới");

    const campaign = await getCampaign(month);
    const [teachers, engagements, connected] = await Promise.all([
      loadTeachers(),
      loadMonthEngagements(month),
      loadConnectedUids(),
    ]);
    const rows = summarize(teachers, engagements, campaign, connected);
    const teacherByUid = new Map(teachers.map((t) => [t.uid, t]));

    const [y, m] = month.split("-").map(Number);
    const isPastMonth = month < currentMonthKey();
    const createdAt = (isPastMonth ? new Date(y, m, 0, 12, 0, 0) : new Date()).toISOString();
    const label = `${String(m).padStart(2, "0")}/${y}`;

    const batch = adminDb.batch();
    let awarded = 0;
    let removed = 0;
    for (const r of rows) {
      const ref = adminDb.collection("evaluations").doc(`fanpage_${month}_${r.uid}`);
      if (r.points <= 0) {
        batch.delete(ref);
        removed++;
        continue;
      }
      const t = teacherByUid.get(r.uid)!;
      batch.set(ref, {
        teacherId: r.uid,
        teacherEmail: t.email,
        teacherName: r.fullName,
        teacherDepartment: r.department,
        ruleId: "FANPAGE_MONTHLY",
        ruleName: `Tương tác fanpage tháng ${label} (${r.completed} bài)`,
        ruleScore: r.points,
        type: "KUDOS",
        evidenceUrl: "",
        note: `Thích ${r.liked} · Chia sẻ ${r.shared} · Bình luận ${r.commented}. Tự động tổng hợp từ extension PAS Fanpage Helper.`,
        status: "APPROVED",
        source: "fanpage",
        createdAt,
        deadlineAt: createdAt,
        createdBy: me.uid,
        createdByName: me.fullName,
      });
      awarded++;
    }
    batch.set(
      adminDb.collection("fanpage_campaigns").doc(month),
      { finalizedAt: new Date().toISOString(), finalizedBy: me.fullName },
      { merge: true }
    );
    await batch.commit();

    return Response.json({ success: true, awarded, removed });
  } catch (e) {
    return errorResponse(e);
  }
}
