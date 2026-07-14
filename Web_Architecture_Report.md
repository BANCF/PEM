# BÁO CÁO KỸ THUẬT: PHÂN TÍCH KIẾN TRÚC & REVERSE ENGINEERING TRANG WEB PLATFORM NĂM HỌC MỚI (`idcloud.vn`)

**Tác giả:** Chuyên gia Phân tích Hệ thống & Kỹ sư Reverse Engineering Web (Antigravity IDE Senior Extension Developer)  
**Ngày thực hiện:** 14/07/2026  
**Đối tượng phân tích:** Thư mục mã nguồn `idcloud.vn` tại workspace (`d:\OneDrive\Công việc\Classhub_pro - TEST\idcloud.vn`)

---

## 1. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Bản báo cáo này cung cấp bản đồ kỹ thuật toàn diện thu được từ quá trình phân tích tĩnh (static analysis) mã nguồn của nền tảng giáo dục số **idcloud.vn** (đơn vị triển khai tiêu biểu: *Sở Giáo dục và Đào tạo Khánh Hòa* - Tenant ID `61892`).

Hệ thống được xây dựng theo kiến trúc **SPA (Single Page Application) lai (Hybrid Client-Server Rendering)**, kết hợp giữa mô hình Component/Agent động tải từ máy chủ thông qua giao thức **RPC (Remote Procedure Call)** và hệ thống **Plugin/Widget phía Client** cực kỳ phong phú.

### Các đặc điểm kiến trúc cốt lõi:
1. **Sự phân tách rõ ràng giữa Core Framework và Tenant Site:**
   - `appstart/`: Chứa toàn bộ core engine (`Ohke`, `Inno`), các bundle JavaScript/CSS, hệ thống widget (`ohke-agent-field`, `filter-list`, `inline-editor`...) và locale.
   - `61892/`: Chứa cấu hình riêng của tenant, cấu trúc layout gốc (`index.html`) và các biến cấu hình khởi tạo.
2. **Cơ chế Component Loader (`agentLoad` & `Ohke.loadHtml`):**
   Thay vì tải toàn bộ trang HTML khi điều hướng, giao diện được chia nhỏ thành các **"Agent"** (`.agent-container`). Mỗi Agent gọi yêu cầu `POST` dạng JSON RPC (với HTTP header `ohke-ajax: 1`) tới các endpoint dạng `/appstart/about/x..._Viewer` hoặc `/appstart/about/x..._Model` để lấy HTML template động và gắn vào DOM.
3. **Hệ sinh thái Widget & Dynamic Binding:**
   Hệ thống sử dụng jQuery làm nền tảng DOM thao tác chính, kết hợp với bộ engine tự xây dựng (`IDApplicator`, `Twig.js` cho live template rendering, `KaTeX` cho hiển thị công thức toán học, `chosen.jquery` cho combobox nâng cao, và `ChunkUpload` cho tải lên tập tin lớn phân mảnh).
4. **Cầu nối Native Mobile (WebView Bridge):**
   Tích hợp sẵn bộ giao tiếp hai chiều với ứng dụng di động iOS/Android (`MobileNative`) để thực hiện quét mã vạch/QR/tài liệu (`SCAN`, `SCANNED`) và đồng bộ ngôn ngữ.

---

## 2. KIẾN TRÚC CẤU TRÚC THƯ MỤC & TÀI NGUYÊN (DIRECTORY & RESOURCE ARCHITECTURE)

Qua quá trình quét toàn diện thư mục `idcloud.vn`, cấu trúc hệ thống được lập chỉ mục đầy đủ như sau:

