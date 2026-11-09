/**
 * Module quản lý trạng thái điểm danh (Cache hoàn tất 14 ngày, Bộ đếm lỗi 3 lần/ngày),
 * cấu hình Auto Hẹn giờ (16:15 & Trong Tiết), lịch điểm danh sắp tới (upcomingClasses),
 * phân loại tiết học (classifyClassesV33) và hàng đợi song song (runPoolV33).
 */

import {
    findMeInCoTeachers,
    getClassKey,
    getClassLabel,
    getMyRole,
    isDoneStatus,
    isExcludedByTeacherName,
    type TeacherIdentity,
    type TeacherRole
} from './identity';
import { addDaysYmdVN, extractClassDateYmd, getClassUnlockInfo, type UnlockInfo, ymdVN } from './time';

export const GHOST_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 ngày
export const DEFAULT_CATCH_UP_DAYS = 30;
export const CATCH_UP_DAYS = 30;
export const MAX_FAILS_PER_DAY = 3;
export const ATTENDANCE_CONCURRENCY = 5;

export interface UpcomingClassItem {
    key: string;
    label: string;
    className: string;
    date: string;
    triggerTs: number;
    unlockTime: string;
    role: TeacherRole;
    isCatchUp: boolean;
}

export interface ClasshubUserState {
    completed: Record<string, number>;
    failures: Record<string, { day: string; count: number }>;
    lastRunDate?: string;
    runLockUntil?: number;
    // Cấu hình Auto giống hệt Extension 3.8.11
    dailyCronEnabled?: boolean;
    inClassAutoEnabled?: boolean;
    catchUpDays?: number;
    lastScoutDate?: string;
    upcomingClasses?: {
        scannedAt: number;
        items: UpcomingClassItem[];
    } | null;
    lastBatchRun?: {
        at: number;
        result: string;
        message?: string;
    } | null;
    recentLogs?: string[];
}

export interface ClassifiedClassItem {
    id: string;
    slotId?: string;
    classCode: string;
    label: string;
    entity: any;
    sourceApi: string;
    unlockInfo: UnlockInfo;
    role: TeacherRole;
    isCatchUp: boolean;
    queueReasons: string[];
    failCount: number;
}

export interface ClassifyResult {
    ready: ClassifiedClassItem[];
    locked: ClassifiedClassItem[];
    doneCount: number;
    blockedCount: number;
    catchUpCount: number;
    outOfRangeCount: number;
    notMineCount: number;
}

export const createEmptyState = (): ClasshubUserState => ({
    completed: {},
    failures: {},
    dailyCronEnabled: false,
    inClassAutoEnabled: false,
    catchUpDays: DEFAULT_CATCH_UP_DAYS,
    upcomingClasses: null,
    lastBatchRun: null,
    recentLogs: []
});

export const pruneState = (raw?: Partial<ClasshubUserState> | null): ClasshubUserState => {
    const now = Date.now();
    const today = ymdVN();
    const completed: Record<string, number> = {};
    const failures: Record<string, { day: string; count: number }> = {};

    if (raw?.completed && typeof raw.completed === 'object') {
        for (const [key, val] of Object.entries(raw.completed)) {
            const ts = (val as any) === true ? now : Number(val);
            if (Number.isFinite(ts) && now - ts < GHOST_CACHE_TTL_MS) {
                completed[key] = ts;
            }
        }
    }

    if (raw?.failures && typeof raw.failures === 'object') {
        for (const [key, val] of Object.entries(raw.failures)) {
            if (val && val.day === today && Number(val.count) > 0) {
                failures[key] = { day: today, count: Number(val.count) };
            }
        }
    }

    const rawCatchUp = Number(raw?.catchUpDays);
    const catchUpDays =
        Number.isFinite(rawCatchUp) && rawCatchUp >= 1 && rawCatchUp <= 365
            ? rawCatchUp
            : DEFAULT_CATCH_UP_DAYS;

    const cleaned: ClasshubUserState = {
        completed,
        failures,
        lastRunDate: raw?.lastRunDate || '',
        runLockUntil: raw?.runLockUntil || 0,
        dailyCronEnabled: Boolean(raw?.dailyCronEnabled),
        inClassAutoEnabled: Boolean(raw?.inClassAutoEnabled),
        catchUpDays,
        lastScoutDate: raw?.lastScoutDate || '',
        upcomingClasses: raw?.upcomingClasses || null,
        lastBatchRun: raw?.lastBatchRun || null,
        recentLogs: Array.isArray(raw?.recentLogs) ? raw!.recentLogs.slice(-30) : []
    };

    return JSON.parse(JSON.stringify(cleaned));
};

