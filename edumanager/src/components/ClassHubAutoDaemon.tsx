"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

function getVietnamNow() {
  const now = new Date();
  const vnParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of vnParts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const ymd = `${map.year}-${map.month}-${map.day}`;
  const hour = Number(map.hour || 0);
  const minute = Number(map.minute || 0);
  return { ymd, hour, minute, ts: now.getTime() };
}

export default function ClassHubAutoDaemon() {
  const { user, profile, actualProfile } = useAuth();
  const busyRef = useRef(false);
  const lastTriggerAtRef = useRef<number>(0);
  const profileRef = useRef<any>(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!user || !profile) return;
    const canUse =
      profile.canUseAutoAttendance === true ||
      profile.role === "SUPER_ADMIN" ||
      actualProfile?.role === "SUPER_ADMIN";
    if (!canUse) return;

    let cancelled = false;

    const tick = async (reason = "interval") => {
      if (cancelled || busyRef.current) return;
      if (reason === "interval" && Date.now() - lastTriggerAtRef.current < 30000) {
        return;
      }

      // Đọc trực tiếp state từ AuthContext (onSnapshot) trong RAM -> Tốn 0 Firestore Read & 0 API request khi chờ giờ!
      const currentProfile = profileRef.current as any;
      if (!currentProfile?.classhubUsername || !currentProfile?.classhubPassword) {
        return;
      }

      const state = currentProfile?.classhubAttendanceState || {};
      if (!state.dailyCronEnabled && !state.inClassAutoEnabled) {
        return;
      }

      const { ymd, hour, minute, ts } = getVietnamNow();

      // 1. Kiểm tra xem hôm nay đã quét lịch đầu ngày chưa (chỉ chạy 1 lần/ngày khi bật In-Class Auto)
      const needsDailyScout =
        Boolean(state.inClassAutoEnabled) &&
        (state.lastScoutDate !== ymd || !state.upcomingClasses);

      // 2. Kiểm tra điều kiện chạy mốc 16:15 hằng ngày (chỉ chạy 1 lần/ngày)
      const isPast1615 = hour > 16 || (hour === 16 && minute >= 15);
      const shouldRunDaily1615 =
        Boolean(state.dailyCronEnabled) && isPast1615 && state.lastRunDate !== ymd;

      // 3. Kiểm tra xem có tiết nào đã tới mốc mở khoá (start + 5p) chưa (kiểm tra 100% trên RAM)
      const dueItems =
        state.inClassAutoEnabled && Array.isArray(state.upcomingClasses?.items)
          ? state.upcomingClasses.items.filter((it: any) => {
              const isDone = Boolean(state.completed?.[it.key]);
              const failCount = state.failures?.[it.key]?.count || 0;
              const isBlocked = failCount >= 3;
              return !isDone && !isBlocked && ts >= Number(it.triggerTs || 0);
            })
          : [];

      // Nếu chưa tới bất kỳ mốc nào -> thoát ngay lập tức (0 tốn Read/Write hay Serverless request)
      if (!needsDailyScout && !shouldRunDaily1615 && dueItems.length === 0) {
        return;
      }

      busyRef.current = true;
      lastTriggerAtRef.current = Date.now();
      try {
        const idToken = await user.getIdToken();

        if (needsDailyScout) {
          const scoutRes = await fetch("/api/classhub/sync/classes", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const scoutData = await scoutRes.json();
          if (scoutData.success) {
            window.dispatchEvent(new CustomEvent("classhub-state-synced", { detail: scoutData }));
          }
          // Nếu sau khi quét lịch xong không có tiết nào cần điểm danh ngay và chưa tới 16:15 thì dừng
          if (!shouldRunDaily1615 && (!Array.isArray(scoutData.data) || scoutData.data.length === 0)) {
            return;
          }
        }

        if (shouldRunDaily1615 || dueItems.length > 0 || needsDailyScout) {
          const triggerSource = shouldRunDaily1615 ? "daily_1615" : "in_class";
          const label = shouldRunDaily1615
            ? "⏰ Tự động Điểm danh 16:15 đang chạy nền..."
            : `🏫 Tự động Điểm danh Trong Tiết đang chạy nền...`;

          const toastId = toast.loading(label);
          const runRes = await fetch("/api/classhub/sync/attendance", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              triggerSource,
            }),
          });
          const runData = await runRes.json();
          if (runData.success) {
            toast.success(runData.message || "Tự động điểm danh hoàn tất!", {
              id: toastId,
              duration: 5000,
            });
          } else {
            toast.error(runData.message || "Lượt tự động điểm danh có tiết chưa chốt được", {
              id: toastId,
              duration: 5000,
            });
          }
          window.dispatchEvent(new CustomEvent("classhub-state-synced", { detail: runData }));
        }
      } catch (e) {
        console.warn("[ClassHubAutoDaemon] tick error:", e);
      } finally {
        busyRef.current = false;
      }
    };

    const initTimer = setTimeout(() => tick("init"), 2000);
    const interval = setInterval(() => tick("interval"), 30000);

    const onConfigUpdated = () => {
      lastTriggerAtRef.current = 0;
      setTimeout(() => tick("manual_toggle"), 500);
    };
    window.addEventListener("classhub-config-updated", onConfigUpdated);

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener("classhub-config-updated", onConfigUpdated);
    };
  }, [user, profile?.id, profile?.canUseAutoAttendance, profile?.role, actualProfile?.role]);

  return null;
}
