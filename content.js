(async function () {
    const delay = ms => new Promise(res => setTimeout(res, ms));

    // ==========================================
    // 0. CẤU HÌNH SERVER BẢO MẬT
    // ==========================================
    const API_URL = "https://script.google.com/macros/s/AKfycbxjz6kq9gkh6OuK3-2wxjhHEgJ3c_5BgoxATDQJP1kRov127nvJwRU2FcI1VhDh8sFN/exec";

    // ==========================================
    // 1. TẢI THƯ VIỆN & XÓA GIAO DIỆN CŨ
    // ==========================================
    if (typeof XLSX === 'undefined') {
        let script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        document.head.appendChild(script);
        await new Promise(r => script.onload = r);
    }

    if (document.getElementById('ohke-hub-tools')) {
        document.getElementById('ohke-hub-tools').remove();
    }

    // ==========================================
    // 2. HỆ THỐNG XÁC THỰC (TOKEN & DEVICE ID)
    // ==========================================
    const getDeviceId = async () => {
        return new Promise(resolve => {
            chrome.storage.local.get(['ohke_device_id'], (res) => {
                if (res.ohke_device_id) { resolve(res.ohke_device_id); }
                else {
                    let newId = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    chrome.storage.local.set({ 'ohke_device_id': newId }); resolve(newId);
                }
            });
        });
    };

    const getSavedToken = async () => {
        return new Promise(resolve => {
            chrome.storage.local.get(['ohke_auth_token'], (res) => resolve(res.ohke_auth_token || null));
        });
    };

    const saveToken = (token) => { chrome.storage.local.set({ 'ohke_auth_token': token }); };

    let deviceId = await getDeviceId();
    let currentToken = await getSavedToken();

    const verifyTokenOnServer = async (token) => {
        if (!API_URL) return { valid: true, message: "Cảnh báo: Chưa cấu hình API." };
        try {
            let res = await fetch(`${API_URL}?token=${token}&deviceId=${deviceId}`);
            return await res.json();
        } catch (e) {
            return { valid: false, message: "Lỗi kết nối máy chủ xác thực!" };
        }
    };

    // ==========================================
    // 3. GIAO DIỆN CHÍNH (MAIN APP V22)
    // ==========================================
    const renderMainApp = () => {
        let pageText = document.body.innerText.toLowerCase();
        let defaultKey = 'TX1';
        if (pageText.includes('hs1-2')) defaultKey = 'TX2';
        else if (pageText.includes('hs1-3')) defaultKey = 'TX3';
        else if (pageText.includes('hs1-4')) defaultKey = 'TX4';
        else if (pageText.includes('hs1-5')) defaultKey = 'TX5';
        else if (pageText.includes('hs2')) defaultKey = 'GK';
        else if (pageText.includes('hs3')) defaultKey = 'CK';

        const panel = document.createElement('div');
        panel.id = 'ohke-hub-tools';
        panel.style.cssText = `
            position: fixed; top: 70px; right: 20px; width: 360px;
            background: #ffffff; border: 2px solid #004085; border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 999999; 
            font-family: Arial, sans-serif; color: #333; overflow: hidden;
        `;

        let displayAuth = currentToken ? 'none' : 'block';
        let displayTools = currentToken ? 'block' : 'none';

        panel.innerHTML = `
            <div style="display: flex; background: #004085; color: white; border-bottom: 2px solid #002752;">
                <div id="tab-grader" style="flex: 1; text-align: center; padding: 12px; font-weight: bold; cursor: pointer; background: #004085;">⚡ NHẬP ĐIỂM (PRO)</div>
                <div id="tab-attendance" style="flex: 1; text-align: center; padding: 12px; font-weight: bold; cursor: pointer; background: #0056b3;">🙋 ĐIỂM DANH (FREE)</div>
            </div>

            <div style="padding: 15px;">
                <!-- KHU VỰC NHẬP ĐIỂM -->
                <div id="section-grader" style="display: none;">
                    <div id="grader-auth" style="display: ${displayAuth}; text-align: center; padding: 10px 0;">
                        <p style="font-size: 12px; margin-bottom: 10px; color: #dc3545; font-weight: bold;">Tính năng này yêu cầu mã Token bản quyền.</p>
                        <input type="text" id="input-token" placeholder="Nhập mã Token..." style="width: 100%; padding: 8px; text-align: center; font-weight: bold; font-size: 13px; border: 2px solid #ccc; border-radius: 4px; margin-bottom: 10px; outline: none;">
                        <button id="btn-verify" style="width: 100%; background: #28a745; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">KÍCH HOẠT PRO</button>
                        <div id="auth-log" style="margin-top: 10px; font-size: 12px; color: red; font-weight: bold;"></div>
                    </div>

                    <div id="grader-tools" style="display: ${displayTools};">
                        <div style="text-align: right; margin-bottom: 8px;">
                            <a href="#" id="btn-logout-token" style="font-size: 11px; color: #dc3545; text-decoration: underline;">Thoát Token</a>
                        </div>
                        <label style="font-size: 12px; font-weight: bold;">1. Chọn file Excel</label>
                        <input type="file" id="excel-file" accept=".xlsx, .xls" style="width: 100%; margin: 8px 0 10px 0; font-size: 12px;">
                        
                        <label style="font-size: 12px; font-weight: bold;">2. Cột điểm hiện tại</label>
                        <select id="score-col" style="width: 100%; margin: 8px 0 15px 0; padding: 6px; border-radius: 4px; border: 1px solid #aaa;">
                            <option value="TX1" ${defaultKey === 'TX1' ? 'selected' : ''}>ĐĐG Thường xuyên 1 (HS1-1)</option>
                            <option value="TX2" ${defaultKey === 'TX2' ? 'selected' : ''}>ĐĐG Thường xuyên 2 (HS1-2)</option>
                            <option value="TX3" ${defaultKey === 'TX3' ? 'selected' : ''}>ĐĐG Thường xuyên 3 (HS1-3)</option>
                            <option value="TX4" ${defaultKey === 'TX4' ? 'selected' : ''}>ĐĐG Thường xuyên 4 (HS1-4)</option>
                            <option value="TX5" ${defaultKey === 'TX5' ? 'selected' : ''}>ĐĐG Thường xuyên 5 (HS1-5)</option>
                            <option value="GK"  ${defaultKey === 'GK' ? 'selected' : ''}>Điểm Giữa Kì (HS2)</option>
                            <option value="CK"  ${defaultKey === 'CK' ? 'selected' : ''}>Điểm Cuối Kì (HS3)</option>
                        </select>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button id="btn-auto-full" style="background: #28a745; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🚀 AUTO LỚP HIỆN TẠI (Tạo Bảng -> Chốt Sổ)</button>
                            <button id="btn-auto-input" style="background: #007bff; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">⚡ CHỈ NHẬP ĐIỂM CỘT ĐANG CHỌN</button>
                            <button id="btn-reset" style="background: #ffc107; color: black; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🔄 RESET ĐIỂM (Kéo về & Xóa sạch)</button>
                        </div>
                    </div>
                </div>

                <!-- KHU VỰC ĐIỂM DANH -->
                <div id="section-attendance" style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="background: #e9ecef; padding: 10px; border-radius: 5px; font-size: 12px; margin-bottom: 5px;">
                        <b>Miễn phí:</b> Mở cửa sổ điểm danh trên web, sau đó bấm nút tự động dưới đây.
                    </div>
                    <button id="btn-auto-attendance" style="background: #dc3545; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🚀 AUTO ĐIỂM DANH TẤT CẢ</button>
                    <button id="btn-att-students" style="background: #17a2b8; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">👨‍🎓 ĐIỂM DANH HỌC SINH (Như tiết trước)</button>
                    <button id="btn-att-teacher" style="background: #6f42c1; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">👨‍🏫 ĐIỂM DANH GIÁO VIÊN</button>
                    <button id="btn-att-complete" style="background: #28a745; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">✅ HOÀN THÀNH & TIẾP TỤC</button>
                </div>

                <div style="margin-top: 15px;">
                    <button id="btn-close-tool" style="width: 100%; background: #6c757d; color: white; padding: 6px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Đóng Cửa Sổ</button>
                </div>
                <div id="tool-log" style="margin-top: 10px; font-size: 11px; color: #444; max-height: 120px; overflow-y: auto; background: #f8f9fa; padding: 8px; border-radius: 4px; border: 1px solid #eee;">Trạng thái: Sẵn sàng...</div>
            </div>
        `;
        document.body.appendChild(panel);

        const log = (msg) => {
            const logEl = document.getElementById('tool-log');
            if (!logEl) return;
            logEl.innerHTML += `<div>👉 ${msg}</div>`;
            logEl.scrollTop = logEl.scrollHeight;
        };

        document.getElementById('btn-close-tool').onclick = () => panel.remove();

        document.getElementById('btn-verify').onclick = async () => {
            let tk = document.getElementById('input-token').value.trim();
            if (!tk) return;
            let btn = document.getElementById('btn-verify');
            btn.innerText = "Đang kiểm tra...";
            btn.style.opacity = "0.7";

            let result = await verifyTokenOnServer(tk);
            if (result.valid) {
                saveToken(tk);
                document.getElementById('grader-auth').style.display = 'none';
                document.getElementById('grader-tools').style.display = 'block';
                log("✅ Đã kích hoạt bản PRO thành công!");
            } else {
                document.getElementById('auth-log').innerText = "❌ " + result.message;
                btn.innerText = "KÍCH HOẠT PRO";
                btn.style.opacity = "1";
            }
        };

        document.getElementById('btn-logout-token').onclick = (e) => {
            e.preventDefault();
            chrome.storage.local.remove(['ohke_auth_token']);
            document.getElementById('grader-auth').style.display = 'block';
            document.getElementById('grader-tools').style.display = 'none';
            document.getElementById('input-token').value = "";
            document.getElementById('auth-log').innerText = "";
            log("🔒 Đã đăng xuất Token. Bản PRO bị khóa.");
        };

        document.getElementById('tab-grader').onclick = () => {
            document.getElementById('tab-grader').style.background = '#0056b3';
            document.getElementById('tab-attendance').style.background = '#004085';
            document.getElementById('section-grader').style.display = 'block';
            document.getElementById('section-attendance').style.display = 'none';
        };

        document.getElementById('tab-attendance').onclick = () => {
            document.getElementById('tab-attendance').style.background = '#0056b3';
            document.getElementById('tab-grader').style.background = '#004085';
            document.getElementById('section-grader').style.display = 'none';
            document.getElementById('section-attendance').style.display = 'flex';
        };

        const forceClick = (el) => {
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.click();
        };

        const getTopModal = () => {
            const modals = Array.from(document.querySelectorAll('.w3-modal.w3-show')).filter(m => m.offsetWidth > 0);
            return modals.length > 0 ? modals[modals.length - 1] : document;
        };

        const clickText = async (tuKhoa, loaiTru = null) => {
            const vung = getTopModal();
            let els = Array.from(vung.querySelectorAll('a, button, div, span, label')).filter(el => {
                if (el.offsetWidth === 0) return false;
                let text = el.textContent.trim();
                if (!text.includes(tuKhoa)) return false;
                if (loaiTru && text.includes(loaiTru)) return false;
                return true;
            });
            if (els.length === 0) return 0;
            let minLen = Math.min(...els.map(e => e.textContent.length));
            forceClick(els.filter(e => e.textContent.length <= minLen + 3)[0]);
            return 1;
        };

        const closeTopModal = async () => {
            const vung = getTopModal();
            if (vung === document) return;
            let nutDong = vung.querySelector('.close-btn, a[onclick*="close"]');
            if (nutDong && nutDong.offsetWidth > 0) {
                nutDong.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(200);
                nutDong.click();
            } else {
                await clickText('Đóng');
            }
        };

        // ==========================================
        // 4. MODULE ĐIỂM DANH (GIỮ NGUYÊN)
        // ==========================================
        document.getElementById('btn-auto-attendance').onclick = async () => {
            log("🚀 Kích hoạt quy trình Tự Động Hóa Điểm Danh...");
            let cacPhanTu = Array.from(document.querySelectorAll('a, button, div, span'));
            let giaoDienTiengAnh = cacPhanTu.find(el => el.offsetWidth > 0 && (el.textContent.trim().toLowerCase() === 'past' || el.textContent.trim().toLowerCase() === 'today'));

            if (giaoDienTiengAnh) {
                log("🌐 Phát hiện giao diện Tiếng Anh! Đang tiến hành đổi sang Tiếng Việt...");
                let coNgoaiNgu = document.querySelector('img[src*="en"], img[src*="us"], img[src*="uk"], .flag-icon-us, .flag-icon-gb');
                let nutChuyenNgonNgu = coNgoaiNgu ? coNgoaiNgu.closest('a, button, div.w3-dropdown-hover, div.w3-dropdown-click') : null;
                if (nutChuyenNgonNgu) {
                    nutChuyenNgonNgu.click(); await delay(500);
                    let coVN = document.querySelector('img[src*="vn"], .flag-icon-vn, [title*="Việt"], [alt*="Việt"]');
                    if (coVN) { coVN.click(); log("⏳ Đã chọn Tiếng Việt. Đợi hệ thống tải lại..."); await delay(3500); }
                    else { await delay(3500); }
                }
            }

            log("🔍 Đang trích xuất danh tính Giáo viên...");
            let tenGiaoVien = "";
            const quetTenNgam = () => {
                let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    let text = node.nodeValue.trim();
                    let match = text.match(/^\[\d+\]\s+([A-Za-zÀ-ỹ\s]+)/);
                    if (match && match[1] && match[1].trim().length > 3) return match[1].trim().split('\n')[0].trim();
                }
                return null;
            };

            tenGiaoVien = quetTenNgam();

            if (!tenGiaoVien) {
                let rightAvatars = document.querySelectorAll('.w3-right .w3-dropdown-click, .w3-right .w3-dropdown-hover, .w3-right img, .w3-top .w3-right > div');
                if (rightAvatars.length > 0) {
                    let avatarBtn = rightAvatars[rightAvatars.length - 1];
                    avatarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); avatarBtn.click(); await delay(1000);
                    tenGiaoVien = quetTenNgam(); avatarBtn.click(); await delay(400);
                }
            }

            if (!tenGiaoVien) { alert("❌ LỖI BẢO MẬT: Không thể đọc được tên của bạn trên hệ thống!"); return; }
            log(`✅ Thành công! Xin chào Giáo viên: [${tenGiaoVien}]`);

            let cacTab = Array.from(document.querySelectorAll('a, button, div, span')).filter(el => el.offsetWidth > 0);
            let tabQuaKhu = cacTab.find(el => el.textContent.trim().toLowerCase() === 'quá khứ');

            if (tabQuaKhu) {
                tabQuaKhu.scrollIntoView({ behavior: 'smooth', block: 'center' }); await delay(300); tabQuaKhu.click(); await delay(3000);
            } else { alert("❌ LỖI: Không tìm thấy tab 'Quá Khứ'."); return; }

            const tabActive = document.querySelector('.tab-content > .tab-item:not(.w3-hide)');
            if (!tabActive) return;

            let tongSoLopDaXuLy = 0;
            while (true) {
                let cacLop = Array.from(tabActive.querySelectorAll('.list-item')).filter(el =>
                    el.offsetWidth > 0 && !el.dataset.daDiemDanh && (el.textContent.includes('CHƯA NỘP BẢNG ĐIỂM DANH') || el.textContent.includes('CHƯA ĐIỂM DANH GIÁO VIÊN'))
                );

                if (cacLop.length > 0) {
                    for (let i = 0; i < cacLop.length; i++) {
                        cacLop[i].scrollIntoView({ behavior: 'smooth', block: 'center' }); await delay(300); cacLop[i].click(); await delay(3000);

                        let vungChinh = getTopModal();
                        let rows = Array.from(vungChinh.querySelectorAll('tr, .list-item, .ohke-row'));
                        let rowGV = rows.find(r => r.textContent.includes(tenGiaoVien) && r.textContent.includes('CHƯA ĐIỂM DANH'));

                        if (rowGV) {
                            let btnChuaDiemDanh = Array.from(rowGV.querySelectorAll('a, button, div, span')).find(el => el.textContent.trim().includes('CHƯA ĐIỂM DANH') && el.offsetWidth > 0);
                            if (btnChuaDiemDanh) {
                                forceClick(btnChuaDiemDanh); await delay(1500);
                                let daClickCoMat = await clickText('CÓ MẶT', 'Tất Cả'); if (daClickCoMat > 0) await delay(1000);
                                let soModal = Array.from(document.querySelectorAll('.w3-modal.w3-show')).filter(m => m.offsetWidth > 0).length;
                                if (soModal > 1) { await closeTopModal(); await delay(800); }
                            }
                        }

                        let laTiet0 = false;
                        try {
                            let dataEntityStr = cacLop[i].dataset.entity;
                            if (dataEntityStr) {
                                let entityData = JSON.parse(dataEntityStr);
                                let classHourCode = entityData.class_hour_code || '';
                                laTiet0 = classHourCode === 'H0' || classHourCode.startsWith('H0.');
                            }
                        } catch (e) { }

                        if (laTiet0) {
                            let daClickCoMatTatCa = await clickText('Đánh Dấu Tất Cả Có Mặt'); if (daClickCoMatTatCa > 0) await delay(1500);
                            let bamTiepTuc0 = await clickText('Tiếp Tục'); if (bamTiepTuc0 > 0) await delay(2500);
                        } else {
                            let daClickTietTruoc = await clickText('Đánh Dấu Như Tiết Học Trước');
                            if (daClickTietTruoc === 0) await clickText('Đánh Dấu Tất Cả Có Mặt');
                            await delay(1500);
                            let bamTiepTuc = await clickText('Tiếp Tục'); if (bamTiepTuc > 0) await delay(2500);
                        }

                        let soNutDaBam = 0;
                        while (soNutDaBam < 3) {
                            let danhSachHoanThanh = Array.from(getTopModal().querySelectorAll('a, button, .btn, .w3-button')).filter(el => el.offsetWidth > 50 && el.textContent.trim().includes('Đánh Dấu Hoàn Thành') && !el.closest('td'));
                            if (danhSachHoanThanh.length === 0) break;
                            danhSachHoanThanh.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
                            let targetBtn = danhSachHoanThanh[0];

                            for (let w = 0; w < 10; w++) {
                                if (!targetBtn.disabled && !targetBtn.className.includes('disabled')) break;
                                await delay(500);
                            }
                            forceClick(targetBtn); soNutDaBam++;

                            for (let j = 0; j < 15; j++) {
                                await delay(500);
                                let checkLai = Array.from(getTopModal().querySelectorAll('a, button, .btn, .w3-button')).filter(el => el.offsetWidth > 50 && el.textContent.trim().includes('Đánh Dấu Hoàn Thành') && !el.closest('td'));
                                if (checkLai.length < danhSachHoanThanh.length) break;
                            }
                        }
                        await delay(800); await closeTopModal(); await delay(1200);
                        cacLop[i].dataset.daDiemDanh = "true"; cacLop[i].style.opacity = "0.3"; tongSoLopDaXuLy++;
                    }
                } else {
                    let dsPhanTu = Array.from(tabActive.querySelectorAll('a, button, div, span'));
                    let nutXemThem = dsPhanTu.find(el => el.offsetWidth > 0 && el.textContent.trim() === 'Xem Thêm');
                    if (nutXemThem) {
                        forceClick(nutXemThem); await delay(3500);
                        let kiemTraTheDoMoi = Array.from(tabActive.querySelectorAll('.list-item')).filter(el => el.offsetWidth > 0 && !el.dataset.daDiemDanh && (el.textContent.includes('CHƯA NỘP BẢNG ĐIỂM DANH') || el.textContent.includes('CHƯA ĐIỂM DANH GIÁO VIÊN')));
                        if (kiemTraTheDoMoi.length === 0) break;
                    } else break;
                }
            }
            alert(`🎉 HOÀN TẤT ĐIỂM DANH! Tổng số lớp đã xử lý: ${tongSoLopDaXuLy} lớp.`);
        };

        const clickLoadMore = async () => {
            let loadMoreCount = 0; let xemThemBtn;
            do {
                xemThemBtn = Array.from(document.querySelectorAll('a, button, span, .ohke-btn')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('xem thêm'));
                if (xemThemBtn) { forceClick(xemThemBtn); await delay(1000); loadMoreCount++; }
            } while (xemThemBtn && loadMoreCount < 10);
        };

        document.getElementById('btn-att-students').onclick = async () => {
            await clickLoadMore();
            let copyBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('đánh dấu như tiết trước'));
            if (copyBtn) { forceClick(copyBtn); await delay(1000); }
            else {
                let coMatBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('có mặt'));
                if (coMatBtn) forceClick(coMatBtn);
            }
        };

        document.getElementById('btn-att-teacher').onclick = async () => {
            await clickLoadMore();
            let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node; let tenGiaoVien = "Vũ Hoàng Linh";
            while (node = walker.nextNode()) {
                let text = node.nodeValue.trim();
                let match = text.match(/^\[\d+\]\s+([A-Za-zÀ-ỹ\s]+)/);
                if (match && match[1] && match[1].trim().length > 3) { tenGiaoVien = match[1].trim().split('\n')[0].trim(); break; }
            }
            let teacherRow = Array.from(document.querySelectorAll('tr, .list-item, .w3-row')).find(el => el.innerText.includes(tenGiaoVien));
            if (teacherRow) {
                let coMatGV = Array.from(teacherRow.querySelectorAll('a, button, input[type="radio"], .ohke-btn, span')).find(el => el.innerText.toLowerCase().includes('có mặt') || el.className.includes('radio'));
                if (coMatGV) forceClick(coMatGV);
            }
        };

        document.getElementById('btn-att-complete').onclick = async () => {
            let doneBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('hoàn thành'));
            if (doneBtn) { forceClick(doneBtn); await delay(1500); }
            let nextBtn = Array.from(document.querySelectorAll('.w3-modal.w3-show a, .w3-modal.w3-show button, button')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('tiếp tục'));
            if (nextBtn) forceClick(nextBtn);
        };

        // ==========================================
        // 5. MODULE NHẬP ĐIỂM (BẢN CHUẨN MASTER V22)
        // ==========================================
        const checkAndCloseErrorGrading = async () => {
            let errModal = Array.from(document.querySelectorAll('.w3-modal.w3-show')).find(m => m.innerText.includes('dữ liệu đã cũ') || m.innerText.includes('Có lỗi'));
            if (errModal) {
                let btn = errModal.querySelector('.ohke-btn, button, a.w3-button, .close-btn, i.fa-close');
                if (btn) { forceClick(btn); await delay(1000); }
                return true;
            }
            return false;
        };

        const clickTabGrading = async (text) => {
            log(`Mở tab con [${text}]...`);
            for (let i = 0; i < 10; i++) {
                // Tối ưu selector: Chỉ tìm trong các nút tab chuẩn của hệ thống
                let els = Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, .select-holder div'))
                    .filter(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes(text.toLowerCase()));
                
                if (els.length > 0) {
                    // Ưu tiên click nút có chứa mã số (ví dụ [961] Nhập Nhanh, [1414] Sổ Điểm)
                    let priorityEls = els.filter(el => /\[\d+\]/.test(el.textContent));
                    let target = priorityEls.length > 0 ? priorityEls[0] : els[0];
                    
                    if (target) { 
                        forceClick(target); 
                        await delay(1000); 
                        return true; 
                    }
                }
                await delay(400);
            }
            log(`⚠️ Không tìm thấy tab [${text}]`);
            return false;
        };

        const handleBatchTransition = async (targetText) => {
            let chuyenTiepBtn = null;
            for (let i = 0; i < 5; i++) {
                let els = Array.from(document.querySelectorAll('a, button, .ohke-btn')).filter(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('chuyển tiếp'));
                if (els.length > 0) { chuyenTiepBtn = els[0]; break; }
                await delay(500);
            }
            if (!chuyenTiepBtn) return false;

            forceClick(chuyenTiepBtn);
            await delay(1500);

            let activeModals = document.querySelectorAll('.w3-modal.w3-show');
            if (activeModals.length === 0) return false;
            let batchModal = activeModals[activeModals.length - 1];

            let options = Array.from(batchModal.querySelectorAll('a, button, label, .ohke-btn')).filter(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes(targetText.toLowerCase()));
            if (options.length > 0) {
                forceClick(options[0]); await delay(1500);
            } else {
                let closeBtn = batchModal.querySelector('.close-btn, a[class*="close-btn"], i.fa-close');
                if (closeBtn) forceClick(closeBtn);
                await delay(1000); return false;
            }

            activeModals = document.querySelectorAll('.w3-modal.w3-show');
            let confirmModal = activeModals[activeModals.length - 1];

            if (confirmModal && confirmModal.innerText.includes('mã sau:')) {
                let match = confirmModal.innerText.match(/mã sau:\s*(\d+)/i);
                if (match && match[1]) {
                    let code = match[1];
                    let inputField = confirmModal.querySelector('input[name="input"], input[type="text"]');
                    if (inputField) {
                        inputField.value = code;
                        inputField.dispatchEvent(new Event('input', { bubbles: true }));
                        inputField.dispatchEvent(new Event('change', { bubbles: true }));
                        await delay(500);
                    }
                }
            }

            let dongYBtn = Array.from(confirmModal.querySelectorAll('button, a, .ohke-btn')).find(el => el.offsetWidth > 0 && (el.textContent.toLowerCase().includes('đồng ý') || el.textContent.toLowerCase().includes('tiếp tục')));
            if (dongYBtn) { forceClick(dongYBtn); await delay(2000); }

            activeModals = document.querySelectorAll('.w3-modal.w3-show');
            if (activeModals.length > 0) {
                let successModal = activeModals[activeModals.length - 1];
                if (successModal && (successModal.innerText.toLowerCase().includes('successfully') || successModal.innerText.toLowerCase().includes('enqueued') || successModal.innerText.toLowerCase().includes('thành công'))) {
                    let btnOk = Array.from(successModal.querySelectorAll('button, a, .ohke-btn')).find(b => b.offsetWidth > 0 && b.textContent.toLowerCase().includes('đồng ý'));
                    if (btnOk) { forceClick(btnOk); await delay(1000); }
                }
            }

            log(`Đợi máy chủ chạy lệnh...`);
            await delay(5000);

            activeModals = document.querySelectorAll('.w3-modal.w3-show');
            if (activeModals.length > 0) {
                let currentBatchModal = activeModals[activeModals.length - 1];
                let closeBtn = currentBatchModal.querySelector('.close-btn, a[class*="close-btn"], i.fa-close');
                if (closeBtn) { forceClick(closeBtn); await delay(1500); }
            }
            return true;
        };

        const extractAllExcelData = async () => {
            const fileInput = document.getElementById('excel-file');
            if (!fileInput.files.length) { alert("Vui lòng chọn file Excel trước!"); return null; }

            const file = fileInput.files[0];
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonArray = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    let headerRowIdx = jsonArray.findIndex(row => row.some(cell => String(cell).toLowerCase().includes('họ và tên')));
                    if (headerRowIdx === -1) { alert("Lỗi: Không tìm thấy cột 'Họ và tên' trong file!"); resolve(null); return; }

                    let nameCol = 2; let gkCol = -1; let ckCol = -1;
                    let txCols = {};
                    let r1 = jsonArray[headerRowIdx] || [];
                    let r2 = jsonArray[headerRowIdx + 1] || [];
                    let currentMainHeader = '';

                    for (let c = 0; c < Math.max(r1.length, r2.length); c++) {
                        let h1 = String(r1[c] || '').trim().toLowerCase();
                        let h2 = String(r2[c] || '').trim().toLowerCase();

                        if (h1) currentMainHeader = h1;

                        if (currentMainHeader.includes('họ và tên') || h1.includes('họ và tên')) nameCol = c;
                        else if (currentMainHeader.includes('đđggk') || h1.includes('giữa k')) gkCol = c;
                        else if (currentMainHeader.includes('đđgck') || h1.includes('cuối k')) ckCol = c;
                        else if (currentMainHeader.includes('đđgtx') || currentMainHeader.includes('thường xuyên')) {
                            if (h2 === '1') txCols['TX1'] = c; else if (h2 === '2') txCols['TX2'] = c; else if (h2 === '3') txCols['TX3'] = c;
                            else if (h2 === '4') txCols['TX4'] = c; else if (h2 === '5') txCols['TX5'] = c; else if (h2 === '6') txCols['TX6'] = c;
                        }
                    }

                    if (Object.keys(txCols).length === 0) {
                        let startTx = r1.findIndex(x => String(x).toLowerCase().includes('đđgtx'));
                        let endTx = r1.findIndex(x => String(x).toLowerCase().includes('đđggk'));
                        if (startTx !== -1 && endTx !== -1) {
                            let txCount = 1;
                            for (let c = startTx; c < endTx; c++) { txCols['TX' + txCount] = c; txCount++; }
                        }
                    }

                    log(`🔍 Quét Excel: GiữaKì (Cột ${gkCol}), CuốiKì (Cột ${ckCol})`);
                    log(`🔍 Quét ĐĐGtx: Tìm thấy mã [${Object.keys(txCols).join(', ')}]`);

                    let dataStartRow = headerRowIdx + 1;
                    let row1Name = String(jsonArray[dataStartRow]?.[nameCol] || '').trim();
                    if (row1Name === '' || !isNaN(row1Name)) { dataStartRow++; }

                    let fullData = { 'GK': {}, 'CK': {} };
                    for (let i = 1; i <= 10; i++) { fullData['TX' + i] = {}; }

                    for (let i = dataStartRow; i < jsonArray.length; i++) {
                        let row = jsonArray[i];
                        let name = row[nameCol];
                        if (!name) continue;
                        let strName = String(name).trim();

                        for (let txKey in txCols) {
                            let score = String(row[txCols[txKey]] || '').trim().replace(/,/g, '.');
                            if (score !== '' && score.toLowerCase() !== 'nan' && !score.startsWith('#')) fullData[txKey][strName] = score;
                        }

                        if (gkCol !== -1) {
                            let score = String(row[gkCol] || '').trim().replace(/,/g, '.');
                            if (score !== '' && score.toLowerCase() !== 'nan' && !score.startsWith('#')) fullData['GK'][strName] = score;
                        }
                        if (ckCol !== -1) {
                            let score = String(row[ckCol] || '').trim().replace(/,/g, '.');
                            if (score !== '' && score.toLowerCase() !== 'nan' && !score.startsWith('#')) fullData['CK'][strName] = score;
                        }
                    }
                    resolve(fullData);
                };
                reader.readAsArrayBuffer(file);
            });
        };

        // ==========================================
        // MODULE: ĐIỀU HƯỚNG VÀO ĐÁNH GIÁ CHIỀU DỌC [959]
        // ==========================================
        const switchToVerticalAssessment = async () => {
            log("🎯 Đang mở tab [Đánh Giá]...");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await delay(800);

            let tabAssessment = document.querySelector('.ohke-tab-btn[data-item-class="sf-V2253-179197"]');
            if (!tabAssessment) {
                tabAssessment = Array.from(document.querySelectorAll('.ohke-tab-btn')).find(el => el.innerText.includes('Đánh Giá') && el.offsetWidth > 0);
            }

            if (tabAssessment) {
                forceClick(tabAssessment);
                log("⏳ Đợi giao diện Đánh giá tải dữ liệu...");
                await delay(2500);
            } else {
                let opened = await clickTabGrading('Đánh Giá');
                if (opened) await delay(2000);
            }

            log("⏳ Đang tìm và kích hoạt tab [959 - Chiều Dọc]...");
            let foundChieuDoc = false;

            for (let j = 0; j < 15; j++) {
                let btn959 = Array.from(document.querySelectorAll('.ohke-tab-btn')).find(el => el.offsetWidth > 0 && el.innerText.includes('[959]'));
                if (btn959) {
                    log("✅ Đã thấy nút [959], đang kích hoạt...");
                    btn959.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await delay(500);
                    window.scrollBy({ top: -150, behavior: 'smooth' });
                    await delay(300);
                    const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
                    events.forEach(evtType => btn959.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window })));
                    foundChieuDoc = true;
                    break;
                }
                await delay(500);
            }

            if (!foundChieuDoc) {
                alert(`⚠️ Lỗi: Không thể tìm thấy tab [959] Đánh giá chiều dọc. Hãy thử F5 lại trang!`);
                return false;
            }

            log("⏳ Đang chờ danh sách đầu điểm tải xong...");
            await delay(3000);
            return true;
        };

        const processSingleColumn = async (scoreDict, mode, colKey = '') => {
            const autoCreate = (mode === 'create');

            // HÀM NHẬP ĐIỂM CƠ BẢN
            const applyValue = async (targetInput, val) => {
                let formattedVal = val.toString().replace(',', '.');
                targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(50);
                targetInput.dispatchEvent(new Event('focus', { bubbles: true }));
                targetInput.dispatchEvent(new Event('click', { bubbles: true }));
                await delay(50); 
                targetInput.value = formattedVal;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                targetInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
                targetInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
                await delay(300);
                if (typeof checkAndCloseErrorGrading === "function") return await checkAndCloseErrorGrading();
            };

            const hasErrorBorder = (inputElement) => {
                const style = window.getComputedStyle(inputElement);
                const parentStyle = window.getComputedStyle(inputElement.parentElement);
                return style.borderColor.includes('255, 0, 0') || style.borderColor.includes('244, 67, 54') || parentStyle.borderColor.includes('255, 0, 0') || style.boxShadow.includes('255, 0, 0');
            };

            if (Object.keys(scoreDict).length === 0) return true;

            // =======================================
            // GIAI ĐOẠN 1: CHỈ TẠO BẢNG & LAZY LOAD NHANH
            // =======================================
            if (autoCreate) {
                window.scrollBy({ top: 400, behavior: 'smooth' });
                await delay(400);
                let taoBangBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('tạo bảng tiêu chí'));
                
                if (taoBangBtn) {
                    log(`🔨 Đang tạo bảng [${colKey}]...`);
                    forceClick(taoBangBtn); await delay(800);
                    let tiepTucBtn = document.querySelector('.ohke-popup .btn-continue, .w3-modal .btn-continue');
                    if (!tiepTucBtn) tiepTucBtn = Array.from(document.querySelectorAll('.ohke-popup a, .w3-modal a, button')).find(el => el.offsetWidth > 0 && el.textContent.trim() === 'Tiếp Tục');
                    
                    if (tiepTucBtn) {
                        forceClick(tiepTucBtn); await delay(1500); 
                        let dongBtn = Array.from(document.querySelectorAll('.w3-modal.w3-show a, .w3-modal.w3-show button')).find(el => el.offsetWidth > 0 && (el.textContent.includes('Đóng') || el.textContent.includes('Đồng ý') || el.textContent.includes('OK')));
                        if (dongBtn) { forceClick(dongBtn); await delay(800); } 
                    }

                    // TỐI ƯU GIAI ĐOẠN 1: Nháy qua Nhập Nhanh & cuộn siêu tốc (Outer Scroll) để DOM load hết danh sách
                    log(`⬇️ Nháy sang [Nhập Nhanh] để nạp trước danh sách học sinh...`);
                    let openedNhanh = await clickTabGrading('Nhập Nhanh');
                    if (openedNhanh) {
                        await delay(800);
                        // Cuộn siêu tốc bên ngoài (Giảm delay, tăng khoảng cách cuộn)
                        for (let k = 0; k < 8; k++) {
                            window.scrollBy({ top: 1200, behavior: 'auto' });
                            await delay(150); 
                        }
                    }
                } 
                return true; 
            }

            // =======================================
            // GIAI ĐOẠN 2: NHẬP ĐIỂM
            // =======================================
            let openedTabNhanh = await clickTabGrading('Nhập Nhanh');
            if (!openedTabNhanh) return false;
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await delay(400);

            // Lazy Load trước khi nhập (Kết hợp trong & ngoài)
            let tabContent = document.querySelector('.tab-content .active .dynamic-content, .tab-content .active .agent-list') || document.querySelector('.tab-content');
            let lastLen = 0;
            for (let k = 0; k < 12; k++) {
                let inputsToScroll = document.querySelectorAll('.tab-content input[type="text"][name="quantitative_result"]');
                if (inputsToScroll.length > 0) inputsToScroll[inputsToScroll.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (tabContent) tabContent.scrollBy({ top: 800, behavior: 'smooth' });
                window.scrollBy({ top: 400, behavior: 'smooth' }); 
                await delay(300);
                if (inputsToScroll.length === lastLen && inputsToScroll.length > 0) break;
                lastLen = inputsToScroll.length;
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await delay(500);

            let countFill = 0;
            let inputs = document.querySelectorAll('input[type="text"][name="quantitative_result"], input[type="text"][placeholder*="Định Lượng"]');

            for (let input of inputs) {
                let rowText = input.closest('tr, .list-item, .w3-row').innerText;
                for (let name of Object.keys(scoreDict)) {
                    if (rowText.includes(name)) {
                        let targetScore = scoreDict[name];
                        let currentValue = String(input.value).trim().replace(/,/g, '.');

                        const numCurrent = parseFloat(currentValue);
                        const numTarget = parseFloat(targetScore);
                        const isDifferent = isNaN(numCurrent) || isNaN(numTarget) ? currentValue !== targetScore : numCurrent !== numTarget;

                        if (isDifferent) {
                            await applyValue(input, targetScore);
                            await delay(200);

                            // BẮT BỆNH MẤT DẤU NGAY LÚC NHẬP
                            let checkVal = parseFloat(String(input.value).replace(/,/g, '.'));
                            if (!isNaN(checkVal) && checkVal > 10) {
                                log(`⚠️ Bị mất dấu (thành ${checkVal}). Ép sửa lại...`);
                                let fixedDot = (checkVal / 10).toFixed(2);
                                input.style.border = '2px solid orange';
                                await applyValue(input, fixedDot); 
                                input.style.border = '';
                                await delay(200);
                            }

                            countFill++;
                        }
                        break;
                    }
                }
            }

            if (countFill === 0) return true;

            log(`✔️ Đã nhập ${countFill} điểm. Đang chờ server lưu...`);
            const startTime = Date.now();
            let isSaved = false;
            while (Date.now() - startTime < 8000) { 
                const bars = document.querySelectorAll('.inno-percent-bar');
                let isAnyRunning = false;
                for (let bar of bars) {
                    const doneBar = bar.querySelector('.bar-done');
                    if (doneBar && parseFloat(doneBar.style.width || "0") > 0 && parseFloat(doneBar.style.width || "0") < 100) { isAnyRunning = true; break; }
                }
                if (!isAnyRunning && Date.now() - startTime > 1500) { isSaved = true; break; }
                await delay(400);
            }

            // =======================================
            // GIAI ĐOẠN 3: KIỂM TRA LỖI > 10 Ở SỔ ĐIỂM
            // =======================================
            let openedSoDiem = await clickTabGrading('Sổ Điểm');
            if (!openedSoDiem) return false;
            await delay(2000); 

            let studentsToFix = [];
            let scoreDivs = document.querySelectorAll('.control-number .content, .list-item [class*="evaluation_result"]'); 
            for (let div of scoreDivs) {
                let textContent = div.innerText.trim();
                if(textContent === '' || isNaN(parseFloat(textContent.replace(/,/g, '.')))) continue;
                
                let val = parseFloat(textContent.replace(/,/g, '.'));
                if (val > 10) {
                    let rowText = div.closest('tr, .list-item, .w3-row').innerText;
                    for (let name of Object.keys(scoreDict)) {
                        if (rowText.includes(name)) {
                            studentsToFix.push({ name, targetScore: scoreDict[name] });
                            log(`❌ Cảnh báo: ${name} có điểm bất thường (${val}).`);
                            break;
                        }
                    }
                }
            }

            // CHUYỂN VỀ NHẬP NHANH ĐỂ SỬA TRƯỚC KHI GỬI DUYỆT
            if (studentsToFix.length > 0) {
                log(`🛠️ Lùi về [Nhập Nhanh] để sửa lỗi > 10...`);
                let openedTabNhanhAgain = await clickTabGrading('Nhập Nhanh');
                if (openedTabNhanhAgain) {
                    await delay(1500); 
                    
                    let lastLenFix = 0;
                    for (let k = 0; k < 15; k++) {
                        let inputsToScroll = document.querySelectorAll('.tab-content input[type="text"][name="quantitative_result"]');
                        if (inputsToScroll.length > 0) inputsToScroll[inputsToScroll.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        window.scrollBy({ top: 500, behavior: 'smooth' });
                        await delay(300);
                        if (inputsToScroll.length === lastLenFix && inputsToScroll.length > 0) break;
                        lastLenFix = inputsToScroll.length;
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    await delay(500);
                    
                    for (let student of studentsToFix) {
                        let targetInputs = document.querySelectorAll('input[type="text"][name="quantitative_result"]');
                        for (let input of targetInputs) {
                            let rowText = input.closest('tr, .list-item, .w3-row').innerText;
                            if (rowText.includes(student.name)) {
                                log(`🔨 Sửa điểm cho ${student.name} -> ${student.targetScore}`);
                                let fixedTarget = parseFloat(student.targetScore).toFixed(2);
                                await applyValue(input, fixedTarget);
                                await delay(400);
                                break;
                            }
                        }
                    }
                    log("⏳ Đang chờ lưu các sửa đổi..."); 
                    await delay(2000);
                    
                    log("⏩ Trở lại [Sổ Điểm] để kiểm tra & chốt...");
                    await clickTabGrading('Sổ Điểm');
                    await delay(2000);
                }
            }

            // =======================================
            // GIAI ĐOẠN 4: AUTO PHÊ DUYỆT BỊ SÓT
            // =======================================
            // QUÉT TÌNH TRẠNG KẾT QUẢ ĐỂ XEM CÓ CẦN DUYỆT KHÔNG
            let needApproval = true;
            let listItems = document.querySelectorAll('.list-item, .w3-row, td, div');
            
            for (let item of listItems) {
                let text = item.innerText || "";
                // Tìm kiếm vùng chứa thông tin tình trạng
                if (text.includes('Tình Trạng Kết Quả')) {
                    if (text.includes('Đã Được Chấp Nhận')) {
                        needApproval = false; // Đã được chấp nhận thì không cần chạy lệnh phê duyệt nữa
                    }
                    break; 
                }
            }

            if (needApproval) {
                log("🚀 Phát hiện bảng chưa được duyệt. Tiến hành Gửi & Phê duyệt...");
                await handleBatchTransition('gửi người phê duyệt'); 
                await handleBatchTransition('chấp nhận');
            } else {
                log("✔️ Bảng này đã 'Đã Được Chấp Nhận'. Bỏ qua lệnh phê duyệt.");
            }

            return true;
        };

        // ==========================================
        // AUTO TOÀN TẬP (MASTER LOOP)
        // ==========================================
        document.getElementById('btn-auto-full').onclick = async () => {
            let fullData = await extractAllExcelData();
            if (!fullData) return;

            // 1. Mở Cánh Cửa [959]
            let isReady = await switchToVerticalAssessment();
            if (!isReady) return; 
            
            let evalRows = Array.from(document.querySelectorAll('.list-item[data-entity]')).filter(r => r.innerText.includes('Tiến Trình Đánh Giá'));
            if (evalRows.length === 0) { alert("⚠️ Lớp này chưa có đầu điểm nào."); return; }

            // =====================================
            // PHASE 1: CHỈ TẠO BẢNG
            // =====================================
            log("🚀 [GIAI ĐOẠN 1]: Khởi tạo các bảng điểm...");
            let firstValidRow = null;

            for (let row of evalRows) {
                let text = row.innerText.toLowerCase();
                let key = null;
                if (text.includes('hs1-1')) key = 'TX1'; else if (text.includes('hs1-2')) key = 'TX2'; else if (text.includes('hs1-3')) key = 'TX3';
                else if (text.includes('hs1-4')) key = 'TX4'; else if (text.includes('hs1-5')) key = 'TX5'; else if (text.includes('hs2')) key = 'GK'; else if (text.includes('hs3')) key = 'CK';

                if (key && fullData[key] && Object.keys(fullData[key]).length > 0) {
                    if (!firstValidRow) firstValidRow = row; 

                    let scrollContainer = row.closest('.dynamic-content, .agent-list, div[style*="overflow"]');
                    if (scrollContainer) scrollContainer.scrollTo({ top: row.offsetTop - 50, behavior: 'smooth' });
                    await delay(300);

                    let radioBtn = row.querySelector('.switch-check, .check, input[type="checkbox"], input[type="radio"]') || row;
                    forceClick(radioBtn);
                    await delay(2500); 
                    
                    await processSingleColumn(fullData[key], 'create', key); 
                }
            }

            if(firstValidRow) {
                let scrollContainer = firstValidRow.closest('.dynamic-content, .agent-list, div[style*="overflow"]');
                if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                let radioBtn = firstValidRow.querySelector('.switch-check, .check, input[type="checkbox"], input[type="radio"]') || firstValidRow;
                forceClick(radioBtn);
                await delay(2000);
            }

            // =====================================
            // PHASE 2: NHẬP LIỆU & PHÊ DUYỆT
            // =====================================
            log("\n🚀 [GIAI ĐOẠN 2]: Bắt đầu Nhập điểm & Phê duyệt...");
            for (let row of evalRows) {
                let text = row.innerText.toLowerCase();
                let key = null;
                if (text.includes('hs1-1')) key = 'TX1'; else if (text.includes('hs1-2')) key = 'TX2'; else if (text.includes('hs1-3')) key = 'TX3';
                else if (text.includes('hs1-4')) key = 'TX4'; else if (text.includes('hs1-5')) key = 'TX5'; else if (text.includes('hs2')) key = 'GK'; else if (text.includes('hs3')) key = 'CK';

                if (key && fullData[key] && Object.keys(fullData[key]).length > 0) {
                    log(`\n-------------------------------------------`);
                    log(`🎯 ĐANG XỬ LÝ CỘT: [${key}]`);

                    let isVertical = document.body.innerText.includes('Bộ Chọn Điểm Đánh Giá');
                    if (!isVertical) {
                        let tabVertical = Array.from(document.querySelectorAll('.ohke-tab-btn')).find(el => el.innerText.includes('[959]'));
                        if (tabVertical) { forceClick(tabVertical); await delay(2000); }
                    }

                    let scrollContainer = row.closest('.dynamic-content, .agent-list, div[style*="overflow"]');
                    if (scrollContainer) scrollContainer.scrollTo({ top: row.offsetTop - 50, behavior: 'smooth' });
                    await delay(300);
                    
                    let btn = row.querySelector('.switch-check, .check, input[type="checkbox"], input[type="radio"]') || row;
                    forceClick(btn);
                    await delay(2000); 

                    let success = await processSingleColumn(fullData[key], 'fill', key); 
                    if (!success) { log("🛑 Dừng AUTO do có lỗi."); return; }
                }
            }
            alert("🎉 ĐÃ HOÀN TẤT TOÀN BỘ!\nCác cột điểm đã được Khởi tạo, Nhập liệu, Sửa lỗi và Phê duyệt thành công.");
        };

        // ==========================================
        // CÁC NÚT TIỆN ÍCH BỔ SUNG
        // ==========================================
        document.getElementById('btn-auto-input').onclick = async () => {
            let fullData = await extractAllExcelData();
            if (!fullData) return;
            let key = document.getElementById('score-col').value;
            let colData = fullData[key];
            if (!colData || Object.keys(colData).length === 0) { alert("⚠️ Cột điểm này trong file Excel trống!"); return; }
            log(`⚡ CHỈ NHẬP ĐIỂM cho cột đã chọn...`);
            let success = await processSingleColumn(colData, 'fill', key);
            if (success) { alert(`🎉 Hoàn tất quá trình nhập cho cột này!`); }
        };

        document.getElementById('btn-reset').onclick = async () => {
            let openedSoDiem = await clickTabGrading('Sổ Điểm');
            if (!openedSoDiem) return;

            await handleBatchTransition('kéo về'); await delay(2000);
            await handleBatchTransition('kéo về'); await delay(2000);

            let openedTabNhanh = await clickTabGrading('Nhập Nhanh');
            if (openedTabNhanh) {
                let lastLen = 0;
                for (let k = 0; k < 15; k++) {
                    let items = document.querySelectorAll('tr, .list-item');
                    if (items.length > 0) items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
                    await delay(800);
                    if (items.length === lastLen && items.length > 0) break;
                    lastLen = items.length;
                }

                let inputs = document.querySelectorAll('input[type="text"][placeholder*="Định Lượng"], input[type="text"][placeholder*="gõ đủ 4 chữ số"], .w3-table-all input[type="text"], .list-item input[type="text"]');
                for (let input of inputs) {
                    if (input.value !== "") {
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await delay(50);
                        input.value = "";
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                        await delay(400); await checkAndCloseErrorGrading();
                    }
                }
            }
            alert("🔄 Đã Reset sạch sẽ trạng thái và điểm!");
        };

        // Mặc định khởi chạy thì kích hoạt Tab Điểm danh (Free)
        document.getElementById('tab-attendance').click();
    };

    // ==========================================
    // KHỞI ĐỘNG HỆ THỐNG
    // ==========================================
    renderMainApp();

})();