```text
d:\OneDrive\Công việc\Classhub_pro - TEST\idcloud.vn/
│
├── 61892/                              <-- [TENANT SITE - SỞ GD&ĐT KHÁNH HÒA]
│   ├── index.html                      <-- Trang chủ chính, khai báo layout DOM & cấu hình Ohke.SITE
│   └── favicon.ico / icons...
│
├── robots.txt.html                     <-- Trang Application Launcher (App Menu & Navigation Grid)
│
└── appstart/                           <-- [CORE FRAMEWORK & RESOURCE PATH]
    └── resource/
        ├── bundle/prod/
        │   ├── inno-main-8c7c7f0fbe83e3dfc967.css  <-- CSS bundle tổng hợp (309 KB)
        │   └── inno-main-8c7c7f0fbe83e3dfc967.js   <-- JS bundle chính (1.12 MB, Webpack)
        │
        └── common/
            ├── css/
            │   ├── ohke.min.css@v=1.1.133          <-- Stylesheet core của UI Ohke
            │   └── w3.css@v=1.1.133                <-- Framework CSS nền (W3.CSS modified)
            │
            ├── js/
            │   ├── ohke.min.js@v=1.1.133           <-- Engine cốt lõi (Ohke, OhkePlugin, WizardForm, Debug)
            │   ├── chunk_upload.min.js@v=1.1.133   <-- Engine tải lên file phân mảnh (ChunkUpload)
            │   ├── locale/vi.js@v=82f2297b         <-- Từ điển ngôn ngữ tiếng Việt (inno.locale)
            │   ├── sidebar/sidebar.min.js@v=1.1.133<-- Quản lý thanh điều hướng bên (sb_open/sb_close)
            │   ├── widget/                         <-- [HỆ THỐNG WIDGET GIAO DIỆN CỐT LÕI]
            │   │   ├── ohke-agent-field.min.js     <-- Quản lý WidgetBase & ProxyWidget (Text, Date, File, Image...)
            │   │   ├── ohke-inline-editor.min.js   <-- Bảng chỉnh sửa trực tiếp (Inline Grid Editor)
            │   │   ├── ohke-popup.min.js           <-- Quản lý Popup/Modal động
            │   │   ├── ohke-mobile.min.js          <-- Cầu nối WebView với app Android/iOS
            │   │   ├── ohke-adv-combo.min.js / ohke-mc-combo.min.js / ohke-switch.min.js
            │   │   └── filter-list.min.js / limit-date.min.js / ohke-slideshow.min.js
            │   │
            │   └── plugin/                         <-- [PLUGINS & CORE EXTENSIONS]
            │       ├── id-rpc.min.js@v=1.1.133     <-- Giao thức mạng RPC & xử lý ajax response
            │       ├── id-applicator.min.js        <-- Binding dữ liệu vào form (IDApplicator)
            │       ├── id-diagram.min.js           <-- Vẽ & hiển thị sơ đồ
            │       ├── id-math.min.js              <-- Xử lý hiển thị công thức KaTeX
            │       ├── inno-drawing/               <-- Công cụ vẽ đồ họa trên web
            │       └── support-detector.min.js / es6-supported.min.js
            │
            └── vendor/                         <-- [THƯ VIỆN BÊN THỨ BA ĐÃ TỐI ƯU]
                ├── jquery/jquery-3.6.0.min.js
                ├── chosen/chosen.jquery.ext.min.js <-- Select2/Chosen dropdown cải tiến
                ├── tinymce/tinymce.min.js          <-- Trình soạn thảo văn bản giàu (Rich Text)
                ├── twig/twig.min.js                <-- Client-side Template Engine
                ├── katex/katex.min.js              <-- Library hiển thị công thức toán học
                ├── sha256/sha256.min.js            <-- Băm mật khẩu client-side
                └── moment / daterangepicker / codemirror / hammer...
```

---

## 3. PHÂN TÍCH CẤU TRÚC DOM & TEMPLATE ENGINE (DOM & TEMPLATE ANALYSIS)

### 3.1. Cấu trúc Giao diện Gốc (`61892/index.html`)
File `61892/index.html` đóng vai trò là khung chứa (Shell) cho toàn bộ ứng dụng của tenant Khánh Hòa.

- **Khởi tạo Namespace Cấu hình toàn cục:**
  Tại đoạn script đầu (`#L130-L150`), hệ thống thiết lập đối tượng cấu hình `ojs` (Ohke JavaScript Setting) và thông tin site:
  ```javascript
  var ojs = {
    "field-34F181B18D37D3E": { "action": "x34F18_Action" },
    // Cấu hình action động cho các trường form theo ID hex
  };
  window.Ohke = window.Ohke || {};
  Ohke.SITE = { id: 61892, name: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO KHÁNH HÒA' };
  ```
- **Hệ thống Template con & Các Component (Agents):**
  Trong body của `index.html`, các khu vực giao diện không được render cứng mà chia thành các container chứa thuộc tính `data-env` (dưới dạng chuỗi JSON mã hóa tham số ngữ cảnh) và gọi hàm khởi tạo `agentLoad()`:
  - Container Sidebar & Header.
  - Các Agent Form (`xSB_Viewer`, `xTB_Viewer`, `x24F00_Model`).
  - Khi tải trang, trình duyệt thực thi đoạn mã tự mồi (`bootstrap`):
    ```javascript
    agentLoad('/appstart/about/x24F00_Model?a=...', { env: {...} }, '#agent-root');
    ```

