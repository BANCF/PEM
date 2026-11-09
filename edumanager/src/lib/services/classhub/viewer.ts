/**
 * Module phân tích phản hồi HTML/JSON của Ohke Viewer & Model (Thuần API, Zero-DOM, chuẩn 3.8.11)
 */

import { decodeOhkeJSON } from './text';

export const STUDENT_SHEET_DOMAIN = 'x35FD2_'; // Viewer sổ điểm danh HỌC SINH (classroom-attendance-marker)
export const TEACHER_SHEET_DOMAIN = 'x35FD3_'; // Viewer sổ điểm danh GIÁO VIÊN (classroom-instructor-attendance-marker)
export const TEACHER_LIST_DOMAIN = 'x24F76_';  // Danh sách bản ghi điểm danh của từng GV trong tiết
export const STUDENT_DELETE_ATTENDANCE_FALLBACK = 'bttAction_x24477_'; // delete_class_attendance (field 148599)

/**
 * Mã endpoint của Ohke = "x" + hex(số hiệu form/subform), vd 152496 -> "x253B0_Model"
 */
export const modelNameForSubform = (fieldSubformId: number | string): string =>
    `x${Number(fieldSubformId).toString(16).toUpperCase()}_Model`;

/**
 * Phát hiện trang đăng nhập (phiên làm việc hết hạn) để không hiểu nhầm thành "không có lớp nào"
 */
export const isLoginPage = (responseUrl: string | undefined, text: string | undefined): boolean => {
    if (responseUrl && /login|signin|dang-nhap/i.test(responseUrl)) return true;
    return /<input[^>]+type=["']?password/i.test(String(text || ''));
};

/**
 * Mã nút trên Viewer sổ HS = "bttAction_x" + hex(số hiệu field),
 * dò từ comment "<!-- 1829V148599-delete_class_attendance -->"
 */
export const findViewerButtonAction = (html: unknown, buttonName: string): string | null => {
    const m = String(html || '').match(new RegExp(`V(\\d+)-${buttonName}\\b`));
    return m ? `bttAction_x${Number(m[1]).toString(16).toUpperCase()}_` : null;
};

/**
 * Máy chủ có thể trả {type:"success"} mà KHÔNG đổi trạng thái (vd tiết đã đóng) ->
 * chỉ coi là thành công khi data.status trả về đúng trạng thái đích (nếu máy chủ có trả status)
 */
export const transitionReached = (res: any, endState: string): boolean =>
    !!res &&
    (res.type === 'success' || res.success === true) &&
    (!res.data || !res.data.status || res.data.status === endState);

export const describeTransition = (res: any): string =>
    !res
        ? 'không có phản hồi'
        : res.code ||
          res.message ||
          (res.data && res.data.status ? `trạng thái trả về ${res.data.status}` : res.type) ||
          'Unknown';

/**
 * Đọc <script type="application/json" id="data-xxx">{...}</script> (kind = 'data' | 'env')
 */
export const parseViewerJson = (html: unknown, kind: 'data' | 'env' = 'data'): any[] => {
    const re = new RegExp(`<script[^>]*type=["']application/json["'][^>]*id=["']${kind}-[^"']*["'][^>]*>([\\s\\S]*?)</script>`, 'gi');
    const out: any[] = [];
    let m: RegExpExecArray | null;
    const str = String(html || '');
    while ((m = re.exec(str)) !== null) {
        try {
            out.push(JSON.parse(m[1]));
        } catch {
            // Bỏ qua block JSON lỗi
        }
    }
    return out;
};

/**
 * Trích xuất mảng bản ghi từ data-entity="..." trong HTML danh sách
 */
export const parseEntities = (html: unknown): any[] => {
    const out: any[] = [];
    const re = /data-entity=(['"])([\s\S]*?)\1/g;
    const str = String(html || '');
    let m: RegExpExecArray | null;
    while ((m = re.exec(str)) !== null) {
        try {
            out.push(JSON.parse(decodeOhkeJSON(m[2])));
        } catch {
            // Bỏ qua entity lỗi
        }
    }
    return out;
};

/**
 * Bản ghi điểm danh của 1 giáo viên (khác dòng lớp / dòng học sinh)
 */
export const isTeacherRecord = (r: any): boolean =>
    !!r &&
    (/^INSTRUCTOR_ATTENDANCE_STATUS_/i.test(r.status || '') ||
        !!r.study_instructor_code ||
        !!r.hrm_activity_type_code);
