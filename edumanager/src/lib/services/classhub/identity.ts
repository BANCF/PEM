/**
 * Module nhận diện danh tính Giáo viên (ID + Tên) và vai trò (GV chính / GV phụ) chuẩn 3.8.11
 */

import { containsExactId, decodeOhkeText, teacherNameMatches } from './text';

export interface TeacherIdentity {
    id: string;
    name: string;
}

export type TeacherRole = 'main' | 'assistant' | 'none' | 'unknown';

/**
 * Nguồn chuẩn nhất (3.8.11): biến Ohke.worker do server in sẵn trong <script> của trang
 * Ví dụ: Ohke.worker = {"id":"47826","name":"...","site_name":"[47826] ..."}
 */
export const readWorkerFromHtml = (html: string): TeacherIdentity | null => {
    const str = String(html || '');
    const m = str.match(/Ohke\.worker\s*=\s*(\{[^;]*?\})\s*;/);
    if (m && m[1]) {
        try {
            const w = JSON.parse(m[1]);
            const id = w?.id ? String(w.id).trim() : '';
            const name = w?.name ? decodeOhkeText(w.name).trim() : '';
            if (id && name) {
                return { id, name };
            }
            if (id || name) {
                return { id, name };
            }
        } catch {
            // Fallback bên dưới nếu JSON lỗi
        }
    }

    // Dự phòng định dạng "[47826] Vũ Hoàng Linh" trên header trang
    const fallbackMatch = str.match(/\[(\d{4,8})\]\s+([A-ZÀ-Ỹa-zà-ỹ\s]{4,50})/);
    if (fallbackMatch && fallbackMatch[1] && fallbackMatch[2]) {
        return {
            id: fallbackMatch[1].trim(),
            name: decodeOhkeText(fallbackMatch[2].split('\n')[0]).trim()
        };
    }

    return null;
};

/**
 * Tách danh sách ID số từ chuỗi "47826,47839" hoặc mảng
 */
export const parseIdList = (val: unknown): string[] => {
    if (Array.isArray(val)) {
        return val
            .map(v => (typeof v === 'object' && v !== null ? (v as any).id : v))
            .map(v => String(v ?? '').trim())
            .filter(s => /^\d+$/.test(s));
    }
    return String(val ?? '')
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(s => /^\d+$/.test(s));
};

/**
 * Nhận diện vai trò giáo viên trong tiết học bằng ID (3.8.11):
 * 'main' | 'assistant' | 'none' (tiết không có mình) | 'unknown' (dữ liệu không có trường vai trò)
 */
export const getMyRole = (entity: any, myId: string): TeacherRole => {
    if (!myId || !entity) return 'unknown';
    const me = String(myId).trim();
    if (!me) return 'unknown';

    const mains = parseIdList(entity.main_instructor);
    const assistants = parseIdList(entity.assistant_instructors);
    const all = parseIdList(entity.instructor_site_ids);

    if (mains.includes(me)) return 'main';
    if (assistants.includes(me)) return 'assistant';
    if (all.includes(me)) return mains.length === 0 && all.length === 1 ? 'main' : 'assistant';
    if (mains.length > 0 || assistants.length > 0 || all.length > 0) return 'none';

    // Nếu không có các trường ID thuần số nhưng có các trường hiển thị tên/ID giáo viên trên dòng lịch
    const rawTeacherFields = [
        entity[':field_teacher'],
        entity['__main_instructor'],
        entity['__assistant_instructors'],
        entity['__instructor_site_ids'],
        entity.instructor_name,
        entity.teacher_name,
        entity.instructor?.name
    ]
        .filter(Boolean)
        .map(v => decodeOhkeText(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/<[^>]*>?/gm, ' '))
        .join(' | ');

    if (rawTeacherFields.trim()) {
        if (rawTeacherFields.includes(`[${me}]`) || containsExactId(rawTeacherFields, me)) {
            const mainDisplay = decodeOhkeText(entity['__main_instructor'] || '');
            if (mainDisplay && (mainDisplay.includes(`[${me}]`) || containsExactId(mainDisplay, me))) {
                return 'main';
            }
            return 'unknown';
        }
        // Nếu chuỗi hiển thị có chứa mã [ID_KHÁC] mà không có [me] -> chắc chắn không phải lớp mình
        if (/\[\d{4,8}\]/.test(rawTeacherFields)) {
            return 'none';
        }
    }

    return 'unknown';
};

/**
 * Kiểm tra bổ sung khi getMyRole trả về 'unknown' và chỉ có tên hiển thị
 */
