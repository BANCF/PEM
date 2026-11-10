"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Search,
  Terminal,
  FlaskConical,
  RotateCcw,
  Clock,
  UserCheck,
  ShieldCheck,
  CalendarClock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

function getTodayYmdVN() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatHmVN(ts?: number) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateLabelVN(ymd: string, todayYmd: string) {
  if (!ymd || ymd === "unknown") return "Không rõ ngày";
  const [y, m, d] = ymd.split("-");
  const short = d && m ? `${d}/${m}/${y}` : ymd;
  if (ymd === todayYmd) return `Hôm nay (${short})`;
  return `Ngày ${short} (Tiết bù)`;
}

export default function ClasshubAttendancePage() {
  const { profile, user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [lockedClasses, setLockedClasses] = useState<any[]>([]);
  const [teacher, setTeacher] = useState<{ id: string; name: string } | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [attending, setAttending] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [forceSync, setForceSync] = useState(false);

  // State đồng bộ từ Extension 3.8.11 (classhubAttendanceState)
  const [autoState, setAutoState] = useState<any>({
    dailyCronEnabled: true,
    inClassAutoEnabled: true,
    catchUpDays: 30,
    lastRunDate: undefined,
    lastScoutDate: undefined,
    completed: {},
    failures: {},
    upcomingClasses: null,
    lastBatchRun: null,
    recentLogs: [],
  });
  const [hasCredentials, setHasCredentials] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Công cụ Test Hủy nhanh Điểm danh trong khoảng (chuẩn Extension 3.8.11)
  const [showTestPanel, setShowTestPanel] = useState<boolean>(false);
  const [revertFromDate, setRevertFromDate] = useState<string>(() => getTodayYmdVN());
  const [revertUntilDt, setRevertUntilDt] = useState<string>(() => `${getTodayYmdVN()}T23:59`);
  const [revertMyTick, setRevertMyTick] = useState<boolean>(true);
  const [revertStudentTicks, setRevertStudentTicks] = useState<boolean>(true);

  const loadAutoConfig = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/classhub/auto-config", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAutoState(json.data);
        setHasCredentials(Boolean(json.hasCredentials));
        if (json.data.teacherIdentity?.id) {
          setTeacher({
            id: json.data.teacherIdentity.id,
            name: json.data.teacherIdentity.fullName || "",
          });
        }
        if (Array.isArray(json.data.recentLogs) && json.data.recentLogs.length > 0) {
          setLogs((prev) => (prev.length === 0 ? json.data.recentLogs : prev));
        }
      }
    } catch (e) {
      console.error("Load auto config error:", e);
    }
  }, [user]);

  useEffect(() => {
    loadAutoConfig();
    const onStateSynced = (e: any) => {
      const detail = e?.detail;
      if (detail?.state) {
        setAutoState(detail.state);
      } else {
        loadAutoConfig();
      }
      if (detail?.logs) {
        setLogs(detail.logs);
      }
      if (detail?.teacher) {
        setTeacher(detail.teacher);
      }
      if (detail?.summary) {
        setSummary(detail.summary);
      }
      if (Array.isArray(detail?.data)) {
        setClasses(detail.data);
      }
      if (Array.isArray(detail?.lockedData)) {
        setLockedClasses(detail.lockedData);
      }
    };
    window.addEventListener("classhub-state-synced", onStateSynced as EventListener);
    return () => {
      window.removeEventListener("classhub-state-synced", onStateSynced as EventListener);
    };
  }, [loadAutoConfig]);

  const updateAutoSetting = async (patch: Record<string, any>, toastMsg?: string) => {
    if (!user) return;
    setSavingConfig(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/classhub/auto-config", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAutoState(json.data);
        if (toastMsg) toast.success(toastMsg);
        window.dispatchEvent(new CustomEvent("classhub-config-updated", { detail: json.data }));
      } else {
        toast.error(json.error || "Không thể lưu cấu hình tự động");
      }
    } catch (e) {
      toast.error("Lỗi kết nối khi lưu cấu hình");
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchClasses = async (customCatchUpDays?: number) => {
    setLoading(true);
    try {
      const idToken = await user?.getIdToken();
      const daysParam = customCatchUpDays || autoState.catchUpDays || 30;
      const response = await fetch(
        `/api/classhub/sync/classes?forceSync=${forceSync}&catchUpDays=${daysParam}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      const result = await response.json();
      if (result.logs) setLogs(result.logs);
      if (result.teacher) setTeacher(result.teacher);
      if (result.summary) setSummary(result.summary);
      if (result.state) setAutoState(result.state);

      if (result.success && result.data) {
        setClasses(result.data);
        setLockedClasses(result.lockedData || []);
        setRunDetails({});
        toast.success(
          `Quét lịch hoàn tất: ${result.data.length} tiết cần điểm danh${
            result.lockedData?.length ? `, ${result.lockedData.length} tiết chờ tới giờ` : ""
          }`
        );
      } else {
        toast.error(result.message || "Không thể lấy danh sách lớp");
      }
    } catch (error) {
      console.error("Fetch classes error", error);
      toast.error("Lỗi khi tải danh sách lớp");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAttend = async (dryRun = false, triggerAllReady = false) => {
    if (!triggerAllReady && classes.length === 0) {
      // Nếu chưa bấm quét lớp trước đó, cho phép chạy thẳng (tự quét + điểm danh giống nút Điểm danh Siêu tốc trên Extension)
      triggerAllReady = true;
    }

    if (!dryRun && classes.length > 0 && !triggerAllReady) {
      const confirmMsg = `Bạn có chắc muốn tự động điểm danh THẬT cho ${classes.length} tiết học theo chuẩn 3.8.11?`;
      if (!window.confirm(confirmMsg)) return;
    }

    setAttending(true);
    const toastId = toast.loading(
      dryRun
        ? "Đang chạy thử (Dry-Run) kiểm tra bản ghi GV & kế hoạch chốt sổ..."
        : "🚀 Đang thực hiện Điểm danh Siêu tốc qua API nền (chuẩn 3.8.11)..."
    );
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch("/api/classhub/sync/attendance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          forceSync,
          dryRun,
          catchUpDays: autoState.catchUpDays || 30,
          targetClasses: triggerAllReady ? [] : classes.map((c) => c.raw_classItem),
          triggerSource: "manual",
        }),
      });
      const result = await response.json();

      if (result.logs) setLogs(result.logs);
      if (result.teacher) setTeacher(result.teacher);
      if (result.state) setAutoState(result.state);

      if (Array.isArray(result.details)) {
        const detailMap: Record<string, any> = {};
        for (const d of result.details) {
          if (d?.class) detailMap[String(d.class)] = d;
        }
        setRunDetails(detailMap);
      }

      if (result.success) {
        toast.success(result.message || (dryRun ? "Dry-Run hoàn tất!" : "Điểm danh hoàn tất!"), {
          id: toastId,
          duration: 5000,
        });
        if (!dryRun) {
          await fetchClasses();
        }
      } else {
        toast.error(result.message || "Có một số tiết chưa chốt được, vui lòng xem log", {
          id: toastId,
          duration: 6000,
        });
      }
    } catch (error) {
      console.error("Auto attend error", error);
      toast.error("Lỗi kết nối", { id: toastId });
    } finally {
      setAttending(false);
    }
  };

  const handleRangeRevert = async () => {
    if (!revertMyTick && !revertStudentTicks) {
      toast.error("Vui lòng chọn ít nhất 1 mục cần hủy (tick của tôi hoặc học sinh).");
      return;
    }

    const untilTs = revertUntilDt ? new Date(revertUntilDt).getTime() : Date.now();
    if (!Number.isFinite(untilTs)) {
      toast.error("Thời điểm kết thúc không hợp lệ!");
      return;
    }

    setReverting(true);
    const toastId = toast.loading("🔍 Đang quét các tiết khớp khoảng thời gian...");
    try {
      const idToken = await user?.getIdToken();
      // Bước 1: Preview danh sách tiết khớp khoảng
      const previewRes = await fetch("/api/classhub/debug/revert", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromYmd: revertFromDate,
          untilTs,
          previewOnly: true,
          includeMyTick: revertMyTick,
          includeStudentTicks: revertStudentTicks,
        }),
      });
      const previewData = await previewRes.json();
      if (previewData.logs) setLogs(previewData.logs);

      if (!previewData.success) {
        toast.error(previewData.error || previewData.message || "Lỗi khi quét tiết cần hủy", {
          id: toastId,
        });
        return;
      }

      const candidates = previewData.candidates || [];
      if (candidates.length === 0) {
        toast.success("Không có tiết nào của bạn nằm trong khoảng thời gian đã chọn.", {
          id: toastId,
        });
        return;
      }

      toast.dismiss(toastId);
      const previewLines = candidates
        .slice(0, 12)
        .map(
          (item: any, idx: number) =>
            `${idx + 1}. [${item.dateYmd}] ${item.label} (${
              item.role === "assistant" ? "GV phụ" : "GV chính"
            })`
        )
        .join("\n");
      const moreLine =
        candidates.length > 12 ? `\n... và ${candidates.length - 12} tiết khác.` : "";

      const confirmed = window.confirm(
        `Tìm thấy ${candidates.length} tiết của bạn từ ${revertFromDate} đến ${revertUntilDt.replace(
          "T",
          " "
        )}:\n\n${previewLines}${moreLine}\n\nThao tác sẽ thực hiện:\n` +
          `${revertMyTick ? '• Hủy tick "Có mặt" của chính bạn (status -> 0)\n' : ""}` +
          `${
            revertStudentTicks ? "• Xoá danh sách điểm danh học sinh (student_attendances -> [])\n" : ""
          }` +
          `• Mở chốt sổ (completed -> 0) và xoá lịch sử completed trên PEM để bạn test lại.\n\nBạn có chắc chắn muốn tiếp tục?`
      );
      if (!confirmed) return;

      const execToast = toast.loading(`🧪 Đang hủy điểm danh ${candidates.length} tiết...`);
      const execRes = await fetch("/api/classhub/debug/revert", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromYmd: revertFromDate,
          untilTs,
          previewOnly: false,
          includeMyTick: revertMyTick,
          includeStudentTicks: revertStudentTicks,
        }),
      });
      const execData = await execRes.json();
      if (execData.logs) setLogs(execData.logs);
      if (execData.state) setAutoState(execData.state);

      if (execData.success) {
        toast.success(
          `🎉 Đã hủy thành công ${execData.count}/${execData.totalCandidates} tiết (Bỏ qua: ${execData.skipped}, Lỗi: ${execData.errors})`,
          { id: execToast, duration: 6000 }
        );
        await fetchClasses();
      } else {
        toast.error(execData.error || "Có lỗi khi hủy điểm danh", { id: execToast });
      }
    } catch (e) {
      toast.error("Lỗi kết nối khi gọi API hủy điểm danh", { id: toastId });
    } finally {
      setReverting(false);
    }
  };

  if (!profile) return null;

  const todayYmd = getTodayYmdVN();
  const isDailyDoneToday = autoState.lastRunDate === todayYmd;

  // Chuẩn bị dữ liệu cho bảng "📅 Lịch điểm danh sắp tới" giống hệt Extension 3.8.11
  const upcomingItems: any[] = Array.isArray(autoState.upcomingClasses?.items)
    ? autoState.upcomingClasses.items
    : [];
  const nowTs = Date.now();
  const visibleUpcoming = upcomingItems.filter((item) => {
    const isDone = Boolean(autoState.completed?.[item.key]);
    const itemDate = item.date || todayYmd;
    // Tiết của ngày cũ đã xong thì ẩn cho gọn; tiết hôm nay hoặc tiết cũ chưa xong vẫn hiển thị
    if (itemDate < todayYmd && isDone) return false;
    return true;
  });

  const groupedByDate: Record<string, any[]> = {};
  for (const item of visibleUpcoming) {
    const d = item.date || todayYmd;
    if (!groupedByDate[d]) groupedByDate[d] = [];
    groupedByDate[d].push(item);
  }
  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  // Tính mốc báo thức kế tiếp
  const pendingTriggers = visibleUpcoming
    .filter((it) => {
      const isDone = Boolean(autoState.completed?.[it.key]);
      const failCount = autoState.failures?.[it.key]?.count || 0;
      return !isDone && failCount < 3 && Number(it.triggerTs || 0) > nowTs;
    })
    .sort((a, b) => Number(a.triggerTs) - Number(b.triggerTs));

  const nextTriggerItem = pendingTriggers[0];

  const renderRoleBadge = (role?: string) => {
    if (role === "main") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-bold border border-emerald-200">
          <UserCheck size={12} /> GV chính
        </span>
      );
    }
    if (role === "assistant") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-200">
          GV phụ (Co-teacher)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
        GV
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER CHÍNH */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <ClipboardCheck className="text-emerald-600" />
              ClassHub Pro Tool v3.8.11 (Bản Web Tự Chạy)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={14} /> Bật 1 Lần - Tự Chạy Trên Server (Không cần mở máy)
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Mặc định tự động kích hoạt cho mọi giáo viên đã liên kết tài khoản ClassHub: kể cả khi tắt hẳn máy tính/điện thoại, Server vẫn tự động quét lịch, canh giờ mở khoá (vào tiết + 5 phút) và chốt sổ lúc 16:15.
          </p>
          {teacher && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
              <span className="font-semibold text-slate-900">🪪 Giáo viên phiên hiện tại:</span>
              <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
                [{teacher.id || "?"}]
              </span>
              <span className="font-bold text-slate-800">{teacher.name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap gap-2.5 justify-end">
            <button
              onClick={() => fetchClasses()}
              disabled={loading || attending || reverting}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Search size={18} className={loading ? "animate-spin" : ""} />
              Quét lịch & lớp
            </button>

            <button
              onClick={() => handleAutoAttend(true, false)}
              disabled={loading || attending || reverting}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
              title="Kiểm tra bản ghi GV và kế hoạch chốt sổ mà KHÔNG ghi lên ClassHub"
            >
              {attending ? <Loader2 size={18} className="animate-spin" /> : <FlaskConical size={18} />}
              Chạy thử (Dry-Run)
            </button>

            <button
              onClick={() => handleAutoAttend(false, true)}
              disabled={loading || attending || reverting}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {attending ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              🚀 Điểm danh Siêu tốc Ngay
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <Terminal size={14} />
              {showLogs ? "Ẩn Log" : `Hiện Log (${logs.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* BẢNG ĐIỀU KHIỂN AUTO-ATTENDANCE (CHUẨN EXTENSION 3.8.11 - GẠT 1 LẦN TỰ CHẠY) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Công tắc 1: Tự bật Điểm danh Siêu tốc lúc 16:15 */}
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                ⏰ Tự bật Điểm danh Siêu tốc lúc 16:15
              </div>
              <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                Tự động quét và chốt toàn bộ các tiết trong ngày (kể cả tiết bù) vào 16:15 chiều hằng ngày.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(autoState.dailyCronEnabled)}
                disabled={savingConfig}
                onChange={(e) => {
                  const next = e.target.checked;
                  updateAutoSetting(
                    { dailyCronEnabled: next },
                    next ? "Đã BẬT tự động điểm danh lúc 16:15" : "Đã TẮT tự động điểm danh 16:15"
                  );
                }}
              />
              <div className="w-12 h-6 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/70 flex items-center justify-between text-xs text-amber-900">
            <label
              className="flex items-center gap-2 cursor-pointer select-none font-medium"
              title="Bỏ tích nếu bạn muốn ép hệ thống chạy lại lượt 16:15 ngay bây giờ"
            >
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                checked={isDailyDoneToday}
                disabled={savingConfig}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateAutoSetting(
                    { lastRunDate: checked ? todayYmd : "" },
                    checked ? "Đã đánh dấu hôm nay đã xong" : "Đã mở khoá để chạy lại lượt hôm nay"
                  );
                }}
              />
              <span>
                {isDailyDoneToday
                  ? "Hôm nay đã xong (Bỏ tích để chạy lại)"
                  : "Hôm nay chưa chạy (Tích để bỏ qua)"}
              </span>
            </label>
          </div>
        </div>

        {/* Công tắc 2: Bật Điểm danh Trong Tiết (Sau 5 phút vào tiết) */}
        <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                🏫 Bật Điểm danh Trong Tiết
              </div>
              <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">
                Tự động quét lịch dạy đầu ngày, đặt hẹn giờ <code className="bg-blue-100 px-1 rounded">giờ vào tiết + 5 phút</code> và tự chạy ngầm ngay khi mở khoá.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(autoState.inClassAutoEnabled)}
                disabled={savingConfig}
                onChange={(e) => {
                  const next = e.target.checked;
                  updateAutoSetting(
                    { inClassAutoEnabled: next, lastScoutDate: next ? "" : undefined },
                    next
                      ? "Đã BẬT Điểm danh Trong Tiết (Đang tự động quét lịch...)"
                      : "Đã TẮT Điểm danh Trong Tiết"
                  );
                }}
              />
              <div className="w-12 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-200/70 flex items-center justify-between text-xs text-blue-900">
            <span>
              Trạng thái:{" "}
              <strong className={autoState.inClassAutoEnabled ? "text-emerald-700" : "text-slate-500"}>
                {autoState.inClassAutoEnabled
                  ? `Đang bật (quét lịch: ${autoState.lastScoutDate || "đang chờ"})`
                  : "Đang tắt"}
              </strong>
            </span>
            <span className="text-[11px] text-blue-700 font-medium">Sau 5p vào tiết</span>
          </div>
        </div>

        {/* Cấu hình 3: Quét bù tiết cũ */}
        <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-bold text-indigo-950">🕰️ Quét bù tiết cũ</label>
              <select
                value={Number(autoState.catchUpDays) || 30}
                disabled={savingConfig}
                onChange={(e) => {
                  const days = Number(e.target.value) || 30;
                  updateAutoSetting(
                    { catchUpDays: days },
                    `Đã lưu độ sâu quét bù: ${days} ngày gần nhất`
                  );
                }}
                className="px-3 py-1.5 rounded-xl border border-indigo-300 bg-white text-indigo-950 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={7}>7 ngày gần nhất</option>
                <option value={14}>14 ngày gần nhất</option>
                <option value={30}>30 ngày (Mặc định)</option>
                <option value={60}>60 ngày (2 tháng)</option>
                <option value={90}>90 ngày (3 tháng)</option>
                <option value={180}>180 ngày (6 tháng)</option>
                <option value={365}>365 ngày (Cả năm học)</option>
              </select>
            </div>
            <p className="text-xs text-indigo-800/90 mt-2 leading-relaxed">
              Số ngày quá khứ tính từ hôm nay mà hệ thống sẽ lùi lại để tìm các tiết quên điểm danh hoặc chưa chốt sổ.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-indigo-200/70 flex items-center justify-between text-xs text-indigo-900">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-indigo-300 text-indigo-600"
                checked={forceSync}
                onChange={(e) => setForceSync(e.target.checked)}
              />
              <span>Bỏ qua bộ nhớ đệm khi quét tay</span>
            </label>
          </div>
        </div>
      </div>

      {/* WIDGET: 📅 LỊCH ĐIỂM DANH SẮP TỚI (CHUẨN EXTENSION 3.8.11) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarClock size={18} className="text-blue-600" />
              📅 Lịch điểm danh sắp tới & Bộ hẹn giờ tự động
            </h3>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {nextTriggerItem
                  ? `⏰ Báo thức kế tiếp: ${formatHmVN(nextTriggerItem.triggerTs)} (${pendingTriggers.length} mốc chờ)`
                  : autoState.inClassAutoEnabled
                  ? "✅ Đã hết mốc chờ mới trong ngày"
                  : "⏳ Bật 'Điểm danh Trong Tiết' để tự động canh giờ"}
              </span>
              {autoState.lastBatchRun && (
                <span>
                  · Lượt gần nhất {formatHmVN(autoState.lastBatchRun.at)}: Xong{" "}
                  <strong>{autoState.lastBatchRun.done || 0}</strong> · Chờ khoá{" "}
                  <strong>{autoState.lastBatchRun.locked || 0}</strong> · Lỗi{" "}
                  <strong className={autoState.lastBatchRun.errors ? "text-rose-600" : ""}>
                    {autoState.lastBatchRun.errors || 0}
                  </strong>
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => fetchClasses()}
            disabled={loading || attending}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            🔄 Quét lại lịch
          </button>
        </div>

        <div className="p-5">
          {!autoState.upcomingClasses ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Chưa có dữ liệu lịch dạy. Hãy bật <strong>🏫 Điểm danh Trong Tiết</strong> hoặc bấm{" "}
              <strong>🔄 Quét lại lịch</strong> để hệ thống lập lịch tự động.
            </div>
          ) : visibleUpcoming.length === 0 ? (
            <div className="text-center py-6 text-emerald-700 font-medium text-sm">
              🎉 Tất cả các tiết cũ đã hoàn tất, hôm nay không còn tiết chờ điểm danh!
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {sortedDates.map((dateKey) => {
                const dayItems = groupedByDate[dateKey] || [];
                const isToday = dateKey === todayYmd;
                return (
                  <div key={dateKey} className="space-y-2">
                    <div
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg inline-block ${
                        isToday
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {formatDateLabelVN(dateKey, todayYmd)} · {dayItems.length} tiết
                    </div>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {dayItems.map((item: any, idx: number) => {
                        const isDone = Boolean(autoState.completed?.[item.key]);
                        const failInfo = autoState.failures?.[item.key];
                        const failCount = failInfo?.count || 0;
                        const isBlocked = failCount >= 3;
                        const isCatchUp = (item.date || todayYmd) < todayYmd;
                        const isDue = nowTs >= Number(item.triggerTs || 0);

                        let badge = null;
                        if (isDone) {
                          badge = (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✅ Xong
                            </span>
                          );
                        } else if (isBlocked) {
                          badge = (
                            <span
                              className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200"
                              title={failInfo?.lastReason || "Lỗi liên tiếp 3 lần"}
                            >
                              ⛔ Cần xử lý tay ({failCount}/3)
                            </span>
                          );
                        } else if (failCount > 0) {
                          badge = (
                            <span
                              className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"
                              title={failInfo?.lastReason || ""}
                            >
                              ⚠️ Lỗi {failCount}/3
                            </span>
                          );
                        } else if (isCatchUp) {
                          badge = (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              ⏰ Bù
                            </span>
                          );
                        } else if (isDue) {
                          badge = (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              🔄 Đến lượt
                            </span>
                          );
                        } else {
                          badge = (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              ⏳ Chờ tới giờ
                            </span>
                          );
                        }

                        return (
                          <div
                            key={item.key || idx}
                            className="px-4 py-2.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                {formatHmVN(item.triggerTs)}
                              </span>
                              <span className="font-medium text-slate-800 truncate">
                                {item.label}
                              </span>
                              {item.role === "assistant" && (
                                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                                  GV phụ
                                </span>
                              )}
                            </div>
                            <div className="shrink-0">{badge}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CÔNG CỤ TEST: HỦY NHANH ĐIỂM DANH TRONG KHOẢNG (CHUẨN EXTENSION 3.8.11) */}
      <div className="bg-rose-50/60 border border-rose-200 border-dashed rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTestPanel((v) => !v)}
          className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-rose-100/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-extrabold text-rose-900 uppercase tracking-wide">
            <RotateCcw size={15} className="text-rose-700" />
            <span>🧪 CÔNG CỤ TEST: HỦY NHANH ĐIỂM DANH TRONG KHOẢNG (CHUẨN EXTENSION 3.8.11)</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-rose-700">
            <span>{showTestPanel ? "Thu gọn" : "Mở rộng"}</span>
            {showTestPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showTestPanel && (
          <div className="px-6 pb-5 pt-2 border-t border-rose-200/70 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-rose-900 mb-1">
                  Từ ngày (quét các tiết từ ngày này):
                </label>
                <input
                  type="date"
                  value={revertFromDate}
                  onChange={(e) => setRevertFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-slate-800 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-900 mb-1">
                  Đến thời điểm (mặc định cuối ngày hôm nay):
                </label>
                <input
                  type="datetime-local"
                  value={revertUntilDt}
                  onChange={(e) => setRevertUntilDt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-slate-800 text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-rose-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={revertMyTick}
                  onChange={(e) => setRevertMyTick(e.target.checked)}
                  className="w-4 h-4 rounded border-rose-400 text-rose-600"
                />
                <span>Hủy cả tick &quot;Có mặt&quot; của tôi (status -&gt; 0)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-rose-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={revertStudentTicks}
                  onChange={(e) => setRevertStudentTicks(e.target.checked)}
                  className="w-4 h-4 rounded border-rose-400 text-rose-600"
                />
                <span>Xoá cả điểm danh học sinh (student_attendances -&gt; [])</span>
              </label>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <p className="text-[11px] text-rose-800">
                * Hệ thống sẽ quét và hiện danh sách các tiết khớp khoảng để bạn xác nhận trước khi hủy thật.
              </p>
              <button
                type="button"
                onClick={handleRangeRevert}
                disabled={reverting || loading || attending}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                {reverting ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                🧪 HỦY NHANH CÁC TIẾT TRONG KHOẢNG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* THỐNG KÊ NHANH PHIÊN QUÉT */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Cần điểm danh ngay</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {summary.readyCount}
              {summary.catchUpCount > 0 && (
                <span className="ml-2 text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {summary.catchUpCount} tiết bù
                </span>
              )}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Chưa tới giờ mở khoá</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{summary.lockedCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Đã hoàn tất</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.doneCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Tạm dừng (lỗi ≥ 3 lần)</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{summary.blockedCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Lớp GV khác (đã lọc bỏ)</div>
            <div className="text-2xl font-bold text-slate-600 mt-1">{summary.notMineCount}</div>
          </div>
        </div>
      )}

      {/* DANH SÁCH CHI TIẾT CÁC TIẾT CẦN ĐIỂM DANH NGAY */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">
              Danh sách tiết cần xử lý tức thời đang trống
            </h3>
            <p className="text-sm text-slate-500">
              Khi bạn bật công tắc <strong>🏫 Điểm danh Trong Tiết</strong> hoặc{" "}
              <strong>⏰ Tự bật lúc 16:15</strong> ở trên, web sẽ tự động quét và điểm danh ngầm mà không cần bấm tay.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
                  <th className="py-4 px-6">Lớp học / Mã tiết</th>
                  <th className="py-4 px-6">Môn / Tiết</th>
                  <th className="py-4 px-6">Vai trò</th>
                  <th className="py-4 px-6">Thời gian</th>
                  <th className="py-4 px-6">Trạng thái / Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls, idx) => {
                  const detail = runDetails[String(cls.id)];
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {cls.className}
                          {cls.isCatchUp && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-bold border border-amber-200">
                              Tiết bù
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-1">
                          MasterKey: {cls.id} {cls.slotId && cls.slotId !== cls.id ? `(Slot: ${cls.slotId})` : ""}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-slate-700">{cls.moduleName || cls.code}</span>
                        {cls.raw_data?.class_hour_code && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">
                            {cls.raw_data.class_hour_code}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">{renderRoleBadge(cls.role)}</td>
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-slate-700">
                          {cls.dateYmd || cls.raw_data?.class_schedule_date || cls.raw_data?.date}
                        </div>
                        <div className="text-xs text-slate-500">
                          {cls.raw_data?.class_hour_start_time} - {cls.raw_data?.class_hour_end_time}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1.5">
                          {!detail ? (
                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg w-fit border border-amber-200">
                              <AlertTriangle size={14} />
                              <span className="text-xs font-bold">
                                {cls.queueReasons?.length > 0 ? cls.queueReasons.join(" · ") : "Chưa điểm danh"}
                              </span>
                            </div>
                          ) : detail.status === "dry_run" ? (
                            <div className="text-xs bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-2 rounded-lg space-y-1">
                              <div className="font-bold flex items-center gap-1">
                                <FlaskConical size={13} /> {detail.reason}
                              </div>
                              {detail.plan && (
                                <div className="font-mono text-[11px] text-indigo-700">
                                  Bản ghi GV: [{detail.plan.teacherRecordIds?.join(", ") || "không"}] | Cần tick: [
                                  {detail.plan.pendingTickIds?.join(", ") || "0"}]
                                </div>
                              )}
                            </div>
                          ) : detail.status === "success" || detail.status === "done" ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit border border-emerald-200">
                              <CheckCircle size={14} />
                              <span className="text-xs font-bold">
                                Thành công {detail.durationMs ? `(${(detail.durationMs / 1000).toFixed(1)}s)` : ""}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg w-fit border border-rose-200">
                              <AlertTriangle size={14} />
                              <span className="text-xs font-bold">{detail.error || detail.reason || "Lỗi"}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NHẬT KÝ THỰC THI */}
      {showLogs && logs.length > 0 && (
        <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
          <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <Terminal size={15} />
              <span>Nhật ký thực thi ClassHub Engine 3.8.11 ({logs.length} dòng)</span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Xoá log
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-1 leading-relaxed">
            {logs.map((line, i) => (
              <div key={i} className="text-slate-300 break-words">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