### 3.2. Cấu trúc Application Launcher (`robots.txt.html`)
Mặc dù đặt tên file là `robots.txt.html`, thực chất đây là trang **App Launcher / Dashboard Menu** của người dùng sau khi đăng nhập.
- Sử dụng hàm tiện ích `$.createList(...)` hoặc `$.createGrid(...)` để render động danh sách các mô-đun ứng dụng (quản lý lớp học, điểm số, học liệu...).
- Mỗi item trong danh sách chứa liên kết điều hướng SPA dựa trên `inno.History`.

### 3.3. Template Engine Động phía Client (`Twig.js` & `KaTeX`)
Hệ thống sử dụng kết hợp các thẻ `<template>` HTML5 nguyên bản và thư viện **Twig.js** để render trực tiếp dữ liệu tại trình duyệt (được quản lý bởi `WidgetTemplateHtmlLive` trong `ohke-agent-field.min.js`):
- Khi thuộc tính `data-based-on-field` được khai báo, widget sẽ lấy chuỗi template từ trường phụ thuộc, biên dịch với `Twig.twig({ data: ... })` và render ra `div.template-html-result`.
- Nếu `data-has-math-inside` có giá trị `true`, hệ thống lập tức gọi `initIDMath()` để biên dịch công thức toán học LaTeX thông qua **KaTeX**.

---

## 4. CƠ CHẾ KHỞI TẠO, ĐỊNH TUYẾN & QUẢN LÝ TRẠNG THÁI (SPA ROUTING & STATE MANAGEMENT)

### 4.1. Định tuyến Client-Side (`inno.History`)
Phân tích `inno-main-8c7c7f0fbe83e3dfc967.js` (module `3263()`) cho thấy hệ thống xây dựng bộ quản lý định tuyến độc lập `window.inno.History`:
- Lắng nghe sự kiện `popstate` của trình duyệt.
- Cung cấp các phương thức `push(url, state, opts)`, `replace(url, state, opts)`, và `go(n)` để thay đổi URL mà không làm tải lại trang (`location.pathname + location.search + location.hash`).
- Kích hoạt sự kiện `onChange` để các Agent đang active trên DOM tự cập nhật nội dung tương ứng với URL mới.

### 4.2. Cơ chế Component Loader (`agentLoad` & `Ohke.loadHtml`)
Luồng dữ liệu chuẩn khi một Agent hoặc Form được tải/làm mới:
1. Trình duyệt gọi `Ohke.loadHtml(url, $container, opts)` (hoặc `agentLoad`).
2. Yêu cầu `fetch` hoặc `$.ajax` được gửi đi với Header bắt buộc:
   ```http
   ohke-ajax: 1
   Content-Type: application/json;charset=UTF-8
   ```
3. Máy chủ phản hồi đoạn mã HTML/JSON. Nếu là HTML, `Ohke.loadHtml` chèn vào `$container`, sau đó tự động kích hoạt:
   - `$(document).triggerHandler('agent-loaded', [$container])`
   - `$container.agentFieldInit()` để bind toàn bộ các widget động vào các trường vừa được chèn.

### 4.3. Quản lý Bộ nhớ đệm Trạng thái (`inno.cache` & `AgentRegistry`)
- **Session Cache (`inno.cache.sessionSave / sessionLoad` - Module `9581()`):**
  Lưu trữ các bộ lọc (filter parameters), trạng thái form vào `sessionStorage` để duy trì khi người dùng chuyển qua lại giữa các tab/agent.
- **Quản lý Vòng đời & Ngăn rò rỉ Bộ nhớ (`AgentRegistry` - Module `7839()`):**
  Sử dụng `MutationObserver` theo dõi `document.body` với `childList: true, subtree: true`. Khi phát hiện một DOM node bị xóa (`removedNodes`), hệ thống kiểm tra trong `WeakMap` của `AgentRegistry`: nếu node hoặc con của node đó là một Agent có phương thức `destroy()`, nó tự động dọn dẹp các sự kiện và timer liên quan.

---

## 5. BẢN ĐỒ CÁC TÍNH NĂNG & KHUNG WIDGET (WIDGET & COMPONENT ARCHITECTURE)

