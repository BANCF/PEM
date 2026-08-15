**[VAI TRÒ CỦA BẠN]**
Bạn là một Lead System Architect và API Integration Expert. Bạn có tư duy logic sắc bén, tuân thủ tuyệt đối kiến trúc hệ thống đã được thiết kế sẵn và cực kỳ khắt khe trong việc phân tích JSON Payload của các hệ thống bảo mật (như SPA/React/Vue). Tuyệt đối không phỏng đoán dữ liệu nếu không có bằng chứng từ Log thực tế.

---

**[NGỮ CẢNH & QUY TRÌNH HOẠT ĐỘNG (WORKFLOW)]**
Chúng tôi đang xây dựng một module điểm danh tự động ngầm (Headless) bằng JavaScript thuần tiêm vào trình duyệt (Chrome Extension) cho hệ thống Ohke. 

**Quy trình chuẩn để chốt sổ 1 lớp thành công bắt buộc phải qua các bước sau:**
1. **Chốt Giáo viên:** Kiểm tra trạng thái giáo viên, nếu chưa có mặt -> Gửi API điểm danh giáo viên -> Gửi API Chốt giáo viên.
2. **Chốt Học sinh (3-Tier Sequential Fallback):** Hệ thống Ohke sẽ từ chối chốt sổ lớp nếu có học sinh chưa được điểm danh. Do đó, phải chạy tuần tự:
   - **Tier 1 (Như tiết trước):** Gửi API bấm nút `bttAction_x2447C_` -> Check API Viewer -> Gửi API Chốt sổ (`x35FD2_jsonPostTransition`). Nếu Ohke trả về thành công thì đóng lớp và chuyển sang lớp tiếp theo. Nếu Ohke trả về lỗi (Student attendance not completed), chuyển sang Tier 2.
   - **Tier 2 (Đến trường):** Gửi API bấm nút `bttAction_x2B0CE_` -> Check API Viewer -> Gửi API Chốt sổ. Nếu Ohke trả về thành công thì đóng lớp và chuyển sang lớp tiếp theo. Nếu lỗi, chuyển sang Tier 3.
   - **Tier 3 (Tất cả có mặt):** Gửi API bấm nút `bttAction_x2447B_` -> Check API Viewer -> Gửi API Chốt sổ. Nếu Ohke trả về thành công thì đóng lớp và chuyển sang lớp tiếp theo. (Tier này luôn thành công 100%).
3. Kiểm tra chéo lại bằng DOM (đợi 600ms xem nhãn đỏ có biến mất không) làm phương án dự phòng cuối cùng.

---

**[PHÂN TÍCH DỮ LIỆU & CHIẾN THUẬT XỬ LÝ]**
Từ việc Reverse Engineering hệ thống Ohke, chúng tôi đã xác định được các quy tắc bảo mật sau mà mã nguồn `content.js` phải tuân thủ:
1. **Payload của các nút hành động (bttAction):** Cực kỳ tối giản. CHỈ CHẤP NHẬN duy nhất tham số `{ "id": "master_key" }`. Nhồi nhét thêm `entity` hay `action_code` sẽ bị Server từ chối ngay lập tức.
2. **Payload của lệnh Chốt sổ và Viewer:** Bắt buộc phải có một Object Context (gọi là `env`) chứa các định danh bảo mật động của phiên làm việc.
3. **Chiến thuật bóc tách Mật mã ngầm:** Vì chúng ta chạy Headless, `env` không thể tự bịa ra. Mã nguồn phải dùng `rpcCallHeadlessV33` gọi API Viewer để kéo chuỗi HTML ngầm về, dùng `DOMParser` bóc tách 2 thẻ `<input name="ohke_prefix">` và `<input name="data_query_id">` để lấy giá trị thực tế, sau đó nhét vào object `env` trước khi gửi lệnh Chốt sổ.

---

**[DỮ LIỆU ĐẦU VÀO (RAW API LOGS)]**
Dưới đây là Log API thực tế đã bắt được từ Network tab khi thao tác bằng tay (Không bị ẩn dữ liệu):

