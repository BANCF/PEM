# 🔄 Sơ đồ Luồng Vận hành (Workflow) Hệ thống PEM

Dưới đây là sơ đồ luồng quy trình nghiệp vụ (Business Workflow) của toàn bộ hệ thống PEM. Bạn có thể sử dụng sơ đồ này để trình bày trực quan với Ban Giám Hiệu về cách hệ thống hoạt động khép kín, minh bạch và dân chủ.

```mermaid
graph TD
    %% Khởi tạo hệ thống
    subgraph GIAI ĐOẠN 1: THIẾT LẬP & KHỞI TẠO
        A[Admin Hệ thống] -->|Thiết lập| B[(Ngân hàng Quy định Thưởng/Phạt)]
        A -->|Phân quyền| C[Tài khoản Giáo viên, TTCM, BGH]
        D[Tất cả Giáo viên] -->|Bắt đầu tháng mới| E((Nhận 100 Điểm KPI Cơ bản))
    end

    %% Quá trình vận hành
    subgraph GIAI ĐOẠN 2: LẬP PHIẾU ĐÁNH GIÁ
        BGH[Ban Giám Hiệu] -->|Lập phiếu Phạt/Thưởng| F{Tạo Phiếu Đánh Giá}
        TTCM[Tổ Trưởng Chuyên Môn] -->|Lập phiếu Phạt/Thưởng| F
        GV[Giáo Viên] -->|Lập phiếu Thưởng Tối đa 5đ/tháng| F
    end

    F -->|Hệ thống ghi nhận| G[Gửi Thông Báo Tức Thì 🔔]
    G --> H[Phiếu ở trạng thái: ĐANG CHỜ PENDING]

    %% Xử lý Khiếu nại
    subgraph GIAI ĐOẠN 3: XỬ LÝ & KHIẾU NẠI (DÂN CHỦ)
        H -->|Trong vòng 48 Giờ| I{Giáo viên có khiếu nại?}
        
        I -->|Không khiếu nại| J[Hệ thống TỰ ĐỘNG CHỐT phiếu]
        
        I -->|Gửi Khiếu nại đính kèm Minh chứng| K[Phiếu chuyển sang: ĐANG KHIẾU NẠI]
        
        K --> L{BGH / TTCM Xét duyệt}
        
        L -->|Chấp nhận lời giải thích| M[HỦY BỎ phiếu phạt]
        L -->|Bác bỏ lời giải thích| N[GIỮ NGUYÊN phiếu phạt]
    end

    %% Cập nhật bảng xếp hạng
    subgraph GIAI ĐOẠN 4: TỔNG KẾT BẢNG XẾP HẠNG
        J --> O
        M -->|Không bị trừ điểm| O
        N --> O[Cập nhật vào Quỹ Điểm KPI]
        
        O --> P[Bảng Xếp Hạng Tổng & Tổ Bộ Môn]
        P --> Q[Xuất File Báo cáo Excel Cuối tháng]
    end

    %% Styles để sơ đồ đẹp hơn
    classDef admin fill:#f97316,stroke:#c2410c,stroke-width:2px,color:#fff,font-weight:bold
    classDef bgh fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff,font-weight:bold
    classDef gv fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff,font-weight:bold
    classDef process fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px
    classDef decision fill:#fef08a,stroke:#ca8a04,stroke-width:2px,color:#854d0e,font-weight:bold
    classDef final fill:#a855f7,stroke:#7e22ce,stroke-width:2px,color:#fff,font-weight:bold

    class A admin
    class BGH,TTCM bgh
    class GV,D gv
    class F,G,H,K,O process
    class I,L decision
    class J,M,N,P,Q final
```

## 💡 Cách thuyết trình sơ đồ này cho BGH:
1. **Tính Tự Động (Automation):** Nhấn mạnh vào việc mọi giáo viên đều có 100 điểm ban đầu. Khi có phiếu đánh giá lập ra, **mọi thứ tự động chạy** từ việc gửi thông báo đến việc tính toán điểm, BGH không cần phải bấm máy tính thủ công.
2. **Tính Dân Chủ (Democracy):** Hãy chỉ vào cụm logic **Giai đoạn 3 (Có nhánh kim cương vàng)**. Trình bày rằng hệ thống không mang tính "áp đặt". Giáo viên có hẳn 48 giờ để tự bảo vệ mình bằng cách nộp minh chứng. Điều này tạo sự công bằng và thấu tình đạt lý trong môi trường sư phạm.
3. **Tính Giới Hạn (Limits):** Nhấn mạnh việc Giáo viên được đánh giá đồng cấp nhưng bị khóa cứng ở **5 điểm/tháng**, ngăn chặn tuyệt đối hiện tượng "kéo bè kết phái" để bơm điểm cho nhau.
4. **Kết quả Cuối Cùng (End Result):** Tất cả đổ về Bảng xếp hạng và chốt bằng **File Báo cáo Excel Cuối tháng**, giải quyết hoàn toàn bài toán giấy tờ thủ công, mệt mỏi vào cuối mỗi kỳ tính lương.