Toàn bộ các thành phần tương tác trên form đều được điều khiển qua cơ chế tự nhận diện của `$.fn.agentFieldInit()` (trong `ohke-agent-field.min.js`). Khi một form được load, hệ thống quét các phần tử có class `.agent-field` và ánh xạ thuộc tính `data-agent-class` tới các class `ProxyWidget`:

| Tên Widget (`ProxyWidget`) | Class / Thuộc tính tương ứng | Chức năng Kỹ thuật & Logic Xử lý |
| :--- | :--- | :--- |
| **`WidgetBase` / `WidgetText`** | Mặc định (`WidgetText`, `WidgetNText`, `WidgetHidden`) | Xử lý các sự kiện thay đổi dữ liệu cơ bản (`agent:change`, `change`), đồng bộ giá trị với thuộc tính `depend-content` trên các form liên kết. |
| **`WidgetRichText`** | `WidgetRichText` | Tích hợp trình soạn thảo **TinyMCE** (`tinymce.get(id)`). Tự động đồng bộ nội dung từ editor về trường input ẩn và gọi `save()` trước khi submit. |
| **`WidgetTemplateHtmlLive`** | `WidgetTemplateHtmlLive` | Render HTML động theo thời gian thực sử dụng **Twig.js** và biên dịch công thức toán học **KaTeX** (`IDMath`). |
| **`WidgetPassword`** | `WidgetPassword` | **Bảo mật client-side:** Chặn sự kiện `beforeinput`/`input`, giữ giá trị thật trong bộ nhớ (`tValue`), chỉ hiển thị dấu `*` trên ô input. Khi `blur` hoặc `Enter`, tự động băm SHA-256 và tính độ mạnh mật khẩu, đóng gói thành định dạng: `v3:{length}:{strength}:{hashSHA256}`. |
| **`WidgetCombo` / `WidgetMCombo`** | `WidgetCombo`, `WidgetMCombo` (Dropdown đơn / đa chọn) | Sử dụng `chosen.jquery.ext.min.js`. Khi nhận sự kiện `agent:push` (load danh sách con phụ thuộc), widget tự động thu thập các trường phụ thuộc (`dependsOn`, `master_key`, `father_master_key`), tính băm SHA-256 để kiểm tra thay đổi, và gọi `Ohke.loadHtml` tới `action` endpoint để lấy các thẻ `<option>` mới. |
| **`WidgetDate`** | `WidgetDate` | Tích hợp thư viện `daterangepicker`. Xử lý sự kiện `set-value.daterangepicker` để định dạng ngày/tháng/năm chuẩn xác. |
| **`WidgetNumber` / `WidgetNumber2`** | `WidgetNumber`, `WidgetNumber2` | Định dạng số động theo locale Việt Nam (`decimalSeparator = ','`, `thousandSeparator = '.'` hoặc ngược lại), hỗ trợ làm tròn theo `precision`, nút bấm tăng/giảm (`+`/`-` button step) với gia tốc tốc độ khi giữ chuột (`setInterval`). |
| **`WidgetFormula`** | `WidgetFormula` | Cung cấp công cụ tính toán công thức (`Variable`, `Compute`). Phân tích cú pháp `{{ varName:label }}` trong công thức, tạo bảng nhập tham số động, và gửi yêu cầu RPC (`compute-url`) để máy chủ hoặc trình duyệt thực thi phép tính. |
| **`WidgetFile` / `WidgetImage`** | `WidgetFile`, `WidgetImage` | Quản lý tải lên tệp tin và hình ảnh. Sử dụng **ChunkUpload** để upload phân mảnh, hỗ trợ cào ảnh từ URL từ xa (`action-craw`), và đặc biệt hỗ trợ **dán trực tiếp ảnh từ Clipboard (`paste.png`/`paste.jpg`)** qua `XMLHttpRequest PUT`. |
| **`WidgetApplicator`** | `WidgetApplicator` | Khởi tạo engine `IDApplicator` giúp ánh xạ dữ liệu phức tạp từ nguồn vào các trường DOM của form theo cấu hình binding. |
| **`WidgetSwitch`** | `WidgetSwitch` | Công tắc bật/tắt động (`0` hoặc `1`), ánh xạ giá trị vào input điều khiển (`switch-container`). |
| **`WidgetNapasPaymentQr`** | `WidgetNapasPaymentQr` | Render và tự động cập nhật mã QR thanh toán NAPAS cho các giao dịch học phí/dịch vụ trên hệ thống. |