Nút số 01: Đánh dấu giống như tiết học trước:bttAction_x2447C_ 
Request payload: 
{id: "1994119"}
id
: 
"1994119"
Respone: 
{"type":"success","data":null}
Ngay sau khi nút được thực thi, các model được load lại: 
x24482_Model
Payload: {id: null, ohke_prefix: "field-epht2bmdsb", master_object_class_name: "study_student_attendance_sheet",…}
:field_subform_id
: 
148610
:master_readonly
: 
0
data_query_id
: 
"muxdylj43v66"
father_master_key
: 
"1994119"
filter_data
: 
""
filter_name
: 
""
filter_text
: 
""
id
: 
null
list.view_customizer
: 
"{\"source\":\"default\",\"name\":\"\",\"list\":[]}"
master_key
: 
"1994119"
master_object_class_code
: 
"DOCTYPE-7004"
master_object_class_name
: 
"study_student_attendance_sheet"
ohke_prefix
: 
"field-epht2bmdsb"
params
: 
[]
status
: 
""
Respone:
<div class="agent-container agent-id-1224 agent-uri-classroom-student-attendance" data-search-id="x24482_1994119" id="agent-m4u2iqmwwl" data-ag-form-id="L1224">
    <div class="ohke-header list-mode header-x x3 titlebar-sf-V1829-148610">
        <form method="post" class="filter-form" id="form-m4u2iqmwwl" data-found="25" data-total="25">
            <!--L1224-->
            <input type="hidden" name="master_key" value="1994119">
            <input type="hidden" name="father_master_key" value="1994119">
            <input type="hidden" name="list.view_customizer" value="&lbrace;&quot;source&quot;&colon;&quot;default&quot;&comma;&quot;name&quot;&colon;&quot;&quot;&comma;&quot;list&quot;&colon;&lbrack;&rsqb;&rcub;">
            <div class="title-bar">
                <div class="w3-hide-large w3-hide-medium mobile-action w3-hide">
                    <a class="ohke-btn dropdown-btn">
                        <i class="fa fa-list"></i>
                    </a>
                    <div class="dropdown-menu">
                        <a class="ohke-btn js-agent-click" data-action="export">
                            <i class="fa fa-table"></i>
                            <span class="title-dropdown">Export</span>
                        </a>
                        <!--list action-->
                    </div>
                </div>
            </div>
            <div class="left-action">
                <a class="ohke-btn btn-view-customizer js-agent-click" data-action="open-view-customizer" title="View Config">
                    <i class="fa fa-sliders"></i>
                </a>
            </div>
            <div class="search ohke-group no-title">
                <a class="ohke-btn btn-adv-search js-agent-click" data-action="open-adv-search" title="Search Settings">
                    <i class="fa fa-filter"></i>
                </a>
                <div class="search-box search3">
                    <div class="name w3-hide"></div>
                    <a class="btn btn-clear">
                        <div>
                            <i class="fa fa-close"></i>
                        </div>
                    </a>
                    <input type="hidden" name="filter_name" value="">
                    <input type="hidden" name="filter_data" value="">
                    <input class="w3-input agent-filter" type="text" name="filter_text" placeholder="Filter by Id&comma; Face Photo&comma; Student" value="">
                    <div class="total">
                        <span class="f">25</span>
                        /<span class="t">25</span>
                    </div>
                    <div class="finding w3-hide">
                        <i class="fa fa-refresh fa-spin"></i>
                    </div>
                </div>
                <div class='state-filter-2 w3-hide-small'>
                    <select class='w3-input inp-state' name='status'>
                        <option value=''>[ Student Attendance ]</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE'>NO ATTENDANCE (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL'>LATE ARRIVAL (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT'>PRESENT (24)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT'>ABSENT (1)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON'>ABSENT WITH REASON (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING'>REMOTE LEARNING (0)</option>
                    </select>
                </div>
                <a class="ohke-btn btn-search">
                    <i class="fa fa-search-plus"></i>
                    <span class="title-action">Search</span>
                </a>
            </div>
            <div class='state-filter-2 w3-hide-medium w3-hide-large'>
                <select class='w3-input inp-state-mobile' data-name='status'>
                    <option value=''>[ Student Attendance ]</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE'>NO ATTENDANCE (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL'>LATE ARRIVAL (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT'>PRESENT (24)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT'>ABSENT (1)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON'>ABSENT WITH REASON (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING'>REMOTE LEARNING (0)</option>
                </select>
            </div>
            <div class="action">
                <a class="ohke-btn js-agent-click" data-action="export">
                    <i class="fa fa-table"></i>
                    <span class="title-action">Export</span>
                </a>
                <!--list action-->
            </div>
        </form>
    </div>
    <div class="ohke-content">
        <style id="style-m4u2iqmwwl">
            .list-m4u2iqmwwl.hide-face-photo .field-m4u2iqmwwl-face-photo {
                display: none;
            }

            .list-m4u2iqmwwl.hide-student-code .field-m4u2iqmwwl-student-code {
                display: none;
            }

            .list-m4u2iqmwwl.hide-student-leave-application-id .field-m4u2iqmwwl-student-leave-application-id {
                display: none;
            }

            .list-m4u2iqmwwl.hide-status .field-m4u2iqmwwl-status {
                display: none;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE {
                background-color: #FEFEFE;
                color: #000;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL {
                background-color: #F5AF0A;
                color: #444;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT {
                background-color: #0073CF;
                color: #ffffff;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT {
                background-color: #D72D2D;
                color: #FFFFFF;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON {
                background-color: #D70B90;
                color: #ffffff;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING {
                background-color: #10B094;
                color: #FFF;
            }
        </style>
        <table id="table-m4u2iqmwwl" class="w3-table-all ohke-table agent-list list-m4u2iqmwwl " data-search-id="x24482_1994119">
            <thead>
                <tr>
                    <th style="width: 1px" class="w3-hide-small">#</th>
                    <th class="field-m4u2iqmwwl-face-photo">Face Photo                          </th>
                    <th class="field-m4u2iqmwwl-student-code">Student                          </th>
                    <th class="field-m4u2iqmwwl-student-leave-application-id">Student Leave Application                          </th>
                    <th class="w3-center field-m4u2iqmwwl-status">Mark As                          </th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020061" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020061&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11930240&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0591&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0591&rsqb; Nguyễn Thị Minh &Aacute;nh &lpar;17&bsol;&sol;9&bsol;&sol;2023&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Aacute;nh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Thị Minh &Aacute;nh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020061-cso-1-11930240-hs2013.0591-nguyen-thi-minh-anh-17-9-2023-" data-update-time="2026-08-15 15:17:24" data-id="15020061">
                    <td class="no-wrap list-item-serial w3-hide-small">1</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UG1Wc3B5WVhHbmoyQys4T1JjRVd5SUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11930240" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0591] Nguyễn Thị Minh Ánh (17/9/2023)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020060" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020060&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998290&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0375&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0375&rsqb; B&ugrave;i Trung D&utilde;ng &lpar;11&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;B&ugrave;i&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;B&ugrave;i Trung D&utilde;ng&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020060-cso-1-11998290-hs2013.0375-bui-trung-dung-11-7-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020060">
                    <td class="no-wrap list-item-serial w3-hide-small">2</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/RTdxejc1WGNoUnZ2dHVaS1FSMTJBWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998290" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0375] Bùi Trung Dũng (11/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020040" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020040&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998264&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142024590&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142024590&rsqb; Dương H&agrave; Linh &lpar;28&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Dương&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Dương H&agrave; Linh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020040-cso-1-11998264-0142024590-duong-ha-linh-28-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020040">
                    <td class="no-wrap list-item-serial w3-hide-small">3</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/cFJjUU9HSlovaTIzREM1L1hMcmZ6WUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998264" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142024590] Dương Hà Linh (28/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020054" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020054&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998283&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;2742214801&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;2742214801&rsqb; &Dstrok;ặng Bạch Dương &lpar;29&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Dstrok;ặng&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;&Dstrok;ặng Bạch Dương&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020054-cso-1-11998283-2742214801-dang-bach-duong-29-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020054">
                    <td class="no-wrap list-item-serial w3-hide-small">4</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/WW9taXdDUk1KZVhOYmdmMGhCc0lmWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998283" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[2742214801] Đặng Bạch Dương (29/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020059" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020059&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998289&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0370&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0370&rsqb; &Dstrok;ỗ Thị Thanh Mai &lpar;19&bsol;&sol;3&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Dstrok;ỗ&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;&Dstrok;ỗ Thị Thanh Mai&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020059-cso-1-11998289-hs2013.0370-do-thi-thanh-mai-19-3-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020059">
                    <td class="no-wrap list-item-serial w3-hide-small">5</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/ajcrMGE5aHBSUVBIT2NvZitqSEt2b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998289" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0370] Đỗ Thị Thanh Mai (19/3/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020057" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020057&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998266&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;5243876180&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;5243876180&rsqb; Huỳnh Bảo S&acirc;m &lpar;5&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Huỳnh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Huỳnh Bảo S&acirc;m&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020057-cso-1-11998266-5243876180-huynh-bao-sam-5-11-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020057">
                    <td class="no-wrap list-item-serial w3-hide-small">6</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OWt6dGQ5TDB3aVpKTWdCZWRmQklFb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998266" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[5243876180] Huỳnh Bảo Sâm (5/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020048" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020048&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998256&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143878172&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143878172&rsqb; L&ecirc; Hồng Trang &lpar;9&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Hồng Trang&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020048-cso-1-11998256-0143878172-le-hong-trang-9-11-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020048">
                    <td class="no-wrap list-item-serial w3-hide-small">7</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/bnVlMGtrVDV2THI4Syt1U3RUZGQzNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998256" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143878172] Lê Hồng Trang (9/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020049" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020049&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998228&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143882653&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143882653&rsqb; L&ecirc; Tuấn Khải &lpar;24&bsol;&sol;4&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Tuấn Khải&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020049-cso-1-11998228-0143882653-le-tuan-khai-24-4-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020049">
                    <td class="no-wrap list-item-serial w3-hide-small">8</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OUVZR0MrSm9LVllQeENxK29Ed0VEWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998228" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143882653] Lê Tuấn Khải (24/4/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020051" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020051&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998279&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0145073072&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0145073072&rsqb; L&ecirc; Nguyễn H&agrave; An &lpar;24&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Nguyễn H&agrave; An&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020051-cso-1-11998279-0145073072-le-nguyen-ha-an-24-11-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020051">
                    <td class="no-wrap list-item-serial w3-hide-small">9</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/L3JtMXozc0RNM1Z3SkxBWk4wamtDNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998279" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0145073072] Lê Nguyễn Hà An (24/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020037" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020037&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998277&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0133693025&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0133693025&rsqb; Lỗ Thị Minh Loan &lpar;22&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Lỗ&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Lỗ Thị Minh Loan&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020037-cso-1-11998277-0133693025-lo-thi-minh-loan-22-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020037">
                    <td class="no-wrap list-item-serial w3-hide-small">10</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/WjdnVm02MzFyekJucVhUeVpoZEVINEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998277" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0133693025] Lỗ Thị Minh Loan (22/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020038" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020038&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998281&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0133699431&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0133699431&rsqb; Lương Th&ugrave;y An &lpar;14&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Lương&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Lương Th&ugrave;y An&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020038-cso-1-11998281-0133699431-luong-thuy-an-14-11-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020038">
                    <td class="no-wrap list-item-serial w3-hide-small">11</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/Q2R2SmVBbzEzYVhZZ3RET3hDOEZtNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998281" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0133699431] Lương Thùy An (14/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020041" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020041&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998237&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142036358&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142036358&rsqb; Nguyễn Thanh Mai &lpar;19&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Thanh Mai&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020041-cso-1-11998237-0142036358-nguyen-thanh-mai-19-7-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020041">
                    <td class="no-wrap list-item-serial w3-hide-small">12</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/M21mUW9iM3FJTk9xM3BONDhiUFovNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998237" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142036358] Nguyễn Thanh Mai (19/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020042" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020042&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998273&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142176194&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142176194&rsqb; Nguyễn Minh Ch&acirc;u &lpar;14&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Minh Ch&acirc;u&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020042-cso-1-11998273-0142176194-nguyen-minh-chau-14-7-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020042">
                    <td class="no-wrap list-item-serial w3-hide-small">13</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/azZDWkJrbTcrZkEwNXBkMkRkbjN1b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998273" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142176194] Nguyễn Minh Châu (14/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020043" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020043&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998167&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142178893&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142178893&rsqb; Nguyễn Xu&acirc;n B&aacute;ch &lpar;12&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Xu&acirc;n B&aacute;ch&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020043-cso-1-11998167-0142178893-nguyen-xuan-bach-12-11-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020043">
                    <td class="no-wrap list-item-serial w3-hide-small">14</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OEhMQ2lzaGJwR0Z0TW5ndnhEOVRxb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998167" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142178893] Nguyễn Xuân Bách (12/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020045" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020045&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998285&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142623193&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142623193&rsqb; Nguyễn Nguyệt Minh Ch&acirc;u &lpar;27&bsol;&sol;1&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Nguyệt Minh Ch&acirc;u&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020045-cso-1-11998285-0142623193-nguyen-nguyet-minh-chau-27-1-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020045">
                    <td class="no-wrap list-item-serial w3-hide-small">15</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/a0ZvNXNTeU5XQkJsYVJFNG0yRjI2SUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998285" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142623193] Nguyễn Nguyệt Minh Châu (27/1/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020046" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020046&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998261&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143847569&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143847569&rsqb; Nguyễn Quang Vinh &lpar;17&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Quang Vinh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020046-cso-1-11998261-0143847569-nguyen-quang-vinh-17-7-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020046">
                    <td class="no-wrap list-item-serial w3-hide-small">16</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/YWN1bG9iZWRuTnpQMjdmNmd5WitSNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998261" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143847569] Nguyễn Quang Vinh (17/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020050" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020050&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998271&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143982147&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143982147&rsqb; Nguyễn Bảo Ng&acirc;n &lpar;10&bsol;&sol;12&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Bảo Ng&acirc;n&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020050-cso-1-11998271-0143982147-nguyen-bao-ngan-10-12-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020050">
                    <td class="no-wrap list-item-serial w3-hide-small">17</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/b0w4N0J2enBNeERoenJVd3NSWVFHb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998271" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143982147] Nguyễn Bảo Ngân (10/12/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020053" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020053&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998224&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;24062013&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;24062013&rsqb; Nguyễn Minh Huy &lpar;24&bsol;&sol;6&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Minh Huy&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020053-cso-1-11998224-24062013-nguyen-minh-huy-24-6-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020053">
                    <td class="no-wrap list-item-serial w3-hide-small">18</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/ditRNTRYQzdPNEdYajdTYWo2alM5b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998224" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[24062013] Nguyễn Minh Huy (24/6/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020056" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020056&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998260&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;3833007416&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;3833007416&rsqb; Nguyễn Trường V&abreve;n &lpar;4&bsol;&sol;4&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Trường V&abreve;n&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020056-cso-1-11998260-3833007416-nguyen-truong-van-4-4-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020056">
                    <td class="no-wrap list-item-serial w3-hide-small">19</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/SlRrSWpOdG50OWF4eHdUc2NxNkxBNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998260" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[3833007416] Nguyễn Trường Văn (4/4/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020058" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020058&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998287&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0074&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0074&rsqb; Nguyễn Bảo Nam &lpar;24&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Bảo Nam&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020058-cso-1-11998287-hs2013.0074-nguyen-bao-nam-24-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020058">
                    <td class="no-wrap list-item-serial w3-hide-small">20</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/eUE0Q2dnTnV2c1BueURKSFByOHhwWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998287" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0074] Nguyễn Bảo Nam (24/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020055" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020055&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998253&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;3043884528&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;3043884528&rsqb; Phạm Duy&ecirc;n Thư &lpar;5&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Phạm&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Phạm Duy&ecirc;n Thư&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020055-cso-1-11998253-3043884528-pham-duyen-thu-5-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020055">
                    <td class="no-wrap list-item-serial w3-hide-small">21</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UzhHaG51bEllSlcxM1oxQ3UydmwwSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998253" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[3043884528] Phạm Duyên Thư (5/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020047" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020047&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998269&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143867800&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143867800&rsqb; Tống Bảo L&acirc;m &lpar;12&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Tống&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Tống Bảo L&acirc;m&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020047-cso-1-11998269-0143867800-tong-bao-lam-12-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020047">
                    <td class="no-wrap list-item-serial w3-hide-small">22</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/djFxLzBUUDR5M1ZENExOSTFzVThLSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998269" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143867800] Tống Bảo Lâm (12/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020039" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020039&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998275&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0138686776&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0138686776&rsqb; Trần B&ugrave;i Ngọc Diệp &lpar;13&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trần&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trần B&ugrave;i Ngọc Diệp&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020039-cso-1-11998275-0138686776-tran-bui-ngoc-diep-13-10-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020039">
                    <td class="no-wrap list-item-serial w3-hide-small">23</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/VHpoTVFCVWdYUE1RMHlKR01qd1ZFSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998275" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0138686776] Trần Bùi Ngọc Diệp (13/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT" id="item-m4u2iqmwwl-15020052" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020052&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998164&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0148717275&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0148717275&rsqb; Trần Mộc Anh &lpar;24&bsol;&sol;5&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;ABSENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;ABSENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trần&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trần Mộc Anh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020052-cso-1-11998164-0148717275-tran-moc-anh-24-5-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020052">
                    <td class="no-wrap list-item-serial w3-hide-small">24</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UENvZXVSTVlwNnpoaFN6QkhMK2tTSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998164" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0148717275] Trần Mộc Anh (24/5/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#D72D2D;color:#FFFFFF;">ABSENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020044" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020044&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998232&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142216810&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142216810&rsqb; Trịnh &Dstrok;ức Long &lpar;17&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;17&colon;24&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trịnh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trịnh &Dstrok;ức Long&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020044-cso-1-11998232-0142216810-trinh-duc-long-17-7-2013-" data-update-time="2026-08-15 15:17:24" data-id="15020044">
                    <td class="no-wrap list-item-serial w3-hide-small">25</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/L3Q2S0xDd2xWZjVuaEREbGN6U2grNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998232" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142216810] Trịnh Đức Long (17/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
            </tbody>
        </table>
    </div>
    <script type="application/json" id="env-m4u2iqmwwl">
        {
            "id": null,
            "ohke_prefix": "field-epht2bmdsb",
            "master_object_class_name": "study_student_attendance_sheet",
            "master_object_class_code": "DOCTYPE-7004",
            ":field_subform_id": 148610,
            "data_query_id": "muxdylj43v66",
            ":master_readonly": 0,
            "master_key": "1994119",
            "father_master_key": "1994119",
            "params": [
            ]
        }</script>
</div>
<script>
    ojs['agent-m4u2iqmwwl'] = $.createList({
        actionPrefix: 'x24482_',
        viewId: 'm4u2iqmwwl',
        agentSelector: '#agent-m4u2iqmwwl',
        formSelector: '#form-m4u2iqmwwl',
        formDomain: 'x24482_',
        inlineSelector: 0,
        isSubform: 1,
        isListNavigator: 0,
        itemActionDefault: 'IV',
        editorInModal: 1,
        viewerInModal: 1,
        creatorInModal: 0,
        hasCreator: 0,
        hasViewer: 1,
        hasEditor: 0,
        title: 'Study &gt; Student Attendance',
        hasListPrint: 0,
        formContainer: 'tab',
        forInputType: 'subform',
        floatingItemAction: 0,
        showSeriesColumn: 1,
        allowClientFilter: 1,
        statistic: {
            found: 25,
            total: 25,
            fullTotal: 25
        },
        switchFields: {},
    });
    ojs['agent-m4u2iqmwwl'].ready().then( () => {
        const agentId = 'agent-m4u2iqmwwl';
        const agentSelector = '#agent-m4u2iqmwwl';
        Ohke.form.registerChild(agentSelector);
        let me = ojs[agentId];
        let $agent = $(agentSelector).closest('.agent-container');
        $('#table-m4u2iqmwwl').children('thead').ohkeHelp();
    }
    ).then( () => {
        const agentId = 'agent-m4u2iqmwwl';
        let me = ojs[agentId];
        let $rootAgent = $('#agent-m4u2iqmwwl');
        $rootAgent.on('pac:RELOAD', (event, attachment) => {
            let message = event.type.substr(4);
            let $agent = $rootAgent
              , self = $agent.data('form-action');
            let PAC = $agent.data('pac-event');
            if (PAC)
                PAC.log('L1224 received RELOAD');
            attachment = Ohke.clone(attachment || {});
            if (!Array.isArray(attachment.env))
                attachment.env = [];
            attachment.env.unshift(Ohke.clone($agent.data('env')));
            try {
                self.reload();
            } catch (e) {
                console.error(`1224-list-RELOAD: ${e.message}`);
            }
        }
        );
        $rootAgent.agentInitListener();
        let PAC = $rootAgent.data('pac-event');
        if (PAC)
            PAC.self('after_load');
    }
    )
</script>
Nút thứ 2: Đánh dấu như đến trường: bttAction_x2B0CE_
Payload:
{id: "1994119"}
id
: 
"1994119"
Respone:{"type":"success","data":null}
Model được load lại:x24482_Model
Payload: 
{id: null, ohke_prefix: "field-epht2bmdsb", master_object_class_name: "study_student_attendance_sheet",…}
:field_subform_id
: 
148610
:master_readonly
: 
0
data_query_id
: 
"muxdylj43v66"
father_master_key
: 
"1994119"
filter_data
: 
""
filter_name
: 
""
filter_text
: 
""
id
: 
null
list.view_customizer
: 
"{\"source\":\"default\",\"name\":\"\",\"list\":[]}"
master_key
: 
"1994119"
master_object_class_code
: 
"DOCTYPE-7004"
master_object_class_name
: 
"study_student_attendance_sheet"
ohke_prefix
: 
"field-epht2bmdsb"
params
: 
[]
status
: 
""
Respone: 
<div class="agent-container agent-id-1224 agent-uri-classroom-student-attendance" data-search-id="x24482_1994119" id="agent-m4u2iqmwwl" data-ag-form-id="L1224">
    <div class="ohke-header list-mode header-x x3 titlebar-sf-V1829-148610">
        <form method="post" class="filter-form" id="form-m4u2iqmwwl" data-found="25" data-total="25">
            <!--L1224-->
            <input type="hidden" name="master_key" value="1994119">
            <input type="hidden" name="father_master_key" value="1994119">
            <input type="hidden" name="list.view_customizer" value="&lbrace;&quot;source&quot;&colon;&quot;default&quot;&comma;&quot;name&quot;&colon;&quot;&quot;&comma;&quot;list&quot;&colon;&lbrack;&rsqb;&rcub;">
            <div class="title-bar">
                <div class="w3-hide-large w3-hide-medium mobile-action w3-hide">
                    <a class="ohke-btn dropdown-btn">
                        <i class="fa fa-list"></i>
                    </a>
                    <div class="dropdown-menu">
                        <a class="ohke-btn js-agent-click" data-action="export">
                            <i class="fa fa-table"></i>
                            <span class="title-dropdown">Export</span>
                        </a>
                        <!--list action-->
                    </div>
                </div>
            </div>
            <div class="left-action">
                <a class="ohke-btn btn-view-customizer js-agent-click" data-action="open-view-customizer" title="View Config">
                    <i class="fa fa-sliders"></i>
                </a>
            </div>
            <div class="search ohke-group no-title">
                <a class="ohke-btn btn-adv-search js-agent-click" data-action="open-adv-search" title="Search Settings">
                    <i class="fa fa-filter"></i>
                </a>
                <div class="search-box search3">
                    <div class="name w3-hide"></div>
                    <a class="btn btn-clear">
                        <div>
                            <i class="fa fa-close"></i>
                        </div>
                    </a>
                    <input type="hidden" name="filter_name" value="">
                    <input type="hidden" name="filter_data" value="">
                    <input class="w3-input agent-filter" type="text" name="filter_text" placeholder="Filter by Id&comma; Face Photo&comma; Student" value="">
                    <div class="total">
                        <span class="f">25</span>
                        /<span class="t">25</span>
                    </div>
                    <div class="finding w3-hide">
                        <i class="fa fa-refresh fa-spin"></i>
                    </div>
                </div>
                <div class='state-filter-2 w3-hide-small'>
                    <select class='w3-input inp-state' name='status'>
                        <option value=''>[ Student Attendance ]</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE'>NO ATTENDANCE (19)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL'>LATE ARRIVAL (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT'>PRESENT (6)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT'>ABSENT (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON'>ABSENT WITH REASON (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING'>REMOTE LEARNING (0)</option>
                    </select>
                </div>
                <a class="ohke-btn btn-search">
                    <i class="fa fa-search-plus"></i>
                    <span class="title-action">Search</span>
                </a>
            </div>
            <div class='state-filter-2 w3-hide-medium w3-hide-large'>
                <select class='w3-input inp-state-mobile' data-name='status'>
                    <option value=''>[ Student Attendance ]</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE'>NO ATTENDANCE (19)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL'>LATE ARRIVAL (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT'>PRESENT (6)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT'>ABSENT (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON'>ABSENT WITH REASON (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING'>REMOTE LEARNING (0)</option>
                </select>
            </div>
            <div class="action">
                <a class="ohke-btn js-agent-click" data-action="export">
                    <i class="fa fa-table"></i>
                    <span class="title-action">Export</span>
                </a>
                <!--list action-->
            </div>
        </form>
    </div>
    <div class="ohke-content">
        <style id="style-m4u2iqmwwl">
            .list-m4u2iqmwwl.hide-face-photo .field-m4u2iqmwwl-face-photo {
                display: none;
            }

            .list-m4u2iqmwwl.hide-student-code .field-m4u2iqmwwl-student-code {
                display: none;
            }

            .list-m4u2iqmwwl.hide-student-leave-application-id .field-m4u2iqmwwl-student-leave-application-id {
                display: none;
            }

            .list-m4u2iqmwwl.hide-status .field-m4u2iqmwwl-status {
                display: none;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE {
                background-color: #FEFEFE;
                color: #000;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL {
                background-color: #F5AF0A;
                color: #444;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT {
                background-color: #0073CF;
                color: #ffffff;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT {
                background-color: #D72D2D;
                color: #FFFFFF;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON {
                background-color: #D70B90;
                color: #ffffff;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING {
                background-color: #10B094;
                color: #FFF;
            }
        </style>
        <table id="table-m4u2iqmwwl" class="w3-table-all ohke-table agent-list list-m4u2iqmwwl " data-search-id="x24482_1994119">
            <thead>
                <tr>
                    <th style="width: 1px" class="w3-hide-small">#</th>
                    <th class="field-m4u2iqmwwl-face-photo">Face Photo                          </th>
                    <th class="field-m4u2iqmwwl-student-code">Student                          </th>
                    <th class="field-m4u2iqmwwl-student-leave-application-id">Student Leave Application                          </th>
                    <th class="w3-center field-m4u2iqmwwl-status">Mark As                          </th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020061" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020061&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11930240&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0591&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0591&rsqb; Nguyễn Thị Minh &Aacute;nh &lpar;17&bsol;&sol;9&bsol;&sol;2023&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Aacute;nh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Thị Minh &Aacute;nh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020061-cso-1-11930240-hs2013.0591-nguyen-thi-minh-anh-17-9-2023-" data-update-time="2026-08-15 15:20:26" data-id="15020061">
                    <td class="no-wrap list-item-serial w3-hide-small">1</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UG1Wc3B5WVhHbmoyQys4T1JjRVd5SUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11930240" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0591] Nguyễn Thị Minh Ánh (17/9/2023)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020060" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020060&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998290&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0375&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0375&rsqb; B&ugrave;i Trung D&utilde;ng &lpar;11&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;38&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;B&ugrave;i&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;B&ugrave;i Trung D&utilde;ng&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020060-cso-1-11998290-hs2013.0375-bui-trung-dung-11-7-2013-" data-update-time="2026-08-15 15:20:38" data-id="15020060">
                    <td class="no-wrap list-item-serial w3-hide-small">2</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/RTdxejc1WGNoUnZ2dHVaS1FSMTJBWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998290" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0375] Bùi Trung Dũng (11/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020040" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020040&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998264&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142024590&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142024590&rsqb; Dương H&agrave; Linh &lpar;28&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Dương&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Dương H&agrave; Linh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020040-cso-1-11998264-0142024590-duong-ha-linh-28-10-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020040">
                    <td class="no-wrap list-item-serial w3-hide-small">3</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/cFJjUU9HSlovaTIzREM1L1hMcmZ6WUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998264" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142024590] Dương Hà Linh (28/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020054" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020054&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998283&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;2742214801&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;2742214801&rsqb; &Dstrok;ặng Bạch Dương &lpar;29&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Dstrok;ặng&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;&Dstrok;ặng Bạch Dương&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020054-cso-1-11998283-2742214801-dang-bach-duong-29-10-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020054">
                    <td class="no-wrap list-item-serial w3-hide-small">4</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/WW9taXdDUk1KZVhOYmdmMGhCc0lmWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998283" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[2742214801] Đặng Bạch Dương (29/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020059" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020059&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998289&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0370&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0370&rsqb; &Dstrok;ỗ Thị Thanh Mai &lpar;19&bsol;&sol;3&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Dstrok;ỗ&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;&Dstrok;ỗ Thị Thanh Mai&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020059-cso-1-11998289-hs2013.0370-do-thi-thanh-mai-19-3-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020059">
                    <td class="no-wrap list-item-serial w3-hide-small">5</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/ajcrMGE5aHBSUVBIT2NvZitqSEt2b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998289" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0370] Đỗ Thị Thanh Mai (19/3/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020057" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020057&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998266&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;5243876180&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;5243876180&rsqb; Huỳnh Bảo S&acirc;m &lpar;5&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Huỳnh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Huỳnh Bảo S&acirc;m&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020057-cso-1-11998266-5243876180-huynh-bao-sam-5-11-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020057">
                    <td class="no-wrap list-item-serial w3-hide-small">6</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OWt6dGQ5TDB3aVpKTWdCZWRmQklFb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998266" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[5243876180] Huỳnh Bảo Sâm (5/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020048" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020048&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998256&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143878172&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143878172&rsqb; L&ecirc; Hồng Trang &lpar;9&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Hồng Trang&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020048-cso-1-11998256-0143878172-le-hong-trang-9-11-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020048">
                    <td class="no-wrap list-item-serial w3-hide-small">7</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/bnVlMGtrVDV2THI4Syt1U3RUZGQzNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998256" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143878172] Lê Hồng Trang (9/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020049" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020049&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998228&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143882653&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143882653&rsqb; L&ecirc; Tuấn Khải &lpar;24&bsol;&sol;4&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Tuấn Khải&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020049-cso-1-11998228-0143882653-le-tuan-khai-24-4-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020049">
                    <td class="no-wrap list-item-serial w3-hide-small">8</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OUVZR0MrSm9LVllQeENxK29Ed0VEWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998228" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143882653] Lê Tuấn Khải (24/4/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020051" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020051&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998279&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0145073072&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0145073072&rsqb; L&ecirc; Nguyễn H&agrave; An &lpar;24&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Nguyễn H&agrave; An&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020051-cso-1-11998279-0145073072-le-nguyen-ha-an-24-11-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020051">
                    <td class="no-wrap list-item-serial w3-hide-small">9</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/L3JtMXozc0RNM1Z3SkxBWk4wamtDNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998279" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0145073072] Lê Nguyễn Hà An (24/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020037" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020037&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998277&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0133693025&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0133693025&rsqb; Lỗ Thị Minh Loan &lpar;22&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;38&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Lỗ&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Lỗ Thị Minh Loan&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020037-cso-1-11998277-0133693025-lo-thi-minh-loan-22-10-2013-" data-update-time="2026-08-15 15:20:38" data-id="15020037">
                    <td class="no-wrap list-item-serial w3-hide-small">10</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/WjdnVm02MzFyekJucVhUeVpoZEVINEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998277" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0133693025] Lỗ Thị Minh Loan (22/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020038" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020038&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998281&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0133699431&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0133699431&rsqb; Lương Th&ugrave;y An &lpar;14&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Lương&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Lương Th&ugrave;y An&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020038-cso-1-11998281-0133699431-luong-thuy-an-14-11-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020038">
                    <td class="no-wrap list-item-serial w3-hide-small">11</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/Q2R2SmVBbzEzYVhZZ3RET3hDOEZtNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998281" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0133699431] Lương Thùy An (14/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020041" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020041&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998237&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142036358&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142036358&rsqb; Nguyễn Thanh Mai &lpar;19&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;38&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Thanh Mai&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020041-cso-1-11998237-0142036358-nguyen-thanh-mai-19-7-2013-" data-update-time="2026-08-15 15:20:38" data-id="15020041">
                    <td class="no-wrap list-item-serial w3-hide-small">12</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/M21mUW9iM3FJTk9xM3BONDhiUFovNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998237" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142036358] Nguyễn Thanh Mai (19/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020042" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020042&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998273&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142176194&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142176194&rsqb; Nguyễn Minh Ch&acirc;u &lpar;14&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Minh Ch&acirc;u&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020042-cso-1-11998273-0142176194-nguyen-minh-chau-14-7-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020042">
                    <td class="no-wrap list-item-serial w3-hide-small">13</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/azZDWkJrbTcrZkEwNXBkMkRkbjN1b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998273" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142176194] Nguyễn Minh Châu (14/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020043" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020043&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998167&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142178893&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142178893&rsqb; Nguyễn Xu&acirc;n B&aacute;ch &lpar;12&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Xu&acirc;n B&aacute;ch&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020043-cso-1-11998167-0142178893-nguyen-xuan-bach-12-11-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020043">
                    <td class="no-wrap list-item-serial w3-hide-small">14</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OEhMQ2lzaGJwR0Z0TW5ndnhEOVRxb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998167" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142178893] Nguyễn Xuân Bách (12/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020045" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020045&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998285&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142623193&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142623193&rsqb; Nguyễn Nguyệt Minh Ch&acirc;u &lpar;27&bsol;&sol;1&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;38&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Nguyệt Minh Ch&acirc;u&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020045-cso-1-11998285-0142623193-nguyen-nguyet-minh-chau-27-1-2013-" data-update-time="2026-08-15 15:20:38" data-id="15020045">
                    <td class="no-wrap list-item-serial w3-hide-small">15</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/a0ZvNXNTeU5XQkJsYVJFNG0yRjI2SUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998285" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142623193] Nguyễn Nguyệt Minh Châu (27/1/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020046" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020046&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998261&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143847569&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143847569&rsqb; Nguyễn Quang Vinh &lpar;17&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Quang Vinh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020046-cso-1-11998261-0143847569-nguyen-quang-vinh-17-7-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020046">
                    <td class="no-wrap list-item-serial w3-hide-small">16</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/YWN1bG9iZWRuTnpQMjdmNmd5WitSNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998261" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143847569] Nguyễn Quang Vinh (17/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020050" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020050&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998271&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143982147&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143982147&rsqb; Nguyễn Bảo Ng&acirc;n &lpar;10&bsol;&sol;12&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Bảo Ng&acirc;n&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020050-cso-1-11998271-0143982147-nguyen-bao-ngan-10-12-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020050">
                    <td class="no-wrap list-item-serial w3-hide-small">17</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/b0w4N0J2enBNeERoenJVd3NSWVFHb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998271" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143982147] Nguyễn Bảo Ngân (10/12/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020053" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020053&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998224&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;24062013&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;24062013&rsqb; Nguyễn Minh Huy &lpar;24&bsol;&sol;6&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Minh Huy&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020053-cso-1-11998224-24062013-nguyen-minh-huy-24-6-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020053">
                    <td class="no-wrap list-item-serial w3-hide-small">18</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/ditRNTRYQzdPNEdYajdTYWo2alM5b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998224" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[24062013] Nguyễn Minh Huy (24/6/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020056" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020056&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998260&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;3833007416&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;3833007416&rsqb; Nguyễn Trường V&abreve;n &lpar;4&bsol;&sol;4&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Trường V&abreve;n&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020056-cso-1-11998260-3833007416-nguyen-truong-van-4-4-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020056">
                    <td class="no-wrap list-item-serial w3-hide-small">19</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/SlRrSWpOdG50OWF4eHdUc2NxNkxBNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998260" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[3833007416] Nguyễn Trường Văn (4/4/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020058" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020058&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998287&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0074&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0074&rsqb; Nguyễn Bảo Nam &lpar;24&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Bảo Nam&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020058-cso-1-11998287-hs2013.0074-nguyen-bao-nam-24-10-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020058">
                    <td class="no-wrap list-item-serial w3-hide-small">20</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/eUE0Q2dnTnV2c1BueURKSFByOHhwWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998287" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0074] Nguyễn Bảo Nam (24/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020055" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020055&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998253&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;3043884528&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;3043884528&rsqb; Phạm Duy&ecirc;n Thư &lpar;5&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Phạm&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Phạm Duy&ecirc;n Thư&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020055-cso-1-11998253-3043884528-pham-duyen-thu-5-10-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020055">
                    <td class="no-wrap list-item-serial w3-hide-small">21</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UzhHaG51bEllSlcxM1oxQ3UydmwwSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998253" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[3043884528] Phạm Duyên Thư (5/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020047" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020047&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998269&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143867800&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143867800&rsqb; Tống Bảo L&acirc;m &lpar;12&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;38&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Tống&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Tống Bảo L&acirc;m&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020047-cso-1-11998269-0143867800-tong-bao-lam-12-10-2013-" data-update-time="2026-08-15 15:20:38" data-id="15020047">
                    <td class="no-wrap list-item-serial w3-hide-small">22</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/djFxLzBUUDR5M1ZENExOSTFzVThLSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998269" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143867800] Tống Bảo Lâm (12/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020039" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020039&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998275&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0138686776&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0138686776&rsqb; Trần B&ugrave;i Ngọc Diệp &lpar;13&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;38&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trần&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trần B&ugrave;i Ngọc Diệp&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020039-cso-1-11998275-0138686776-tran-bui-ngoc-diep-13-10-2013-" data-update-time="2026-08-15 15:20:38" data-id="15020039">
                    <td class="no-wrap list-item-serial w3-hide-small">23</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/VHpoTVFCVWdYUE1RMHlKR01qd1ZFSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998275" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0138686776] Trần Bùi Ngọc Diệp (13/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020052" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020052&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998164&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0148717275&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0148717275&rsqb; Trần Mộc Anh &lpar;24&bsol;&sol;5&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trần&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trần Mộc Anh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020052-cso-1-11998164-0148717275-tran-moc-anh-24-5-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020052">
                    <td class="no-wrap list-item-serial w3-hide-small">24</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UENvZXVSTVlwNnpoaFN6QkhMK2tTSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998164" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0148717275] Trần Mộc Anh (24/5/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE" id="item-m4u2iqmwwl-15020044" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020044&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998232&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142216810&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142216810&rsqb; Trịnh &Dstrok;ức Long &lpar;17&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;NO&lowbar;ATTENDANCE&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;NO ATTENDANCE&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;20&colon;26&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trịnh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trịnh &Dstrok;ức Long&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020044-cso-1-11998232-0142216810-trinh-duc-long-17-7-2013-" data-update-time="2026-08-15 15:20:26" data-id="15020044">
                    <td class="no-wrap list-item-serial w3-hide-small">25</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/L3Q2S0xDd2xWZjVuaEREbGN6U2grNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998232" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142216810] Trịnh Đức Long (17/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#FEFEFE;color:#000;">NO ATTENDANCE  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
            </tbody>
        </table>
    </div>
    <script type="application/json" id="env-m4u2iqmwwl">
        {
            "id": null,
            "ohke_prefix": "field-epht2bmdsb",
            "master_object_class_name": "study_student_attendance_sheet",
            "master_object_class_code": "DOCTYPE-7004",
            ":field_subform_id": 148610,
            "data_query_id": "muxdylj43v66",
            ":master_readonly": 0,
            "master_key": "1994119",
            "father_master_key": "1994119",
            "params": [
            ]
        }</script>
</div>
<script>
    ojs['agent-m4u2iqmwwl'] = $.createList({
        actionPrefix: 'x24482_',
        viewId: 'm4u2iqmwwl',
        agentSelector: '#agent-m4u2iqmwwl',
        formSelector: '#form-m4u2iqmwwl',
        formDomain: 'x24482_',
        inlineSelector: 0,
        isSubform: 1,
        isListNavigator: 0,
        itemActionDefault: 'IV',
        editorInModal: 1,
        viewerInModal: 1,
        creatorInModal: 0,
        hasCreator: 0,
        hasViewer: 1,
        hasEditor: 0,
        title: 'Study &gt; Student Attendance',
        hasListPrint: 0,
        formContainer: 'tab',
        forInputType: 'subform',
        floatingItemAction: 0,
        showSeriesColumn: 1,
        allowClientFilter: 1,
        statistic: {
            found: 25,
            total: 25,
            fullTotal: 25
        },
        switchFields: {},
    });
    ojs['agent-m4u2iqmwwl'].ready().then( () => {
        const agentId = 'agent-m4u2iqmwwl';
        const agentSelector = '#agent-m4u2iqmwwl';
        Ohke.form.registerChild(agentSelector);
        let me = ojs[agentId];
        let $agent = $(agentSelector).closest('.agent-container');
        $('#table-m4u2iqmwwl').children('thead').ohkeHelp();
    }
    ).then( () => {
        const agentId = 'agent-m4u2iqmwwl';
        let me = ojs[agentId];
        let $rootAgent = $('#agent-m4u2iqmwwl');
        $rootAgent.on('pac:RELOAD', (event, attachment) => {
            let message = event.type.substr(4);
            let $agent = $rootAgent
              , self = $agent.data('form-action');
            let PAC = $agent.data('pac-event');
            if (PAC)
                PAC.log('L1224 received RELOAD');
            attachment = Ohke.clone(attachment || {});
            if (!Array.isArray(attachment.env))
                attachment.env = [];
            attachment.env.unshift(Ohke.clone($agent.data('env')));
            try {
                self.reload();
            } catch (e) {
                console.error(`1224-list-RELOAD: ${e.message}`);
            }
        }
        );
        $rootAgent.agentInitListener();
        let PAC = $rootAgent.data('pac-event');
        if (PAC)
            PAC.self('after_load');
    }
    )
</script>

Nút thứ 3: Đánh dấu tất cả có mặt: bttAction_x2447B_
Payload: {id: "1994119"}
id
: 
"1994119"
Respone: {"type":"success","data":null}
Sau đó model được load lại: x24482_Model
Payload:
{id: null, ohke_prefix: "field-epht2bmdsb", master_object_class_name: "study_student_attendance_sheet",…}
:field_subform_id
: 
148610
:master_readonly
: 
0
data_query_id
: 
"muxdylj43v66"
father_master_key
: 
"1994119"
filter_data
: 
""
filter_name
: 
""
filter_text
: 
""
id
: 
null
list.view_customizer
: 
"{\"source\":\"default\",\"name\":\"\",\"list\":[]}"
master_key
: 
"1994119"
master_object_class_code
: 
"DOCTYPE-7004"
master_object_class_name
: 
"study_student_attendance_sheet"
ohke_prefix
: 
"field-epht2bmdsb"
params
: 
[]
status
: 
""
Respone:
<div class="agent-container agent-id-1224 agent-uri-classroom-student-attendance" data-search-id="x24482_1994119" id="agent-m4u2iqmwwl" data-ag-form-id="L1224">
    <div class="ohke-header list-mode header-x x3 titlebar-sf-V1829-148610">
        <form method="post" class="filter-form" id="form-m4u2iqmwwl" data-found="25" data-total="25">
            <!--L1224-->
            <input type="hidden" name="master_key" value="1994119">
            <input type="hidden" name="father_master_key" value="1994119">
            <input type="hidden" name="list.view_customizer" value="&lbrace;&quot;source&quot;&colon;&quot;default&quot;&comma;&quot;name&quot;&colon;&quot;&quot;&comma;&quot;list&quot;&colon;&lbrack;&rsqb;&rcub;">
            <div class="title-bar">
                <div class="w3-hide-large w3-hide-medium mobile-action w3-hide">
                    <a class="ohke-btn dropdown-btn">
                        <i class="fa fa-list"></i>
                    </a>
                    <div class="dropdown-menu">
                        <a class="ohke-btn js-agent-click" data-action="export">
                            <i class="fa fa-table"></i>
                            <span class="title-dropdown">Export</span>
                        </a>
                        <!--list action-->
                    </div>
                </div>
            </div>
            <div class="left-action">
                <a class="ohke-btn btn-view-customizer js-agent-click" data-action="open-view-customizer" title="View Config">
                    <i class="fa fa-sliders"></i>
                </a>
            </div>
            <div class="search ohke-group no-title">
                <a class="ohke-btn btn-adv-search js-agent-click" data-action="open-adv-search" title="Search Settings">
                    <i class="fa fa-filter"></i>
                </a>
                <div class="search-box search3">
                    <div class="name w3-hide"></div>
                    <a class="btn btn-clear">
                        <div>
                            <i class="fa fa-close"></i>
                        </div>
                    </a>
                    <input type="hidden" name="filter_name" value="">
                    <input type="hidden" name="filter_data" value="">
                    <input class="w3-input agent-filter" type="text" name="filter_text" placeholder="Filter by Id&comma; Face Photo&comma; Student" value="">
                    <div class="total">
                        <span class="f">25</span>
                        /<span class="t">25</span>
                    </div>
                    <div class="finding w3-hide">
                        <i class="fa fa-refresh fa-spin"></i>
                    </div>
                </div>
                <div class='state-filter-2 w3-hide-small'>
                    <select class='w3-input inp-state' name='status'>
                        <option value=''>[ Student Attendance ]</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE'>NO ATTENDANCE (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL'>LATE ARRIVAL (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT'>PRESENT (25)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT'>ABSENT (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON'>ABSENT WITH REASON (0)</option>
                        <option value='STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING'>REMOTE LEARNING (0)</option>
                    </select>
                </div>
                <a class="ohke-btn btn-search">
                    <i class="fa fa-search-plus"></i>
                    <span class="title-action">Search</span>
                </a>
            </div>
            <div class='state-filter-2 w3-hide-medium w3-hide-large'>
                <select class='w3-input inp-state-mobile' data-name='status'>
                    <option value=''>[ Student Attendance ]</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE'>NO ATTENDANCE (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL'>LATE ARRIVAL (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT'>PRESENT (25)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT'>ABSENT (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON'>ABSENT WITH REASON (0)</option>
                    <option value='STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING'>REMOTE LEARNING (0)</option>
                </select>
            </div>
            <div class="action">
                <a class="ohke-btn js-agent-click" data-action="export">
                    <i class="fa fa-table"></i>
                    <span class="title-action">Export</span>
                </a>
                <!--list action-->
            </div>
        </form>
    </div>
    <div class="ohke-content">
        <style id="style-m4u2iqmwwl">
            .list-m4u2iqmwwl.hide-face-photo .field-m4u2iqmwwl-face-photo {
                display: none;
            }

            .list-m4u2iqmwwl.hide-student-code .field-m4u2iqmwwl-student-code {
                display: none;
            }

            .list-m4u2iqmwwl.hide-student-leave-application-id .field-m4u2iqmwwl-student-leave-application-id {
                display: none;
            }

            .list-m4u2iqmwwl.hide-status .field-m4u2iqmwwl-status {
                display: none;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_NO_ATTENDANCE {
                background-color: #FEFEFE;
                color: #000;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_LATE_ARRIVAL {
                background-color: #F5AF0A;
                color: #444;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT {
                background-color: #0073CF;
                color: #ffffff;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT {
                background-color: #D72D2D;
                color: #FFFFFF;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_ABSENT_WITH_REASON {
                background-color: #D70B90;
                color: #ffffff;
            }

            #agent-m4u2iqmwwl .STUDY_STUDENT_ATTENDANCE_STATUS_REMOTE_LEARNING {
                background-color: #10B094;
                color: #FFF;
            }
        </style>
        <table id="table-m4u2iqmwwl" class="w3-table-all ohke-table agent-list list-m4u2iqmwwl " data-search-id="x24482_1994119">
            <thead>
                <tr>
                    <th style="width: 1px" class="w3-hide-small">#</th>
                    <th class="field-m4u2iqmwwl-face-photo">Face Photo                          </th>
                    <th class="field-m4u2iqmwwl-student-code">Student                          </th>
                    <th class="field-m4u2iqmwwl-student-leave-application-id">Student Leave Application                          </th>
                    <th class="w3-center field-m4u2iqmwwl-status">Mark As                          </th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020061" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020061&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11930240&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0591&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0591&rsqb; Nguyễn Thị Minh &Aacute;nh &lpar;17&bsol;&sol;9&bsol;&sol;2023&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Aacute;nh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Thị Minh &Aacute;nh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020061-cso-1-11930240-hs2013.0591-nguyen-thi-minh-anh-17-9-2023-" data-update-time="2026-08-15 15:22:07" data-id="15020061">
                    <td class="no-wrap list-item-serial w3-hide-small">1</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UG1Wc3B5WVhHbmoyQys4T1JjRVd5SUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11930240" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0591] Nguyễn Thị Minh Ánh (17/9/2023)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020060" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020060&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998290&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0375&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0375&rsqb; B&ugrave;i Trung D&utilde;ng &lpar;11&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;B&ugrave;i&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;B&ugrave;i Trung D&utilde;ng&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020060-cso-1-11998290-hs2013.0375-bui-trung-dung-11-7-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020060">
                    <td class="no-wrap list-item-serial w3-hide-small">2</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/RTdxejc1WGNoUnZ2dHVaS1FSMTJBWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998290" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0375] Bùi Trung Dũng (11/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020040" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020040&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998264&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142024590&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142024590&rsqb; Dương H&agrave; Linh &lpar;28&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Dương&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Dương H&agrave; Linh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020040-cso-1-11998264-0142024590-duong-ha-linh-28-10-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020040">
                    <td class="no-wrap list-item-serial w3-hide-small">3</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/cFJjUU9HSlovaTIzREM1L1hMcmZ6WUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998264" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142024590] Dương Hà Linh (28/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020054" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020054&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998283&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;2742214801&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;2742214801&rsqb; &Dstrok;ặng Bạch Dương &lpar;29&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Dstrok;ặng&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;&Dstrok;ặng Bạch Dương&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020054-cso-1-11998283-2742214801-dang-bach-duong-29-10-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020054">
                    <td class="no-wrap list-item-serial w3-hide-small">4</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/WW9taXdDUk1KZVhOYmdmMGhCc0lmWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998283" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[2742214801] Đặng Bạch Dương (29/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020059" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020059&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998289&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0370&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0370&rsqb; &Dstrok;ỗ Thị Thanh Mai &lpar;19&bsol;&sol;3&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;&Dstrok;ỗ&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;&Dstrok;ỗ Thị Thanh Mai&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020059-cso-1-11998289-hs2013.0370-do-thi-thanh-mai-19-3-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020059">
                    <td class="no-wrap list-item-serial w3-hide-small">5</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/ajcrMGE5aHBSUVBIT2NvZitqSEt2b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998289" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0370] Đỗ Thị Thanh Mai (19/3/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020057" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020057&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998266&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;5243876180&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;5243876180&rsqb; Huỳnh Bảo S&acirc;m &lpar;5&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Huỳnh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Huỳnh Bảo S&acirc;m&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020057-cso-1-11998266-5243876180-huynh-bao-sam-5-11-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020057">
                    <td class="no-wrap list-item-serial w3-hide-small">6</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OWt6dGQ5TDB3aVpKTWdCZWRmQklFb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998266" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[5243876180] Huỳnh Bảo Sâm (5/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020048" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020048&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998256&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143878172&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143878172&rsqb; L&ecirc; Hồng Trang &lpar;9&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Hồng Trang&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020048-cso-1-11998256-0143878172-le-hong-trang-9-11-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020048">
                    <td class="no-wrap list-item-serial w3-hide-small">7</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/bnVlMGtrVDV2THI4Syt1U3RUZGQzNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998256" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143878172] Lê Hồng Trang (9/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020049" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020049&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998228&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143882653&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143882653&rsqb; L&ecirc; Tuấn Khải &lpar;24&bsol;&sol;4&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Tuấn Khải&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020049-cso-1-11998228-0143882653-le-tuan-khai-24-4-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020049">
                    <td class="no-wrap list-item-serial w3-hide-small">8</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OUVZR0MrSm9LVllQeENxK29Ed0VEWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998228" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143882653] Lê Tuấn Khải (24/4/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020051" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020051&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998279&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0145073072&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0145073072&rsqb; L&ecirc; Nguyễn H&agrave; An &lpar;24&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;L&ecirc;&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;L&ecirc; Nguyễn H&agrave; An&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020051-cso-1-11998279-0145073072-le-nguyen-ha-an-24-11-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020051">
                    <td class="no-wrap list-item-serial w3-hide-small">9</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/L3JtMXozc0RNM1Z3SkxBWk4wamtDNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998279" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0145073072] Lê Nguyễn Hà An (24/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020037" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020037&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998277&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0133693025&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0133693025&rsqb; Lỗ Thị Minh Loan &lpar;22&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Lỗ&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Lỗ Thị Minh Loan&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020037-cso-1-11998277-0133693025-lo-thi-minh-loan-22-10-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020037">
                    <td class="no-wrap list-item-serial w3-hide-small">10</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/WjdnVm02MzFyekJucVhUeVpoZEVINEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998277" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0133693025] Lỗ Thị Minh Loan (22/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020038" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020038&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998281&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0133699431&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0133699431&rsqb; Lương Th&ugrave;y An &lpar;14&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Lương&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Lương Th&ugrave;y An&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020038-cso-1-11998281-0133699431-luong-thuy-an-14-11-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020038">
                    <td class="no-wrap list-item-serial w3-hide-small">11</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/Q2R2SmVBbzEzYVhZZ3RET3hDOEZtNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998281" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0133699431] Lương Thùy An (14/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020041" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020041&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998237&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142036358&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142036358&rsqb; Nguyễn Thanh Mai &lpar;19&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Thanh Mai&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020041-cso-1-11998237-0142036358-nguyen-thanh-mai-19-7-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020041">
                    <td class="no-wrap list-item-serial w3-hide-small">12</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/M21mUW9iM3FJTk9xM3BONDhiUFovNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998237" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142036358] Nguyễn Thanh Mai (19/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020042" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020042&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998273&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142176194&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142176194&rsqb; Nguyễn Minh Ch&acirc;u &lpar;14&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Minh Ch&acirc;u&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020042-cso-1-11998273-0142176194-nguyen-minh-chau-14-7-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020042">
                    <td class="no-wrap list-item-serial w3-hide-small">13</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/azZDWkJrbTcrZkEwNXBkMkRkbjN1b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998273" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142176194] Nguyễn Minh Châu (14/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020043" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020043&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998167&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142178893&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142178893&rsqb; Nguyễn Xu&acirc;n B&aacute;ch &lpar;12&bsol;&sol;11&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Xu&acirc;n B&aacute;ch&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020043-cso-1-11998167-0142178893-nguyen-xuan-bach-12-11-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020043">
                    <td class="no-wrap list-item-serial w3-hide-small">14</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/OEhMQ2lzaGJwR0Z0TW5ndnhEOVRxb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998167" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142178893] Nguyễn Xuân Bách (12/11/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020045" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020045&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998285&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142623193&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142623193&rsqb; Nguyễn Nguyệt Minh Ch&acirc;u &lpar;27&bsol;&sol;1&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Nguyệt Minh Ch&acirc;u&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020045-cso-1-11998285-0142623193-nguyen-nguyet-minh-chau-27-1-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020045">
                    <td class="no-wrap list-item-serial w3-hide-small">15</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/a0ZvNXNTeU5XQkJsYVJFNG0yRjI2SUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998285" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142623193] Nguyễn Nguyệt Minh Châu (27/1/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020046" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020046&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998261&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143847569&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143847569&rsqb; Nguyễn Quang Vinh &lpar;17&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Quang Vinh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020046-cso-1-11998261-0143847569-nguyen-quang-vinh-17-7-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020046">
                    <td class="no-wrap list-item-serial w3-hide-small">16</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/YWN1bG9iZWRuTnpQMjdmNmd5WitSNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998261" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143847569] Nguyễn Quang Vinh (17/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020050" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020050&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998271&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143982147&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143982147&rsqb; Nguyễn Bảo Ng&acirc;n &lpar;10&bsol;&sol;12&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Bảo Ng&acirc;n&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020050-cso-1-11998271-0143982147-nguyen-bao-ngan-10-12-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020050">
                    <td class="no-wrap list-item-serial w3-hide-small">17</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/b0w4N0J2enBNeERoenJVd3NSWVFHb0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998271" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143982147] Nguyễn Bảo Ngân (10/12/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020053" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020053&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998224&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;24062013&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;24062013&rsqb; Nguyễn Minh Huy &lpar;24&bsol;&sol;6&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Minh Huy&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020053-cso-1-11998224-24062013-nguyen-minh-huy-24-6-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020053">
                    <td class="no-wrap list-item-serial w3-hide-small">18</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/ditRNTRYQzdPNEdYajdTYWo2alM5b0x4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998224" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[24062013] Nguyễn Minh Huy (24/6/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020056" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020056&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998260&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;3833007416&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;3833007416&rsqb; Nguyễn Trường V&abreve;n &lpar;4&bsol;&sol;4&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Trường V&abreve;n&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020056-cso-1-11998260-3833007416-nguyen-truong-van-4-4-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020056">
                    <td class="no-wrap list-item-serial w3-hide-small">19</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/SlRrSWpOdG50OWF4eHdUc2NxNkxBNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998260" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[3833007416] Nguyễn Trường Văn (4/4/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020058" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020058&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998287&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;HS2013&period;0074&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;HS2013&period;0074&rsqb; Nguyễn Bảo Nam &lpar;24&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Nguyễn&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Nguyễn Bảo Nam&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020058-cso-1-11998287-hs2013.0074-nguyen-bao-nam-24-10-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020058">
                    <td class="no-wrap list-item-serial w3-hide-small">20</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/eUE0Q2dnTnV2c1BueURKSFByOHhwWUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998287" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[HS2013.0074] Nguyễn Bảo Nam (24/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020055" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020055&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998253&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;3043884528&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;3043884528&rsqb; Phạm Duy&ecirc;n Thư &lpar;5&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;43&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Phạm&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Phạm Duy&ecirc;n Thư&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020055-cso-1-11998253-3043884528-pham-duyen-thu-5-10-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020055">
                    <td class="no-wrap list-item-serial w3-hide-small">21</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UzhHaG51bEllSlcxM1oxQ3UydmwwSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998253" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[3043884528] Phạm Duyên Thư (5/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020047" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020047&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998269&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0143867800&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0143867800&rsqb; Tống Bảo L&acirc;m &lpar;12&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Tống&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Tống Bảo L&acirc;m&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020047-cso-1-11998269-0143867800-tong-bao-lam-12-10-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020047">
                    <td class="no-wrap list-item-serial w3-hide-small">22</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/djFxLzBUUDR5M1ZENExOSTFzVThLSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998269" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0143867800] Tống Bảo Lâm (12/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020039" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020039&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998275&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0138686776&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0138686776&rsqb; Trần B&ugrave;i Ngọc Diệp &lpar;13&bsol;&sol;10&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trần&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trần B&ugrave;i Ngọc Diệp&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020039-cso-1-11998275-0138686776-tran-bui-ngoc-diep-13-10-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020039">
                    <td class="no-wrap list-item-serial w3-hide-small">23</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/VHpoTVFCVWdYUE1RMHlKR01qd1ZFSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998275" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0138686776] Trần Bùi Ngọc Diệp (13/10/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020052" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020052&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998164&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0148717275&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0148717275&rsqb; Trần Mộc Anh &lpar;24&bsol;&sol;5&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;07&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trần&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trần Mộc Anh&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020052-cso-1-11998164-0148717275-tran-moc-anh-24-5-2013-" data-update-time="2026-08-15 15:22:07" data-id="15020052">
                    <td class="no-wrap list-item-serial w3-hide-small">24</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/UENvZXVSTVlwNnpoaFN6QkhMK2tTSUx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998164" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0148717275] Trần Mộc Anh (24/5/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
                <tr class="list-item item-m4u2iqmwwl list-x24482_1994119 STUDY_STUDENT_ATTENDANCE_STATUS_PRESENT" id="item-m4u2iqmwwl-15020044" data-entity="&lbrace;&quot;id&quot;&colon;&quot;15020044&quot;&comma;&quot;working&lowbar;site&lowbar;id&quot;&colon;&quot;61892&quot;&comma;&quot;&lowbar;&lowbar;working&lowbar;site&lowbar;id&quot;&colon;&quot;&lbrack;61892&rsqb; PASCAL 2026-2027&quot;&comma;&quot;face&lowbar;photo&quot;&colon;&quot;cso&colon;1&colon;11998232&quot;&comma;&quot;student&lowbar;code&quot;&colon;&quot;0142216810&quot;&comma;&quot;&lowbar;&lowbar;student&lowbar;code&quot;&colon;&quot;&lbrack;0142216810&rsqb; Trịnh &Dstrok;ức Long &lpar;17&bsol;&sol;7&bsol;&sol;2013&rpar;&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;null&comma;&quot;&lowbar;&lowbar;student&lowbar;leave&lowbar;application&lowbar;id&quot;&colon;&quot;&quot;&comma;&quot;status&quot;&colon;&quot;STUDY&lowbar;STUDENT&lowbar;ATTENDANCE&lowbar;STATUS&lowbar;PRESENT&quot;&comma;&quot;&lowbar;&lowbar;status&quot;&colon;&quot;PRESENT&quot;&comma;&quot;create&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;create&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;create&lowbar;time&quot;&colon;&quot;2026-08-14 14&colon;50&colon;42&quot;&comma;&quot;update&lowbar;site&lowbar;id&quot;&colon;&quot;47826&quot;&comma;&quot;&lowbar;&lowbar;update&lowbar;site&lowbar;id&quot;&colon;&quot;V&utilde; Ho&agrave;ng Linh&quot;&comma;&quot;update&lowbar;time&quot;&colon;&quot;2026-08-15 15&colon;22&colon;06&quot;&comma;&quot;first&lowbar;name&quot;&colon;&quot;Trịnh&quot;&comma;&quot;full&lowbar;name&quot;&colon;&quot;Trịnh &Dstrok;ức Long&quot;&comma;&quot;student&lowbar;leave&lowbar;application&lowbar;occ&quot;&colon;&quot;DOCTYPE-7014&quot;&comma;&quot;star&lowbar;id&quot;&colon;&quot;1&quot;&comma;&quot;class&lowbar;schedule&lowbar;slot&lowbar;id&quot;&colon;&quot;2054334&quot;&comma;&quot;has&lowbar;attendance&quot;&colon;&quot;1&quot;&comma;&quot;study&lowbar;student&lowbar;attendance&lowbar;sheet&lowbar;id&quot;&colon;&quot;1994119&quot;&comma;&quot;class&lowbar;schedule&lowbar;date&quot;&colon;&quot;2026-08-14&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;x&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;y&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dx&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;dy&quot;&colon;&quot;0&quot;&comma;&quot;&lowbar;&lowbar;geo&lowbar;&lowbar;meta&quot;&colon;null&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;teacher&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;allow&lowbar;proctor&lowbar;to&lowbar;mark&lowbar;student&lowbar;attendance&quot;&colon;&quot;0&quot;&comma;&quot;master&lowbar;key&quot;&colon;&quot;1994119&quot;&rcub;" data-search-key="15020044-cso-1-11998232-0142216810-trinh-duc-long-17-7-2013-" data-update-time="2026-08-15 15:22:06" data-id="15020044">
                    <td class="no-wrap list-item-serial w3-hide-small">25</td>
                    <td class="field-m4u2iqmwwl-face-photo">
                        <div class="avatar-container w64 h64" style="max-width:48px !important;max-height:48px !important;">
                            <img src="https://idcloud.vn/61892/appstart/reader/L3Q2S0xDd2xWZjVuaEREbGN6U2grNEx4dTA2eHNHSHBKUXhyR3dBcytRVT0=/0/48-48/cso:1:11998232" alt="face_photo">
                        </div>
                    </td>
                    <td class="field-m4u2iqmwwl-student-code">[0142216810] Trịnh Đức Long (17/7/2013)                  </td>
                    <td class="field-m4u2iqmwwl-student-leave-application-id"></td>
                    <td class="w3-center field-m4u2iqmwwl-status">
                        <div class="ohke-status" style="background:#0073CF;color:#ffffff;">PRESENT  </div>
                    </td>
                    <td class="prevent-click w3-right-align no-wrap"></td>
                </tr>
            </tbody>
        </table>
    </div>
    <script type="application/json" id="env-m4u2iqmwwl">
        {
            "id": null,
            "ohke_prefix": "field-epht2bmdsb",
            "master_object_class_name": "study_student_attendance_sheet",
            "master_object_class_code": "DOCTYPE-7004",
            ":field_subform_id": 148610,
            "data_query_id": "muxdylj43v66",
            ":master_readonly": 0,
            "master_key": "1994119",
            "father_master_key": "1994119",
            "params": [
            ]
        }</script>
</div>
<script>
    ojs['agent-m4u2iqmwwl'] = $.createList({
        actionPrefix: 'x24482_',
        viewId: 'm4u2iqmwwl',
        agentSelector: '#agent-m4u2iqmwwl',
        formSelector: '#form-m4u2iqmwwl',
        formDomain: 'x24482_',
        inlineSelector: 0,
        isSubform: 1,
        isListNavigator: 0,
        itemActionDefault: 'IV',
        editorInModal: 1,
        viewerInModal: 1,
        creatorInModal: 0,
        hasCreator: 0,
        hasViewer: 1,
        hasEditor: 0,
        title: 'Study &gt; Student Attendance',
        hasListPrint: 0,
        formContainer: 'tab',
        forInputType: 'subform',
        floatingItemAction: 0,
        showSeriesColumn: 1,
        allowClientFilter: 1,
        statistic: {
            found: 25,
            total: 25,
            fullTotal: 25
        },
        switchFields: {},
    });
    ojs['agent-m4u2iqmwwl'].ready().then( () => {
        const agentId = 'agent-m4u2iqmwwl';
        const agentSelector = '#agent-m4u2iqmwwl';
        Ohke.form.registerChild(agentSelector);
        let me = ojs[agentId];
        let $agent = $(agentSelector).closest('.agent-container');
        $('#table-m4u2iqmwwl').children('thead').ohkeHelp();
    }
    ).then( () => {
        const agentId = 'agent-m4u2iqmwwl';
        let me = ojs[agentId];
        let $rootAgent = $('#agent-m4u2iqmwwl');
        $rootAgent.on('pac:RELOAD', (event, attachment) => {
            let message = event.type.substr(4);
            let $agent = $rootAgent
              , self = $agent.data('form-action');
            let PAC = $agent.data('pac-event');
            if (PAC)
                PAC.log('L1224 received RELOAD');
            attachment = Ohke.clone(attachment || {});
            if (!Array.isArray(attachment.env))
                attachment.env = [];
            attachment.env.unshift(Ohke.clone($agent.data('env')));
            try {
                self.reload();
            } catch (e) {
                console.error(`1224-list-RELOAD: ${e.message}`);
            }
        }
        );
        $rootAgent.agentInitListener();
        let PAC = $rootAgent.data('pac-event');
        if (PAC)
            PAC.self('after_load');
    }
    )
</script>

Nút đánh dấu hoàn thành: https://idcloud.vn/61892/appstart/classhub/x35FD2_jsonPostTransition
Nếu bị lỗi: 
Payload:{id: 1994119, field_name: "attendance_sheet_status", begin_state: "CLASS_SCHEDULE_SLOT_STATUS_PENDING",…}
begin_state
: 
"CLASS_SCHEDULE_SLOT_STATUS_PENDING"
end_state
: 
"CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED"
entity
: 
{id: "1994119", working_site_id: "61892", __working_site_id: "[61892] PASCAL 2026-2027",…}
env
: 
{id: "1994119", ohke_prefix: "field-jzx5yqdyah", data_query_id: "sjuhcptepzut",…}
field_name
: 
"attendance_sheet_status"
id
: 
1994119
is_reversal
: 
0
mode
: 
"V"
update_time
: 
"2026-08-15 15:15:50"
Respone:
{
    "type": "error",
    "code": "ERR_STUDENT_ATTENDANCE_INCOMPLETED",
    "message": "👉 Student attendance not completed",
    "description": "<div>👉 <em data-start=\"385\" data-end=\"553\">The student attendance for this class session has not been completed or is incomplete. Please review and finalize the attendance before proceeding with other actions.<\/em><\/div>",
    "params": []
}
Nếu thành công:
Payload: {id: 1994119, field_name: "attendance_sheet_status", begin_state: "CLASS_SCHEDULE_SLOT_STATUS_PENDING",…}
begin_state
: 
"CLASS_SCHEDULE_SLOT_STATUS_PENDING"
end_state
: 
"CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED"
entity
: 
{id: "1994119", working_site_id: "61892", __working_site_id: "[61892] PASCAL 2026-2027",…}
env
: 
{id: "1994119", ohke_prefix: "field-jzx5yqdyah", data_query_id: "sjuhcptepzut",…}
field_name
: 
"attendance_sheet_status"
id
: 
1994119
is_reversal
: 
0
mode
: 
"V"
update_time
: 
"2026-08-15 15:15:50"
Respone:
{
    "type": "success",
    "data": {
        "mode": "V",
        "accessible": true,
        "modes": {
            "C": true,
            "V": true,
            "E": true,
            "L": 1
        },
        "status": "CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED"
    }
}
Sẽ có load lại viewer và model

---

**[NHIỆM VỤ CỦA BẠN]**
1. **Audit (Kiểm toán) Mã nguồn:** Đọc kỹ Raw API Logs được cung cấp. Đối chiếu từng trường dữ liệu (Header, Payload, Params) với các lệnh `rpcCallHeadlessV33` đang được cấu hình trong hàm `submitAttendanceFlowV33` của file `content.js` hiện tại.
2. **Phân tích Khác biệt:** Liệt kê ngắn gọn (dưới dạng Bullet points) những điểm mã nguồn hiện tại đang làm sai, truyền thừa, hoặc truyền thiếu so với Raw Log.
3. **Tái cấu trúc mã nguồn:** Viết lại hoàn chỉnh hàm `submitAttendanceFlowV33`. Phải đảm bảo:
   - Payload của các API `bttAction` khớp 100% với log.
   - Cơ chế bóc tách HTML ngầm để lấy `ohke_prefix` và `data_query_id` hoạt động chuẩn xác và được cập nhật liên tục nếu cần trước mỗi lần chốt sổ.
   - Luồng 3-Tier Fallback hoạt động đúng logic đã mô tả (bị reject -> nhảy Tier).
4. **Quy tắc Bất di bất dịch:** 
   - KHÔNG làm thay đổi bất kỳ logic nào bên ngoài hàm `submitAttendanceFlowV33` (đặc biệt là cơ chế Background Alarm, Ghost Tab và Day-pass).
   - KHÔNG sử dụng các phương thức thao tác DOM trực tiếp để chốt sổ, tuân thủ 100% Headless API.

**[ĐỊNH DẠNG ĐẦU RA]**
1. Báo cáo kiểm toán ngắn gọn.
2. Khối mã hoàn chỉnh của hàm `submitAttendanceFlowV33` đã được vá lỗi.