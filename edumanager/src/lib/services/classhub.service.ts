import { adminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';
import { ClasshubAPI, type SubmitAttendanceResult } from './classhub.api';
import {
    type ClasshubUserState,
    DEFAULT_CATCH_UP_DAYS,
    type UpcomingClassItem,
    catchUpMinYmd,
    createEmptyState,
    pruneState,
    runPool
} from './classhub/state';
import { getClassKey, getClassLabel, getMyRole, isExcludedByTeacherName } from './classhub/identity';
import { decodeOhkeText } from './classhub/text';
import { extractClassDateYmd, getClassUnlockInfo, ymdVN } from './classhub/time';

const IDCLOUD_LOGIN_URL = 'https://idcloud.vn/61892/appstart/digitalismspace/jsonPostSignIn';
const RUN_LOCK_TTL_MS = 65 * 1000; // Khoá chống chạy chồng 65s
const TIME_BUDGET_MS = 26 * 1000;  // Ngân sách thực thi 26s cho vòng lặp điểm danh (đảm bảo tổng thời gian luôn < 45s, dưới ngưỡng 60s của Vercel)

export interface PushAttendanceParams {
    forceSync?: boolean;
    catchUpDays?: number;
    targetClasses?: any[];
    targetKeys?: string[];
    classId?: string;
    dryRun?: boolean;
    triggerSource?: 'manual' | 'in_class' | 'daily_1615' | 'cron';
}

export class ClassHubService {
    static async getAutoConfig(uid: string): Promise<{ state: ClasshubUserState; hasCredentials: boolean }> {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) throw new Error('User not found');
        const userData = userDoc.data() || {};
        const state = pruneState(userData.classhubAttendanceState || createEmptyState());
        const hasCredentials = Boolean(userData.classhubUsername && userData.classhubPassword);
        return { state, hasCredentials };
    }

    static async updateAutoConfig(
        uid: string,
        patch: Partial<Pick<ClasshubUserState, 'dailyCronEnabled' | 'inClassAutoEnabled' | 'catchUpDays' | 'lastRunDate' | 'lastScoutDate'>>
    ): Promise<ClasshubUserState> {
        const { state } = await this.getAutoConfig(uid);
        if (patch.dailyCronEnabled !== undefined) state.dailyCronEnabled = Boolean(patch.dailyCronEnabled);
        if (patch.inClassAutoEnabled !== undefined) {
            state.inClassAutoEnabled = Boolean(patch.inClassAutoEnabled);
            if (!state.inClassAutoEnabled) {
                state.lastScoutDate = '';
            }
        }
        if (patch.catchUpDays !== undefined) {
            const val = Number(patch.catchUpDays);
            if (Number.isFinite(val) && val >= 1 && val <= 365) {
                state.catchUpDays = val;
            }
        }
        if (patch.lastRunDate !== undefined) {
            state.lastRunDate = patch.lastRunDate || '';
        }
        if (patch.lastScoutDate !== undefined) {
            state.lastScoutDate = patch.lastScoutDate || '';
        }
        await this.saveUserState(uid, state);
        return pruneState(state);
    }

    static async getValidSession(uid: string): Promise<{ cookie: string; state: ClasshubUserState }> {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) throw new Error('User not found');

        const userData = userDoc.data();
        if (!userData?.classhubUsername || !userData?.classhubPassword) {
            throw new Error('Tài khoản chưa cấu hình ClassHub. Vui lòng vào Hồ sơ cá nhân để liên kết.');
        }

        const state = pruneState(userData.classhubAttendanceState || createEmptyState());
        const username = userData.classhubUsername;
        const rawPassword = Buffer.from(userData.classhubPassword, 'base64').toString('utf8');
        const password = crypto.createHash('sha256').update(rawPassword).digest('hex');

        const response = await fetch(IDCLOUD_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'ohke-ajax': '1',
                'User-Agent': 'Mozilla/5.0'
            },
            body: JSON.stringify({
                'login-form': { username, password, remember_me: '1' }
            })
        });

        if (!response.ok) throw new Error(`ClassHub Login Failed with status ${response.status}`);
        const setCookieHeader = response.headers.get('set-cookie');
        if (!setCookieHeader) throw new Error('Đăng nhập ClassHub thành công nhưng không lấy được Cookie');

        await adminDb.collection('users').doc(uid).update({
            classhubCookie: setCookieHeader,
            classhubLastVerified: new Date().toISOString(),
            classhubStatus: 'CONNECTED'
        });

        return { cookie: setCookieHeader, state };
    }

    static async saveUserState(uid: string, state: ClasshubUserState): Promise<void> {
        try {
            const pruned = pruneState(state);
            await adminDb.collection('users').doc(uid).update({
                classhubAttendanceState: pruned
            });
        } catch (e) {
            console.error('[ClassHubService] Không thể lưu classhubAttendanceState:', e);
        }
    }

    static async fetchClasses(uid: string, forceSync = false, catchUpDaysOverride?: number) {
        const { cookie, state } = await this.getValidSession(uid);
        if (catchUpDaysOverride && Number.isFinite(catchUpDaysOverride) && catchUpDaysOverride >= 1 && catchUpDaysOverride <= 365) {
            state.catchUpDays = catchUpDaysOverride;
        }
        const daysBack = forceSync ? Math.max(30, state.catchUpDays || DEFAULT_CATCH_UP_DAYS) : (state.catchUpDays || DEFAULT_CATCH_UP_DAYS);

        console.log('[ClassHub 3.8.11] Fetching classes. ForceSync:', forceSync, 'daysBack:', daysBack);
        const api = new ClasshubAPI('61892', '', cookie, (msg: string) => console.log(msg), state);

        // 1. Xác định danh tính Giáo viên (ID + Họ tên từ Ohke.worker)
        const identity = await api.requireIdentity();

        // 2. Quét danh sách các tiết từ các tab _Model chuẩn 3.8.11
        const allClasses = await api.scanAllClasses({
            daysBack,
            daysAhead: 6,
            maxPages: Math.max(30, Math.ceil(daysBack / 2))
        });

        // 3. Phân loại tiết học theo vai trò ID, trạng thái sổ GV/HS và giờ mở khoá
        const classified = api.classifyAllClasses(allClasses, 5, {
            minDateYmd: catchUpMinYmd(daysBack),
            ignoreBlock: forceSync,
            ignoreCompletedCache: forceSync
        });

        // 4. Lưu lịch điểm danh sắp tới (syncScheduleToBackground chuẩn 3.8.11)
        const now = Date.now();
        const upcomingItems: UpcomingClassItem[] = [];
        for (const item of [...classified.ready, ...classified.locked]) {
            const unlockTs = item.unlockInfo.unlockTimestamp;
            if (!Number.isFinite(unlockTs)) continue;
            const triggerTimeMs = Math.ceil(Math.max(unlockTs, now) / 60000) * 60000;
            const entity = item.entity || {};
            upcomingItems.push({
                key: item.id,
                label: item.label || getClassLabel(entity),
                className: decodeOhkeText(entity.student_class_name || entity.class_name || 'Lớp học'),
                date: item.unlockInfo?.dateYmd || String(entity.class_schedule_date || '').slice(0, 10),
                triggerTs: triggerTimeMs,
                unlockTime: item.unlockInfo?.timeString || '',
                role: item.role,
                isCatchUp: Boolean(item.isCatchUp)
            });
        }

        api.state.upcomingClasses = {
            scannedAt: now,
            items: upcomingItems
        };
        api.state.lastScoutDate = ymdVN();
        api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
        await this.saveUserState(uid, api.state);

        const mapItemForFrontend = (c: any, isLocked = false) => {
            const entity = c.entity || {};
            return {
                id: c.id,
                slotId: c.slotId || c.id,
                className: decodeOhkeText(entity.student_class_name || entity.class_name || 'Lớp học'),
                moduleName: decodeOhkeText(entity.module_name || entity.__study_module_code || entity.study_module_code || ''),
                code: decodeOhkeText(entity.code || entity.class_hour_code || ''),
                numberOfStudents: parseInt(entity.number_of_students || '0', 10),
                studyClassStatus: entity.attendance_sheet_status || entity.status,
                teacherSheetStatus: entity.instructor_attendance_status || entity.instructor_attendance_sheet_status || '',
                role: c.role,
                isCatchUp: Boolean(c.isCatchUp),
                isLocked,
                unlockTime: c.unlockInfo?.timeString || '',
                unlockTimestamp: c.unlockInfo?.unlockTimestamp,
                dateYmd: c.unlockInfo?.dateYmd || String(entity.class_schedule_date || '').slice(0, 10),
                label: c.label || getClassLabel(entity),
                queueReasons: c.queueReasons || [],
                failCount: c.failCount || 0,
                raw_data: entity,
                raw_classItem: {
                    id: c.id,
                    slotId: c.slotId,
                    sourceApi: c.sourceApi,
                    entity
                }
            };
        };

        const resultClasses = classified.ready.map(c => mapItemForFrontend(c, false));
        const lockedClasses = classified.locked.map(c => mapItemForFrontend(c, true));

        return {
            success: true,
            message: 'Lấy danh sách lớp thành công',
            teacher: identity,
            state: pruneState(api.state),
            summary: {
                readyCount: classified.ready.length,
                lockedCount: classified.locked.length,
                doneCount: classified.doneCount,
                blockedCount: classified.blockedCount,
                catchUpCount: classified.catchUpCount,
                outOfRangeCount: classified.outOfRangeCount,
                notMineCount: classified.notMineCount
            },
            data: resultClasses,
            lockedData: lockedClasses,
            logs: api.logBuffer || []
        };
    }

    static async pushAttendance(
        uid: string,
        forceSyncOrParams: boolean | PushAttendanceParams = false,
        legacyTargetClasses?: any[]
    ) {
        const params: PushAttendanceParams =
            typeof forceSyncOrParams === 'boolean'
                ? {
                      forceSync: forceSyncOrParams,
                      targetClasses: legacyTargetClasses
                  }
                : forceSyncOrParams;

        const forceSync = Boolean(params.forceSync);
        const dryRun = Boolean(params.dryRun);

        let api: ClasshubAPI | null = null;
        try {
            const { cookie, state } = await this.getValidSession(uid);
            if (params.catchUpDays && Number.isFinite(params.catchUpDays)) {
                state.catchUpDays = Number(params.catchUpDays);
            }

            // Khoá chống chạy chồng (tương tự isGhostRunning của background.js 3.8.11)
            if (!dryRun && state.runLockUntil && Date.now() < state.runLockUntil) {
                const remainSec = Math.ceil((state.runLockUntil - Date.now()) / 1000);
                state.lastBatchRun = {
                    at: Date.now(),
                    result: 'postponed',
                    message: `Đang có lượt chạy khác (còn ~${remainSec}s)`
                };
                await this.saveUserState(uid, state);
                return {
                    success: false,
                    busy: true,
                    state: pruneState(state),
                    message: `Đang có một tiến trình điểm danh khác đang chạy cho tài khoản này (còn ~${remainSec}s). Vui lòng đợi hoàn tất.`
                };
            }

            if (!dryRun) {
                state.runLockUntil = Date.now() + RUN_LOCK_TTL_MS;
                await this.saveUserState(uid, state);
            }

            api = new ClasshubAPI('61892', '', cookie, (msg: string) => console.log(msg), state);
            const identity = await api.requireIdentity();

            let myClasses: any[] = [];
            const requestedKeys = new Set<string>(
                [
                    ...(params.targetKeys || []),
                    ...(params.classId ? [String(params.classId).trim()] : [])
                ].filter(Boolean)
            );

            if (params.targetClasses && Array.isArray(params.targetClasses) && params.targetClasses.length > 0 && requestedKeys.size === 0) {
                for (const rawItem of params.targetClasses) {
                    const entity = rawItem?.entity || rawItem;
                    if (!entity) continue;
                    const masterKey = getClassKey(entity) || String(rawItem.id || '');
                    if (!masterKey) continue;
                    const role = getMyRole(entity, identity.id);
                    if (role === 'none' || (role === 'unknown' && isExcludedByTeacherName(entity, identity))) {
                        api.log(`⚠️ Bỏ qua tiết [${masterKey}] do không thuộc danh sách giảng dạy của [${identity.id}] ${identity.name}.`);
                        continue;
                    }
                    const unlockInfo = getClassUnlockInfo(entity, 5);
                    if (!unlockInfo.isSafe) {
                        api.log(`⏳ Bỏ qua tiết [${masterKey}] do chưa đến giờ mở khoá (${unlockInfo.timeString}).`);
                        continue;
                    }
                    myClasses.push({
                        id: masterKey,
                        sourceApi: rawItem.sourceApi || entity.sourceApi || '',
                        entity
                    });
                }
            } else {
                const daysBack = forceSync
                    ? Math.max(30, api.state.catchUpDays || DEFAULT_CATCH_UP_DAYS)
                    : (api.state.catchUpDays || DEFAULT_CATCH_UP_DAYS);

                const allClasses = await api.scanAllClasses({
                    daysBack,
                    daysAhead: 6,
                    maxPages: Math.max(30, Math.ceil(daysBack / 2))
                });
                const classified = api.classifyAllClasses(allClasses, 5, {
                    minDateYmd: catchUpMinYmd(daysBack),
                    ignoreBlock: forceSync || requestedKeys.size > 0,
                    ignoreCompletedCache: forceSync || requestedKeys.size > 0
                });

                // Cập nhật luôn upcomingClasses khi chạy ngầm
                const now = Date.now();
                api.state.upcomingClasses = {
                    scannedAt: now,
                    items: [...classified.ready, ...classified.locked]
                        .filter(item => Number.isFinite(item.unlockInfo.unlockTimestamp))
                        .map(item => ({
                            key: item.id,
                            label: item.label || getClassLabel(item.entity || {}),
                            className: decodeOhkeText(item.entity?.student_class_name || item.entity?.class_name || 'Lớp học'),
                            date: item.unlockInfo?.dateYmd || String(item.entity?.class_schedule_date || '').slice(0, 10),
                            triggerTs: Math.ceil(Math.max(item.unlockInfo.unlockTimestamp, now) / 60000) * 60000,
                            unlockTime: item.unlockInfo?.timeString || '',
                            role: item.role,
                            isCatchUp: Boolean(item.isCatchUp)
                        }))
                };
                api.state.lastScoutDate = ymdVN();

                myClasses = classified.ready;

                if (requestedKeys.size > 0) {
                    myClasses = myClasses.filter(c => {
                        const entity = c.entity || {};
                        return (
                            requestedKeys.has(String(c.id)) ||
                            requestedKeys.has(String(c.slotId)) ||
                            requestedKeys.has(String(entity.study_class_id)) ||
                            requestedKeys.has(String(entity.class_schedule_slot_id))
                        );
                    });
                }
            }

            if (myClasses.length === 0) {
                api.state.runLockUntil = 0;
                api.state.lastBatchRun = {
                    at: Date.now(),
                    result: 'opened',
                    message: 'Không có tiết nào cần điểm danh ngay'
                };
                api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
                await this.saveUserState(uid, api.state);
                return {
                    success: true,
                    teacher: identity,
                    state: pruneState(api.state),
                    message: 'Tất cả các lớp đã được điểm danh hoặc chưa đến giờ mở khoá.',
                    summary: { total: 0, successCount: 0, skippedCount: 0, errorCount: 0, dryRun },
                    details: [],
                    logs: api.logBuffer || []
                };
            }

            // Ưu tiên điểm danh các tiết HÔM NAY và tiết mới nhất trước, tiết bù tháng cũ xử lý cuốn chiếu theo từng đợt 10 tiết
            myClasses.sort((a: any, b: any) => {
                const aCatch = Boolean(a.isCatchUp);
                const bCatch = Boolean(b.isCatchUp);
                if (aCatch !== bCatch) return aCatch ? 1 : -1;
                const aTs = Number(a.unlockInfo?.unlockTimestamp || 0);
                const bTs = Number(b.unlockInfo?.unlockTimestamp || 0);
                return bTs - aTs;
            });

            const totalReadyCount = myClasses.length;
            const MAX_CLASSES_PER_BATCH = 10;
            let stoppedByBudget = totalReadyCount > MAX_CLASSES_PER_BATCH;
            if (stoppedByBudget) {
                myClasses = myClasses.slice(0, MAX_CLASSES_PER_BATCH);
            }

            const startTs = Date.now();
            const details: SubmitAttendanceResult[] = [];
            let successCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            await runPool(
                myClasses,
                async classItem => {
                    if (Date.now() - startTs > TIME_BUDGET_MS) {
                        stoppedByBudget = true;
                        return;
                    }
                    const res = await api!.submitAttendanceFlow(classItem, false, { dryRun });
                    details.push(res);
                    if (res.status === 'success' || res.status === 'dry_run') {
                        successCount++;
                    } else if (res.status === 'skipped' || res.status === 'done') {
                        skippedCount++;
                    } else {
                        errorCount++;
                    }
                },
                {
                    concurrency: 5,
                    shouldContinue: () => Date.now() - startTs <= TIME_BUDGET_MS
                }
            );

            // Đóng dấu hoàn thành trong ngày nếu đã sau 16:15 giờ VN và không có tiết lỗi (3.8.11 markDailyDoneIfComplete)
            if (!dryRun && errorCount === 0 && !stoppedByBudget) {
                const vnParts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(new Date()).split(':');
                const h = parseInt(vnParts[0], 10) || 0;
                const m = parseInt(vnParts[1], 10) || 0;
                if (h > 16 || (h === 16 && m >= 15)) {
                    api.state.lastRunDate = ymdVN();
                    api.log(`📅 Đã đóng dấu hoàn thành điểm danh cho ngày hôm nay (${api.state.lastRunDate}).`);
                }
            }

            api.state.runLockUntil = 0;
            if (!dryRun) {
                api.state.lastBatchRun = {
                    at: Date.now(),
                    result: 'opened',
                    message: `Chốt thành công ${successCount}/${myClasses.length} tiết`
                };
                api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
                await this.saveUserState(uid, api.state);
            }

            const modePrefix = dryRun ? '[DRY-RUN] ' : '';
            const budgetNote = stoppedByBudget
                ? ' (Đã tạm dừng do chạm ngưỡng 50s, hãy bấm chạy tiếp cho các tiết còn lại)'
                : '';

            return {
                success: errorCount === 0,
                dryRun,
                teacher: identity,
                state: pruneState(api.state),
                message: `${modePrefix}Hoàn tất xử lý ${details.length}/${myClasses.length} tiết. Thành công: ${successCount}, Đã xong/Bỏ qua: ${skippedCount}, Lỗi: ${errorCount}${budgetNote}`,
                summary: {
                    total: myClasses.length,
                    processed: details.length,
                    successCount,
                    skippedCount,
                    errorCount,
                    stoppedByBudget,
                    dryRun
                },
                details,
                logs: api.logBuffer || []
            };
        } catch (error: any) {
            console.error('[ClassHub Push Attendance Error]', error);
            if (api && !dryRun) {
                api.state.runLockUntil = 0;
                api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
                await this.saveUserState(uid, api.state);
            }
            return {
                success: false,
                code: error.code || undefined,
                message: error.message || 'Lỗi khi điểm danh tự động',
                logs: api?.logBuffer || []
            };
        }
    }

    static async revertFutureClassesDev(
        uid: string,
        options: {
            includeMyTick?: boolean;
            includeStudentTicks?: boolean;
            targetKeys?: string[];
            fromYmd?: string;
            untilTs?: number;
            previewOnly?: boolean;
        } = {}
    ) {
        try {
            const { cookie, state } = await this.getValidSession(uid);
            const api = new ClasshubAPI('61892', '', cookie, (msg: string) => console.log(msg), state);
            const identity = await api.requireIdentity();

            // Chế độ Công cụ Test chuẩn 3.8.11: tìm/hủy các tiết trong khoảng [fromYmd, untilTs]
            if (options.fromYmd && Number.isFinite(options.untilTs)) {
                const fromYmd = String(options.fromYmd).slice(0, 10);
                const untilTs = Number(options.untilTs);
                const diffDays = Math.max(7, Math.ceil((Date.now() - new Date(fromYmd).getTime()) / 86400000) + 2);
                const allClasses = await api.scanAllClasses({
                    daysBack: Math.min(365, diffDays),
                    daysAhead: 7,
                    maxPages: 40
                });

                const matched: Array<{
                    id: string;
                    date: string;
                    label: string;
                    startTs: number;
                    sourceApi: string;
                    entity: any;
                }> = [];
                const seen = new Set<string>();

                for (const item of allClasses) {
                    const entity = item.entity || item;
                    const key = getClassKey(entity);
                    if (!key || seen.has(key)) continue;
                    seen.add(key);

                    const role = getMyRole(entity, identity.id);
                    if (role === 'none' || (role === 'unknown' && isExcludedByTeacherName(entity, identity))) continue;

                    const dateYmd = extractClassDateYmd(entity) || String(entity.class_schedule_date || '').slice(0, 10);
                    if (!dateYmd || dateYmd < fromYmd) continue;

                    const unlock = getClassUnlockInfo(entity, 0);
                    if (!Number.isFinite(unlock.startTimestamp) || unlock.startTimestamp > untilTs) continue;

                    matched.push({
                        id: key,
                        date: dateYmd,
                        label: getClassLabel(entity),
                        startTs: unlock.startTimestamp,
                        sourceApi: item.sourceApi || '',
                        entity
                    });
                }

                matched.sort((a, b) => a.startTs - b.startTs);

                if (options.previewOnly) {
                    return {
                        success: true,
                        preview: true,
                        count: matched.length,
                        items: matched.map(m => ({ id: m.id, date: m.date, label: m.label })),
                        teacher: identity,
                        logs: api.logBuffer
                    };
                }

                let okCount = 0;
                await runPool(matched, async c => {
                    const r = await api.revertAttendanceFlow(c, '', {
                        includeMyTick: options.includeMyTick,
                        includeStudentTicks: options.includeStudentTicks
                    });
                    if (r.success) okCount++;
                });

                api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
                await this.saveUserState(uid, api.state);
                return {
                    success: okCount === matched.length,
                    count: okCount,
                    totalFound: matched.length,
                    teacher: identity,
                    state: pruneState(api.state),
                    logs: api.logBuffer
                };
            }

            if (options.targetKeys && options.targetKeys.length > 0) {
                const keySet = new Set(options.targetKeys.map(String));
                const allClasses = await api.scanAllClasses({ daysBack: 30, daysAhead: 14 });
                const targets = allClasses.filter(
                    c => keySet.has(String(c.id)) || keySet.has(String(c.slotId))
                );
                let okCount = 0;
                await runPool(targets, async c => {
                    const r = await api.revertAttendanceFlow(c, '', {
                        includeMyTick: options.includeMyTick,
                        includeStudentTicks: options.includeStudentTicks
                    });
                    if (r.success) okCount++;
                });
                api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
                await this.saveUserState(uid, api.state);
                return {
                    success: okCount === targets.length,
                    count: okCount,
                    totalFound: targets.length,
                    teacher: identity,
                    state: pruneState(api.state),
                    logs: api.logBuffer
                };
            }

            const res = await api.revertFutureClasses(undefined, {
                includeMyTick: options.includeMyTick,
                includeStudentTicks: options.includeStudentTicks
            });
            api.state.recentLogs = [...(api.state.recentLogs || []), ...(api.logBuffer || [])].slice(-30);
            await this.saveUserState(uid, api.state);
            return {
                ...res,
                teacher: identity,
                state: pruneState(api.state),
                logs: api.logBuffer
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    static async pushGrades(uid: string, payload: any) {
        console.log('[ClassHub] Pushing grades payload:', payload);
        return { success: true };
    }
}