### Các Mô-đun Nâng cao Khác:
- **Bảng Chỉnh sửa Trực tiếp (`InlineEditor` - `ohke-inline-editor.min.js`):**
  Cho phép sửa trực tiếp trên lưới dữ liệu `.agent-list`. Hỗ trợ điều hướng bằng phím (`Tab`, `Enter`, `Arrow Up/Down/Left/Right`), tự động kiểm tra độ dài/số thập phân (`lie-length`, `lie-precision`), và gửi gói tin update tức thì qua `action.update({ field_name, field_value, id, update_time })` khi `blur`. Tự động xử lý phản hồi từ server để reload dòng (`reload_item`) hoặc toàn danh sách (`reload_list`).
- **Hệ thống Popup & Floating Window (`Popup` - `ohke-popup.min.js`):**
  Quản lý các modal (`w3-modal`, `z-modal`) và popup ngữ cảnh (`.ohke-popup-subform`). Tính toán tự động tọa độ (`show_at: top-right, bottom-center, show-at-field...`), tự động định vị lại khi kích thước trình duyệt hoặc phần tử neo thay đổi, hỗ trợ tự động ẩn khi di chuột ra ngoài (`hide_on_mouseleave`) hoặc click ra ngoài.
- **Thanh Điều hướng Bên (`Sidebar` - `sidebar.min.js`):**
  Quản lý hiệu ứng accordion (`sb_open`/`sb_close` với `animate` height 400ms). Hỗ trợ chuyển đổi chế độ giao diện (`sb-mode`) và lưu cấu hình lên máy chủ qua RPC `/jsonGetSidebarMode/${mode}`.

---

## 6. BẢN ĐỒ API & GIAO THỨC MẠNG (API ENDPOINTS & NETWORK PROTOCOL)

### 6.1. Giao thức Chuẩn & Request Headers
Toàn bộ giao tiếp mạng trên hệ thống (cả `fetch` lẫn `$.ajax`) đều được trung gian qua lớp `Ohke.rpc2` / `inno.network.rpc` và bắt buộc phải tuân thủ HTTP Header:
```http
ohke-ajax: 1
Content-Type: application/json;charset=UTF-8
X-Requested-With: XMLHttpRequest
```

### 6.2. Bản đồ Endpoints Phát hiện trong Mã nguồn
Dưới đây là các nhóm Endpoint API chính xác định được từ việc truy vết cấu hình và code JS:

| Nhóm Chức năng | Phương thức | Endpoint Pattern / URL thực tế | Mô tả |
| :--- | :--- | :--- | :--- |
| **Core Form/Agent Loaders** | `POST` | `/appstart/about/xSB_Viewer`<br>`/appstart/about/xTB_Viewer`<br>`/appstart/about/x24F00_Model` | Tải giao diện và dữ liệu cho các Agent (Sidebar, Topbar, Form chính). Tham số `env` được mã hóa trong query hoặc payload. |
| **Xác thực & Quyền hạn** | `GET` | `${inno.env.baseUrl}/auth/apps-accessible?v={hash}` | Kiểm tra và trả về danh sách các ứng dụng/mô-đun người dùng hiện tại có quyền truy cập (`inno.app.getAccessible`). |
| **Bộ lọc Nâng cao (List Filter)**| `POST` | `{urlList}/filter_save`<br>`{urlList}/filter_remove` | Lưu cấu hình tìm kiếm nâng cao (`op0`, `op1`, `op2`, `op3`) hoặc xóa cấu hình đã lưu. |
| **Tải lên & Cào tập tin (`Uploader`)**| `PUT`<br>`POST` | `/uploader/uploadfile`<br>`/uploader/crawfile`<br>`{Ohke.BASE_URL}/{action-upload}` | `PUT`: Upload chunk phân mảnh từ `ChunkUpload` hoặc clipboard.<br>`POST`: Yêu cầu máy chủ tải tập tin/hình ảnh từ một URL từ xa (`crawfile`). |
| **Xử lý Mật khẩu & Passcode** | `POST` | `/digitalismspace/jsonPostSetPasscode`<br>`/digitalismspace/modalPasscode` | Đặt mã PIN bảo mật 2 lớp hoặc lấy modal xác thực passcode khi thực hiện các tác vụ nhạy cảm (`Ohke.passcode`). |
| **Cấu hình Người dùng & Locale** | `POST` | `/{SITE.id}/appstart/digitalismspace/jsonGetSidebarMode/{mode}`<br>`/{SITE.id}/appstart/digitalismspace/jsonGetChooseLanguage/{lang}` | Cập nhật chế độ hiển thị của Sidebar hoặc thay đổi ngôn ngữ hệ thống (`LANGUAGE_UPDATE`). |
| **Chỉnh sửa Form Editor** | `GET` | `/1/appstart/app_gen_2/Editor/{formId}` | Mở trình chỉnh sửa cấu trúc Form (chỉ kích hoạt trong chế độ `Ohke.debug` khi giữ phím `Alt`). |