export const isClassCachedInState = (state: ClasshubUserState, masterKey: string): boolean =>
    Boolean(state.completed[String(masterKey)]);

export const markClassCompletedInState = (state: ClasshubUserState, masterKey: string): void => {
    const key = String(masterKey);
    state.completed[key] = Date.now();
    delete state.failures[key];
};

export const unmarkClassCompletedInState = (state: ClasshubUserState, masterKey: string): void => {
    const key = String(masterKey);
    delete state.completed[key];
    delete state.failures[key];
};

export const recordClassFailureInState = (state: ClasshubUserState, masterKey: string): number => {
    const key = String(masterKey);
    const today = ymdVN();
    const current = state.failures[key];
    const nextCount = current && current.day === today ? current.count + 1 : 1;
    state.failures[key] = { day: today, count: nextCount };
    return nextCount;
};

export const getClassFailCountToday = (state: ClasshubUserState, masterKey: string): number => {
    const f = state.failures[String(masterKey)];
    return f && f.day === ymdVN() ? f.count : 0;
};

export const isClassBlockedTodayInState = (state: ClasshubUserState, masterKey: string): boolean =>
    getClassFailCountToday(state, masterKey) >= MAX_FAILS_PER_DAY;

export const catchUpMinYmd = (daysBack = DEFAULT_CATCH_UP_DAYS): string => addDaysYmdVN(-daysBack);

/**
 * Phân loại tiết học chuẩn 3.8.11 (classifyClassesV33):
 * ĐÃ XONG / CẦN ĐIỂM DANH NGAY (ready) / CHƯA TỚI GIỜ (locked)
 */
export const classifyClasses = (
    apiItems: any[],
    identity: TeacherIdentity,
    state: ClasshubUserState,
    bufferMinutes = 5,
    options: {
        minDateYmd?: string | null;
        ignoreBlock?: boolean;
        ignoreCompletedCache?: boolean;
    } = {}
): ClassifyResult => {
    const daysBack = state.catchUpDays || DEFAULT_CATCH_UP_DAYS;
    const minDateYmd = options.minDateYmd === undefined ? catchUpMinYmd(daysBack) : options.minDateYmd;
    const todayYmd = ymdVN();

    const ready: ClassifiedClassItem[] = [];
    const locked: ClassifiedClassItem[] = [];
    let doneCount = 0;
    let blockedCount = 0;
    let catchUpCount = 0;
    let outOfRangeCount = 0;
    let notMineCount = 0;

    const seenKeys = new Set<string>();

    for (const rawItem of apiItems || []) {
        const entity = rawItem?.entity || rawItem;
        if (!entity) continue;

        const masterKey = getClassKey(entity);
        if (!masterKey || masterKey === 'undefined' || masterKey === 'null') continue;
        if (seenKeys.has(masterKey)) continue;
        seenKeys.add(masterKey);

        // Lọc ngày phía tool: tab "quá khứ" của ClassHub có thể bỏ qua start_date và trả về toàn bộ tiết cũ
        const classDate = extractClassDateYmd(entity) || String(entity.class_schedule_date || '').slice(0, 10);
        if (classDate && minDateYmd && classDate < minDateYmd) {
            outOfRangeCount++;
            continue;
        }

        const role = getMyRole(entity, identity.id);
        // Tiết không có mình trong danh sách GV -> không đụng tới
        if (role === 'none' || (role === 'unknown' && isExcludedByTeacherName(entity, identity))) {
            notMineCount++;
            continue;
        }

        const isTeacherPending = !isDoneStatus(
            entity.instructor_attendance_status || entity.instructor_attendance_sheet_status || entity.status
        );
        const isStudentPending = !String(entity.attendance_sheet_status || '').toUpperCase().includes('ACCEPTED');

        // Nếu sổ trên ClassHub đã ACCEPTED và nằm trong cache hoàn tất -> bỏ qua ngay
        if (
            !options.ignoreCompletedCache &&
            isClassCachedInState(state, masterKey) &&
            !isTeacherPending &&
            (role !== 'main' || !isStudentPending)
        ) {
            doneCount++;
            continue;
        }

        if (!options.ignoreBlock && isClassBlockedTodayInState(state, masterKey)) {
            blockedCount++;
            continue;
        }

        const hasCoTeachers = Array.isArray(entity.co_teachers) && entity.co_teachers.length > 0;
        const me = findMeInCoTeachers(entity.co_teachers, identity);

        // Mình đã tick cá nhân chưa?
        let isMyTickPending: boolean;
        if (me) isMyTickPending = !isDoneStatus(me.status);
        else if (hasCoTeachers) isMyTickPending = isTeacherPending;
        else isMyTickPending = isTeacherPending || (role !== 'assistant' && isStudentPending);

        const classCode = String(entity.class_hour_code || masterKey);

        // Đã xong phần việc của mình: (sổ GV đã khoá + sổ HS đã khoá với GV chính) hoặc (mình là GV phụ và đã tick)
        if (!isMyTickPending && (!isTeacherPending || me) && (role !== 'main' || !isStudentPending)) {
            doneCount++;
            continue;
        }

        const queueReasons: string[] = [];
        if (isTeacherPending) queueReasons.push('Sổ GV chưa ACCEPT');
        if (role !== 'assistant' && isStudentPending) queueReasons.push('Sổ HS chưa ACCEPT');
        if (isMyTickPending) queueReasons.push('Chưa tick cá nhân');

        const unlockInfo = getClassUnlockInfo(entity, bufferMinutes);
        const isCatchUp = Boolean(classDate && classDate < todayYmd);
        const classItem: ClassifiedClassItem = {
            id: masterKey,
            slotId: String(rawItem?.id || entity.class_schedule_slot_id || masterKey),
            classCode,
            label: getClassLabel(entity),
            entity,
            sourceApi: rawItem?.sourceApi || entity.sourceApi || '',
            unlockInfo,
            role,
            isCatchUp,
            queueReasons,
            failCount: getClassFailCountToday(state, masterKey)
        };

        if (unlockInfo.isSafe) {
            ready.push(classItem);
            if (isCatchUp) catchUpCount++;
        } else {
            locked.push(classItem);
        }
    }

    const byUnlock = (a: ClassifiedClassItem, b: ClassifiedClassItem) =>
        a.unlockInfo.unlockTimestamp - b.unlockInfo.unlockTimestamp;
    ready.sort(byUnlock);
    locked.sort(byUnlock);

    return {
        ready,
        locked,
        doneCount,
        blockedCount,
        catchUpCount,
        outOfRangeCount,
        notMineCount
    };
};

