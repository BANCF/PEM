// =====================================================================
// Tương tác Fanpage — tiện ích phía server (chỉ dùng trong API routes)
// =====================================================================
import { createHash, randomBytes } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { defaultCampaign, FanpageCampaign, MONTH_RE } from "./types";

export interface FanpageCaller {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  via: "idToken" | "extension";
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Mã kết nối dạng PEM-XXXX-XXXX-XXXX-XXXX (dễ đọc, khó đoán) */
export function generateConnectionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += alphabet[bytes[i] % alphabet.length];
  return `PEM-${s.match(/.{4}/g)!.join("-")}`;
}

/** Id tài liệu ổn định cho 1 bài viết */
export const postIdFromUrl = (url: string) => sha256(normalizePostUrl(url)).slice(0, 20);

export function normalizePostUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = "www.facebook.com";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

async function loadProfile(uid: string, via: FanpageCaller["via"]): Promise<FanpageCaller> {
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) throw new HttpError(403, "Tài khoản chưa có hồ sơ trong PEM");
  const d = snap.data() || {};
  const role = d.role || "TEACHER";
  if (role !== "SUPER_ADMIN" && d.canUseFanpage !== true) {
    const settingsSnap = await adminDb.collection("system_settings").doc("general").get();
    const fanpageEnabled = settingsSnap.exists && settingsSnap.data()?.features?.fanpage === true;
    if (!fanpageEnabled) {
      throw new HttpError(403, "Tài khoản chưa được cấp quyền sử dụng tính năng Tương tác Fanpage");
    }
  }
  return {
    uid,
    fullName: d.fullName || d.email || "Không tên",
    email: d.email || "",
    role,
    department: d.department || "Chưa phân tổ",
    via,
  };
}

/**
 * Xác thực người gọi:
 *  - Web PEM: header Authorization: Bearer <Firebase ID token>
 *  - Extension: header X-PEM-Token: <mã kết nối>
 */
export async function authenticate(req: Request, allowExtension = false): Promise<FanpageCaller> {
  if (!adminDb || !adminAuth) throw new HttpError(500, "Firebase Admin chưa được cấu hình");

  const extToken = req.headers.get("x-pem-token");
  if (extToken) {
    if (!allowExtension) throw new HttpError(403, "Thao tác này chỉ dùng được trên web PEM");
    const doc = await adminDb.collection("fanpage_tokens").doc(sha256(extToken.trim())).get();
    if (!doc.exists) throw new HttpError(401, "Mã kết nối không đúng hoặc đã bị thay mới");
    const { uid } = doc.data();
    doc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});
    return loadProfile(uid, "extension");
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new HttpError(401, "Chưa đăng nhập");
  try {
    const decoded = await adminAuth.verifyIdToken(auth.slice(7));
    return loadProfile(decoded.uid, "idToken");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Phiên đăng nhập hết hạn, vui lòng tải lại trang");
  }
}

export function assertMonth(month: string | null | undefined): string {
  if (!month || !MONTH_RE.test(month)) throw new HttpError(400, "Tháng không hợp lệ (định dạng YYYY-MM)");
  return month;
}

export async function getCampaign(month: string): Promise<FanpageCampaign> {
  const snap = await adminDb.collection("fanpage_campaigns").doc(month).get();
  const base = defaultCampaign(month);
  if (!snap.exists) return base;
  const d = snap.data() || {};
  return {
    ...base,
    ...d,
    month,
    requiredActions: { ...base.requiredActions, ...(d.requiredActions || {}) },
  } as FanpageCampaign;
}

export function errorResponse(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Lỗi không xác định";
  if (status === 500) console.error("[fanpage]", e);
  return Response.json({ success: false, message }, { status, headers: corsHeaders() });
}

/** Extension gọi từ service worker nên không cần CORS, nhưng vẫn trả header để dễ thử nghiệm */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-PEM-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  };
}

export const optionsResponse = () => new Response(null, { status: 204, headers: corsHeaders() });
