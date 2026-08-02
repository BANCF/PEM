export interface CriteriaItem {
  id: string;
  code: string;
  title: string;
  options: { label: string; score: number }[];
  maxScore: number;
}

export interface CriteriaGroup {
  id: string;
  title: string;
  maxScore: number;
  items: CriteriaItem[];
}

export const THI_DUA_CRITERIA_GROUPS: CriteriaGroup[] = [
  {
    id: "I",
    title: "I. NỀ NẾP KỈ LUẬT CHUNG",
    maxScore: 90,
    items: [
      {
        id: "I.1",
        code: "1",
        title: "1. Thực hiện quy định ngày công (Nghỉ có phép / không phép)",
        maxScore: 10,
        options: [
          { label: "Đi làm đầy đủ", score: 10 },
          { label: "Nghỉ 1 ngày CP/tháng", score: 7 },
          { label: "Nghỉ 2 ngày CP/tháng", score: 5 },
          { label: "Nghỉ 3 ngày CP trở lên hoặc 01 ngày KP trở lên", score: 0 }
        ]
      },
      {
        id: "I.2",
        code: "2",
        title: "2. Thực hiện nghiêm túc quy định về thời gian làm việc (giờ giấc, ra vào tiết, trực)",
        maxScore: 10,
        options: [
          { label: "Đúng giờ", score: 10 },
          { label: "Chấm công muộn / vào lớp muộn 1 lần/tháng", score: 7 },
          { label: "Chấm công muộn / vào lớp muộn 2 lần/tháng", score: 5 },
          { label: "Chấm công muộn / vào lớp muộn 3 lần/tháng", score: 3 },
          { label: "Vào lớp muộn sau 10' / Bỏ tiết / Ra ngoài không xin phép", score: 0 }
        ]
      },
      {
        id: "I.3",
        code: "3",
        title: "3. Thực hiện quy định về tiết kiệm điện (tắt điện, quạt, điều hòa khi ra khỏi phòng)",
        maxScore: 10,
        options: [
          { label: "Thực hiện nghiêm túc", score: 10 },
          { label: "Vi phạm 1 lần/tháng", score: 7 },
          { label: "Vi phạm 2 lần/tháng", score: 5 },
          { label: "Vi phạm từ 3 lần/tháng trở lên", score: 0 }
        ]
      },
      {
        id: "I.4",
        code: "4",
        title: "4. Chấp hành sự phân công của nhà trường",
        maxScore: 10,
        options: [
          { label: "Nghiêm chỉnh, tích cực, tự giác", score: 10 },
          { label: "Chưa tự giác, chưa tích cực, phải nhắc nhở", score: 5 },
          { label: "Không chấp hành", score: 0 }
        ]
      },
      {
        id: "I.5",
        code: "5",
        title: "5. Tham gia đầy đủ các buổi hội họp, sự kiện, hoạt động tập thể của nhà trường",
        maxScore: 10,
        options: [
          { label: "Tham gia đầy đủ và đúng giờ", score: 10 },
          { label: "Vắng 1 lần/tháng", score: 7 },
          { label: "Vắng 2 lần/tháng", score: 5 },
          { label: "Vắng 3 lần/tháng trở lên", score: 0 }
        ]
      },
      {
        id: "I.6",
        code: "6",
        title: "6. Thực hiện quy định đồng phục",
        maxScore: 10,
        options: [
          { label: "Thực hiện nghiêm túc", score: 10 },
          { label: "Vi phạm 1 lần/tháng", score: 7 },
          { label: "Vi phạm 2 lần/tháng", score: 5 },
          { label: "Vi phạm từ 3 lần/tháng trở lên", score: 0 }
        ]
      },
      {
        id: "I.7",
        code: "7",
        title: "7. Thực hiện quy định lịch trực",
        maxScore: 10,
        options: [
          { label: "Thực hiện nghiêm túc", score: 10 },
          { label: "Vi phạm 1 lần/tháng", score: 7 },
          { label: "Vi phạm 2 lần/tháng", score: 5 },
          { label: "Vi phạm từ 3 lần/tháng trở lên", score: 0 }
        ]
      },
      {
        id: "I.8",
        code: "8",
        title: "8. Không hút thuốc, rượu bia trong trường, không sử dụng điện thoại khi đang dạy học",
        maxScore: 10,
        options: [
          { label: "Thực hiện tốt", score: 10 },
          { label: "Vi phạm 1 lần/tháng", score: 7 },
          { label: "Vi phạm 2 lần/tháng", score: 5 },
          { label: "Vi phạm 3 lần/tháng trở lên", score: 0 }
        ]
      },
      {
        id: "I.9",
        code: "9",
        title: "9. Giao tiếp ứng xử chuẩn mực với đồng nghiệp, phụ huynh, học sinh",
        maxScore: 10,
        options: [
          { label: "Thực hiện tốt", score: 10 },
          { label: "Bị phản ánh 1 lần/tháng", score: 5 },
          { label: "Bị phản ánh từ 2 lần trở lên", score: 0 }
        ]
      }
    ]
  },
  {
    id: "II",
    title: "II. Ý THỨC GIÁO DỤC NỀ NẾP HỌC SINH",
    maxScore: 20,
    items: [
      {
        id: "II.1",
        code: "1",
        title: "1. Luôn giáo dục ý thức - nề nếp cho học sinh trong tiết dạy (đồng phục, vệ sinh, bàn ghế...)",
        maxScore: 10,
        options: [
          { label: "Thực hiện tốt", score: 10 },
          { label: "Từ 1-3 học sinh không thực hiện tốt nội quy", score: 5 },
          { label: "Trên 3 học sinh không thực hiện tốt nội quy", score: 0 }
        ]
      },
      {
        id: "II.2",
        code: "2",
        title: "2. Luôn giáo dục học sinh trong các hoạt động ngoài tiết dạy (cộng đồng, tập thể, an toàn)",
        maxScore: 10,
        options: [
          { label: "Giáo dục HS tích cực tham gia và nghiêm túc", score: 10 },
          { label: "HS chưa tích cực, còn vi phạm nhiều lần", score: 5 },
          { label: "Học sinh thường xuyên bị nhắc nhở, phê bình", score: 0 }
        ]
      }
    ]
  },
  {
    id: "III",
    title: "III. Ý THỨC TINH THẦN TRÁCH NHIỆM VỚI TẬP THỂ",
    maxScore: 50,
    items: [
      {
        id: "III.1",
        code: "1",
        title: "1. Luôn có ý thức giúp đỡ đồng nghiệp; chia sẻ công việc, kinh nghiệm",
        maxScore: 10,
        options: [
          { label: "Tích cực", score: 10 },
          { label: "Chưa tích cực", score: 5 },
          { label: "Không tích cực", score: 0 }
        ]
      },
      {
        id: "III.2",
        code: "2",
        title: "2. Thực hiện nghiêm túc, hiệu quả các công việc kiêm nhiệm ngoài chuyên môn",
        maxScore: 10,
        options: [
          { label: "Tích cực", score: 10 },
          { label: "Chưa tích cực", score: 5 },
          { label: "Không tích cực", score: 0 }
        ]
      },
      {
        id: "III.3",
        code: "3",
        title: "3. Tích cực, nhiệt tình khi tham gia các hoạt động chung của tập thể (tổ - trường) và PGD",
        maxScore: 10,
        options: [
          { label: "Tích cực", score: 10 },
          { label: "Chưa tích cực", score: 5 },
          { label: "Không tích cực", score: 0 }
        ]
      },
      {
        id: "III.4",
        code: "4",
        title: "4. Luôn có ý thức quảng bá - truyền thông hình ảnh, thành tích của trường tới PHHS",
        maxScore: 10,
        options: [
          { label: "Tích cực", score: 10 },
          { label: "Chưa tích cực", score: 5 },
          { label: "Không tích cực", score: 0 }
        ]
      },
      {
        id: "III.5",
        code: "5",
        title: "5. Luôn có tinh thần học hỏi, cầu tiến, tự học để hoàn thiện bản thân",
        maxScore: 10,
        options: [
          { label: "Tích cực", score: 10 },
          { label: "Chưa tích cực", score: 5 },
          { label: "Không tích cực", score: 0 }
        ]
      }
    ]
  },
  {
    id: "IV",
    title: "IV. KẾT QUẢ THỰC HIỆN CÁC NHIỆM VỤ GIÁO DỤC",
    maxScore: 50,
    items: [
      {
        id: "IV.1",
        code: "1",
        title: "1. Thực hiện chấm chữa VBT cuối tuần, vở ghi (đối với GVCN, GVBM)",
        maxScore: 10,
        options: [
          { label: "Chấm chữa và nhận xét chi tiết, thường xuyên", score: 10 },
          { label: "Có chấm chữa nhưng chưa chi tiết, thường xuyên", score: 5 },
          { label: "Có chấm bài nhưng còn sai sót, chưa chữa lỗi", score: 0 }
        ]
      },
      {
        id: "IV.2",
        code: "2",
        title: "2. Hồ sơ sổ sách (Lịch báo giảng, Giáo án, KH giảng dạy, sổ hội họp...)",
        maxScore: 10,
        options: [
          { label: "Đủ, sạch đẹp, khoa học, thực hiện đúng tiến độ", score: 10 },
          { label: "Chưa hoàn thiện một số nội dung", score: 5 },
          { label: "Thiếu hồ sơ", score: 0 }
        ]
      },
      {
        id: "IV.3",
        code: "3",
        title: "3. Dự giờ",
        maxScore: 10,
        options: [
          { label: "Đạt 4 tiết trở lên/tháng", score: 10 },
          { label: "3 tiết/tháng", score: 5 },
          { label: "2 tiết trở xuống/tháng", score: 0 }
        ]
      },
      {
        id: "IV.4",
        code: "4",
        title: "4. Thực hiện Kế hoạch giảng dạy",
        maxScore: 10,
        options: [
          { label: "Đúng tiến độ, không cắt xén, không dồn ghép", score: 10 },
          { label: "Bài dạy sai lệch so với KHGD, Lịch báo giảng", score: 5 },
          { label: "Không đảm bảo tiến độ chương trình", score: 0 }
        ]
      },
      {
        id: "IV.5",
        code: "5",
        title: "5. Chất lượng giờ dạy - Ứng dụng CNTT, đổi mới PP dạy học",
        maxScore: 10,
        options: [
          { label: "Được đánh giá Tốt", score: 10 },
          { label: "Được đánh giá Khá", score: 5 },
          { label: "Được đánh giá Trung bình", score: 0 }
        ]
      }
    ]
  }
];

export const TOTAL_MAX_SCORE = 210;
