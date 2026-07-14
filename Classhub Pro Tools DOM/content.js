(async function () {
    const delay = ms => new Promise(res => setTimeout(res, ms));

    // ==========================================
    // MODULE: SMART WAIT (CHỜ THÔNG MINH BẰNG DOM)
    // ==========================================
    const waitForCondition = async (conditionFn, timeout = 10000, interval = 200) => {
        let elapsed = 0;
        while (elapsed < timeout) {
            if (conditionFn()) return true; // Nếu điều kiện thỏa mãn -> Trả về true luôn, không đợi thêm
            await delay(interval);
            elapsed += interval;
        }
        return false; // Quá thời gian mà chưa thấy -> Trả về false
    };

    const waitForElementToDisappear = async (selector, timeout = 5000) => {
        return await waitForCondition(() => {
            let els = document.querySelectorAll(selector);
            return els.length === 0 || Array.from(els).every(el => el.offsetWidth === 0);
        }, timeout);
    };

    const log = (msg) => {
        let logEl = document.getElementById('tool-log');
        if (logEl) {
            logEl.insertAdjacentHTML('beforeend', `<div>👉 ${msg}</div>`);
            logEl.scrollTop = logEl.scrollHeight;
        }
        console.log(msg); // In thêm ra F12 để dễ kiểm tra
    };

    // ==========================================
    // 0. CẤU HÌNH SERVER BẢO MẬT
    // ==========================================
    const API_URL = "https://script.google.com/macros/s/AKfycbxjz6kq9gkh6OuK3-2wxjhHEgJ3c_5BgoxATDQJP1kRov127nvJwRU2FcI1VhDh8sFN/exec";

    // ==========================================
    // 1. TẢI THƯ VIỆN & XÓA GIAO DIỆN CŨ
    // ==========================================
    // if (typeof XLSX === 'undefined') {
    //     let script = document.createElement('script');
    //     script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    //     document.head.appendChild(script);
    //     await new Promise(r => script.onload = r);
    // }

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
            display: flex; flex-direction: column; max-height: 85vh;
        `;

        let displayAuth = currentToken ? 'none' : 'block';
        let displayTools = currentToken ? 'block' : 'none';

        // Thêm biến để theo dõi trạng thái
        let isMinimized = false;

        panel.innerHTML = `
            <style>
                #ohke-hub-tools { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
                #ohke-hub-tools ::-webkit-scrollbar { width: 6px; }
                #ohke-hub-tools ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
                #ohke-hub-tools ::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }
                #ohke-hub-tools .control-btn:hover { background: rgba(255,255,255,0.2); border-radius: 4px; }
                #ohke-hub-tools button { font-size: 13px !important; } /* Ép font 13px cho mọi nút */
            </style>

            <div id="ohke-drag-handle" style="display: flex; justify-content: space-between; align-items: center; background: #002752; color: white; padding: 10px 12px; cursor: move; user-select: none; flex-shrink: 0;">
                <div style="font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">🛠️ ClassHub Pro Tools</div>
                <div style="display: flex; gap: 8px;">
                    <div id="btn-minimize-tool" class="control-btn" title="Thu nhỏ" style="padding: 0 6px; cursor: pointer; font-weight: bold; font-size: 18px; line-height: 1;">−</div>
                    <div id="btn-close-tool-top" class="control-btn" title="Đóng hẳn" style="padding: 0 6px; cursor: pointer; font-weight: bold; font-size: 18px; line-height: 1;">×</div>
                </div>
            </div>

            <div id="ohke-tabs-container" style="display: flex; flex-shrink: 0; border-bottom: 2px solid #002752;">
                <div id="tab-grader" style="flex: 1; text-align: center; padding: 10px; font-weight: bold; cursor: pointer; background: #004085; color: white; font-size: 13px; transition: 0.2s;">⚡ NHẬP ĐIỂM (PRO)</div>
                <div id="tab-attendance" style="flex: 1; text-align: center; padding: 10px; font-weight: bold; cursor: pointer; background: #0056b3; color: white; font-size: 13px; transition: 0.2s;">🙋 ĐIỂM DANH (FREE)</div>
            </div>

            <div id="ohke-panel-body" style="padding: 15px; overflow-y: auto; flex-grow: 1; transition: all 0.3s ease;">
                <div id="section-grader" style="display: none;">
                    <div id="grader-auth" style="display: ${displayAuth}; text-align: center; padding: 10px 0;">
                        <p style="font-size: 13px; margin-bottom: 10px; color: #dc3545; font-weight: bold;">Tính năng này yêu cầu mã Token bản quyền.</p>
                        <input type="text" id="input-token" placeholder="Nhập mã Token..." style="width: 100%; padding: 8px; text-align: center; font-weight: bold; font-size: 13px; border: 2px solid #ccc; border-radius: 4px; margin-bottom: 10px; outline: none;">
                        <button id="btn-verify" style="width: 100%; background: #28a745; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">KÍCH HOẠT PRO</button>
                        <div id="auth-log" style="margin-top: 10px; font-size: 13px; color: red; font-weight: bold;"></div>
                    </div>

                    <div id="grader-tools" style="display: ${displayTools};">
                        <div style="text-align: right; margin-bottom: 8px;">
                            <a href="#" id="btn-logout-token" style="font-size: 12px; color: #dc3545; text-decoration: underline;">Thoát Token</a>
                        </div>
                        <label style="font-size: 13px; font-weight: bold;">1. Chọn file Excel</label>
                        <input type="file" id="excel-file" accept=".xlsx, .xls" multiple style="width: 100%; margin: 8px 0 10px 0; font-size: 13px;">
                        
                        <label style="font-size: 13px; font-weight: bold;">2. Cột điểm hiện tại</label>
                        <select id="score-col" style="width: 100%; margin: 8px 0 5px 0; padding: 6px; border-radius: 4px; border: 1px solid #aaa; font-size: 13px;">
                            <option value="TX1" ${defaultKey === 'TX1' ? 'selected' : ''}>ĐĐG Thường xuyên 1 (HS1-1)</option>
                            <option value="TX2" ${defaultKey === 'TX2' ? 'selected' : ''}>ĐĐG Thường xuyên 2 (HS1-2)</option>
                            <option value="TX3" ${defaultKey === 'TX3' ? 'selected' : ''}>ĐĐG Thường xuyên 3 (HS1-3)</option>
                            <option value="TX4" ${defaultKey === 'TX4' ? 'selected' : ''}>ĐĐG Thường xuyên 4 (HS1-4)</option>
                            <option value="TX5" ${defaultKey === 'TX5' ? 'selected' : ''}>ĐĐG Thường xuyên 5 (HS1-5)</option>
                            <option value="GK"  ${defaultKey === 'GK' ? 'selected' : ''}>Điểm Giữa Kì (HS2)</option>
                            <option value="CK"  ${defaultKey === 'CK' ? 'selected' : ''}>Điểm Cuối Kì (HS3)</option>
                        </select>
                        
                        <div style="margin-top: 10px; border: 1px solid #ccc; border-radius: 4px; padding: 8px; background: #f9f9f9;">
                            <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color:#d81b60;">📔 TỪ ĐIỂN MÔN HỌC (Tự động lưu)</div>
                            <table style="width: 100%; font-size: 12px; text-align: left;">
                                <thead><tr style="border-bottom: 1px solid #ddd;"><th>Tên Excel</th><th>Từ khóa Web (Ngăn bởi dấu phẩy)</th><th style="width:20px;"></th></tr></thead>
                                <tbody id="dict-body"></tbody>
                            </table>
                            <button id="btn-add-dict" style="width: 100%; margin-top: 8px; padding: 6px; cursor:pointer; border: 1px dashed #aaa; border-radius: 4px;">+ Thêm từ khóa mới</button>
                        </div>

                        <div style="margin-top: 10px; border: 1px solid #007bff; border-radius: 4px; padding: 8px;">
                            <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color:#007bff;">📋 TIẾN ĐỘ CHẠY (QUEUE)</div>
                            <div id="queue-list" style="max-height: 120px; overflow-y: auto; font-size: 12px; background: #fff; border: 1px solid #eee; padding: 6px;">
                                <i style="color: #666;">Chưa có dữ liệu...</i>
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
                            <button id="btn-auto-batch" style="background: #e91e63; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🚀 AUTO CHẠY TẤT CẢ FILE ĐÃ CHỌN</button>
                            <button id="btn-auto-full" style="background: #28a745; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🚀 AUTO LỚP HIỆY TẠI</button>
                            <button id="btn-auto-input" style="background: #007bff; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">⚡ CHỈ NHẬP ĐIỂM CỘT ĐANG CHỌN</button>
                            
                            <div style="border-top: 1px dashed #ccc; margin: 5px 0;"></div> 
                            <button id="btn-reset" style="background: #ffc107; color: black; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🔄 RESET ĐIỂM (Cột Đang Chọn)</button>
                            <button id="btn-reset-all" style="background: #dc3545; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">💣 RESET TOÀN BỘ (Tất Cả Các Cột)</button>
                        </div>
                    </div>
                </div>

                <div id="section-attendance" style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="background: #e9ecef; padding: 10px; border-radius: 5px; font-size: 13px; margin-bottom: 5px; line-height: 1.4;">
                        <b>Miễn phí:</b> Mở cửa sổ điểm danh trên web, sau đó bấm nút tự động dưới đây.
                    </div>
                    <button id="btn-auto-attendance" style="background: #dc3545; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🚀 AUTO ĐIỂM DANH TẤT CẢ</button>
                    <button id="btn-att-students" style="background: #17a2b8; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">👨🎓 ĐIỂM DANH HỌC SINH (Như tiết trước)</button>
                    <button id="btn-att-teacher" style="background: #6f42c1; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">👨🏫 ĐIỂM DANH GIÁO VIÊN</button>
                    <button id="btn-att-complete" style="background: #28a745; color: white; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">✅ HOÀN THÀNH & TIẾP TỤC</button>
                </div>

                <div style="margin-top: 15px;">
                    <button id="btn-close-tool" style="width: 100%; background: #6c757d; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Đóng Cửa Sổ</button>
                </div>
                <div id="tool-log" style="margin-top: 12px; font-size: 12px; color: #444; max-height: 140px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 4px; border: 1px solid #ccc; line-height: 1.4;">Trạng thái: Sẵn sàng...</div>
            </div>
        `;
        document.documentElement.appendChild(panel);

        const panelBody = document.getElementById('ohke-panel-body');
        const tabsContainer = document.getElementById('ohke-tabs-container');
        const btnMinimize = document.getElementById('btn-minimize-tool');

        btnMinimize.onclick = (e) => {
            e.stopPropagation();
            isMinimized = !isMinimized;

            if (isMinimized) {
                panelBody.style.display = 'none';
                tabsContainer.style.display = 'none'; // Ẩn luôn tầng Tab
                panel.style.height = 'auto';
                panel.style.width = '240px';
                btnMinimize.innerText = '+';
                btnMinimize.title = "Mở rộng";
            } else {
                panelBody.style.display = 'block';
                tabsContainer.style.display = 'flex'; // Hiện lại tầng Tab
                panel.style.width = '360px';
                panel.style.maxHeight = '85vh';
                btnMinimize.innerText = '−';
                btnMinimize.title = "Thu nhỏ";
            }
        };

        document.getElementById('btn-close-tool-top').onclick = () => panel.remove();

        // ==========================================
        // MODULE: KÉO THẢ GIAO DIỆN (DRAG & DROP)
        // ==========================================
        const dragHandle = document.getElementById('ohke-drag-handle');
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        dragHandle.addEventListener('mousedown', (e) => {
            isDragging = true;

            // Tính toán khoảng cách từ chuột đến viền của Panel
            const rect = panel.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;

            // Chuyển đổi định vị từ right/bottom sang left/top để di chuyển mượt mà
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = rect.left + 'px';
            panel.style.top = rect.top + 'px';

            dragHandle.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Ngăn chặn bôi đen văn bản khi đang kéo

            // Tính toán tọa độ mới
            let newX = e.clientX - dragOffsetX;
            let newY = e.clientY - dragOffsetY;

            // Giới hạn không cho kéo văng ra khỏi màn hình
            let maxX = window.innerWidth - panel.offsetWidth;
            let maxY = window.innerHeight - panel.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                dragHandle.style.cursor = 'move';
            }
        });

        const clearLogUI = (className) => {
            const logEl = document.getElementById('tool-log');
            if (logEl) {
                logEl.innerHTML = `<div style="color: #666; font-style: italic; border-bottom: 1px dashed #ccc; margin-bottom: 5px;">
                    🧹 Đã dọn dẹp bộ nhớ đệm. Đang bắt đầu lớp: <b>${className}</b>...
                </div>`;
            }
        };

        // ==========================================
        // MODULE: TỪ ĐIỂN TỰ ĐỘNG LƯU (DICTIONARY)
        // ==========================================
        const renderDict = (dictObj) => {
            const tbody = document.getElementById('dict-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            for (let exName in dictObj) {
                let tr = document.createElement('tr');
                tr.className = 'dict-row';
                tr.innerHTML = `
                    <td><input type="text" class="ex-name" value="${exName}" style="width:95%; padding:4px; font-size:12px; border: 1px solid #ccc; border-radius: 3px;"></td>
                    <td><input type="text" class="web-names" value="${dictObj[exName]}" style="width:95%; padding:4px; font-size:12px; border: 1px solid #ccc; border-radius: 3px;"></td>
                    <td style="text-align: right;"><button class="del-row" style="color:red; background:none; border:none; cursor:pointer; font-weight: bold; font-size: 14px;">×</button></td>
                `;
                tbody.appendChild(tr);
            }
            bindDictEvents();
        };

        const saveDict = () => {
            let newDict = {};
            document.querySelectorAll('.dict-row').forEach(row => {
                let ex = row.querySelector('.ex-name').value.trim();
                let web = row.querySelector('.web-names').value.trim();
                if (ex) newDict[ex] = web;
            });
            chrome.storage.local.set({ 'ohke_subject_dict': newDict });
        };

        const bindDictEvents = () => {
            document.querySelectorAll('.dict-row input').forEach(inp => {
                inp.onchange = saveDict; inp.onkeyup = saveDict;
            });
            document.querySelectorAll('.del-row').forEach(btn => {
                btn.onclick = (e) => { e.target.closest('tr').remove(); saveDict(); };
            });
        };

        let btnAddDict = document.getElementById('btn-add-dict');
        if (btnAddDict) {
            btnAddDict.onclick = () => {
                let tr = document.createElement('tr');
                tr.className = 'dict-row';
                tr.innerHTML = `
                    <td><input type="text" class="ex-name" placeholder="Vd: Khoa học Tự nhiên" style="width:95%; padding:4px; font-size:12px; border: 1px solid #007bff; border-radius: 3px;"></td>
                    <td><input type="text" class="web-names" placeholder="KHTN, Lý 8..." style="width:95%; padding:4px; font-size:12px; border: 1px solid #007bff; border-radius: 3px;"></td>
                    <td style="text-align: right;"><button class="del-row" style="color:red; background:none; border:none; cursor:pointer; font-weight: bold; font-size: 14px;">×</button></td>
                `;
                document.getElementById('dict-body').appendChild(tr);
                bindDictEvents();
            };
        }

        // Tự động Load từ khóa đã lưu trên trình duyệt
        chrome.storage.local.get(['ohke_subject_dict'], (res) => {
            let dict = res.ohke_subject_dict || { "Khoa học Tự nhiên": "KHTN, KHTN Lý", "Công nghệ": "Công nghệ" };
            renderDict(dict);
        });

        // 💡 TÍNH NĂNG MỚI: TỰ ĐỘNG CẬP NHẬT TỪ ĐIỂN KHI CHỌN FILE EXCEL
        const fileInput = document.getElementById('excel-file');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                let files = e.target.files;
                if (!files || files.length === 0) return;

                log("🔍 Đang quét nhanh file để kiểm tra môn học...");
                let newSubjects = new Set();

                for (let i = 0; i < files.length; i++) {
                    let file = files[i];
                    let subject = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            try {
                                const data = new Uint8Array(e.target.result);
                                const workbook = XLSX.read(data, { type: 'array' });
                                let validSheets = workbook.SheetNames.filter(n => !n.toLowerCase().includes('hướng') && !n.toLowerCase().includes('bìa'));
                                if (validSheets.length === 0) validSheets = [workbook.SheetNames[0]];

                                for (let sheet of validSheets) {
                                    const jsonArray = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 });
                                    for (let r = 0; r < Math.min(20, jsonArray.length); r++) {
                                        let rowStr = (jsonArray[r] || []).map(c => String(c || '')).join(" ");
                                        const sMatch = rowStr.match(/(?:môn(?:\s*học)?|học\s*phần|subject)[:\s]*(.*?)(?=\s*học\s*kỳ|\s*lớp|\s*gv:|\s*giáo\s*viên|\s*-|$)/i);
                                        if (sMatch && sMatch[1]) {
                                            let val = sMatch[1].replace(/[,:]/g, "").trim();
                                            if (val.length > 1 && val.length < 50) return resolve(val);
                                        }
                                    }
                                }
                                resolve(null);
                            } catch (err) { resolve(null); }
                        };
                        reader.readAsArrayBuffer(file);
                    });

                    if (subject && subject.toUpperCase() !== "UNKNOWN") {
                        newSubjects.add(subject);
                    }
                }

                if (newSubjects.size > 0) {
                    // Lấy danh sách môn học đã có trong từ điển hiện tại
                    let existingDict = {};
                    document.querySelectorAll('.dict-row .ex-name').forEach(inp => {
                        if (inp.value.trim()) existingDict[inp.value.trim().toLowerCase()] = true;
                    });

                    let added = 0;
                    newSubjects.forEach(subj => {
                        if (!existingDict[subj.toLowerCase()]) {
                            // Thêm môn mới vào UI với viền Xanh lá cây để gây chú ý
                            let tr = document.createElement('tr');
                            tr.className = 'dict-row';
                            tr.innerHTML = `
                                <td><input type="text" class="ex-name" value="${subj}" style="width:95%; padding:4px; font-size:12px; border: 1.5px solid #28a745; border-radius: 3px;" title="Môn mới phát hiện"></td>
                                <td><input type="text" class="web-names" placeholder="Để trống hoặc điền từ khóa..." style="width:95%; padding:4px; font-size:12px; border: 1.5px solid #28a745; border-radius: 3px;" title="Điền tên môn trên web"></td>
                                <td style="text-align: right;"><button class="del-row" style="color:red; background:none; border:none; cursor:pointer; font-weight: bold; font-size: 14px;">×</button></td>
                            `;
                            document.getElementById('dict-body').appendChild(tr);
                            added++;
                        }
                    });

                    if (added > 0) {
                        bindDictEvents(); // Bật lại event lưu tự động
                        saveDict();
                        log(`✨ Đã tự động thêm ${added} môn mới vào Từ điển. (Các ô có viền xanh lá)`);
                    } else {
                        log(`✔️ Các môn học trong file đều đã có sẵn trong Từ điển.`);
                    }
                }
            });
        }


        // Hàm tra cứu từ khóa cho vòng lặp
        const getSubjectMapping = () => {
            let mapping = {};
            document.querySelectorAll('.dict-row').forEach(row => {
                let ex = row.querySelector('.ex-name').value.trim();
                let webs = row.querySelector('.web-names').value.split(',').map(s => s.trim().toLowerCase());
                if (ex) mapping[ex] = webs;
            });
            return mapping;
        };

        document.getElementById('btn-close-tool').onclick = () => panel.remove();

        // ==========================================
        // MODULE: TỰ ĐỘNG ĐIỀU HƯỚNG BẰNG DEEP LINK (V5)
        // ==========================================
        const getDeepLink = (type) => {
            // Tự động quét và lấy mã ID hệ thống (VD: 61892) từ URL hiện tại
            let match = window.location.href.match(/idcloud\.vn\/(\d+)/);
            let tenantId = match ? match[1] : '61892'; // Cập nhật ID mới của trường
            let baseUrl = `https://idcloud.vn/${tenantId}`;

            if (type === 'CLASSHUB') return `${baseUrl}/appstart/classhub/source=deeplink`;
            if (type === 'CLASSROOM') return `${baseUrl}/appstart/classroom/source=deeplink`;
            return window.location.href;
        };

        const forceNavigate = async (type) => {
            let targetUrl = getDeepLink(type);
            log(`🚀 Dùng Deep Link ép chuyển thẳng tới: ${type}...`);
            window.location.href = targetUrl; // Ép trình duyệt nhảy thẳng URL
            return 'HARD_RELOAD';
        };

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
                let text = el.textContent.trim();
                if (!text.includes(tuKhoa)) return false;
                if (loaiTru && text.includes(loaiTru)) return false;
                if (el.offsetWidth === 0) return false;
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
            if (nutDong && nutDong.textContent.trim() !== "" && nutDong.offsetWidth > 0) {
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

            // Check xem URL hiện tại có đang ở ClassHub chưa
            if (!window.location.href.includes('classhub')) {
                log("Đang lưu trạng thái và dùng Deep Link tới ClassHub...");
                await chrome.storage.local.set({ 'pending_action': 'AUTO_ATTENDANCE' });
                await forceNavigate('CLASSHUB');
                return; // Dừng code nhường cho trang load lại
            }

            chrome.storage.local.remove(['pending_action']);

            // --- GIỮ NGUYÊN CODE TÌM TÊN GIÁO VIÊN BÊN DƯỚI CỦA BẠN ---
            log("🔍 Đang trích xuất danh tính Giáo viên...");
            let giaoDienTiengAnh = Array.from(document.querySelectorAll('a, button, div, span')).find(el => el.offsetWidth > 0 && (el.textContent.trim().toLowerCase() === 'past' || el.textContent.trim().toLowerCase() === 'today'));

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

            let cacTab = Array.from(document.querySelectorAll('a, button, div, span')).filter(el => el.textContent.trim() !== "" && el.offsetWidth > 0);
            let tabQuaKhu = cacTab.find(el => el.textContent.trim().toLowerCase() === 'quá khứ');

            if (tabQuaKhu) {
                tabQuaKhu.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(300);
                tabQuaKhu.click();
                log("⏳ Đang tải danh sách lớp trong quá khứ (5s)...");
                await delay(5000); // Tăng lên 5s để đảm bảo load hết danh sách
            } else { alert("❌ LỖI: Không tìm thấy tab 'Quá Khứ'."); return; }

            const tabActive = document.querySelector('.tab-content > .tab-item:not(.w3-hide)');
            if (!tabActive) return;

            let tongSoLopDaXuLy = 0;
            while (true) {
                let cacLop = Array.from(tabActive.querySelectorAll('.list-item')).filter(el => {
                    let txt = el.textContent;
                    return (txt.includes('CHƯA NỘP BẢNG ĐIỂM DANH') || txt.includes('CHƯA ĐIỂM DANH GIÁO VIÊN')) && el.offsetWidth > 0 && !el.dataset.daDiemDanh;
                });

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
                                let checkLai = Array.from(getTopModal().querySelectorAll('a, button, .btn, .w3-button')).filter(el => {
                                    let txt = el.textContent.trim();
                                    return txt.includes('Đánh Dấu Hoàn Thành') && el.offsetWidth > 50 && !el.closest('td');
                                });
                                if (checkLai.length < danhSachHoanThanh.length) break;
                            }
                        }
                        await delay(800); await closeTopModal(); await delay(1200);
                        cacLop[i].dataset.daDiemDanh = "true"; cacLop[i].style.opacity = "0.3"; tongSoLopDaXuLy++;
                    }
                } else {
                    let dsPhanTu = Array.from(tabActive.querySelectorAll('a, button, div, span'));
                    let nutXemThem = dsPhanTu.find(el => el.textContent.trim() === 'Xem Thêm' && el.offsetWidth > 0);
                    if (nutXemThem) {
                        forceClick(nutXemThem); await delay(3500);
                        let kiemTraTheDoMoi = Array.from(tabActive.querySelectorAll('.list-item')).filter(el => {
                            let txt = el.textContent;
                            return (txt.includes('CHƯA NỘP BẢNG ĐIỂM DANH') || txt.includes('CHƯA ĐIỂM DANH GIÁO VIÊN')) && el.offsetWidth > 0 && !el.dataset.daDiemDanh;
                        });
                        if (kiemTraTheDoMoi.length === 0) break;
                    } else break;
                }
            }
            alert(`🎉 HOÀN TẤT ĐIỂM DANH! Tổng số lớp đã xử lý: ${tongSoLopDaXuLy} lớp.`);
        };

        const clickLoadMore = async () => {
            let loadMoreCount = 0; let xemThemBtn;
            do {
                xemThemBtn = Array.from(document.querySelectorAll('a, button, span, .ohke-btn')).find(el => el.textContent.toLowerCase().includes('xem thêm') && el.offsetWidth > 0);
                if (xemThemBtn) { forceClick(xemThemBtn); await delay(1000); loadMoreCount++; }
            } while (xemThemBtn && loadMoreCount < 10);
        };

        document.getElementById('btn-att-students').onclick = async () => {
            await clickLoadMore();
            let copyBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.textContent.toLowerCase().includes('đánh dấu như tiết trước') && el.offsetWidth > 0);
            if (copyBtn) { forceClick(copyBtn); await delay(1000); }
            else {
                let coMatBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.textContent.toLowerCase().includes('có mặt') && el.offsetWidth > 0);
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
            let doneBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.textContent.toLowerCase().includes('hoàn thành') && el.offsetWidth > 0);
            if (doneBtn) { forceClick(doneBtn); await delay(1500); }
            let nextBtn = Array.from(document.querySelectorAll('.w3-modal.w3-show a, .w3-modal.w3-show button, button')).find(el => el.textContent.toLowerCase().includes('tiếp tục') && el.offsetWidth > 0);
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
            for (let i = 0; i < 15; i++) { // Tăng số vòng lặp lên một chút để bù cho delay ngắn lại
                let els = Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, .select-holder div'))
                    .filter(el => el.textContent.toLowerCase().includes(text.toLowerCase()) && el.offsetWidth > 0);

                if (els.length > 0) {
                    let priorityEls = els.filter(el => /\[\d+\]/.test(el.textContent));
                    let target = priorityEls.length > 0 ? priorityEls[0] : els[0];

                    if (target) {
                        forceClick(target);
                        await delay(300); // GIẢM MẠNH: Từ 1000ms xuống chỉ còn 300ms
                        return true;
                    }
                }
                await delay(200); // GIẢM TỐC ĐỘ QUÉT: Từ 400ms xuống 200ms
            }
            log(`⚠️ Không tìm thấy tab [${text}]`);
            return false;
        };

        const handleBatchTransition = async (targetText) => {
            log(`⚡ Đang thực thi: [${targetText.toUpperCase()}]...`);

            let chuyenTiepBtn = null;
            await waitForCondition(() => {
                let els = Array.from(document.querySelectorAll('a, button, .ohke-btn')).filter(el => el.textContent.toLowerCase().includes('chuyển tiếp') && el.offsetWidth > 0);
                if (els.length > 0) { chuyenTiepBtn = els[0]; return true; }
                return false;
            }, 2000);

            if (!chuyenTiepBtn) return false;
            forceClick(chuyenTiepBtn);

            // SMART WAIT: Chờ Popup tuỳ chọn mở ra
            await waitForCondition(() => document.querySelectorAll('.w3-modal.w3-show').length > 0, 3000);

            let batchModal = document.querySelectorAll('.w3-modal.w3-show')[document.querySelectorAll('.w3-modal.w3-show').length - 1];
            if (!batchModal) return false;

            let options = Array.from(batchModal.querySelectorAll('a, button, label, .ohke-btn')).filter(el => el.textContent.toLowerCase().includes(targetText.toLowerCase()) && el.offsetWidth > 0);
            if (options.length > 0) {
                forceClick(options[0]);
            } else {
                let closeBtn = batchModal.querySelector('.close-btn, a[class*="close-btn"], i.fa-close');
                if (closeBtn) forceClick(closeBtn);
                return false;
            }

            // SMART WAIT: Xử lý Popup Mã Xác Nhận
            await waitForCondition(() => {
                let modals = document.querySelectorAll('.w3-modal.w3-show');
                if (modals.length === 0) return false;
                let current = modals[modals.length - 1];

                if (current.innerText.includes('mã sau:')) {
                    let match = current.innerText.match(/mã sau:\s*(\d+)/i);
                    if (match && match[1]) {
                        let inputField = current.querySelector('input[name="input"], input[type="text"]');
                        if (inputField) {
                            inputField.value = match[1];
                            inputField.dispatchEvent(new Event('input', { bubbles: true }));
                            inputField.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    let dongYBtn = Array.from(current.querySelectorAll('button, a, .ohke-btn')).find(el => (el.textContent.toLowerCase().includes('đồng ý') || el.textContent.toLowerCase().includes('tiếp tục')) && el.offsetWidth > 0);
                    if (dongYBtn) forceClick(dongYBtn);
                }
                return true;
            }, 3000);

            // Tự động bấm đồng ý bảng "Enqueued"
            await waitForCondition(() => {
                let modals = document.querySelectorAll('.w3-modal.w3-show');
                if (modals.length > 0 && (modals[modals.length - 1].innerText.toLowerCase().includes('successfully') || modals[modals.length - 1].innerText.toLowerCase().includes('hàng đợi'))) {
                    let btn = Array.from(modals[modals.length - 1].querySelectorAll('button, a, .ohke-btn')).find(el => el.textContent.toLowerCase().includes('đồng ý') && el.offsetWidth > 0);
                    if (btn) forceClick(btn);
                    return true;
                }
                return false;
            }, 2000);

            // SMART WAIT: Theo dõi thanh Loading đến khi Completed
            let isCompleted = await waitForCondition(() => {
                let modals = document.querySelectorAll('.w3-modal.w3-show');
                if (modals.length === 0) return false;
                let currentModal = modals[modals.length - 1];
                if (currentModal.innerText.toLowerCase().includes('trạng thái') && currentModal.innerText.toLowerCase().includes('completed')) {
                    let closeX = currentModal.querySelector('i.fa-close, .close-btn, .w3-button.w3-display-topright') || Array.from(currentModal.querySelectorAll('button, a, i')).find(el => el.className.includes('close') || (el.textContent && el.textContent.toLowerCase().trim() === 'x'));
                    if (closeX) forceClick(closeX);
                    return true;
                }
                return false;
            }, 30000, 500); // Đợi tối đa 30 giây cho máy chủ duyệt xong

            // Chờ các popup biến mất sạch sẽ
            await waitForElementToDisappear('.w3-modal.w3-show', 3000);
            return true;
        };

        // ==========================================
        // MODULE: ĐỌC EXCEL (AUTO 1 LỚP - BẢN GỐC ĐÃ CHẠY ỔN)
        // ==========================================
        // ==========================================
        // MODULE 2: RÚT DỮ LIỆU CẤP TỐC (DÙNG CHO BATCH HOẶC 1 LỚP)
        // ==========================================
        const extractAllExcelData = async () => {
            if (window.isBatchMode && window.currentBatchScores) {
                log(`✔️ Xác nhận: Rút từ thùng [${window.currentBatchClassName}] -> Chuẩn ${window.currentBatchCount} điểm.`);
                return window.currentBatchScores;
            }

            let fileInput = document.getElementById('excel-file');
            if (!fileInput.files.length) { alert("Vui lòng tải lên file Excel!"); return null; }
            let targetFile = fileInput.files[0];

            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const cleanStr = str => String(str || '').toLowerCase().replace(/[\n\r\s\-]/g, '');

                        let targetSheet = null;
                        for (let sheetName of workbook.SheetNames) {
                            let tempArr = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                            let hasName = false, hasScoreCol = false;
                            for (let r = 0; r < Math.min(tempArr.length, 20); r++) {
                                let rowStr = (tempArr[r] || []).map(cleanStr).join("");
                                if (rowStr.includes('họvàtên') || rowStr.includes('họtên')) hasName = true;
                                if (rowStr.includes('đđgtx') || rowStr.includes('đđggk') || rowStr.includes('giữak')) hasScoreCol = true;
                            }
                            if (hasName && hasScoreCol) { targetSheet = sheetName; break; }
                        }
                        if (!targetSheet) targetSheet = workbook.SheetNames[0];

                        const jsonArray = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1 });

                        let headerRowIdx = jsonArray.findIndex(r => r.some(c => cleanStr(c).includes('họvàtên') || cleanStr(c).includes('họtên')));
                        if (headerRowIdx === -1) { resolve(null); return; }

                        let nameCol = -1, gkCol = -1, ckCol = -1, sTx = -1;
                        for (let r = Math.max(0, headerRowIdx - 1); r <= Math.min(jsonArray.length - 1, headerRowIdx + 2); r++) {
                            let row = jsonArray[r] || [];
                            for (let c = 0; c < row.length; c++) {
                                let cell = cleanStr(row[c]);
                                if (nameCol === -1 && (cell.includes('họvàtên') || cell.includes('họtên'))) nameCol = c;
                                if (gkCol === -1 && (cell.includes('giữak') || cell.includes('đđggk'))) gkCol = c;
                                if (ckCol === -1 && (cell.includes('cuốik') || cell.includes('đđgck'))) ckCol = c;
                                if (sTx === -1 && (cell.includes('thườngxuyên') || cell.includes('đđgtx'))) sTx = c;
                            }
                        }

                        let txCols = {};
                        if (sTx !== -1 && gkCol !== -1 && gkCol > sTx) {
                            let count = 1;
                            for (let c = sTx; c < gkCol; c++) { if (c !== nameCol) { txCols['TX' + count] = c; count++; } }
                        } else if (sTx !== -1) {
                            let count = 1;
                            for (let c = sTx; c < sTx + 5; c++) { if (c !== nameCol) { txCols['TX' + count] = c; count++; } }
                        } else {
                            let count = 1;
                            for (let c = nameCol + 2; c <= nameCol + 6; c++) { txCols['TX' + count] = c; count++; }
                        }

                        let fullData = { 'GK': {}, 'CK': {} };
                        for (let i = 1; i <= 15; i++) fullData['TX' + i] = {};

                        let countDiem = 0;
                        for (let i = headerRowIdx + 1; i < jsonArray.length; i++) {
                            let rowD = jsonArray[i] || [];
                            let rawStt = String(rowD[0] || '').trim();
                            let stt = rawStt.replace(/[^\d]/g, '');
                            let name = String(rowD[nameCol] || '').trim();

                            if (stt === '' || !name) continue;
                            if (cleanStr(name).includes('họvàtên')) continue;

                            for (let key in txCols) {
                                let score = String(rowD[txCols[key]] || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
                                if (score !== '') { fullData[key][name] = score; countDiem++; }
                            }
                            if (gkCol !== -1) {
                                let sc = String(rowD[gkCol] || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
                                if (sc !== '') { fullData['GK'][name] = sc; countDiem++; }
                            }
                            if (ckCol !== -1) {
                                let sc = String(rowD[ckCol] || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
                                if (sc !== '') { fullData['CK'][name] = sc; countDiem++; }
                            }
                        }

                        log(`✔️ Rút tại chỗ [${targetFile.name}]: chuẩn ${countDiem} điểm.`);
                        resolve(fullData);

                    } catch (e) { resolve(null); }
                };
                reader.readAsArrayBuffer(targetFile);
            });
        };

        // ==========================================
        // MODULE 1: QUÉT NHÃN MÁC TẠO HÀNG ĐỢI (PRE-SCAN)
        // ==========================================
        // ==========================================
        // MODULE 1: ĐÓNG GÓI DỮ LIỆU TỪ ĐẦU (V5 - RADAR & DIỆT KÝ TỰ ẨN)
        // ==========================================
        // ==========================================
        // MODULE 1: ĐÓNG GÓI DỮ LIỆU TỪ ĐẦU (V6 - TÁCH BIỆT DOM)
        // ==========================================
        const parseAllFilesUpfront = async () => {
            const fileInput = document.getElementById('excel-file');
            if (!fileInput.files.length) { alert("Vui lòng tải lên file Excel!"); return null; }

            let queue = [];
            log(`📂 Đang quét và ĐÓNG GÓI dữ liệu từ ${fileInput.files.length} file...`);

            for (let f = 0; f < fileInput.files.length; f++) {
                const file = fileInput.files[f];
                let fileTasks = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        let extracted = [];
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });

                            let validSheets = workbook.SheetNames.filter(n => {
                                let txt = n.toLowerCase();
                                return !txt.includes('hướng') && !txt.includes('huong') && !txt.includes('bìa') && !txt.includes('bia');
                            });
                            if (validSheets.length === 0) validSheets = [workbook.SheetNames[0]];

                            const cleanStr = str => String(str || '').toLowerCase().replace(/[\n\r\s\-]/g, '');

                            for (let targetSheet of validSheets) {
                                const jsonArray = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1 });
                                let className = "UNKNOWN", subjectName = "UNKNOWN";

                                // QUÉT LỚP & MÔN
                                for (let i = 0; i < Math.min(20, jsonArray.length); i++) {
                                    let rowStr = (jsonArray[i] || []).map(c => String(c || '')).join(" ");
                                    if (className === "UNKNOWN") {
                                        let cMatch = rowStr.match(/(?:lớp(?:\s*học|\/\s*nhóm)?|class)[:\s]*([a-zA-Z0-9\-\/]+)(?=\s*môn|\s*học|\s*năm|$)/i);
                                        if (cMatch) className = cMatch[1].trim().toUpperCase();
                                    }
                                    if (subjectName === "UNKNOWN") {
                                        const sMatch = rowStr.match(/(?:môn(?:\s*học)?|học\s*phần|subject)[:\s]*(.*?)(?=\s*học\s*kỳ|\s*lớp|\s*gv:|\s*giáo\s*viên|\s*-|$)/i);
                                        if (sMatch && sMatch[1]) {
                                            let val = sMatch[1].replace(/[,:]/g, "").trim();
                                            if (val.length > 1 && val.length < 50) subjectName = val;
                                        }
                                    }
                                }

                                // 💡 TÍNH NĂNG MỚI: TÌM TÊN LỚP TRONG TÊN FILE (CỨU CÁNH)
                                if (className === "UNKNOWN") {
                                    // Nhận diện thông minh các cụm như: 9A5, 12A1, Lop 8C, Diem_6G.xlsx
                                    let fileClassMatch = file.name.match(/(?:l[ớo]p\s*|-|_|\b)([1-9][0-9]?[A-Za-z][A-Za-z0-9]*)\b/i);
                                    if (fileClassMatch) {
                                        className = fileClassMatch[1].trim().toUpperCase();
                                        log(`💡 Tự động nhận diện lớp [${className}] từ tên file: ${file.name}`);
                                    }
                                }


                                let headerRowIdx = jsonArray.findIndex(r => r.some(c => cleanStr(c).includes('họvàtên') || cleanStr(c).includes('họtên')));
                                if (headerRowIdx === -1) continue;

                                let sttCol = -1, nameCol = -1, gkCol = -1, ckCol = -1, sTx = -1;
                                let headers = jsonArray[headerRowIdx] || [];

                                for (let r = Math.max(0, headerRowIdx - 1); r <= Math.min(jsonArray.length - 1, headerRowIdx + 2); r++) {
                                    let row = jsonArray[r] || [];
                                    for (let c = 0; c < row.length; c++) {
                                        let cell = cleanStr(row[c]);
                                        if (sttCol === -1 && (cell === 'stt' || cell === 'sốtt')) sttCol = c;
                                        if (nameCol === -1 && (cell.includes('họvàtên') || cell.includes('họtên'))) nameCol = c;
                                        if (gkCol === -1 && (cell.includes('giữak') || cell.includes('đđggk'))) gkCol = c;
                                        if (ckCol === -1 && (cell.includes('cuốik') || cell.includes('đđgck'))) ckCol = c;
                                        if (sTx === -1 && (cell.includes('thườngxuyên') || cell.includes('đđgtx'))) sTx = c;
                                    }
                                }
                                if (sttCol === -1) sttCol = 0;

                                let txCols = {};
                                let txCount = 1;
                                let searchStart = sTx !== -1 ? sTx : (nameCol !== -1 ? nameCol + 1 : 0);
                                let searchEnd = gkCol !== -1 ? gkCol : searchStart + 12;

                                for (let c = searchStart; c < searchEnd; c++) {
                                    let cell = String(headers[c] || '').trim();
                                    if (/^[1-9]$/.test(cell)) { txCols['TX' + txCount] = c; txCount++; }
                                }

                                if (Object.keys(txCols).length === 0 && sTx !== -1 && gkCol !== -1) {
                                    for (let c = sTx; c < gkCol; c++) {
                                        if (c !== nameCol && c !== sttCol) { txCols['TX' + txCount] = c; txCount++; }
                                    }
                                }

                                if (Object.keys(txCols).length === 0) {
                                    let base = sTx !== -1 ? sTx : (nameCol !== -1 ? nameCol + 2 : 2);
                                    for (let i = 0; i < 5; i++) { txCols['TX' + (i + 1)] = base + i; }
                                }

                                let fullData = { 'GK': {}, 'CK': {} };
                                for (let i = 1; i <= 15; i++) fullData['TX' + i] = {};

                                let countDiem = 0, countStudents = 0;

                                for (let i = headerRowIdx + 1; i < jsonArray.length; i++) {
                                    let rowD = jsonArray[i] || [];
                                    let rawStt = String(rowD[sttCol] || '').trim();
                                    let stt = rawStt.replace(/[^\d]/g, '');
                                    let name = String(rowD[nameCol] || '').trim();

                                    if (stt === '' || !name) continue;
                                    if (cleanStr(name).includes('họvàtên') || cleanStr(name).includes('sốhọcsinh')) continue;

                                    countStudents++;

                                    for (let key in txCols) {
                                        let score = String(rowD[txCols[key]] || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
                                        if (score !== '') { fullData[key][name] = score; countDiem++; }
                                    }
                                    if (gkCol !== -1) {
                                        let sc = String(rowD[gkCol] || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
                                        if (sc !== '') { fullData['GK'][name] = sc; countDiem++; }
                                    }
                                    if (ckCol !== -1) {
                                        let sc = String(rowD[ckCol] || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
                                        if (sc !== '') { fullData['CK'][name] = sc; countDiem++; }
                                    }
                                }

                                if (countStudents > 0) {
                                    log(`📦 Đã nạp THÙNG [${className}]: ${countStudents} Học sinh | Chuẩn ${countDiem} điểm.`);

                                    // PUSH TRỰC TIẾP VÀO HÀNG ĐỢI (KHÔNG QUÉT DOM NỮA)
                                    extracted.push({
                                        className,
                                        subjectName,
                                        fileObj: file,
                                        scores: fullData,
                                        countDiem
                                    });
                                }
                            }
                            resolve(extracted);
                        } catch (e) { resolve([]); }
                    };
                    reader.readAsArrayBuffer(file);
                });
                queue = queue.concat(fileTasks);
            }
            return queue;
        };

        // ==========================================
        // MODULE: ĐIỀU HƯỚNG VÀO ĐÁNH GIÁ CHIỀU DỌC [959]
        // ==========================================
        const switchToVerticalAssessment = async () => {
            log("🎯 Đang mở tab [Đánh Giá]...");
            window.scrollTo({ top: 0, behavior: 'smooth' });

            let tabAssessment = document.querySelector('.ohke-tab-btn[data-item-class="sf-V2253-179197"]');
            if (!tabAssessment) tabAssessment = Array.from(document.querySelectorAll('.ohke-tab-btn')).find(el => el.innerText.includes('Đánh Giá') && el.offsetWidth > 0);

            if (tabAssessment) {
                forceClick(tabAssessment);
            } else {
                await clickTabGrading('Đánh Giá');
            }

            // SMART WAIT: Đợi các tab con bên trong Đánh Giá nạp xong
            await waitForCondition(() => document.querySelectorAll('.ohke-tab-btn').length > 5, 5000);

            log("⏳ Đang tìm và kích hoạt tab [959 - Chiều Dọc]...");
            let foundChieuDoc = await waitForCondition(() => {
                let btn959 = Array.from(document.querySelectorAll('.ohke-tab-btn')).find(el => el.innerText.includes('[959]') && el.offsetWidth > 0);
                if (btn959) {
                    btn959.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
                    events.forEach(evtType => btn959.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window })));
                    return true;
                }
                return false;
            }, 8000, 400);

            if (!foundChieuDoc) {
                alert(`⚠️ Lỗi: Không thể tìm thấy tab [959]. Hãy thử F5 lại trang!`);
                return false;
            }

            // ==========================================
            // FIX LỖI CHẠY QUÁ NHANH: CHỜ ĐÚNG MỤC TIÊU
            // ==========================================
            log("⏳ Đang chờ hệ thống nạp các cột điểm...");
            let listLoaded = await waitForCondition(() => {
                // Phải bắt buộc nhìn thấy chữ "Tiến Trình Đánh Giá" mới tính là tải xong
                let rows = Array.from(document.querySelectorAll('.list-item[data-entity]'));
                return rows.some(r => r.innerText.includes('Tiến Trình Đánh Giá'));
            }, 8000, 500); // Quét 0.5s/lần, đợi tối đa 8s

            if (!listLoaded) {
                // Nếu đợi 8s mà vẫn không có, chờ thêm 2s để chắc chắn mạng không bị đứt
                log("⚠️ Chưa thấy cột điểm nào. Đợi thêm 2 giây để xác nhận...");
                await delay(2000);
            } else {
                log("✅ Đã thấy các cột điểm xuất hiện!");
                await delay(500); // Nghỉ 1 nhịp siêu nhỏ để DOM thực sự hoàn thiện
            }

            return true;
        };

        const processSingleColumn = async (scoreDict, mode, colKey = '') => {
            const autoCreate = (mode === 'create');

            // HÀM NHẬP ĐIỂM CƠ BẢN (Đã thêm tham số skipEnter)
            // HÀM NHẬP ĐIỂM CƠ BẢN (Tối ưu tốc độ động)
            const applyValue = async (targetInput, val, skipEnter = false, postDelay = 200) => {
                let formattedVal = val.toString().replace(',', '.');
                targetInput.scrollIntoView({ behavior: 'auto', block: 'center' });

                // Nghỉ 1 nhịp siêu ngắn để DOM kịp cuộn
                await delay(20);

                targetInput.dispatchEvent(new Event('focus', { bubbles: true }));
                targetInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                targetInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));

                targetInput.value = formattedVal;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

                if (!skipEnter) {
                    targetInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
                    targetInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
                }

                targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                targetInput.dispatchEvent(new Event('blur', { bubbles: true }));

                // THỜI GIAN CHỜ LINH HOẠT THEO CHỈ ĐỊNH
                await delay(postDelay);

                if (typeof checkAndCloseErrorGrading === "function") return await checkAndCloseErrorGrading();
            };

            const hasErrorBorder = (inputElement) => {
                const style = window.getComputedStyle(inputElement);
                const parentStyle = window.getComputedStyle(inputElement.parentElement);
                return style.borderColor.includes('255, 0, 0') || style.borderColor.includes('244, 67, 54') || parentStyle.borderColor.includes('255, 0, 0') || style.boxShadow.includes('255, 0, 0');
            };

            if (Object.keys(scoreDict).length === 0) return true;



            // =======================================
            // GIAI ĐOẠN 2: NHẬP ĐIỂM
            // =======================================
            let openedTabNhanh = await clickTabGrading('Nhập Nhanh');
            if (!openedTabNhanh) return false;

            window.scrollTo({ top: 0, behavior: 'smooth' });

            log("⏳ Mắt thần đang kiểm tra cấu trúc bảng và dữ liệu...");

            const LOADING_SELECTOR = '.fa-spinner, .fa-refresh.fa-spin, .loading, .w3-display-middle i.fa-spin';
            const HEADER_SELECTOR = '.tab-content .active th, .w3-table-all th, .ohke-table th';
            const SCORE_INPUT_SELECTOR = 'input[type="text"][name="quantitative_result"], .tab-content .active input[type="text"]';

            let isDataReady = await waitForCondition(() => {
                // 1. Kiểm tra Spinner (phải mất ĐI)
                let loaders = Array.from(document.querySelectorAll(LOADING_SELECTOR)).filter(el => el.offsetWidth > 0);

                // 2. Kiểm tra Header (phải hiện LÊN)
                let headers = Array.from(document.querySelectorAll(HEADER_SELECTOR));
                let hasStandardHeader = headers.some(th => {
                    let txt = th.textContent.trim().toLowerCase();
                    return txt.includes('họ và tên') || txt.includes('định lượng') || txt.includes('stt');
                });

                return loaders.length === 0 && hasStandardHeader;
            }, 10000, 200);

            if (!isDataReady) {
                log("⚠️ Hệ thống chưa sẵn sàng. Đang thử quét lại lần cuối...");
                await delay(1000);
            } else {
                log("✅ XÁC NHẬN: Bảng và dữ liệu đã nạp xong!");
                await delay(200); // Bước đệm ổn định UI
            }

            log("⚡ Bắt đầu gõ điểm...");

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

            // =======================================
            // GIAI ĐOẠN 2: NHẬP ĐIỂM
            // =======================================
            log("⬆️ Đang ép trình duyệt nhảy lên đầu bảng điểm...");

            // 1. Ép cuộn cứng mọi thẻ chứa nội dung bằng scrollTop
            window.scrollTo({ top: 0, behavior: 'auto' });
            let containers = document.querySelectorAll('.dynamic-content, .agent-list, .tab-content, .tab-content .active, div[style*="overflow"]');
            containers.forEach(c => {
                try { c.scrollTop = 0; } catch (e) { }
            });
            await delay(300);

            // 2. TUYỆT CHIÊU: Ép focus và click vào ô nhập liệu đầu tiên (Theo đúng ý tưởng của bạn)
            let tempInputs = document.querySelectorAll('input[type="text"][name="quantitative_result"], input[type="text"][placeholder*="Định Lượng"]');
            if (tempInputs.length > 0) {
                let firstInp = tempInputs[0];
                firstInp.scrollIntoView({ behavior: 'auto', block: 'center' });
                await delay(100);

                // Giả lập click chuột thật mạnh để đánh thức framework
                firstInp.dispatchEvent(new Event('focus', { bubbles: true }));
                firstInp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                firstInp.dispatchEvent(new MouseEvent('click', { bubbles: true }));

                await delay(400); // Chờ UI thực sự load xong và nhả khung hình
            } else {
                // Nếu chưa thấy ô điểm nào, thử click vào hàng đầu tiên
                let topItem = document.querySelector('.list-item, .w3-table-all tr');
                if (topItem) {
                    topItem.scrollIntoView({ behavior: 'auto', block: 'center' });
                    topItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await delay(400);
                }
            }

            let countFill = 0;
            // BẮT BUỘC phải lấy lại danh sách inputs sau cú click đánh thức
            let inputs = document.querySelectorAll('input[type="text"][name="quantitative_result"], input[type="text"][placeholder*="Định Lượng"]');

            for (let input of inputs) {
                if (input.disabled || input.readOnly || input.className.includes('disabled')) {
                    continue;
                }

                let rowText = input.closest('tr, .list-item, .w3-row').innerText;
                for (let name of Object.keys(scoreDict)) {
                    if (rowText.includes(name)) {
                        let targetScore = scoreDict[name].toString().replace(/,/g, '.');

                        let successInput = false;
                        for (let attempt = 1; attempt <= 3; attempt++) {

                            // CÔNG THỨC TỐC ĐỘ (Cập nhật an toàn): 
                            // - 3 bạn đầu tiên hoặc đang phải thử lại do lỗi: Chờ 400ms để ổn định.
                            // - Từ bạn thứ 4 trở đi: Chạy đều ở tốc độ 200ms.
                            let speedDelay = (countFill < 3 || attempt > 1) ? 400 : 200;

                            await applyValue(input, targetScore, false, speedDelay);

                            let hasErrorPopup = typeof checkAndCloseErrorGrading === "function" ? await checkAndCloseErrorGrading() : false;
                            let checkVal = parseFloat(String(input.value).replace(/,/g, '.'));

                            if (!hasErrorPopup && !isNaN(checkVal) && checkVal <= 10) {
                                successInput = true;
                                countFill++;
                                break;
                            } else {
                                log(`⚠️ Lỗi nhập liệu cho [${name}] (Thử lại lần ${attempt}/3)...`);
                                input.style.border = '2px solid red';
                                await delay(400); // Lỗi thì dừng lại 1 chút để DOM thở
                                input.value = "";
                            }
                        }

                        if (!successInput) {
                            input.style.border = '2px solid orange';
                        }

                        break;
                    }
                }
            }

            if (countFill > 0) {
                log(`✔️ Đã xử lý xong ${countFill} điểm.`);
                await delay(300);
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
                if (textContent === '' || isNaN(parseFloat(textContent.replace(/,/g, '.')))) continue;

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

                                // GỌI HÀM VỚI THAM SỐ skipEnter = true ĐỂ KHÔNG BẤM ENTER
                                await applyValue(input, fixedTarget, true);

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

                    // --- BỔ SUNG: ÉP TẢI LẠI ĐIỂM ---
                    log("🔄 Mở hộp thoại Chuyển tiếp để ép hệ thống tải lại điểm mới...");
                    let chuyenTiepBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn')).find(el => el.offsetWidth > 0 && el.textContent.toLowerCase().includes('chuyển tiếp'));
                    if (chuyenTiepBtn) {
                        forceClick(chuyenTiepBtn);
                        await delay(1500); // Chờ popup mở
                        let activeModals = document.querySelectorAll('.w3-modal.w3-show');
                        if (activeModals.length > 0) {
                            let batchModal = activeModals[activeModals.length - 1];
                            let closeBtn = batchModal.querySelector('.close-btn, a[class*="close-btn"], i.fa-close');
                            if (closeBtn) {
                                forceClick(closeBtn);
                                await delay(1500); // Chờ load lại bảng điểm
                            }
                        }
                    }
                }
            }

            // =======================================
            // GIAI ĐOẠN 4: AUTO PHÊ DUYỆT (TỐI ƯU MỚI)
            // =======================================
            log("🚀 Tiến hành quá trình Gửi & Phê duyệt (Sẽ tự động bỏ qua nếu đã duyệt)...");

            // Cứ bấm chuyển tiếp, nếu có nút Gửi thì chạy, không có thì tự tắt
            await handleBatchTransition('gửi người phê duyệt');
            await delay(1000);

            // Cứ bấm chuyển tiếp, nếu có nút Chấp nhận thì chạy, không có thì tự tắt
            await handleBatchTransition('chấp nhận');

            return true;
        };

        const runAutoGradingForCurrentClass = async (fullData) => {
            if (!fullData) return false;

            // 1. Mở Cánh Cửa [959]
            let isReady = await switchToVerticalAssessment();
            if (!isReady) return false;

            let evalRows = Array.from(document.querySelectorAll('.list-item[data-entity]')).filter(r => r.innerText.includes('Tiến Trình Đánh Giá'));
            if (evalRows.length === 0) { log("⚠️ Lớp này chưa có đầu điểm nào."); return false; }

            // =====================================
            // PHASE 1: CHỈ TẠO BẢNG (TỐI ƯU SMART SKIP)
            // =====================================
            log("🚀 [GIAI ĐOẠN 1]: Quét & Khởi tạo các bảng điểm...");
            let firstValidRow = null;

            for (let row of evalRows) {
                let text = row.innerText.toLowerCase();
                let key = null;
                if (text.includes('hs1-1')) key = 'TX1'; else if (text.includes('hs1-2')) key = 'TX2'; else if (text.includes('hs1-3')) key = 'TX3';
                else if (text.includes('hs1-4')) key = 'TX4'; else if (text.includes('hs1-5')) key = 'TX5'; else if (text.includes('hs2')) key = 'GK'; else if (text.includes('hs3')) key = 'CK';

                if (key && fullData[key] && Object.keys(fullData[key]).length > 0) {
                    if (!firstValidRow) firstValidRow = row;

                    let scrollContainer = row.closest('.dynamic-content, .agent-list, div[style*="overflow"]');
                    if (scrollContainer) scrollContainer.scrollTo({ top: row.offsetTop - 50, behavior: 'auto' });
                    await delay(100);

                    let radioBtn = row.querySelector('.switch-check, .check, input[type="checkbox"], input[type="radio"]') || row;
                    forceClick(radioBtn);

                    // Nghỉ 1 chút để UI xóa dữ liệu của cột cũ và gọi API load cột mới
                    await delay(800);

                    log(`🔍 Đang kiểm tra trạng thái bảng [${key}]...`);

                    // SMART POLLING: Bộ nhận diện trạng thái bảng
                    let taoBangBtn = null;
                    let isAlreadyCreated = false;

                    for (let w = 0; w < 8; w++) { // Chờ tối đa 1.6 giây
                        await delay(200);

                        taoBangBtn = Array.from(document.querySelectorAll('a, button, .ohke-btn'))
                            .find(el => el.textContent.toLowerCase().includes('tạo bảng tiêu chí') && el.offsetWidth > 0);

                        // Nếu thấy các tab con xuất hiện => Bảng đã được tạo từ trước
                        let existTabs = Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-'))
                            .find(el => /\[\d+\]/.test(el.textContent) && (el.textContent.toLowerCase().includes('nhập nhanh') || el.textContent.toLowerCase().includes('sổ điểm')) && el.offsetWidth > 0);

                        if (taoBangBtn) break; // Chưa tạo -> Thoát vòng lặp chờ để tạo
                        if (existTabs) {
                            isAlreadyCreated = true;
                            break; // Đã tạo -> Ghi nhận và thoát
                        }
                    }

                    if (isAlreadyCreated) {
                        log(`⏭️ Bảng [${key}] ĐÃ TỒN TẠI. Bỏ qua bước tạo!`);
                        continue; // Bỏ qua luôn, sang cột tiếp theo ngay lập tức
                    }

                    if (taoBangBtn) {
                        log(`🔨 Bảng [${key}] chưa có. Tiến hành Tạo mới...`);
                        forceClick(taoBangBtn);
                        await delay(500);

                        let tiepTucBtn = document.querySelector('.ohke-popup .btn-continue, .w3-modal .btn-continue');
                        if (!tiepTucBtn) tiepTucBtn = Array.from(document.querySelectorAll('.ohke-popup a, .w3-modal a, button')).find(el => el.textContent.trim() === 'Tiếp Tục' && el.offsetWidth > 0);

                        if (tiepTucBtn) {
                            forceClick(tiepTucBtn);
                            await delay(1000);
                            let dongBtn = Array.from(document.querySelectorAll('.w3-modal.w3-show a, .w3-modal.w3-show button')).find(el => (el.textContent.includes('Đóng') || el.textContent.includes('Đồng ý') || el.textContent.includes('OK')) && el.offsetWidth > 0);
                            if (dongBtn) { forceClick(dongBtn); await delay(400); }
                        }

                        // Nháy qua Nhập Nhanh & cuộn mồi để DOM load trước danh sách
                        log(`⬇️ Load trước danh sách cho [${key}]...`);
                        let openedNhanh = await clickTabGrading('Nhập Nhanh');
                        if (openedNhanh) {
                            await delay(300);
                            for (let k = 0; k < 6; k++) {
                                window.scrollBy({ top: 1200, behavior: 'auto' });
                                await delay(100);
                            }
                        }
                    }
                }
            }

            if (firstValidRow) {
                let scrollContainer = firstValidRow.closest('.dynamic-content, .agent-list, div[style*="overflow"]');
                if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
                let radioBtn = firstValidRow.querySelector('.switch-check, .check, input[type="checkbox"], input[type="radio"]') || firstValidRow;
                forceClick(radioBtn);
                await delay(1500);
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
                    if (!success) { log("🛑 Dừng AUTO do có lỗi."); return false; }
                }
            }
            return true;
        };

        // ==========================================
        // AUTO TOÀN TẬP (MASTER LOOP)
        // ==========================================
        // ==========================================
        // NÚT AUTO NHẬP ĐIỂM 1 LỚP (V8 - ÉP VÀO TRONG LỚP)
        // ==========================================
        document.getElementById('btn-auto-full').onclick = async () => {
            let fullData = window.restoredFullData || await extractAllExcelData();
            if (!fullData) return;

            // KIỂM TRA NGỮ CẢNH: Đã vào trong giao diện có Sổ Điểm/Sidebar chưa?
            let isInsideClass = Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, a, button')).some(el =>
                el.offsetWidth > 0 && (el.textContent.includes('Đánh Giá') || el.textContent.includes('Sổ Điểm') || el.textContent.includes('Nhập điểm'))
            );

            if (!isInsideClass) {
                // CHƯA VÀO LỚP: Đang ở trang chủ -> Nhảy Deep Link
                if (!window.location.href.includes('classroom')) {
                    log("🚀 Chưa ở Phòng học. Đang lưu dữ liệu và nhảy Deep Link...");
                    await chrome.storage.local.set({ 'pending_action': 'AUTO_GRADING_FULL', 'pending_data': fullData });
                    await forceNavigate('CLASSROOM');
                    return;
                }

                // CHƯA VÀO LỚP: Đang ở cửa Phòng Học (dạng thẻ) -> Phải click vào lớp đầu tiên
                log("🖱️ Đang ở cửa Phòng Học. Tự động click vào lớp đầu tiên để lấy giao diện...");
                await delay(1500);
                let classCards = Array.from(document.querySelectorAll('.w3-col .w3-card')).filter(card => card.offsetWidth > 0);

                if (classCards.length > 0) {
                    let targetCard = classCards[0];
                    try { targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }

                    let titleH5 = targetCard.querySelector('h5');
                    let clickTarget = titleH5 ? titleH5 : targetCard;

                    // Backup dữ liệu vào RAM phòng trường hợp click thẻ làm web load lại
                    await chrome.storage.local.set({ 'pending_action': 'AUTO_GRADING_FULL', 'pending_data': fullData });

                    if (typeof window.$ !== 'undefined') try { window.$(clickTarget).trigger('click'); } catch (e) { }
                    clickTarget.click();

                    log(`⏳ Đã click mở lớp. Đang theo dõi tiến trình nạp Sidebar và Sổ Điểm...`);

                    // RADAR: Bám đuổi cho đến khi thấy Sổ Điểm xuất hiện mới chạy tiếp
                    let isLoaded = await waitForCondition(() => {
                        return Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, a, button')).some(el =>
                            el.offsetWidth > 0 && (el.textContent.includes('Đánh Giá') || el.textContent.includes('Sổ Điểm') || el.textContent.includes('Nhập điểm'))
                        );
                    }, 15000, 500); // Quét mỗi 500ms, đợi tối đa 15s

                    if (isLoaded) {
                        log("🔄 ĐÃ VÀO GIAO DIỆN CHUẨN! Tiếp tục tiến trình...");
                        await delay(1000); // Chờ UI Render lần cuối
                        window.restoredFullData = fullData;
                        document.getElementById('btn-auto-full').click();
                    } else {
                        log("⚠️ Quá thời gian tải lớp. Vui lòng thử lại.");
                    }
                    return;
                } else {
                    log("⚠️ Không thấy thẻ lớp nào. Bạn hãy tự click vào 1 lớp nhé!");
                    return;
                }
            }

            // GIAI ĐOẠN CUỐI: ĐÃ Ở BÊN TRONG LỚP (CÓ SIDEBAR & SỔ ĐIỂM)
            chrome.storage.local.remove(['pending_action', 'pending_data', 'pending_queue']);
            window.restoredFullData = null;

            log("🚀 Ngữ cảnh đã chuẩn 100%. Bắt đầu đẩy điểm...");
            let success = await runAutoGradingForCurrentClass(fullData);
            if (success && !window.isBatchMode) {
                alert("🎉 HOÀN TẤT: Đã xử lý xong toàn bộ các cột điểm của lớp này!");
            }
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

        // ==========================================
        // MODULE: LOGIC RESET ĐIỂM (TURBO SPEED)
        // ==========================================
        // Hàm dùng chung: Thực hiện Reset 1 bảng đang được chọn với tốc độ cao
        const resetCurrentTable = async () => {
            let openedSoDiem = await clickTabGrading('Sổ Điểm');
            if (!openedSoDiem) return false;

            log("🔄 Đang kéo trạng thái điểm về Đang Soạn...");
            await handleBatchTransition('kéo về'); await delay(2000);
            await handleBatchTransition('kéo về'); await delay(2000);

            let openedTabNhanh = await clickTabGrading('Nhập Nhanh');
            if (openedTabNhanh) {
                log("🧹 Đang xoá trắng điểm số (Chế độ Turbo Max Speed)...");

                // Kéo xuống cuối siêu tốc để DOM load toàn bộ học sinh
                let lastLen = 0;
                let tabContent = document.querySelector('.tab-content .active .dynamic-content, .tab-content .active .agent-list') || document.querySelector('.tab-content');
                for (let k = 0; k < 10; k++) {
                    let items = document.querySelectorAll('tr, .list-item');
                    if (items.length > 0) items[items.length - 1].scrollIntoView({ behavior: 'auto', block: 'end' });
                    if (tabContent) tabContent.scrollBy({ top: 1200, behavior: 'auto' });
                    window.scrollBy({ top: 1000, behavior: 'auto' });
                    await delay(300);
                    if (items.length === lastLen && items.length > 0) break;
                    lastLen = items.length;
                }

                let inputs = document.querySelectorAll('input[type="text"][placeholder*="Định Lượng"], input[type="text"][placeholder*="gõ đủ 4 chữ số"], .w3-table-all input[type="text"], .list-item input[type="text"]');
                let countDeleted = 0;

                for (let input of inputs) {
                    if (input.value !== "") {
                        // Không dùng cuộn smooth nữa để tăng tốc tối đa
                        input.value = "";

                        // Bắn sự kiện thay đổi dữ liệu
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));

                        // Mô phỏng ấn phím Enter và Delete siêu tốc
                        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete', code: 'Delete', keyCode: 46 }));
                        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Delete', code: 'Delete', keyCode: 46 }));
                        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
                        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));

                        input.dispatchEvent(new Event('blur', { bubbles: true }));

                        countDeleted++;

                        // Đã tăng delay lên 150ms để server kịp phản hồi các gói JSON
                        await delay(150);
                    }
                }

                if (countDeleted > 0) {
                    log(`✔️ Đã xoá siêu tốc ${countDeleted} ô điểm. Chuyển sang bước tiếp theo...`);
                    // Đã bỏ delay(3000) ở đây để tool chạy lướt qua các bảng liên tục
                    if (typeof checkAndCloseErrorGrading === 'function') await checkAndCloseErrorGrading();
                } else {
                    log(`✔️ Bảng này đã trống sẵn.`);
                }

                return true;
            }
            return false;
        };

        // Nút 1: RESET Cột Hiện Tại (Giữ nguyên logic cũ)
        document.getElementById('btn-reset').onclick = async () => {
            log("🔄 Bắt đầu Reset cột điểm hiện tại...");
            await resetCurrentTable();
            alert("🔄 Đã Reset sạch sẽ trạng thái và điểm của cột này!");
        };

        // Nút 2: RESET TOÀN BỘ CÁC CỘT TRONG LỚP
        document.getElementById('btn-reset-all').onclick = async () => {
            let confirmAction = confirm("⚠️ CẢNH BÁO: Hành động này sẽ xoá SẠCH SẼ toàn bộ điểm của TẤT CẢ các cột trong lớp hiện tại (Kéo về Draft -> Xoá sạch). \n\nBạn có chắc chắn muốn thực hiện?");
            if (!confirmAction) return;

            log("💣 Kích hoạt quy trình XÓA SẠCH TOÀN BỘ BẢNG ĐIỂM...");

            // 1. Chuyển vào view Đánh giá Chiều dọc [959] để thấy tất cả các cột
            let isReady = await switchToVerticalAssessment();
            if (!isReady) return;

            // 2. Tìm tất cả các hàng đầu điểm
            let evalRows = Array.from(document.querySelectorAll('.list-item[data-entity]')).filter(r => r.innerText.includes('Tiến Trình Đánh Giá'));
            if (evalRows.length === 0) { alert("⚠️ Lớp này chưa có đầu điểm nào."); return; }

            // 3. Vòng lặp duyệt qua từng đầu điểm để xoá
            for (let i = 0; i < evalRows.length; i++) {
                let row = evalRows[i];
                let nameCol = row.innerText.split('\n')[0].trim() || `Cột số ${i + 1}`;

                log(`\n-------------------------------------------`);
                log(`🗑️ ĐANG XÓA CỘT: [${nameCol}] (${i + 1}/${evalRows.length})`);

                // Kiểm tra lại xem có đang ở view 959 không (tránh bị nhảy tab)
                let isVertical = document.body.innerText.includes('Bộ Chọn Điểm Đánh Giá');
                if (!isVertical) {
                    let tabVertical = Array.from(document.querySelectorAll('.ohke-tab-btn')).find(el => el.innerText.includes('[959]'));
                    if (tabVertical) { forceClick(tabVertical); await delay(2000); }
                }

                // Cuộn đến bảng điểm và click để mở nó ra
                let scrollContainer = row.closest('.dynamic-content, .agent-list, div[style*="overflow"]');
                if (scrollContainer) scrollContainer.scrollTo({ top: row.offsetTop - 50, behavior: 'smooth' });
                await delay(300);

                let radioBtn = row.querySelector('.switch-check, .check, input[type="checkbox"], input[type="radio"]') || row;
                forceClick(radioBtn);
                await delay(2000);

                // 4. Gọi hàm Xoá (Dùng chung)
                await resetCurrentTable();
            }

            alert("🎉 HOÀN TẤT: Đã xóa sạch sẽ toàn bộ các cột điểm của lớp này!");
        };

        // ==========================================
        // THE ULTIMATE MASTER LOOP (DELEGATION MODE V2)
        // ==========================================
        const updateQueueUI = (id, statusHtml) => {
            let row = document.getElementById(id);
            if (row) row.querySelector('.q-status').innerHTML = statusHtml;
        };

        // ==========================================
        // NÚT AUTO CHẠY TẤT CẢ (V8 - ÉP VÀO LỚP RỒI MỚI XẢ QUEUE)
        // ==========================================
        let btnAutoBatch = document.getElementById('btn-auto-batch');
        if (btnAutoBatch) {
            btnAutoBatch.onclick = async () => {
                let queue = window.restoredBatchQueue || await parseAllFilesUpfront();
                if (!queue || queue.length === 0) return;

                let isInsideClass = Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, a, button')).some(el =>
                    el.offsetWidth > 0 && (el.textContent.includes('Đánh Giá') || el.textContent.includes('Sổ Điểm') || el.textContent.includes('Nhập điểm'))
                );

                if (!isInsideClass) {
                    if (!window.location.href.includes('classroom')) {
                        log("🚀 Đang lưu Hàng Đợi và nhảy Deep Link tới cửa Phòng học...");
                        let safeQueue = queue.map(q => ({ ...q, fileObj: null }));
                        await chrome.storage.local.set({ 'pending_action': 'AUTO_BATCH', 'pending_queue': safeQueue });
                        await forceNavigate('CLASSROOM');
                        return;
                    }

                    log("🖱️ Đang ở cửa Phòng Học. Tự động click lớp đầu tiên để mở Sidebar...");
                    await delay(1500);
                    let classCards = Array.from(document.querySelectorAll('.w3-col .w3-card')).filter(card => card.offsetWidth > 0);

                    if (classCards.length > 0) {
                        let targetCard = classCards[0];
                        try { targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }

                        let titleH5 = targetCard.querySelector('h5');
                        let clickTarget = titleH5 ? titleH5 : targetCard;

                        // Giữ lại Queue
                        let safeQueue = queue.map(q => ({ ...q, fileObj: null }));
                        await chrome.storage.local.set({ 'pending_action': 'AUTO_BATCH', 'pending_queue': safeQueue });

                        if (typeof window.$ !== 'undefined') try { window.$(clickTarget).trigger('click'); } catch (e) { }
                        clickTarget.click();

                        log(`⏳ Đã click mở lớp. Đang chờ Sidebar làm việc xuất hiện...`);

                        // RADAR SPA THEO DÕI GIAO DIỆN CHUẨN
                        let isClassLoaded = await waitForCondition(() => {
                            return Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, a, button')).some(el =>
                                el.offsetWidth > 0 && (el.textContent.includes('Đánh Giá') || el.textContent.includes('Sổ Điểm') || el.textContent.includes('Nhập điểm'))
                            );
                        }, 15000, 500);

                        if (isClassLoaded) {
                            log("🔄 ĐÃ VÀO GIAO DIỆN CHUẨN! Bắt đầu xả Queue...");
                            await delay(1000);
                            window.restoredBatchQueue = queue;
                            document.getElementById('btn-auto-batch').click();
                            return;
                        } else {
                            log("⚠️ Quá thời gian tải lớp. Bỏ qua.");
                        }
                    } else {
                        log("⚠️ Không thấy thẻ lớp. Hãy tự click vào 1 lớp!");
                    }
                    return;
                }

                // ========================================
                // GIAI ĐOẠN ĐÃ Ở BÊN TRONG (CÓ SIDEBAR)
                // ========================================
                chrome.storage.local.remove(['pending_action', 'pending_queue']);
                window.restoredBatchQueue = null;

                let queueList = document.getElementById('queue-list');
                queueList.innerHTML = '';
                queue.forEach((q, idx) => {
                    queueList.insertAdjacentHTML('beforeend', `<div id="q-${idx}" style="padding:3px; border-bottom:1px dashed #ccc;">
                        <span class="q-status">⏳</span> <b>${q.className}</b> - ${q.subjectName}
                    </div>`);
                });

                log(`🚀 BẮT ĐẦU CHẾ ĐỘ BATCH: Xử lý ${queue.length} lớp...`);
                window.isBatchMode = true;

                for (let i = 0; i < queue.length; i++) {
                    let task = queue[i];
                    if (i > 0) clearLogUI(task.className);

                    log(`\n======================================`);
                    log(`🎯 TÌM LỚP: [${task.className}] - Môn [${task.subjectName}]`);
                    updateQueueUI(`q-${i}`, `🏃`);

                    let classBtn = null;
                    // TÌM LỚP TRÊN SIDEBAR
                    let sidebarItems = Array.from(document.querySelectorAll('.ohke-row, .list-item, .sidebar-item, a, .w3-card h5, .w3-card div')).filter(el => el.textContent.trim() !== "" && el.offsetWidth > 0);

                    if (task.exactWebName) classBtn = sidebarItems.find(el => el.innerText === task.exactWebName);

                    if (!classBtn) {
                        let subjectMap = getSubjectMapping();
                        let keywords = subjectMap[task.subjectName] || [task.subjectName.toLowerCase()];
                        let classRegex = new RegExp(`\\b${task.className}\\b`, 'i');

                        for (let item of sidebarItems) {
                            let txt = item.innerText.toLowerCase();
                            if (classRegex.test(txt) && keywords.some(k => txt.includes(k.toLowerCase()))) {
                                classBtn = item;
                                break;
                            }
                        }
                    }

                    if (classBtn) {
                        try { classBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
                        if (typeof window.$ !== 'undefined') try { window.$(classBtn).trigger('click'); } catch (e) { }
                        classBtn.click();

                        log("⏳ Đang đợi tải bảng điểm của lớp...");

                        let isClassLoaded = await waitForCondition(() => {
                            return Array.from(document.querySelectorAll('.ohke-tab-btn, .tab-btn-, a, button')).some(el =>
                                el.offsetWidth > 0 && (el.textContent.includes('Đánh Giá') || el.textContent.includes('Sổ Điểm') || el.textContent.includes('Nhập điểm'))
                            );
                        }, 15000, 500);

                        if (isClassLoaded) {
                            try {
                                await delay(1000); // Chờ ổn định
                                window.currentBatchScores = task.scores;
                                window.currentBatchClassName = task.className;
                                window.currentBatchCount = task.countDiem;

                                log(`🤖 Đã ở Lớp ${task.className}. Mở THÙNG nạp ${task.countDiem} điểm.`);

                                let btnFull = document.getElementById('btn-auto-full');
                                if (btnFull) await btnFull.onclick();

                                log(`✅ HOÀN TẤT LỚP: [${task.className}]`);
                                updateQueueUI(`q-${i}`, `✅`);

                            } catch (err) {
                                log(`❌ LỖI: ${err.message}`);
                                updateQueueUI(`q-${i}`, `❌ Lỗi tiến trình`);
                            }
                        } else {
                            log(`⚠️ Quá thời gian tải lớp [${task.className}]. Bỏ qua.`);
                            updateQueueUI(`q-${i}`, `❌ Lỗi tải trang`);
                        }
                    } else {
                        log(`⚠️ KHÔNG TÌM THẤY [${task.className}] trên web. Bỏ qua!`);
                        updateQueueUI(`q-${i}`, `❌ Không tìm thấy`);
                    }
                }

                window.isBatchMode = false;
                window.currentBatchScores = null;
                alert("🎉 QUY TRÌNH BATCH HOÀN TẤT!");
            };
        }

        // Mặc định khởi chạy thì kích hoạt Tab Điểm danh (Free)
        document.getElementById('tab-attendance').click();
    };

    // ==========================================
    // KHỞI ĐỘNG HỆ THỐNG
    // ==========================================
    renderMainApp();

    // ==========================================
    // AUTO RESUME: ĐÁNH THỨC VÀ KHÔI PHỤC DỮ LIỆU EXCEL
    // ==========================================
    chrome.storage.local.get(['pending_action', 'pending_data', 'pending_queue'], (res) => {
        if (res.pending_action) {
            let action = res.pending_action;
            let pData = res.pending_data;
            let pQueue = res.pending_queue;

            // QUAN TRỌNG: Phải xóa khỏi bộ nhớ ngay lập tức
            chrome.storage.local.remove(['pending_action', 'pending_data', 'pending_queue']);

            log(`⏳ Đang thiết lập tự động chạy tiếp [${action}] sau 4 giây...`);

            setTimeout(() => {
                log(`🔄 Khôi phục trạng thái thành công. Đang chạy lệnh...`);

                if (action === 'AUTO_ATTENDANCE') {
                    let tabAtt = document.getElementById('tab-attendance');
                    if (tabAtt) tabAtt.click();
                    let btnAtt = document.getElementById('btn-auto-attendance');
                    if (btnAtt) btnAtt.click();

                } else if (action === 'AUTO_GRADING_FULL') {
                    let tabGrad = document.getElementById('tab-grader');
                    if (tabGrad) tabGrad.click();
                    if (pData) window.restoredFullData = pData;

                    let btnGrad = document.getElementById('btn-auto-full');
                    if (btnGrad) btnGrad.click();

                } else if (action === 'AUTO_BATCH') {
                    let tabGrad = document.getElementById('tab-grader');
                    if (tabGrad) tabGrad.click();
                    if (pQueue) window.restoredBatchQueue = pQueue;

                    let btnBatch = document.getElementById('btn-auto-batch');
                    if (btnBatch) btnBatch.click();
                }
            }, 4000);
        }
    });

})();