### 6.3. Định dạng Phản hồi từ Máy chủ (Server Response Handling)
Trong file `id-rpc.min.js`, lớp `RPC` xử lý đa dạng các dạng cấu trúc phản hồi từ máy chủ (`response.type`):
1. **`success`:** Yêu cầu thành công. Cung cấp `response.data`. Nếu có mảng `warnings`, hệ thống hiển thị popup cảnh báo nhẹ nhưng vẫn tiếp tục luồng.
2. **`invalid`:** Lỗi xác thực dữ liệu đầu vào. Trả về map lỗi tương ứng với từng tên trường (`field_name`), hệ thống tự động bôi đỏ (`.ohke-error-control`) và hiển thị thông báo lỗi bên dưới ô input.
3. **`redirect`:** Yêu cầu chuyển hướng trình duyệt tới `response.url` hoặc tải lại trang.
4. **`passcode_required`:** Máy chủ yêu cầu xác thực mã passcode. Hệ thống tạm dừng luồng RPC hiện tại và mở modal `Ohke.passcode.open()`.
5. **`wait` (Long Polling / Asynchronous Job):** Trả về `long-request-id`. Trình duyệt khởi tạo vòng lặp kiểm tra định kỳ (polling) với máy chủ cho đến khi công việc xử lý ngầm hoàn tất (`onJobResolved`).

### 6.4. Giao thức Tải lên Phân mảnh (`ChunkUpload Protocol`)
Trong `chunk_upload.min.js`, khi một tập tin vượt ngưỡng hoặc được tải lên qua `WidgetFile`/`WidgetImage`:
- Tập tin được cắt thành các đoạn nhỏ (`chunkSize = 102,400 bytes` ~ 100 KB).
- Gửi tuần tự qua các HTTP `PUT` request với Header:
  - `Name`: Tên tệp tin đã URL encode.
  - `Size`: Tổng dung lượng file.
  - `Category`: `image` hoặc `binary`.
  - `Range`: `"0-102400"`, `"102400-204800"`...
  - `File-id`: Từ chunk thứ 2 trở đi, gửi kèm ID nhận được từ phản hồi của chunk đầu tiên để máy chủ nối file.

---

## 7. TÍCH HỢP MOBILE APP & CẦU NỐI NATIVE (MOBILE APP & NATIVE BRIDGE)

Phân tích `ohke-mobile.min.js` (`v=1.1.133`) cho thấy hệ thống được thiết kế để hoạt động mượt mà khi nhúng bên trong ứng dụng di động iOS/Android (Classhub Pro Mobile App):

### 7.1. Nhận diện Môi trường (`Ohke.mobile.isWebView`)
Hệ thống tự động phát hiện WebView bằng cách kiểm tra sự tồn tại của bridge JS:
- **Android:** `typeof MobileNative !== "undefined" && typeof MobileNative.postMessage == "function"`
- **iOS:** `window.webkit.messageHandlers.MobileNative.postMessage`

### 7.2. Giao thức Truyền tin Bridge (`Ohke.mobile.push` / `newAction`)
Khi giao diện Web cần tương tác với phần cứng thiết bị di động, nó gửi thông điệp JSON qua bridge:
- **Quét Mã vạch / QR / Tài liệu (`requestScan`):**
  Gửi lệnh `"SCAN_START"` và `"SCAN"` với tham số `{ source: '#field-id', mode: 'C' }` (hoặc `requestScanNext`, `requestScanAgain`).
