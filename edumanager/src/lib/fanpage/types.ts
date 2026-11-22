// =====================================================================
// Tương tác Fanpage — kiểu dữ liệu dùng chung (client + server)
// Firestore:
//   fanpage_campaigns/{YYYY-MM}        cấu hình tháng do BGH soạn
//   fanpage_engagements/{uid}_{postId} kết quả tương tác của từng giáo viên
//   fanpage_tokens/{sha256(code)}      mã kết nối extension của giáo viên
// =====================================================================

export interface FanpageRequiredActions {
  like: boolean;
  share: boolean;
  comment: boolean;
}

export interface FanpageCampaign {
  month: string; // "YYYY-MM"
  pageUrl: string;
  comments: string[];
  pointsPerPost: number;
  maxPoints: number; // 0 = không giới hạn
  requiredActions: FanpageRequiredActions;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export interface FanpageEngagement {
  id: string;
  uid: string;
  teacherName: string;
  department: string;
  month: string; // tháng của NGÀY ĐĂNG bài, "YYYY-MM"
  postUrl: string;
  postDate: string; // "YYYY-MM-DD"
  liked: boolean;
  shared: boolean;
  commented: boolean;
  updatedAt: string;
}

export interface FanpageTeacherSummary {
  uid: string;
  fullName: string;
  department: string;
  posts: number; // số bài đã có tương tác
  liked: number;
  shared: number;
  commented: number;
  completed: number; // số bài đạt đủ thao tác bắt buộc
  points: number;
  connected: boolean; // đã tạo mã kết nối extension chưa
}

export const DEFAULT_FANPAGE_URL = "https://www.facebook.com/tieuhoc.thcspascal";

export const DEFAULT_COMMENTS = [
  "Tuyệt vời quá! 👏",
  "Chúc mừng các con và thầy cô! 🎉",
  "Hoạt động rất ý nghĩa ❤️",
  "Pascal luôn tự hào! 💪",
  "Những khoảnh khắc thật đẹp 😍",
  "Cảm ơn nhà trường đã tổ chức chương trình rất hay!",
];

export function defaultCampaign(month: string): FanpageCampaign {
  return {
    month,
    pageUrl: DEFAULT_FANPAGE_URL,
    comments: DEFAULT_COMMENTS,
    pointsPerPost: 1,
    maxPoints: 0,
    requiredActions: { like: true, share: true, comment: true },
    finalizedAt: null,
  };
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isPostCompleted(
  e: Pick<FanpageEngagement, "liked" | "shared" | "commented">,
  req: FanpageRequiredActions
): boolean {
  if (!req.like && !req.share && !req.comment) return e.liked || e.shared || e.commented;
  return (!req.like || e.liked) && (!req.share || e.shared) && (!req.comment || e.commented);
}

export function computePoints(completed: number, c: Pick<FanpageCampaign, "pointsPerPost" | "maxPoints">): number {
  const raw = completed * (c.pointsPerPost || 0);
  return c.maxPoints > 0 ? Math.min(raw, c.maxPoints) : raw;
}

export const FANPAGE_MANAGER_ROLES = ["ADMIN", "BGH", "SUPER_ADMIN"];
export const FANPAGE_DEPT_ROLES = ["TTCM", "TPCM"];
