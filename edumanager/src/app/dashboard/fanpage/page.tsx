"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2, Circle, Clock, Copy, Download, ExternalLink, KeyRound, Loader2, Lock, MessageCircle, Play, Plug, RefreshCw,
  Save, Share2, Square, ThumbsUp, Trophy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import FanpageChecklist from "@/components/fanpage/FanpageChecklist";
import {
  currentMonthKey, FanpageCampaign, FanpageCampaignPost, FanpageChecklistItem, FanpageEngagement, FanpageTeacherSummary, isPostCompleted,
} from "@/lib/fanpage/types";

interface SummaryResponse {
  success: boolean;
  message?: string;
  month: string;
  campaign: FanpageCampaign;
  scope: "self" | "department" | "school";
  me: {
    uid: string;
    fullName: string;
    role: string;
    department: string;
    connected: boolean;
    posts: number;
    completed: number;
    points: number;
  };
  mine: FanpageEngagement[];
  checklist: FanpageChecklistItem[];
  teachers?: FanpageTeacherSummary[];
  posts?: { postUrl: string; postDate: string; teachers: number }[];
}

const MANAGER_ROLES = ["ADMIN", "BGH", "SUPER_ADMIN"];

interface ExtAutoCfg {
  enabled: boolean;
  hour: number;
  minute: number;
  maxPosts: number;
  lastRunDate?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
}

interface ExtState {
  version?: string;
  conn?: { url: string; fullName: string; department: string } | null;
  queued?: number;
  running?: boolean;
  autoCfg?: ExtAutoCfg;
}