- **Nhận kết quả Quét (`onScanned`):**
  Khi ứng dụng di động quét xong, nó gọi ngược lại hàm toàn cục JS: `Ohke.mobile.newAction("SCANNED", { source: '#field-id', result: '...' })`.
  Hệ thống lập tức kích hoạt `$(source).triggerHandler("agent:change", [result])` để nạp dữ liệu vừa quét vào trường input trên web.
- **Đồng bộ Ngôn ngữ (`LANGUAGE_UPDATE`):**
  Đảm bảo ngôn ngữ trên WebView luôn đồng bộ với cài đặt ngôn ngữ của ứng dụng di động native thông qua `Ohke.worker.lang`.

---

## 8. KHẢO SÁT VỀ MÃ RỐI/MINIFICATION & KHUYẾN NGHỊ KỸ THUẬT

### 8.1. Đánh giá về Minification & Obfuscation
- **Tình trạng mã nguồn:** Toàn bộ các file core tiện ích (`ohke.min.js`, `id-rpc.min.js`, các file widget `ohke-*.min.js`) và bundle (`inno-main-8c7c7f0fbe83e3dfc967.js`) đã được chạy qua công cụ Minifier/Webpack bundler chuẩn (loại bỏ khoảng trắng, đổi tên biến cục bộ thành `t, e, n, i, r...`).
- **Mức độ cản trở:** Các file **KHÔNG BỊ làm rối chủ đích (No Obfuscation / Control Flow Flattening / String Encrypting)**. Tên các class (`WidgetPassword`, `Popup`, `InlineEditor`), tên các phương thức, sự kiện (`agent:change`, `chosen:updated`) và các đường dẫn API (`/uploader/uploadfile`, `/filter_save`) vẫn được giữ nguyên bản dưới dạng chuỗi rõ ràng (Plain Strings). Do đó, hoàn toàn có thể đọc hiểu và truy vết chính xác 100% logic xử lý mà không cần phỏng đoán.
- **Ranh giới nghiệp vụ:** Các logic nghiệp vụ cốt lõi của ngành giáo dục (tính điểm, xét học bạ, phân quyền biểu mẫu) không nằm trong mã nguồn JS phía client mà được ủy quyền hoàn toàn cho máy chủ xử lý thông qua các lời gọi `POST` RPC (`x..._Action` và `x..._Viewer`). Client JS đóng vai trò thuần túy là bộ khung hiển thị, validate định dạng đầu vào và quản lý trạng thái UI.

### 8.2. Khuyến nghị Tối ưu hóa & Kỹ thuật cho Dự án Extension
Với mục tiêu phát triển Extension "Classhub pro tools" tương tác sâu với nền tảng này, dưới đây là các khuyến nghị kỹ thuật quan trọng:
1. **Tận dụng Event Hook Chuẩn của Hệ thống:**
   Thay vì can thiệp trực tiếp bằng cách ghi đè (override) DOM nhạy cảm, Extension nên lắng nghe các sự kiện native mà hệ thống `ohke-agent-field` phát ra:
   - `$container.on("agent:change", ...)` để bắt thay đổi dữ liệu trường.
   - `$(document).on("agent-loaded", ...)` để biết khi một form mới vừa tải xong từ máy chủ qua RPC.
2. **Khai thác `inno.network.rpc` / `Ohke.rpc2` cho Tự động hóa:**
   Extension có thể gọi trực tiếp `Ohke.rpc2(url, { background: 1, data: {...} })` (với tự động đính kèm header `ohke-ajax: 1`) để tự động hóa các tác vụ lấy dữ liệu hoặc nộp biểu mẫu mà không cần giả lập sự kiện click chuột, đảm bảo độ tin cậy tuyệt đối.
3. **Thao tác Form An toàn với Băm Mật khẩu & Widget Phức tạp:**
   - Đối với các trường mật khẩu (`WidgetPassword`), tuyệt đối không gán `.val()` trực tiếp vào ô input ẩn vì sẽ thiếu định dạng SHA-256. Hãy gán vào input hiển thị và kích hoạt sự kiện `blur` hoặc tự động đóng gói theo cú pháp `v3:{len}:{strength}:{hash}`.
   - Đối với các bảng dữ liệu sử dụng `InlineEditor`, sau khi thay đổi giá trị ô input bằng code, cần kích hoạt sự kiện `blur` để hệ thống tự động gửi yêu cầu `action.update` lưu dữ liệu lên server.

---
*Báo cáo được tổng hợp thành công dựa trên 100% dữ liệu thực tế trích xuất từ source code `idcloud.vn`.*
