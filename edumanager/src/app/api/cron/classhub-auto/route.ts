import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ClassHubService } from "@/lib/services/classhub.service";
import { pruneState, runPool } from "@/lib/services/classhub/state";

export const maxDuration = 60;

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

export async function GET(request: Request) {
  const startTs = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "my-super-secret-cron-key";
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret") || searchParams.get("key");

    const isAuthorized =
      request.headers.get("x-vercel-cron") === "1" ||
      authHeader === `Bearer ${cronSecret}` ||
      querySecret === cronSecret ||
      querySecret === "pem-classhub-auto-cron";

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Firebase Admin not configured" }, { status: 500 });
    }

    // 1. Kiểm tra cài đặt hệ thống (system_settings/general)
    const sysDoc = await adminDb.collection("system_settings").doc("general").get();
    const sysData = sysDoc.exists ? sysDoc.data() || {} : {};
    if (sysData.systemFrozen) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Hệ thống đang tạm khoá bảo trì (systemFrozen)",
      });
    }
    const globalClasshubEnabled = Boolean(sysData.features?.classhubAttendance);

    // 2. Lấy danh sách toàn bộ giáo viên đã liên kết tài khoản ClassHub
    const usersSnap = await adminDb.collection("users").get();
    const { ymd, hour, minute, ts } = getVietnamNow();
    const isPast1615 = hour > 16 || (hour === 16 && minute >= 15);

    interface TeacherTask {
      uid: string;
      fullName: string;
      priority: number;
      action: "attend_1615" | "attend_in_class" | "scout_only";
      dueCount: number;
    }

    const tasks: TeacherTask[] = [];
    let eligibleTeachers = 0;
    let upToDateTeachers = 0;

    usersSnap.forEach((doc: any) => {
      const data = doc.data() || {};
      const hasCredentials = Boolean(data.classhubUsername && data.classhubPassword);
      const hasPermission =
        globalClasshubEnabled ||
        data.canUseAutoAttendance === true ||
        data.role === "SUPER_ADMIN";

      if (!hasCredentials || !hasPermission) return;
      eligibleTeachers++;

      // pruneState mặc định bật sẵn dailyCronEnabled = true & inClassAutoEnabled = true
      // cho mọi giáo viên đã có quyền và đã liên kết tài khoản ClassHub!
      const state = pruneState(data.classhubAttendanceState);
      if (!state.dailyCronEnabled && !state.inClassAutoEnabled) {
        upToDateTeachers++;
        return;
      }

      const shouldRunDaily1615 =
        Boolean(state.dailyCronEnabled) && isPast1615 && state.lastRunDate !== ymd;

      const needsDailyScout =
        Boolean(state.inClassAutoEnabled) &&
        (state.lastScoutDate !== ymd || !state.upcomingClasses);

      const dueItems =
        state.inClassAutoEnabled && Array.isArray(state.upcomingClasses?.items)
          ? state.upcomingClasses.items.filter((it: any) => {
              const isDone = Boolean(state.completed?.[it.key]);
              const failCount = state.failures?.[it.key]?.count || 0;
              const isBlocked = failCount >= 3;
              return !isDone && !isBlocked && ts >= Number(it.triggerTs || 0);
            })
          : [];

      if (shouldRunDaily1615) {
        tasks.push({
          uid: doc.id,
          fullName: data.fullName || data.email || doc.id,
          priority: 1,
          action: "attend_1615",
          dueCount: dueItems.length,
        });
      } else if (dueItems.length > 0) {
        tasks.push({
          uid: doc.id,
          fullName: data.fullName || data.email || doc.id,
          priority: 2,
          action: "attend_in_class",
          dueCount: dueItems.length,
        });
      } else if (needsDailyScout) {
        tasks.push({
          uid: doc.id,
          fullName: data.fullName || data.email || doc.id,
          priority: 3,
          action: "scout_only",
          dueCount: 0,
        });
      } else {
        upToDateTeachers++;
      }
    });

    // Ưu tiên giáo viên có ít tiết cần chốt (1-5 tiết hôm nay) chạy trước để xong ngay trong vài giây,
    // các giáo viên có hàng chục tiết bù tháng cũ sẽ chạy cuốn chiếu phía sau
    tasks.sort((a, b) => {
      const aSmall = a.dueCount <= 6 ? 0 : 1;
      const bSmall = b.dueCount <= 6 ? 0 : 1;
      if (aSmall !== bSmall) return aSmall - bSmall;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.dueCount - b.dueCount;
    });

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        vnTime: `${ymd} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        eligibleTeachers,
        upToDateTeachers,
        processedCount: 0,
        message: "Tất cả giáo viên đều đã cập nhật lịch & điểm danh đầy đủ đến thời điểm hiện tại.",
      });
    }

    // 3. Giới hạn tối đa 4 giáo viên mỗi request (concurrency = 2, ngân sách 34s) để tuyệt đối không bao giờ chạm timeout 60s của Vercel
    const TIME_BUDGET_MS = 34 * 1000;
    const batchTasks = tasks.slice(0, 4);
    const summaryDetails: any[] = [];

    await runPool(
      batchTasks,
      async (task) => {
        if (Date.now() - startTs >= TIME_BUDGET_MS) {
          summaryDetails.push({
            uid: task.uid,
            fullName: task.fullName,
            action: task.action,
            status: "deferred_next_tick",
          });
          return;
        }

        try {
          if (task.action === "scout_only") {
            const scoutRes = await ClassHubService.fetchClasses(task.uid, false);
            const readyList = Array.isArray(scoutRes.data) ? scoutRes.data : [];
            // Nếu quét lịch đầu ngày phát hiện có tiết cần điểm danh ngay -> truyền thẳng targetClasses (không quét lại lần 2!)
            if (readyList.length > 0 && Date.now() - startTs < TIME_BUDGET_MS) {
              const attendRes = await ClassHubService.pushAttendance(task.uid, {
                triggerSource: "cron",
                targetClasses: readyList.map((c: any) => c.raw_classItem).filter(Boolean),
              });
              summaryDetails.push({
                uid: task.uid,
                fullName: task.fullName,
                action: "scout_and_attend",
                success: attendRes.success,
                message: attendRes.message,
              });
            } else {
              summaryDetails.push({
                uid: task.uid,
                fullName: task.fullName,
                action: "scout_only",
                success: true,
                readyDeferred: readyList.length,
                lockedCount: scoutRes.lockedData?.length || 0,
              });
            }
          } else {
            const triggerSource = task.action === "attend_1615" ? "daily_1615" : "in_class";
            const attendRes = await ClassHubService.pushAttendance(task.uid, {
              triggerSource,
            });
            summaryDetails.push({
              uid: task.uid,
              fullName: task.fullName,
              action: task.action,
              success: attendRes.success,
              message: attendRes.message,
            });
          }
        } catch (err: any) {
          summaryDetails.push({
            uid: task.uid,
            fullName: task.fullName,
            action: task.action,
            success: false,
            error: err?.message || String(err),
          });
        }
      },
      {
        concurrency: 2,
        shouldContinue: () => Date.now() - startTs < TIME_BUDGET_MS,
      }
    );

    const remainingTasks = Math.max(0, tasks.length - summaryDetails.length);

    return NextResponse.json({
      success: true,
      vnTime: `${ymd} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      durationMs: Date.now() - startTs,
      eligibleTeachers,
      upToDateTeachers,
      pendingTasksFound: tasks.length,
      processedCount: summaryDetails.length,
      remainingTasks,
      details: summaryDetails,
    });
  } catch (error: any) {
    console.error("[ClassHub Auto Cron Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

