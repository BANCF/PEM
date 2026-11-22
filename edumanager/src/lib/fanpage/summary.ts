// =====================================================================
// Tương tác Fanpage — tổng hợp theo giáo viên (dùng chung cho summary/finalize)
// =====================================================================
import { adminDb } from "@/lib/firebase/admin";
import {
  computePoints, FanpageCampaign, FanpageEngagement, FanpageTeacherSummary, isPostCompleted,
} from "./types";

interface TeacherRow {
  uid: string;
  fullName: string;
  email: string;
  department: string;
}

export async function loadTeachers(department?: string): Promise<TeacherRow[]> {
  const snap = await adminDb.collection("users").where("role", "in", ["TEACHER", "TTCM", "TPCM"]).get();
  const rows: TeacherRow[] = [];
  snap.forEach((d: { id: string; data: () => Record<string, string> }) => {
    const u = d.data();
    rows.push({ uid: d.id, fullName: u.fullName || u.email, email: u.email || "", department: u.department || "Chưa phân tổ" });
  });
  return (department ? rows.filter((r) => r.department === department) : rows).sort(
    (a, b) => a.department.localeCompare(b.department, "vi") || a.fullName.localeCompare(b.fullName, "vi")
  );
}

export async function loadMonthEngagements(month: string): Promise<FanpageEngagement[]> {
  const snap = await adminDb.collection("fanpage_engagements").where("month", "==", month).get();
  return snap.docs.map((d: { id: string; data: () => object }) => ({ id: d.id, ...d.data() }) as FanpageEngagement);
}

export async function loadConnectedUids(): Promise<Set<string>> {
  const snap = await adminDb.collection("fanpage_tokens").get();
  return new Set(snap.docs.map((d: { data: () => { uid: string } }) => d.data().uid));
}

export function summarize(
  teachers: TeacherRow[],
  engagements: FanpageEngagement[],
  campaign: FanpageCampaign,
  connected: Set<string>
): FanpageTeacherSummary[] {
  const byUid = new Map<string, FanpageEngagement[]>();
  for (const e of engagements) {
    if (!byUid.has(e.uid)) byUid.set(e.uid, []);
    byUid.get(e.uid)!.push(e);
  }
  return teachers.map((t) => {
    const list = byUid.get(t.uid) || [];
    const completed = list.filter((e) => isPostCompleted(e, campaign.requiredActions)).length;
    return {
      uid: t.uid,
      fullName: t.fullName,
      department: t.department,
      posts: list.length,
      liked: list.filter((e) => e.liked).length,
      shared: list.filter((e) => e.shared).length,
      commented: list.filter((e) => e.commented).length,
      completed,
      points: computePoints(completed, campaign),
      connected: connected.has(t.uid),
    };
  });
}

/** Danh sách bài (gộp từ mọi giáo viên) để biết tháng có bao nhiêu bài */
export function distinctPosts(engagements: FanpageEngagement[]) {
  const m = new Map<string, { postUrl: string; postDate: string; teachers: number }>();
  for (const e of engagements) {
    const cur = m.get(e.postUrl);
    if (cur) cur.teachers++;
    else m.set(e.postUrl, { postUrl: e.postUrl, postDate: e.postDate, teachers: 1 });
  }
  return [...m.values()].sort((a, b) => b.postDate.localeCompare(a.postDate));
}
