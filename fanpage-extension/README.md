# PAS Fanpage Helper

Extension Chrome hỗ trợ **Thích / Chia sẻ / Bình luận** các bài viết trong một tháng trên fanpage trường, dùng phiên Facebook đang đăng nhập sẵn (không cần mật khẩu).

## Cài đặt
1. Lấy thư mục `fanpage-extension` (trong repo PEM) hoặc file zip quản trị viên gửi.
2. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển** (góc phải trên).
3. Bấm **Tải tiện ích đã giải nén** → chọn thư mục `fanpage-extension`.
4. Ghim biểu tượng extension lên thanh công cụ.

## Kết nối với PEM
1. Đăng nhập PEM → menu **Tương tác Fanpage** → **Tạo mã kết nối** → copy mã (chỉ hiện 1 lần).
2. Mở popup extension → ô **Mã kết nối PEM** → dán mã → **Kết nối**.
3. Từ đó mỗi bài xử lý xong được gửi về PEM ngay; mất mạng thì tự gửi bù lần sau.
   Nút **Đồng bộ nhật ký lên PEM** gửi lại toàn bộ nhật ký cũ.
4. Khi tích "Dùng link fanpage và câu bình luận do BGH cài trên PEM", extension lấy cấu hình tháng từ PEM lúc bấm Bắt đầu.

Mã kết nối chỉ dùng được cho việc đọc cấu hình và gửi kết quả tương tác, không đăng nhập được vào PEM.
Tạo mã mới trên PEM sẽ làm mã cũ hết hiệu lực.

## Sử dụng thủ công
1. Bấm biểu tượng extension → **Mở fanpage** (đợi trang tải xong).
2. Chọn tháng/năm, các thao tác, sửa danh sách câu bình luận mẫu.
3. Bấm **▶ Bắt đầu**. Bảng tiến độ hiện ở góc phải trang, có nút Tạm dừng / Dừng.
4. Chế độ **bán tự động**: extension tự Thích; Chia sẻ được tự bấm **Chia sẻ ngay** (bỏ tích "Tự bấm Chia sẻ ngay" nếu muốn tự xác nhận); với Bình luận nó điền sẵn câu, bạn bấm **Enter**.
5. Xong thì mở lại popup → **Copy link** để dán vào Google Sheet KPI, hoặc **Xuất CSV**.

Nếu vừa cài/cập nhật extension mà tab Facebook đang mở sẵn, hãy **F5** tab đó một lần.

## Tương tác tự động & Lịch nhắc hằng ngày
Khi đã kết nối extension với web PEM:
1. Bạn có thể bật **Nhắc tôi tương tác fanpage hằng ngày** trên web PEM và chọn giờ nhắc, số lượng bài tối đa mỗi ngày (mặc định 5 bài).
2. Tới giờ hẹn (khi Chrome đang mở), extension sẽ gửi thông báo hệ thống:
   - Bấm **"Chạy ngay"**: extension sẽ mở một cửa sổ Facebook riêng ở phía trước để bắt đầu tương tác.
   - Bấm **"Để sau"**: extension sẽ nhắc lại sau 60 phút (tối đa nhắc 3 lần/ngày).
3. Bạn cũng có thể bấm nút **"Chạy ngay (mở cửa sổ Facebook)"** trực tiếp trên web PEM bất kỳ lúc nào.
4. **Cơ chế hoạt động khi chạy:**
   - **Không thu nhỏ cửa sổ:** Cửa sổ Facebook cần được giữ hiển thị, không thu nhỏ trong lúc chạy để Chrome duy trì hiển thị trang và cuộn bài viết.
   - **Tự tạm dừng khi bị ẩn:** Nếu cửa sổ Facebook bị ẩn hoặc thu nhỏ, extension sẽ tự động tạm dừng và hiển thị thông báo yêu cầu mở lại cửa sổ để tiếp tục chạy.
   - **Tự đóng cửa sổ khi xong:** Khi hoàn thành số lượng bài đặt ra hoặc hết bài trong tháng, bảng kết quả hiển thị trên trang vài giây rồi cửa sổ tự động đóng lại.
   - **Tự ngắt quá thời gian:** Nếu sau 20 phút lượt chạy chưa kết thúc, extension sẽ tự dừng an toàn.

## Cách hoạt động
- Áp dụng **Bộ lọc → Năm → Tháng** của Facebook (nếu bỏ tích, extension tự đọc ngày đăng).
- Tìm từng bài qua nút "Chia sẻ bài viết…", đọc ngày đăng từ link thời gian
  (`aria-label` dạng "Thứ Sáu, 20 Tháng 11, 2026 lúc 22:24").
- Chỉ bấm Thích khi nút còn nhãn "Bày tỏ cảm xúc Thích…" (tức là chưa thích) → không bao giờ bỏ thích nhầm.
- Bỏ qua bình luận nếu đã thấy bình luận của chính bạn trong bài.
- Nhớ bài đã xử lý trong nhật ký, chạy lại không làm trùng.
- Tự dừng khi gặp checkpoint hoặc cảnh báo "bạn đang dùng tính năng quá nhanh".

## Khi Facebook đổi giao diện
Mọi nhãn/selector nằm trong `selectors.config.js`. Mở DevTools (F12), xem `aria-label` mới của nút rồi sửa file đó, sau đó bấm ↻ (tải lại) extension trong `chrome://extensions`.

## Lưu ý an toàn tài khoản
- Facebook phát hiện thao tác tự động. Nên giữ độ trễ 8–20 giây, tối đa ~15 bài/lượt.
- Bình luận lặp lại y hệt dễ bị coi là spam → nên có nhiều câu mẫu khác nhau.
- Chế độ "Tự động hoàn toàn" rủi ro cao hơn; Enter tự động có thể không được Facebook nhận, khi đó extension sẽ chờ bạn bấm Enter.
- Chưa kiểm tra được trạng thái "đã chia sẻ" trên Facebook, nên extension dựa vào nhật ký của chính nó.