export const describeClassify = (
    { ready, locked, doneCount, blockedCount, catchUpCount, outOfRangeCount }: ClassifyResult,
    catchUpDays = DEFAULT_CATCH_UP_DAYS
): string => {
    const parts = [
        `${doneCount} đã xong`,
        `${ready.length} cần điểm danh ngay${catchUpCount ? ` (trong đó ${catchUpCount} tiết BÙ ngày trước)` : ''}`
    ];
    if (locked.length > 0) {
        parts.push(`${locked.length} chưa tới giờ`);
    }
    if (blockedCount > 0) {
        parts.push(`${blockedCount} tạm dừng do lỗi quá ${MAX_FAILS_PER_DAY} lần hôm nay`);
    }
    if (outOfRangeCount > 0) {
        parts.push(`${outOfRangeCount} tiết cũ hơn ${catchUpDays} ngày (bỏ qua)`);
    }
    return parts.join(' - ');
};

/**
 * Hàng đợi song song liên tục (worker pool chuẩn 3.8.11):
 * luôn giữ `concurrency` tiết đang chạy, tiết nào xong lấy ngay tiết kế tiếp.
 */
export const runPool = async <T, R>(
    items: T[],
    worker: (item: T, index: number) => Promise<R>,
    options: {
        concurrency?: number;
        shouldContinue?: () => boolean;
        onError?: (err: any, index: number) => void;
    } = {}
): Promise<Array<R | { error: any }>> => {
    const concurrency = options.concurrency ?? ATTENDANCE_CONCURRENCY;
    const shouldContinue = options.shouldContinue ?? (() => true);
    let next = 0;
    const results = new Array<R | { error: any }>(items.length);

    const runner = async () => {
        while (next < items.length && shouldContinue()) {
            const idx = next++;
            try {
                results[idx] = await worker(items[idx], idx);
            } catch (e: any) {
                results[idx] = { error: e };
                if (options.onError) options.onError(e, idx);
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
    return results;
};
