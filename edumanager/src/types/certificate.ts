export interface CertificateField {
  id: string; // e.g., 'student_name' | 'class_name' | 'award_title'
  label: string;
  x: number; // Tọa độ X tính theo point từ mép trái (trên tổng chiều rộng ~842 pt của A4 ngang)
  y: number; // Tọa độ Y tính theo point từ mép TRÊN xuống (Top-down Y, trên tổng chiều cao ~595 pt)
  fontSize: number; // Cỡ chữ chuẩn (pt), ví dụ 36
  fontFamily: string; // Ví dụ 'UTM ViceroyJF'
  color: string; // Mã màu HEX, ví dụ '#B22222'
  textAlign: 'left' | 'center' | 'right';
  maxWidth: number; // Giới hạn bề ngang tối đa (pt) trước khi kích hoạt co dãn font tự động
}

export interface CertificateTemplate {
  id: string;
  name: string;
  bgUrl: string; // Đường dẫn phôi ảnh, ví dụ '/certi/HSG.PNG'
  width: number; // Mặc định 841.89 pt (A4 ngang)
  height: number; // Mặc định 595.28 pt (A4 ngang)
  fields: CertificateField[];
  isDefault?: boolean;
  isCustomized?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentAwardSelection {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  templateId: string; // ID mẫu phôi (ví dụ 'hsg', 'hsxs', hoặc 'none' nếu không nhận thưởng)
  customFontSizeScale: number; // Tỷ lệ co dãn thủ công (%), mặc định là 100
  customNote?: string; // Danh hiệu tùy biến hoặc ghi chú thêm nếu cần
  customStudentName?: string; // Tên học sinh tùy chỉnh ghi đè
  customClassName?: string; // Tên lớp tùy chỉnh ghi đè
  customAwardTitle?: string; // Danh hiệu / lời khen tùy chỉnh ghi đè
}

export interface CertificateBatchRequest {
  classId: string;
  className: string;
  issueDate: string;
  selections: StudentAwardSelection[];
  printMode: 'full_color' | 'text_only'; // In màu toàn phần hay chỉ in chữ đè phôi cứng
}

export interface CertificatePreset {
  id: string;
  name: string; // ví dụ "Mẫu_v1", "Cấu hình chuẩn 2026"
  templates: CertificateTemplate[];
  isDefault?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
