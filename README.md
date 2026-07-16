<div align="center">

# 🚀 PEM (Pascal Education Manager)
**Hệ thống Quản lý, Đánh giá và Xếp hạng KPI dành cho Môi trường Sư phạm**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## 🎯 Giới thiệu
**PEM** là một giải pháp số hóa toàn diện giúp các trường học thay thế hoàn toàn giấy tờ thủ công trong việc đánh giá và tính điểm KPI cho đội ngũ giáo viên. Hệ thống mang lại một môi trường làm việc minh bạch, công bằng và đầy tính động lực (gamification) thông qua các bảng xếp hạng thời gian thực.

## ✨ Tính năng Nổi bật

- 🏆 **Bảng Xếp hạng Thời gian thực (Live Leaderboard):** Hiển thị quỹ điểm KPI, tự động xếp hạng toàn trường và xếp hạng riêng theo từng Tổ bộ môn. Vinh danh Top 3 xuất sắc nhất.
- 📋 **Quản lý Quy định & Lập Phiếu:** Admin có thể định nghĩa các bộ quy định (Thưởng/Phạt). BGH và Tổ trưởng (TTCM) dễ dàng lập Phiếu đánh giá trong 5 giây.
- 🤝 **Đánh giá Đồng cấp (Peer-to-Peer Kudos):** Giáo viên có thể tặng điểm thưởng cho nhau (tối đa 5 điểm/tháng) để khích lệ tinh thần làm việc.
- ⚖️ **Hệ thống Khiếu nại Dân chủ:** Giáo viên có 48 giờ để gửi khiếu nại kèm minh chứng nếu bị phạt sai. Quá thời gian, hệ thống tự động chốt phiếu.
- 🔔 **Thông báo Tức thì (Notifications):** Không bỏ lỡ bất kỳ biến động nào về điểm số hay kết quả khiếu nại thông qua hệ thống chuông báo tích hợp.
- 📊 **Thống kê & Báo cáo Mở rộng:** Phân tích biểu đồ (Đường, Tròn) theo Tuần/Tháng và Hỗ trợ xuất dữ liệu ra file Excel phục vụ tính lương.
- 🔐 **Phân quyền Đa tầng (RBAC):** Quyền hạn được chia nhỏ, bảo mật chặt chẽ giữa các cấp: Giáo viên (TEACHER), Tổ Trưởng (TTCM), Ban Giám Hiệu (BGH), Quản Trị Viên (ADMIN).

## 🛠️ Công nghệ Sử dụng
- **Frontend Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS (Class-based, Dark/Light modes ready)
- **Database & Authentication:** Firebase (Firestore, Firebase Auth)
- **Icons & UI:** Lucide React
- **Data Visualization:** Recharts
- **Language:** TypeScript (Strict Type Checking)

## 🚀 Hướng dẫn Cài đặt & Chạy Local

### 1. Yêu cầu hệ thống
- Node.js (phiên bản v20 trở lên)
- Trình quản lý package npm hoặc yarn

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
Tạo file `.env.local` ở thư mục gốc `edumanager` và điền các thông tin từ Firebase Console của bạn:
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

## 🤝 Hỗ trợ và Đóng góp
Dự án được thiết kế đặc biệt theo nhu cầu nội bộ. Nếu có bất kỳ câu hỏi nào hoặc muốn báo cáo lỗi, vui lòng liên hệ đội ngũ phát triển nội bộ của trường.

---
*Developed with ❤️ for Education.*
