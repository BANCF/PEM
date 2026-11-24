// GET /api/fanpage/summary?month=YYYY-MM
//  - Giáo viên: chỉ thấy bài của mình
//  - TTCM/TPCM: thấy giáo viên trong tổ
//  - BGH/Admin: thấy toàn trường
import { adminDb } from "@/lib/firebase/admin";
import { assertMonth, authenticate, errorResponse, getCampaign } from "@/lib/fanpage/server";
import { buildChecklist, distinctPosts, loadConnectedUids, loadMonthEngagements, loadTeachers, summarize } from "@/lib/fanpage/summary";
import {
  computePoints, currentMonthKey, FANPAGE_DEPT_ROLES, FANPAGE_MANAGER_ROLES, FanpageEngagement, isPostCompleted,
} from "@/lib/fanpage/types";

export async function GET(req: Request) {
  try {
    const me = await authenticate(req);
    const month = assertMonth(new URL(req.url).searchParams.get("month") || currentMonthKey());
    const [campaign, engagements, tokenSnap] = await Promise.all([
      getCampaign(month),
      loadMonthEngagements(month),
      adminDb.collection("fanpage_tokens").where("uid", "==", me.uid).limit(1).get(),
    ]);

    const mine: FanpageEngagement[] = engagements
      .filter((e) => e.uid === me.uid)
      .sort((a, b) => b.postDate.localeCompare(a.postDate));
    const myCompleted = mine.filter((e) => isPostCompleted(e, campaign.requiredActions)).length;
    const checklist = buildChecklist(campaign, engagements, mine);

    const result: Record<string, unknown> = {
      success: true,
      month,
      campaign,
      scope: "self",
      me: {
        uid: me.uid,
        fullName: me.fullName,
        role: me.role,
        department: me.department,
        connected: !tokenSnap.empty,
        posts: mine.length,
        completed: myCompleted,
        points: computePoints(myCompleted, campaign),
      },
      mine,
      checklist,
    };

    const isManager = FANPAGE_MANAGER_ROLES.includes(me.role);
    const isDeptLead = FANPAGE_DEPT_ROLES.includes(me.role);
    if (isManager || isDeptLead) {
      const [teachers, connected] = await Promise.all([
        loadTeachers(isManager ? undefined : me.department),
        loadConnectedUids(),
      ]);
      const uids = new Set(teachers.map((t) => t.uid));
      const scoped = engagements.filter((e) => uids.has(e.uid));
      result.scope = isManager ? "school" : "department";
      result.teachers = summarize(teachers, scoped, campaign, connected);
      result.posts = distinctPosts(engagements);
    }

    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
