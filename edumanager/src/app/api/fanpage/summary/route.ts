// GET /api/fanpage/summary?month=YYYY-MM
//  - Giáo viên: chỉ thấy bài của mình
//  - TTCM/TPCM: thấy giáo viên trong tổ
//  - BGH/Admin: thấy toàn trường
import { adminDb } from "@/lib/firebase/admin";
import { assertMonth, authenticate, errorResponse, getCampaign } from "@/lib/fanpage/server";
import { distinctPosts, loadConnectedUids, loadMonthEngagements, loadTeachers, summarize } from "@/lib/fanpage/summary";
import {
  computePoints, currentMonthKey, FANPAGE_DEPT_ROLES, FANPAGE_MANAGER_ROLES, FanpageEngagement, isPostCompleted,
} from "@/lib/fanpage/types";

export async function GET(req: Request) {
  try {
    const me = await authenticate(req);
    const month = assertMonth(new URL(req.url).searchParams.get("month") || currentMonthKey());
    const campaign = await getCampaign(month);

    // Bài của chính mình (lọc theo uid rồi lọc tháng trong bộ nhớ để khỏi cần composite index)
    const mineSnap = await adminDb.collection("fanpage_engagements").where("uid", "==", me.uid).get();
    const mine: FanpageEngagement[] = mineSnap.docs
      .map((d: { id: string; data: () => object }) => ({ id: d.id, ...d.data() }) as FanpageEngagement)
      .filter((e: FanpageEngagement) => e.month === month)
      .sort((a: FanpageEngagement, b: FanpageEngagement) => b.postDate.localeCompare(a.postDate));
    const myCompleted = mine.filter((e) => isPostCompleted(e, campaign.requiredActions)).length;

    const tokenSnap = await adminDb.collection("fanpage_tokens").where("uid", "==", me.uid).limit(1).get();

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
    };

    const isManager = FANPAGE_MANAGER_ROLES.includes(me.role);
    const isDeptLead = FANPAGE_DEPT_ROLES.includes(me.role);
    if (isManager || isDeptLead) {
      const [teachers, engagements, connected] = await Promise.all([
        loadTeachers(isManager ? undefined : me.department),
        loadMonthEngagements(month),
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
