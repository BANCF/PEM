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
      // Tránh spam liên tục nếu vừa chạy < 15 giây trước (trừ khi user vừa gạt nút)
      if (reason === "interval" && Date.now() - lastTriggerAtRef.current < 25000) {
        return;
      }

      busyRef.current = true;
      try {
        const idToken = await user.getIdToken();
        const cfgRes = await fetch("/api/classhub/auto-config", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!cfgRes.ok) return;
        const cfg = await cfgRes.json();
        if (!cfg.success || !cfg.hasCredentials || !cfg.data) return;

        let state = cfg.data;
        const { ymd, hour, minute, ts } = getVietnamNow();

        // 1. Nếu bật Điểm danh Trong Tiết mà hôm nay chưa quét lịch -> tự động quét lịch (Scout)
        if (state.inClassAutoEnabled && (state.lastScoutDate !== ymd || !state.upcomingClasses)) {
          const scoutRes = await fetch("/api/classhub/sync/classes", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const scoutData = await scoutRes.json();
          if (scoutData.success && scoutData.state) {
            state = scoutData.state;
            window.dispatchEvent(new CustomEvent("classhub-state-synced", { detail: scoutData }));
          }
        }

        // 2. Kiểm tra điều kiện chạy mốc 16:15 hằng ngày
        const isPast1615 = hour > 16 || (hour === 16 && minute >= 15);
        const shouldRunDaily1615 =
          Boolean(state.dailyCronEnabled) && isPast1615 && state.lastRunDate !== ymd;

        // 3. Kiểm tra điều kiện chạy Điểm danh Trong Tiết (tiết đã tới giờ mở khoá start + 5p)
        const dueItems =
          state.inClassAutoEnabled && Array.isArray(state.upcomingClasses?.items)
            ? state.upcomingClasses.items.filter((it: any) => {
                const isDone = Boolean(state.completed?.[it.key]);
                const failCount = state.failures?.[it.key]?.count || 0;
                const isBlocked = failCount >= 3;
                return !isDone && !isBlocked && ts >= Number(it.triggerTs || 0);
              })
            : [];

        if (shouldRunDaily1615 || dueItems.length > 0) {
          lastTriggerAtRef.current = Date.now();
          const triggerSource = shouldRunDaily1615 ? "daily_1615" : "in_class";
          const label = shouldRunDaily1615
            ? "⏰ Tự động Điểm danh 16:15 đang chạy nền..."
            : `🏫 Tự động Điểm danh Trong Tiết (${dueItems.length} tiết đến giờ)...`;

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

    // Chạy ngay sau 2s khi vào web và lặp lại mỗi 40s
    const initTimer = setTimeout(() => tick("init"), 2000);
    const interval = setInterval(() => tick("interval"), 40000);

    const onConfigUpdated = () => {
      tick("manual_toggle");
    };
    window.addEventListener("classhub-config-updated", onConfigUpdated);

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener("classhub-config-updated", onConfigUpdated);
    };
  }, [user, profile, actualProfile]);

  return null;
}

