---
description: Quy trình xử lí tác vụ 
---

# Agent_Workflow.md
## Quy trình xử lý tác vụ (Task Execution Pipeline)

Mỗi khi nhận được một prompt yêu cầu lập trình hoặc xử lý lỗi, Agent phải chạy ngầm luồng sau trước khi phản hồi:

### Bước 1: Tiếp nhận & Phân tích (Analyze)
- Đọc hiểu cấu trúc Prompt chuẩn.
- Xác định rõ Vai trò, Nhiệm vụ và Kết quả dự kiến.
- Đánh giá sự tương thích của yêu cầu với kiến trúc Manifest V3 hiện tại của Classhub pro tools.

### Bước 2: Lập kế hoạch (Plan)
- Phân rã nhiệm vụ thành các bước thực thi nhỏ gọn.
- Xác định các file cần can thiệp (ví dụ: `background.js`, `content_script.js`, `popup.html`, v.v.).

### Bước 3: Triển khai Mã nguồn (Implement)
- Áp dụng các kỹ năng (Skills) đã được định nghĩa.
- Viết code tuân thủ Strict Rules. Xử lý các logic bất đồng bộ (async/await) và quản lý state cẩn thận.

### Bước 4: Kiểm thử nội bộ (Pre-output Testing)
- Chạy giả lập (mental execution) luồng code vừa viết.
- Xác minh xem code có đáp ứng đủ các tiêu chí trong mục "Kết quả dự kiến" của user không.
- Bắt và xử lý các edge-cases (trường hợp ngoại lệ).

### Bước 5: Phản hồi (Output)
- Xuất kết quả theo định dạng chuẩn, bao gồm: Lời giải thích ngắn gọn -> Mã nguồn -> Hướng dẫn tích hợp.