export const isExcludedByTeacherName = (entity: any, identity: TeacherIdentity): boolean => {
    if (!entity || !identity.name) return false;
    const rawTeacherFields = [
        entity[':field_teacher'],
        entity['__main_instructor'],
        entity['__assistant_instructors'],
        entity['__instructor_site_ids'],
        entity.instructor_name,
        entity.teacher_name,
        entity.instructor?.name
    ]
        .filter(Boolean)
        .map(v => decodeOhkeText(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/<[^>]*>?/gm, ' '))
        .join(' | ')
        .trim();

    if (!rawTeacherFields) return false;
    if (identity.id && (rawTeacherFields.includes(`[${identity.id}]`) || containsExactId(rawTeacherFields, identity.id))) {
        return false;
    }
    return !teacherNameMatches(rawTeacherFields, identity.name);
};

const OWN_ID_KEY_RE = /(^|_)(instructor|teacher|worker|person|staff|employee)(_site)?_id$|^site_id$/;
const NOT_OWNER_KEY_RE = /^_*(create|update|working|member_of|owner|approve|approved)_/;

/**
 * Bản ghi điểm danh GV (sub-record từ x24F76_Model / Viewer) có phải của mình không? (3.8.11)
 * Ưu tiên trường ID; bỏ qua create_/update_* (người tạo/sửa bản ghi KHÔNG phải chủ bản ghi)
 */
export const recordBelongsToMe = (rec: any, text: string, identity: TeacherIdentity): boolean => {
    const myId = identity.id ? String(identity.id).trim() : '';
    if (rec && typeof rec === 'object') {
        for (const key of Object.keys(rec)) {
            if (NOT_OWNER_KEY_RE.test(key)) continue;
            const val = rec[key];
            if (val === null || val === undefined || typeof val === 'object') continue;
            const s = String(val);
            if (myId && OWN_ID_KEY_RE.test(key) && s === myId) return true;
            // Trường hiển thị kiểu "__instructor_site_id": "[47826] Vũ Hoàng Linh"
            if (myId && key.startsWith('__') && s.includes(`[${myId}]`)) return true;
        }
        if (identity.name) {
            for (const key of ['instructor_name', 'teacher_name', 'full_name', 'worker_site_name', 'worker_name', 'name']) {
                if (rec[key] && teacherNameMatches(rec[key], identity.name)) return true;
            }
            if (rec.user && rec.user.full_name && teacherNameMatches(rec.user.full_name, identity.name)) return true;
            if (rec.instructor && rec.instructor.name && teacherNameMatches(rec.instructor.name, identity.name)) return true;
            if (rec.instructor && rec.instructor.worker_site_name && teacherNameMatches(rec.instructor.worker_site_name, identity.name)) return true;
        }
    }
    if (text) {
        const decoded = decodeOhkeText(text);
        if (myId && decoded.includes(`[${myId}]`)) return true;
        if (identity.name && teacherNameMatches(decoded, identity.name)) return true;
    }
    return false;
};

/**
 * Tìm bản ghi của chính mình trong danh sách co_teachers của tiết (3.8.11)
 */
export const findMeInCoTeachers = (coTeachers: any, identity: TeacherIdentity): any | null => {
    if (!Array.isArray(coTeachers) || coTeachers.length === 0) return null;
    return (
        coTeachers.find(t => {
            if (!t) return false;
            if (identity.id) {
                const ids = [t.instructor_id, t.worker_id, t.user_id, t.user && t.user.id]
                    .filter(v => v !== undefined && v !== null)
                    .map(String);
                if (ids.includes(String(identity.id)) || containsExactId(JSON.stringify(t), identity.id)) return true;
            }
            if (identity.name) {
                return (
                    teacherNameMatches(t.instructor_name, identity.name) ||
                    teacherNameMatches(t.user && t.user.full_name, identity.name)
                );
            }
            return false;
        }) || null
    );
};

/**
 * Trạng thái điểm danh coi là "đã xong" (3.8.11)
 */
export const isDoneStatus = (status: unknown): boolean => {
    const s = String(status || '').toUpperCase();
    return s.includes('ACCEPTED') || s.includes('PRESENT') || s.includes('FULL_ATTENDANCE');
};

/**
 * Mã tiết dùng cho API chốt sổ: entity.id (KHÔNG phải class_schedule_slot_id - hai mã này khác nhau)
 */
export const getClassKey = (entity: any): string => {
    if (!entity) return '';
    return String(entity.id || entity.master_key || entity.class_schedule_slot_id || '');
};

/**
 * Nhãn dễ đọc cho 1 tiết: "Tiết 2 (08:30) · 8A2 · STEM 8"
 */
export const getClassLabel = (entity: any): string => {
    if (!entity) return '';
    const hour = decodeOhkeText(entity.__class_hour_code || entity.class_hour_code || '');
    const start = String(entity.class_hour_start_time || '').slice(0, 5);
    const mod = decodeOhkeText(entity.__study_module_code || entity.study_module_code || entity.module_name || '').replace(/^\[[^\]]*\]\s*/, '');
    const className = decodeOhkeText(entity.class_name || entity.student_class_name || '');
    return [hour + (start ? ` (${start})` : ''), className, mod].filter(Boolean).join(' · ');
};
