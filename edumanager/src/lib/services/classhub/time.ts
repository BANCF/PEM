/**
 * Module xử lý thời gian theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 * và kiểm tra mở khoá tiết học (Fail-Closed chuẩn 3.8.11).
 */

export interface UnlockInfo {
    isSafe: boolean;
    unlockTimestamp: number;
    startTimestamp: number;
    timeString: string;
    dateYmd: string;
}

/**
 * Lấy chuỗi YYYY-MM-DD theo múi giờ Việt Nam (an toàn cả trên local UTC+7 lẫn server UTC)
 */
export const ymdVN = (d: Date = new Date()): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value || '1970';
    const m = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    return `${y}-${m}-${day}`;
};

/**
 * Cộng/trừ số ngày so với hôm nay theo giờ Việt Nam và trả về YYYY-MM-DD
 */
export const addDaysYmdVN = (offsetDays: number, baseDate: Date = new Date()): string => {
    const target = new Date(baseDate.getTime() + offsetDays * 86400000);
    return ymdVN(target);
};

/**
 * Phân tích chuỗi ngày đa định dạng của Ohke (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD-MM-YY)
 * Trả về { year, month (0-11), day, ymd } hoặc null nếu không hợp lệ.
 */
export const parseOhkeDate = (rawDate: unknown): { year: number; month: number; day: number; ymd: string } | null => {
    if (!rawDate) return null;
    const datePart = String(rawDate).trim().split(/[T\s]/)[0];
    if (!datePart) return null;

    const parts = datePart.includes('/')
        ? datePart.split('/')
        : datePart.includes('-')
            ? datePart.split('-')
            : null;

    if (!parts || parts.length !== 3) return null;

    let year: number;
    let month: number;
    let day: number;

    if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
    } else {
        // DD-MM-YYYY hoặc DD-MM-YY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
        if (parts[2].length === 2) year += 2000;
    }

    if (
        !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) ||
        year < 2000 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31
    ) {
        return null;
    }

    const yStr = String(year).padStart(4, '0');
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');

    return { year, month, day, ymd: `${yStr}-${mStr}-${dStr}` };
};

export const extractClassDateYmd = (entityData: any): string => {
    if (!entityData) return '';
    const dateStr = entityData.class_schedule_date || entityData.date || entityData.start_date || entityData.teaching_date || '';
    const parsed = parseOhkeDate(dateStr);
    return parsed ? parsed.ymd : '';
};

/**
 * Kiểm tra tiết học đã đủ điều kiện thời gian để điểm danh chưa (chuẩn 3.8.11 Fail-Closed):
 * - Nếu thiếu ngày hoặc sai định dạng ngày/giờ -> CHẶN (isSafe: false) để không điểm danh nhầm tiết tương lai.
 * - Mở khoá sau `bufferMinutes` phút kể từ giờ bắt đầu tiết (theo giờ Việt Nam +07:00).
 */
export const getClassUnlockInfo = (entityData: any, bufferMinutes = 5): UnlockInfo => {
    if (!entityData) {
        return { isSafe: false, unlockTimestamp: Infinity, startTimestamp: Infinity, timeString: 'Lỗi dữ liệu', dateYmd: '' };
    }
    const dateStr = entityData.class_schedule_date || entityData.date || entityData.start_date || entityData.teaching_date || '';
    if (!dateStr) {
        return { isSafe: false, unlockTimestamp: Infinity, startTimestamp: Infinity, timeString: 'Không có lịch', dateYmd: '' };
    }

    try {
        const parsedDate = parseOhkeDate(dateStr);
        if (!parsedDate) {
            // Fail-closed: Không hiểu định dạng ngày -> CHẶN
            return { isSafe: false, unlockTimestamp: Infinity, startTimestamp: Infinity, timeString: 'Lỗi định dạng ngày', dateYmd: '' };
        }

        const timeStr = String(
            entityData.class_hour_start_time || entityData.start_time || entityData.teaching_start_time || '00:00:00'
        ).trim();
        const timeParts = timeStr.split(':');
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1] ?? '0', 10);

        if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return { isSafe: false, unlockTimestamp: Infinity, startTimestamp: Infinity, timeString: 'Lỗi định dạng giờ', dateYmd: parsedDate.ymd };
        }

        const hStr = String(hours).padStart(2, '0');
        const minStr = String(minutes).padStart(2, '0');
        const isoStr = `${parsedDate.ymd}T${hStr}:${minStr}:00+07:00`;
        const startTimestamp = new Date(isoStr).getTime();

        if (!Number.isFinite(startTimestamp)) {
            return { isSafe: false, unlockTimestamp: Infinity, startTimestamp: Infinity, timeString: 'Lỗi định dạng giờ', dateYmd: parsedDate.ymd };
        }

        const unlockTimestamp = startTimestamp + bufferMinutes * 60 * 1000;
        const now = Date.now();

        const timeString = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(new Date(unlockTimestamp));

        return {
            isSafe: now >= unlockTimestamp,
            unlockTimestamp,
            startTimestamp,
            timeString,
            dateYmd: parsedDate.ymd
        };
    } catch {
        // Fail-closed: Có lỗi ngoại lệ -> CHẶN
        return { isSafe: false, unlockTimestamp: Infinity, startTimestamp: Infinity, timeString: 'Lỗi định dạng giờ', dateYmd: '' };
    }
};
