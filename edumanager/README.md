<div align="center">

# 🚀 PEM (Pascal Education Manager)
**Hệ thống Quản lý Giáo dục, Đánh giá và Xếp hạng KPI Toàn diện cho Môi trường Sư phạm**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## 🎯 Giới thiệu
**PEM (Pascal Education Manager)** là giải pháp số hóa toàn diện và tiên tiến được thiết kế riêng cho các trường học hiện đại. Hệ thống thay thế hoàn toàn các quy trình giấy tờ thủ công, tích hợp đồng bộ từ Quản lý giảng dạy (Thời khóa biểu, Lớp học, Sổ điểm điện tử) đến Đánh giá thi đua, tính điểm KPI và xếp hạng động lực cho đội ngũ giáo viên.

Với giao diện trực quan, minh bạch và ứng dụng các cơ chế tạo động lực (gamification), PEM mang đến một môi trường làm việc công bằng, tích cực và chuyên nghiệp hóa toàn bộ hoạt động quản trị nhà trường.

## ✨ Tính năng Nổi bật

### 🏆 Đánh giá & Xếp hạng KPI Thời gian thực (Live KPI Leaderboard)
- **Bảng Xếp hạng Tự động:** Cập nhật quỹ điểm KPI theo từng giây, hiển thị bảng xếp hạng toàn trường và phân loại theo từng Tổ bộ môn.
- **Vinh danh Top 3 Xuất sắc:** Giao diện huy chương 🥇 🥈 🥉 nổi bật ngay trang chủ nhằm tôn vinh các giáo viên có thành tích cao nhất trong tháng.
- **Đánh giá Đồng cấp (Peer-to-Peer Kudos):** Khuyến khích văn hóa ghi nhận tích cực; giáo viên có thể tặng điểm thưởng cho đồng nghiệp trong tổ (tối đa 5 điểm/tháng).

### 🎓 Quản lý Lớp học & Sổ Điểm Điện tử (Class & Gradebook Suite)
- **Quản lý Lớp học & Học sinh:** Quản lý danh sách lớp học, hồ sơ học sinh chi tiết và phân công Giáo viên Chủ nhiệm (GVCN). Hỗ trợ import/export danh sách hàng loạt từ file Excel.
- **Sổ Điểm Điện tử Số hóa:** Quản lý điểm số học sinh theo từng môn học và học kỳ. Tự động tính toán điểm trung bình môn, đánh giá kết quả học tập tuân thủ theo các thông tư quy định của Bộ GD&ĐT (TT58/TT22...).
- **Xuất Báo cáo Điểm số:** Hỗ trợ tải bảng điểm, tổng kết học kỳ ra file Excel chuẩn định dạng chỉ với 1 cú nhấp chuột.

### 📅 Thời Khóa Biểu Thông minh (Smart Schedule Management)
- **Đọc & Phân tích TKB Tự động:** Tích hợp công cụ upload file Excel Thời khóa biểu phức tạp của nhà trường, tự động bóc tách và nhận diện dữ liệu chính xác.
- **Lịch Giảng dạy Trực quan:** Tra cứu thời khóa biểu toàn trường, lọc theo lớp, môn học hoặc xem lịch giảng dạy cá nhân hóa cho từng giáo viên.

### 📋 Quy trình Lập Phiếu & Khiếu nại Dân chủ (Evaluations & Appeal Workflow)
- **Ngân hàng Quy định Linh hoạt:** Admin có thể thiết lập các bộ tiêu chí Thưởng (Kudos) và Phạt (Penalty) kèm mức điểm tùy chỉnh.
- **Lập Phiếu Nhanh chóng:** Ban Giám Hiệu (BGH) và Tổ Trưởng Chuyên Môn (TTCM) tạo phiếu đánh giá chi tiết chỉ trong 5 giây.
- **Cơ chế Khiếu nại 48 Giờ:** Giáo viên được quyền gửi khiếu nại kèm minh chứng trong vòng 48 giờ kể từ khi nhận phiếu phạt. Nếu không khiếu nại, hệ thống tự động chốt duyệt.

