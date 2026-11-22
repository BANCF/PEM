// POST /api/fanpage/token — tạo mã kết nối extension mới cho giáo viên đang đăng nhập.
// Mã cũ (nếu có) bị vô hiệu. Chỉ lưu bản băm SHA-256, mã gốc chỉ trả về đúng 1 lần.
// GET  /api/fanpage/token — cho biết đã có mã kết nối chưa.
import { adminDb } from "@/lib/firebase/admin";
import { authenticate, errorResponse, generateConnectionCode, sha256 } from "@/lib/fanpage/server";

export async function GET(req: Request) {
  try {
    const me = await authenticate(req);
    const snap = await adminDb.collection("fanpage_tokens").where("uid", "==", me.uid).limit(1).get();
    const d = snap.empty ? null : snap.docs[0].data();
    return Response.json({ success: true, connected: !!d, createdAt: d?.createdAt || null, lastUsedAt: d?.lastUsedAt || null });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await authenticate(req);
    const old = await adminDb.collection("fanpage_tokens").where("uid", "==", me.uid).get();
    const batch = adminDb.batch();
    old.forEach((d: { ref: unknown }) => batch.delete(d.ref));

    const code = generateConnectionCode();
    batch.set(adminDb.collection("fanpage_tokens").doc(sha256(code)), {
      uid: me.uid,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });
    await batch.commit();
    return Response.json({ success: true, code });
  } catch (e) {
    return errorResponse(e);
  }
}
