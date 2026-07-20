# Quy chuẩn xây dựng tính năng In/Xuất PDF (Print Forms)

Khi xây dựng các trang in (hoặc Xuất PDF) cho hệ thống, cần tuân thủ các quy tắc sau để đảm bảo giao diện đẹp và không bị lỗi:

1. **Auto-save trước khi in**: Luôn tự động lưu dữ liệu đang nhập (gọi hàm save) TRƯỚC khi dùng `window.open` để mở trang in. Trang in luôn gọi lại dữ liệu từ DB, vì thế phải đảm bảo dữ liệu mới đã được lưu.
2. **Ẩn Layout Dashboard**: Thêm class `print:hidden` vào các thành phần menu (Sidebar, Header) và các class `print:bg-white`, `print:overflow-visible`, `print:block` vào layout bọc ngoài để trang in chiếm trọn khung hình và không bị kẹp trong giao diện của web.
3. **Ngắt trang chuẩn A4**: Bắt buộc sử dụng class `print:block` cho thẻ chứa ngoài cùng (thay vì `flex`, vì `flex` làm hỏng page break). Dùng CSS `@page { size: A4 portrait; margin: 0; }` và class custom chứa `break-after: page;` để ép trình duyệt ngắt trang chính xác cho mỗi học sinh.
4. **Font chữ Tiếng Việt**: KHÔNG dùng `font-serif` mặc định của Tailwind vì nó sẽ gây lỗi tách dấu Tiếng Việt (VD: KÊ´T QUẢ). Luôn import và sử dụng Google Font `Tinos` cho các trang in yêu cầu font chữ có chân (Serif).
5. **UX Nhập liệu (Excel style)**: Với các bảng điểm dạng lưới (table), luôn bổ sung sự kiện `onKeyDown` cho phím `Enter` để tự động di chuyển con trỏ (focus) xuống ô input bên dưới (cùng cột), giúp giáo viên nhập liệu nhanh như dùng Excel.