function askExtension<T = Record<string, unknown>>(type: string, payload?: Record<string, unknown>, timeoutMs = 4000): Promise<T & { ok: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    const requestId = `pem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Không nhận được phản hồi từ Extension"));
    }, timeoutMs);

    function onMsg(event: MessageEvent) {
      if (event.source !== window) return;
      const d = event.data;
      if (!d || d.channel !== "PEM_FANPAGE_EXT" || d.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(d);
    }
    window.addEventListener("message", onMsg);
    window.postMessage({ channel: "PEM_FANPAGE_WEB", requestId, type, payload }, "*");
  });
}

function monthOptions(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(currentMonthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return out;
}
const monthLabel = (m: string) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;
const fmtDate = (s: string) => s.split("-").reverse().join("/");

const FB_POST_URL_RE = /^https:\/\/(www\.|web\.|m\.)?facebook\.com\//;

function formatPostsText(posts: FanpageCampaignPost[]): string {
  return posts
    .map((p) => {
      const parts = p.date.split("-");
      const ddmm = parts.length === 3 ? `${parts[2]}/${parts[1]}` : p.date;
      return p.note ? `${ddmm} | ${p.url} | ${p.note}` : `${ddmm} | ${p.url}`;
    })
    .join("\n");
}

function parsePostsText(
  text: string,
  month: string
): { posts: FanpageCampaignPost[] } | { error: string } {
  const year = Number(month.slice(0, 4));
  const expectedMonth = month.slice(5, 7);
  const lines = text.split(/\r?\n/);
  const posts: FanpageCampaignPost[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const lineNum = i + 1;
    const parts = raw.split("|");
    if (parts.length < 2) {
      return { error: `Dòng ${lineNum}: sai định dạng (cần "dd/mm | link | ghi chú")` };
    }
    const datePart = parts[0].trim();
    const urlPart = parts[1].trim();
    const notePart = parts.slice(2).join("|").trim();

    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(datePart);
    if (!m) {
      return { error: `Dòng ${lineNum}: ngày "${datePart}" sai định dạng dd/mm` };
    }
    const day = Number(m[1]);
    const mon = Number(m[2]);
    const dt = new Date(Date.UTC(year, mon - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== mon - 1 || dt.getUTCDate() !== day) {
      return { error: `Dòng ${lineNum}: ngày "${datePart}" không hợp lệ` };
    }
    const mm = String(mon).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    if (mm !== expectedMonth) {
      return { error: `Dòng ${lineNum}: ngày ${dd}/${mm} không thuộc ${monthLabel(month)}` };
    }
    if (!FB_POST_URL_RE.test(urlPart)) {
      return { error: `Dòng ${lineNum}: link bài viết Facebook không hợp lệ` };
    }
    const date = `${year}-${mm}-${dd}`;
    const note = notePart.slice(0, 200);
    posts.push(note ? { date, url: urlPart, note } : { date, url: urlPart });
  }
  if (posts.length > 100) {
    return { error: "Danh sách bài viết tối đa 100 bài" };
  }
  return { posts };
}

function Mark({ on }: { on: boolean }) {
  return on ? <CheckCircle2 size={18} className="text-emerald-500 mx-auto" /> : <Circle size={18} className="text-slate-300 mx-auto" />;
}

export default function FanpagePage() {
  const { user, profile } = useAuth();
  const [month, setMonth] = useState(currentMonthKey());
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<FanpageCampaign | null>(null);
  const [postsText, setPostsText] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [extState, setExtState] = useState<ExtState | null>(null);
  const [extChecked, setExtChecked] = useState(false);

  const isManager = MANAGER_ROLES.includes(profile?.role || "");

  const pingExtension = useCallback(async () => {
    try {
      const r = await askExtension<ExtState>("pemPing", undefined, 1500);
      if (r.ok) setExtState(r);
    } catch {
      setExtState(null);
    } finally {
      setExtChecked(true);
    }
  }, []);

  useEffect(() => {
    pingExtension();
    const onReady = (e: MessageEvent) => {
      if (e.source === window && e.data?.channel === "PEM_FANPAGE_EXT" && e.data?.type === "PEM_EXT_READY") {
        pingExtension();
      }
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [pingExtension]);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await user?.getIdToken();
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      });
      const json = await res.json().catch(() => ({ success: false, message: "Phản hồi không hợp lệ" }));
      if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
      return json;
    },
    [user]
  );

  // Tăng reloadKey để tải lại dữ liệu
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api(`/api/fanpage/summary?month=${month}`)
      .then((json: SummaryResponse) => {
        if (cancelled) return;
        setData(json);
        setForm(json.campaign);
        setPostsText(formatPostsText(json.campaign.posts || []));
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, month, user, reloadKey]);

  // Poll extension khi đang chạy
  useEffect(() => {
    if (!extState?.running) return;
    const t = setInterval(async () => {
      try {
        const r = await askExtension<ExtState>("pemPing", undefined, 1500);
        if (r.ok) {
          setExtState(r);
          if (!r.running) {
            load();
            toast.success(r.autoCfg?.lastRunStatus || "Đã chạy xong tương tác Fanpage!");
          }
        }
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [extState?.running]);

  const createCode = async () => {
    if (data?.me.connected && !confirm("Tạo mã mới sẽ làm mã cũ trong extension hết hiệu lực. Tiếp tục?")) return;
    setBusy("code");
    try {
      const json = await api("/api/fanpage/token", { method: "POST" });
      setCode(json.code);
      toast.success("Đã tạo mã kết nối");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const autoConnectExtension = async () => {
    setBusy("autoConnect");
    try {
      const json = await api("/api/fanpage/token", { method: "POST" });
      const r = await askExtension<ExtState>("pemConnect", {
        url: window.location.origin,
        token: json.code,
      }, 10000);
      if (!r.ok) throw new Error(r.error || "Không kết nối được extension");
      toast.success("Đã kết nối tự động với Extension!");
      await pingExtension();
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadExtension = async () => {
    setBusy("download");
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/fanpage/download-extension", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Không tải được bộ cài Extension");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pas-fanpage-helper.zip";
      a.click();
      toast.success("Đã tải bộ cài! Giải nén và chạy file CAI_DAT_NHANH.bat");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const updateAutoCfg = async (patch: Partial<ExtAutoCfg>) => {
    setBusy("autoCfg");
    try {
      const r = await askExtension<{ autoCfg: ExtAutoCfg }>("pemSetAuto", patch as Record<string, unknown>);
      if (!r.ok) throw new Error(r.error || "Không lưu được lịch tự động");
      setExtState((prev) => (prev ? { ...prev, autoCfg: r.autoCfg } : prev));
      toast.success("Đã cập nhật lịch tự động trên Extension");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    setBusy("runNow");
    try {
      const r = await askExtension("pemRunNow", { maxPosts: extState?.autoCfg?.maxPosts || 5 }, 45000);
      if (!r.ok) throw new Error(r.error || "Không khởi động được");
      toast.success("Đã mở cửa sổ Facebook — đừng thu nhỏ cửa sổ đó trong lúc chạy.");
      await pingExtension();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const stopRun = async () => {
    setBusy("stopRun");
    try {
      await askExtension("pemStopRun");
      toast("Đã dừng tiến trình");
      await pingExtension();
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveConfig = async () => {
    if (!form) return;
    const parsed = parsePostsText(postsText, month);
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }
    setBusy("config");
    try {
      await api("/api/fanpage/config", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          month,
          posts: parsed.posts,
          allowManual: Boolean(form.allowManual),
        }),
      });
      toast.success("Đã lưu cấu hình tháng");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const finalize = async () => {
    if (!confirm(`Chốt điểm KPI tương tác fanpage ${monthLabel(month)}?\nMỗi giáo viên nhận 1 phiếu thưởng (đã duyệt). Chốt lại sẽ cập nhật, không cộng trùng.`)) return;
    setBusy("finalize");
    try {
      const json = await api("/api/fanpage/finalize", { method: "POST", body: JSON.stringify({ month }) });
      toast.success(`Đã chốt: ${json.awarded} giáo viên được cộng điểm`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const departments = useMemo(
    () => [...new Set((data?.teachers || []).map((t) => t.department))].sort((a, b) => a.localeCompare(b, "vi")),
    [data]
  );
  const teacherRows = useMemo(
    () => (data?.teachers || []).filter((t) => deptFilter === "all" || t.department === deptFilter),
    [data, deptFilter]
  );

  const exportCsv = () => {
    const header = ["Tổ", "Giáo viên", "Số bài", "Thích", "Chia sẻ", "Bình luận", "Bài đạt", "Tự khai", "Điểm", "Đã kết nối"];
    const lines = [header, ...teacherRows.map((t) => [t.department, t.fullName, t.posts, t.liked, t.shared, t.commented, t.completed, t.manualPosts, t.points, t.connected ? "x" : ""])]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tuong-tac-fanpage-${month}.csv`;
    a.click();
  };

  const req = data?.campaign.requiredActions;
  const reqText = req
    ? [req.like && "Thích", req.share && "Chia sẻ", req.comment && "Bình luận"].filter(Boolean).join(" + ") || "Bất kỳ thao tác nào"
    : "";

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ThumbsUp className="text-blue-600" /> Tương tác Fanpage
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Theo dõi Thích · Chia sẻ · Bình luận bài viết fanpage trường qua extension PAS Fanpage Helper.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => { setLoading(true); setMonth(e.target.value); }}
            className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium"
          >
            {monthOptions().map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button onClick={() => { setLoading(true); load(); }} className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600" title="Tải lại">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center p-16"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : data ? (
        <>
          {/* Thẻ cá nhân */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-sm text-slate-500">Điểm tháng này của bạn</p>
            <p className="text-4xl font-black text-blue-600 mt-1">+{data.me.points}</p>
            <p className="text-sm text-slate-600 mt-2">
              {data.me.completed}/{data.me.posts} bài đạt yêu cầu ({reqText})
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {data.campaign.pointsPerPost} điểm/bài{data.campaign.maxPoints > 0 ? ` · tối đa ${data.campaign.maxPoints} điểm` : ""}
            </p>
            {data.campaign.finalizedAt && (
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                <Lock size={12} /> Đã chốt bởi {data.campaign.finalizedBy}
              </p>
            )}
          </div>

          {/* Checklist tương tác (ưu tiên điện thoại) */}
          <FanpageChecklist
            month={month}
            campaign={data.campaign}
            items={data.checklist || []}
            api={api}
            onChanged={load}
          />

          {/* Thông báo trên điện thoại thay cho khối Extension */}
          <p className="md:hidden text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            Trên điện thoại hãy dùng danh sách bên trên; extension chỉ dùng trên Chrome máy tính.
          </p>

          {/* Điều khiển Extension (chỉ hiển thị từ md trở lên) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Plug size={18} className={extState?.conn ? "text-emerald-600" : "text-blue-600"} />
                    Điều khiển Extension &amp; Lịch nhắc tự động
                    {extState?.version && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đã cài v{extState.version}
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {!extChecked
                      ? "Đang kiểm tra extension trên trình duyệt..."
                      : !extState
                      ? "Chưa phát hiện extension trên Chrome. Tải bộ cài 1-Click bên cạnh để cài nhanh trong 10 giây."
                      : extState.conn
                      ? `Đã kết nối tự động (${extState.conn.fullName}). Nhắc tương tác khi Chrome mở, không cần mở web PEM.`
                      : "Extension đã sẵn sàng — bấm Kết nối tự động để liên kết ngay không cần copy mã."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {!extState ? (
                    <button
                      onClick={downloadExtension}
                      disabled={busy === "download"}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-60"
                    >
                      {busy === "download" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Tải bộ cài Extension (1-Click)
                    </button>
                  ) : !extState.conn ? (
                    <button
                      onClick={autoConnectExtension}
                      disabled={busy === "autoConnect"}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-60"
                    >
                      {busy === "autoConnect" ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
                      Kết nối tự động ngay
                    </button>
                  ) : extState.running ? (
                    <button
                      onClick={stopRun}
                      disabled={busy === "stopRun"}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-60"
                    >
                      {busy === "stopRun" ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                      Đang chạy trên cửa sổ Facebook... (Bấm để dừng)
                    </button>
                  ) : (
                    <button
                      onClick={runNow}
                      disabled={busy === "runNow"}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-60"
                    >
                      {busy === "runNow" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                      Chạy ngay (mở cửa sổ Facebook)
                    </button>
                  )}
                </div>
              </div>

              {/* Cài đặt lịch nhắc tự động khi đã kết nối extension */}
              {extState?.conn && extState.autoCfg && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-emerald-600"
                      checked={extState.autoCfg.enabled}
                      disabled={busy === "autoCfg"}
                      onChange={(e) => updateAutoCfg({ enabled: e.target.checked })}
                    />
                    <div>
                      <span className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                        <Clock size={15} className="text-emerald-600" />
                        Nhắc tôi tương tác fanpage hằng ngày (khi Chrome đang mở)
                      </span>
                      <p className="text-xs text-slate-500">
                        {extState.autoCfg.lastRunStatus
                          ? `Lần gần nhất (${extState.autoCfg.lastRunDate || ""}): ${extState.autoCfg.lastRunStatus}`
                          : "Tới giờ sẽ hiện thông báo nhắc, bấm để mở cửa sổ xử lý bài mới rồi tự đóng."}
                      </p>
                    </div>
                  </label>

                  <div className="flex items-center gap-2 text-xs text-slate-700 shrink-0">
                    <span>Giờ chạy:</span>
                    <input
                      type="time"
                      value={`${String(extState.autoCfg.hour).padStart(2, "0")}:${String(extState.autoCfg.minute).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        if (!isNaN(h) && !isNaN(m)) updateAutoCfg({ hour: h, minute: m });
                      }}
                      className="border border-slate-300 rounded-lg px-2 py-1 bg-white font-medium"
                    />
                    <span>Tối đa</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={extState.autoCfg.maxPosts}
                      onChange={(e) => updateAutoCfg({ maxPosts: Number(e.target.value) || 5 })}
                      className="w-14 border border-slate-300 rounded-lg px-2 py-1 bg-white text-center font-medium"
                    />
                    <span>bài/ngày</span>
                  </div>
                </div>
              )}

              {/* Hướng dẫn cài nhanh nếu chưa có extension */}
              {extChecked && !extState && (
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1 bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <li>Bấm <b>Tải bộ cài Extension (1-Click)</b> và giải nén file ZIP.</li>
                  <li>Mở thư mục vừa giải nén, bấm đúp vào file <b>CAI_DAT_NHANH.bat</b> (script tự chép file, copy sẵn đường dẫn và mở Chrome).</li>
                  <li>Trên Chrome vừa mở: bật <i>Chế độ nhà phát triển</i> → bấm <i>Tải tiện ích đã giải nén</i> → bấm <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">Ctrl+V</kbd> rồi <b>Enter</b>, sau đó tải lại (F5) trang này.</li>
                </ol>
              )}

              {/* Dự phòng kết nối thủ công */}
              <details className="text-xs text-slate-500 pt-1">
                <summary className="cursor-pointer hover:text-slate-700 font-medium">
                  Kết nối thủ công bằng mã (dự phòng khi dùng trên máy khác)
                </summary>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={createCode}
                    disabled={busy === "code"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                  >
                    {busy === "code" ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {data.me.connected ? "Tạo mã mới" : "Tạo mã kết nối"}
                  </button>
                  {extState?.conn && (
                    <button
                      onClick={downloadExtension}
                      disabled={busy === "download"}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                    >
                      <Download size={14} /> Tải lại bộ cài
                    </button>
                  )}
                </div>
                {code && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-800 mb-1.5">Mã chỉ hiện 1 lần — dán vào ô &quot;Mã kết nối PEM&quot; trong extension:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-base font-bold tracking-wider text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-amber-200 select-all">{code}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(code); toast.success("Đã copy"); }}
                        className="p-2 rounded-lg bg-white border border-amber-200 hover:bg-amber-100"
                      ><Copy size={16} /></button>
                    </div>
                  </div>
                )}
              </details>
          </div>

          {/* Cấu hình tháng — BGH/Admin */}
          {isManager && form && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-800 mb-4">Cấu hình {monthLabel(month)}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Link fanpage
                    <input
                      value={form.pageUrl}
                      onChange={(e) => setForm({ ...form, pageUrl: e.target.value })}
                      className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Điểm mỗi bài đạt
                      <input
                        type="number" min={0} step={0.5}
                        value={form.pointsPerPost}
                        onChange={(e) => setForm({ ...form, pointsPerPost: Number(e.target.value) })}
                        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Tối đa/tháng (0 = không giới hạn)
                      <input
                        type="number" min={0}
                        value={form.maxPoints}
                        onChange={(e) => setForm({ ...form, maxPoints: Number(e.target.value) })}
                        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </label>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Bài được tính khi có đủ</p>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                      {(["like", "share", "comment"] as const).map((k) => (
                        <label key={k} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.requiredActions[k]}
                            onChange={(e) => setForm({ ...form, requiredActions: { ...form.requiredActions, [k]: e.target.checked } })}
                          />
                          {k === "like" ? "Thích" : k === "share" ? "Chia sẻ" : "Bình luận"}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.allowManual)}
                      onChange={(e) => setForm({ ...form, allowManual: e.target.checked })}
                    />
                    Cho phép giáo viên tự khai (điện thoại)
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Câu bình luận mẫu (mỗi dòng 1 câu — extension tự lấy về)
                  <textarea
                    rows={7}
                    value={form.comments.join("\n")}
                    onChange={(e) => setForm({ ...form, comments: e.target.value.split("\n") })}
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 font-normal"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700 mt-4">
                Danh sách bài trong tháng (mỗi dòng: <span className="font-mono font-normal text-xs text-slate-500">dd/mm | link | ghi chú (tuỳ chọn)</span>)
                <textarea
                  rows={5}
                  value={postsText}
                  onChange={(e) => setPostsText(e.target.value)}
                  placeholder={`05/${month.slice(5)} | https://www.facebook.com/... | Ghi chú bài viết`}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 font-normal font-mono text-xs sm:text-sm"
                />
              </label>
              <div className="mt-5 flex flex-wrap gap-3 justify-end">
                <button
                  onClick={saveConfig}
                  disabled={busy === "config"}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium disabled:opacity-60"
                >
                  {busy === "config" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu cấu hình
                </button>
                <button
                  onClick={finalize}
                  disabled={busy === "finalize"}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-60"
                >
                  {busy === "finalize" ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                  {data.campaign.finalizedAt ? "Chốt lại điểm KPI" : "Chốt điểm KPI tháng"}
                </button>
              </div>
            </div>
          )}

          {/* Bảng giáo viên — BGH/Admin/TTCM */}
          {data.teachers && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800">
                    {data.scope === "school" ? "Toàn trường" : `Tổ ${data.me.department}`} · {data.posts?.length || 0} bài trong tháng
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {teacherRows.filter((t) => t.completed > 0).length}/{teacherRows.length} giáo viên đã tương tác ·{" "}
                    {teacherRows.filter((t) => t.connected).length} đã kết nối extension
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {data.scope === "school" && (
                    <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
                      <option value="all">Tất cả tổ</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                  <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">
                    <Download size={16} /> CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-5 py-3">Giáo viên</th>
                      <th className="text-left px-3 py-3">Tổ</th>
                      <th className="px-3 py-3"><ThumbsUp size={14} className="mx-auto" /></th>
                      <th className="px-3 py-3"><Share2 size={14} className="mx-auto" /></th>
                      <th className="px-3 py-3"><MessageCircle size={14} className="mx-auto" /></th>
                      <th className="px-3 py-3">Bài đạt</th>
                      <th className="px-3 py-3">Tự khai</th>
                      <th className="px-3 py-3">Điểm</th>
                      <th className="px-3 py-3">Extension</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherRows.map((t) => (
                      <tr key={t.uid} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-800">{t.fullName}</td>
                        <td className="px-3 py-3 text-slate-500">{t.department}</td>
                        <td className="px-3 py-3 text-center">{t.liked}</td>
                        <td className="px-3 py-3 text-center">{t.shared}</td>
                        <td className="px-3 py-3 text-center">{t.commented}</td>
                        <td className="px-3 py-3 text-center font-semibold">{t.completed}</td>
                        <td className="px-3 py-3 text-center text-slate-600">{t.manualPosts}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-600">{t.points > 0 ? `+${t.points}` : "0"}</td>
                        <td className="px-3 py-3 text-center">
                          {t.connected
                            ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Đã kết nối</span>
                            : <span className="text-xs text-slate-400">Chưa</span>}
                        </td>
                      </tr>
                    ))}
                    {!teacherRows.length && (
                      <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400">Chưa có giáo viên</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bài của tôi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Bài viết bạn đã tương tác</h2>
              <a href={data.campaign.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                Mở fanpage <ExternalLink size={14} />
              </a>
            </div>
            {data.mine.length ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-5 py-3">Ngày đăng</th>
                    <th className="text-left px-3 py-3">Bài viết</th>
                    <th className="px-3 py-3">Thích</th>
                    <th className="px-3 py-3">Chia sẻ</th>
                    <th className="px-3 py-3">Bình luận</th>
                    <th className="px-3 py-3">Đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.mine.map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600">{fmtDate(e.postDate)}</td>
                      <td className="px-3 py-3 max-w-xs truncate">
                        <a href={e.postUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{e.postUrl.replace("https://www.facebook.com/", "")}</a>
                      </td>
                      <td className="px-3 py-3"><Mark on={e.liked} /></td>
                      <td className="px-3 py-3"><Mark on={e.shared} /></td>
                      <td className="px-3 py-3"><Mark on={e.commented} /></td>
                      <td className="px-3 py-3"><Mark on={isPostCompleted(e, data.campaign.requiredActions)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-10 text-center text-slate-400 text-sm">Chưa có dữ liệu cho {monthLabel(month)}.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