### 🖨️ Báo cáo Thi đua & Phiếu Nhận xét Tháng (Export & Printing Suite)
- **Phiếu Nhận xét Tháng (PDF):** Tự động tổng hợp dữ liệu KPI và tạo phiếu nhận xét tháng chuẩn form biểu nhà trường, hỗ trợ xem trước và xuất file PDF lưu hồ sơ thi đua.
- **Xuất Excel Tổng hợp:** Tải báo cáo xếp hạng KPI, bảng lương thưởng thi đua định kỳ nhanh chóng mà không cần nhập liệu thủ công.

### 🔐 Phân quyền Đa tầng & Bảo mật Hệ thống (Advanced RBAC & System Security)
- **Phân quyền Chặt chẽ theo Cấp bậc:** Quyền hạn được phân định rõ ràng giữa các vai trò: Giáo viên (`TEACHER`), Tổ Trưởng/Tổ Phó (`TTCM`/`TPCM`), Ban Giám Hiệu (`BGH`) và Quản trị viên (`ADMIN`).
- **Khóa Bảo trì Hệ thống (System Frozen):** Hỗ trợ tính năng khóa tạm thời toàn bộ thao tác lập phiếu khi hệ thống cần bảo trì hoặc chốt sổ tổng kết kỳ thi đua cuối tháng/cuối kỳ.
- **Nhật ký Kiểm toán (Audit Logs):** Ghi vết chi tiết lịch sử các thao tác quan trọng trên hệ thống nhằm đảm bảo tính minh bạch, chính xác và an toàn dữ liệu tuyệt đối.

### 🔔 Thông báo & Phân tích Dữ liệu (Real-time Alerts & Analytics)
- **Chuông Báo Tức thì:** Hệ thống thông báo thời gian thực về các phiếu đánh giá mới, kết quả xử lý khiếu nại và các thông báo từ BGH.
- **Biểu đồ Phong độ Chuyên sâu:** Tích hợp biểu đồ đường (Line Chart) và biểu đồ tròn (Pie Chart) phân tích quỹ đạo điểm số theo Tuần/Tháng và so sánh năng lực giữa các tổ bộ môn.

---

## 🛠️ Công nghệ Sử dụng
- **Frontend Framework:** Next.js 16 (App Router), React 19
- **Styling & UI:** Tailwind CSS, Lucide React Icons (Responsive & Modern UI)
- **Database & Authentication:** Google Firebase (Firestore NoSQL, Firebase Authentication)
- **Data Visualization & Analytics:** Recharts
- **File Processing:** Hỗ trợ xử lý Excel (Import/Export TKB, Danh sách học sinh, Sổ điểm) và xuất PDF phiếu nhận xét
- **Language:** TypeScript (Strict Type Checking)

---

## 🚀 Hướng dẫn Cài đặt & Chạy Local

### 1. Yêu cầu hệ thống
- Node.js (phiên bản v20 trở lên)
- Trình quản lý package npm, yarn hoặc pnpm

### 2. Các bước cài đặt
Clone mã nguồn về máy:
```bash
git clone https://github.com/BANCF/PEM.git
cd PEM/edumanager
```

Cài đặt các gói phụ thuộc:
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env.local` ở thư mục gốc `edumanager` và điền các thông tin cấu hình từ Firebase Console của bạn:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

### 4. Chạy Server Development
Khởi chạy dự án ở môi trường dev:
```bash
npm run dev
```
Mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

---

## 🤝 Hỗ trợ và Đóng góp
Dự án được thiết kế và tối ưu hóa đặc biệt theo nhu cầu quản trị trường học nội bộ. Nếu có bất kỳ thắc mắc, đề xuất nâng cấp hoặc báo cáo lỗi, vui lòng liên hệ đội ngũ phát triển.

---
*Developed with ❤️ for Education.*
