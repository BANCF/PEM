/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: TỰ ĐỘNG LẤY FILE TKB TỪ GMAIL & CẬP NHẬT VÀO PEM
 * ==============================================================================
 * 
 * HƯỚNG DẪN THIẾT LẬP (CHỈ LÀM 1 LẦN DUY NHẤT):
 * 
 * 1. Truy cập vào trang Google Apps Script: https://script.google.com/
 * 2. Bấm nút "Dự án mới" (New Project).
 * 3. Xóa hết mã mặc định và dán toàn bộ đoạn mã bên dưới vào file Code.gs.
 * 4. Cấu hình 2 thông số ở đầu file:
 *    - PEM_API_URL: Link API của ứng dụng PEM (ví dụ: https://pem-app.vercel.app/api/schedule/auto-import)
 *    - SECRET_KEY: Mã bí mật khớp với TKB_AUTO_IMPORT_SECRET trên PEM (Mặc định: PEM_TKB_SECRET_2026)
 * 5. Bấm nút "Lưu" (Biểu tượng đĩa mềm hoặc Ctrl + S).
 * 6. Chạy thử hàm `checkAndImportTKB` bằng cách chọn tên hàm ở thanh công cụ phía trên và bấm "Chạy" (Run).
 *    (Ở lần đầu tiên, Google sẽ yêu cầu cấp quyền đọc Gmail -> Bấm "Advanced" / "Nâng cao" -> "Go to Project (unsafe)" -> "Allow").
 * 7. Thiết lập chạy tự động (Trigger):
 *    - Nhấp vào biểu tượng Đồng hồ (Triggers) ở thanh menu bên trái.
 *    - Bấm nút "+ Thêm bộ kích hoạt" (+ Add Trigger) góc dưới bên phải.
 *    - Chọn hàm: `checkAndImportTKB`
 *    - Chọn nguồn sự kiện: "Theo thời gian" (Time-driven)
 *    - Chọn loại bộ kích hoạt: "Trình kích hoạt theo phút" (Minutes timer) -> "Mỗi 15 phút" (Every 15 minutes).
 *    - Bấm Lưu.
 * 
 * XONG! Từ nay bất kỳ khi nào nhà trường gửi mail TKB đính kèm file Excel (.xlsx),
 * Gmail sẽ tự động gửi file về PEM và cập nhật TKB chính thức tức thì!
 * ==============================================================================
 */

// ⚙️ CẤU HÌNH HỆ THỐNG
const PEM_API_URL = "https://<DOMAIN_CỦA_BẠN>/api/schedule/auto-import"; // Thay bằng tên miền PEM thực tế của bạn
const SECRET_KEY = "PEM_TKB_SECRET_2026"; // Mã bí mật xác thực API

// Từ khóa tìm kiếm Gmail (Tìm mail chưa đọc có file đính kèm excel và tiêu đề có TKB hoặc Thời khóa biểu)
const GMAIL_SEARCH_QUERY = 'has:attachment filename:xlsx label:unread (subject:TKB OR subject:"Thời khóa biểu")';

function checkAndImportTKB() {
  Logger.log("🔍 Đang kiểm tra Gmail tìm mail TKB mới...");

  // Tìm các luồng thư khớp điều kiện
  const threads = GmailApp.search(GMAIL_SEARCH_QUERY, 0, 5);

  if (threads.length === 0) {
    Logger.log("ℹ️ Không tìm thấy email TKB mới nào chưa đọc.");
    return;
  }

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      if (!message.isUnread()) continue;

      const subject = message.getSubject();
      const attachments = message.getAttachments();

      for (let k = 0; k < attachments.length; k++) {
        const attachment = attachments[k];
        const fileName = attachment.getName();

        // Kiểm tra đúng định dạng file Excel (.xlsx)
        if (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")) {
          Logger.log("📄 Phát hiện file TKB: " + fileName + " trong mail: " + subject);

          try {
            // Mã hóa file sang Base64 để gửi qua JSON API
            const fileBytes = attachment.getBytes();
            const base64Data = Utilities.base64Encode(fileBytes);

            const payload = {
              fileName: fileName,
              fileBase64: base64Data,
              emailSubject: subject,
              receivedDate: message.getDate().toISOString()
            };

            const options = {
              method: "post",
              contentType: "application/json",
              headers: {
                "x-import-secret": SECRET_KEY
              },
              payload: JSON.stringify(payload),
              muteHttpExceptions: true
            };

            Logger.log("🚀 Đang gửi file lên PEM Server...");
            const response = UrlFetchApp.fetch(PEM_API_URL, options);
            const responseText = response.getContentText();
            const responseCode = response.getResponseCode();

            Logger.log("Response Code: " + responseCode);
            Logger.log("Response Text: " + responseText);

            if (responseCode === 200) {
              const resJson = JSON.parse(responseText);
              Logger.log("🎉 CẬP NHẬT THÀNH CÔNG: " + resJson.message);
              
              // Đánh dấu email đã đọc để không gửi lặp lại
              message.markRead();

              // Gửi email xác nhận ngắn gọn về chính mail của bạn (Tùy chọn)
              /*
              GmailApp.sendEmail(
                Session.getActiveUser().getEmail(),
                "✅ [PEM Auto] Đã cập nhật TKB chính thức: " + fileName,
                "Hệ thống PEM đã tự động đọc và cập nhật TKB từ email: " + subject + "\n" +
                "Số lớp: " + resJson.classesCount + ", Số giáo viên: " + resJson.teachersCount
              );
              */
            } else {
              Logger.log("❌ Lỗi từ Server PEM: " + responseText);
            }
          } catch (err) {
            Logger.log("💥 Lỗi xử lý gửi file: " + err.toString());
          }
        }
      }
    }
  }
}
