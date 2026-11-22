// =====================================================================
// TOÀN BỘ NHÃN / SELECTOR CỦA FACEBOOK NẰM Ở ĐÂY.
// Khi Facebook đổi giao diện, chỉ cần sửa file này.
// Các nhãn tiếng Việt đã được kiểm tra thực tế trên fanpage
// tieuhoc.thcspascal ngày 22/11/2026. Nhãn tiếng Anh là dự phòng (chưa kiểm tra).
// =====================================================================
const FB_SELECTORS = {
  // Nút "Bộ lọc" trong phần Bài viết của fanpage
  filterButton: ['[aria-label="Bộ lọc"]', '[aria-label="Filters"]'],
  // Hộp thoại bộ lọc: combobox[0] = Năm, combobox[1] = Tháng (chỉ hiện sau khi chọn năm)
  combobox: '[role="combobox"]',
  option: '[role="option"]',
  monthOptionText: (m) => [`Tháng ${m}`, ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]],
  doneButtonText: ['Xong', 'Done'],

  // Mỗi bài viết nằm trong 1 khối có thuộc tính aria-posinset
  postContainer: '[aria-posinset]',

  // Nút Chia sẻ của bài (dùng làm "mỏ neo" để tìm từng bài)
  shareButton: ['[role="button"][aria-label^="Chia sẻ bài viết"]', '[role="button"][aria-label^="Send this to friends"]'],

  // Nút Thích khi CHƯA thích. Khi đã thả cảm xúc, nhãn sẽ đổi khác -> extension bỏ qua.
  // (KHÔNG nhầm với "Thích: 36 người" là danh sách người đã thích)
  likeNotYet: ['[role="button"][aria-label^="Bày tỏ cảm xúc Thích"]', '[role="button"][aria-label="Like"]'],

  // Nút Bình luận và ô nhập bình luận
  commentButton: ['[role="button"][aria-label^="Bình luận về bài viết"]', '[role="button"][aria-label^="Leave a comment"]'],
  commentBox: ['[role="textbox"][aria-label^="Bình luận dưới tên"]', '[role="textbox"][aria-label^="Comment as"]'],
  commentBoxNamePrefix: ['Bình luận dưới tên ', 'Comment as '],
  commentSubmitButton: [
    '[role="button"][aria-label="Bình luận"]',
    '[role="button"][aria-label="Comment"]',
    '#focused-state-composer-submit [role="button"]'
  ],

  // Hộp thoại chia sẻ
  shareNow: ['[role="button"][aria-label="Chia sẻ ngay"]', '[role="button"][aria-label="Share now"]'],
  closeDialog: ['[aria-label="Đóng"]', '[aria-label="Close"]'],

  // Link thời gian đăng bài có aria-label dạng "Thứ Sáu, 20 Tháng 11, 2026 lúc 22:24"
  timestampRegex: /(\d{1,2}) [Tt]háng (\d{1,2}),? (\d{4})/,
  // Chữ hiển thị dạng "14 tháng 11 lúc 08:15" (năm hiện tại)
  shortDateRegex: /(\d{1,2}) [Tt]háng (\d{1,2})(?:,? (\d{4}))?/,
  // Thời gian tương đối: "3 giờ", "1 ngày", "15 phút", "Vừa xong"
  relativeRegex: /^(\d+)\s*(phút|giờ|ngày|m|h|d)$/,

  // Dấu hiệu bị Facebook cảnh báo -> dừng ngay
  dangerTexts: ['quá nhanh', 'tạm thời bị chặn', 'đã bị chặn', 'Xác nhận đó là bạn', 'going too fast', 'Temporarily Blocked', 'Confirm it\'s you']
};
