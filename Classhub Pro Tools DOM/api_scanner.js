/**
 * OHKE HEADLESS API SCANNER
 * Module độc lập (Zero-DOM) dùng để cào dữ liệu trực tiếp từ Ohke Server
 * Có thể nhúng vào Web Worker hoặc Node.js (sau khi thay thế hàm fetch nếu cần).
 */

window.OhkeHeadlessScanner = {
    /**
     * Thuật toán Anti-Corrupt Decode: Giải mã an toàn các HTML Entity của Ohke
     * Xử lý triệt để lỗi gãy cấu trúc do lồng nháy kép.
     */
    decodeOhkeJSON: function(encodedStr) {
        if (!encodedStr) return "";
        let str = encodedStr
            .replace(/&lbrace;/g, '{')
            .replace(/&lcub;/g, '{')
            .replace(/&rbrace;/g, '}')
            .replace(/&rcub;/g, '}')
            .replace(/&colon;/g, ':')
            .replace(/&comma;/g, ',')
            .replace(/&lowbar;/g, '_')
            .replace(/&lbrack;/g, '[')
            .replace(/&rsqb;/g, ']')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&equals;/g, '=')
            .replace(/&bsol;/g, '\\');
        
        // BẢO VỆ CHUỖI JSON (Anti-Corrupt)
        // Nếu Ohke mã hóa ký tự nháy kép lồng bên trong chuỗi giá trị thành \&quot; -> Khôi phục thành \"
        str = str.replace(/\\&quot;/g, '\\"');
        
        // Khôi phục các dấu nháy kép còn lại (là nháy cấu trúc JSON) thành "
        str = str.replace(/&quot;/g, '"');
        
        // Xử lý các dấu nháy đơn nếu có
        str = str.replace(/&#39;/g, "'").replace(/&apos;/g, "'");

        return str;
    },

    /**
     * Vét sạch lớp học qua đường hầm API
     * @param {string} baseUrl URL của trang Classhub hiện tại
     * @param {number|null} singleFieldSubformId ID của Tab cần vét. Nếu null sẽ tự động quét TẤT CẢ các tab có trên trang.
     */
    scanAllClasses: async function(baseUrl, singleFieldSubformId = null) {
        console.log("🚀 [API SCANNER] Kích hoạt tiến trình quét Thuần API...");
        let allItems = [];
        let allFoundIds = new Set();
        
        try {
            let res = await fetch(baseUrl);
            let html = await res.text();
            
            // TÌM TẤT CẢ CÁC CẶP (ohke_prefix, field_subform_id) BẰNG DOM PARSER
            let doc = new DOMParser().parseFromString(html, 'text/html');
            let tabs = [];
            
            // 1. Tìm trong <script type="application/json">
            let scripts = doc.querySelectorAll('script[type="application/json"]');
            scripts.forEach(script => {
                try {
                    let json = JSON.parse(script.textContent);
                    if (json.ohke_prefix && json[':field_subform_id']) {
                        tabs.push({ prefix: json.ohke_prefix, id: json[':field_subform_id'] });
                    }
                } catch(e) {}
            });
            
            // 2. Tìm trong thuộc tính data-env
            let envEls = doc.querySelectorAll('[data-env]');
            envEls.forEach(el => {
                try {
                    let jsonStr = el.getAttribute('data-env');
                    let json = JSON.parse(jsonStr);
                    if (json.ohke_prefix && json[':field_subform_id']) {
                        tabs.push({ prefix: json.ohke_prefix, id: json[':field_subform_id'] });
                    }
                } catch(e) {}
            });

            // Lọc trùng lặp
            let uniqueTabs = [];
            let seenIds = new Set();
            for (let t of tabs) {
                let idStr = t.id.toString();
                if (!seenIds.has(idStr)) {
                    seenIds.add(idStr);
                    uniqueTabs.push(t);
                }
            }
            
            if (singleFieldSubformId) {
                // Rất khó để chạy singleFieldSubformId nếu không biết prefix của nó.
                // Do đó, ta thử tìm trong uniqueTabs xem có không, nếu không lấy prefix đầu tiên.
                let matched = uniqueTabs.find(t => t.id.toString() === singleFieldSubformId.toString());
                if (matched) uniqueTabs = [matched];
                else uniqueTabs = [{ id: singleFieldSubformId, prefix: uniqueTabs.length > 0 ? uniqueTabs[0].prefix : 'field-egoacw7rbi' }];
            }

            console.log(`🔍 [API SCANNER] Tìm thấy ${uniqueTabs.length} Tabs:`, uniqueTabs);
            
            if (uniqueTabs.length === 0) {
                console.warn("⚠️ [API SCANNER] Không lấy được Tab nào từ HTML. Huỷ bỏ quá trình quét.");
                return [];
            }

            for (let tab of uniqueTabs) {
                let fieldSubformId = tab.id;
                let ohkePrefix = tab.prefix;
                let dataQueryId = null; 
                let tabItems = [];

                console.log(`🔑 [API SCANNER] Bẻ khóa Tab ${fieldSubformId} | Prefix: ${ohkePrefix}`);
                
                let page = 0; 
                let tenantIdMatch = baseUrl.match(/\/(\d+)\/appstart/);
                let tenantId = tenantIdMatch ? tenantIdMatch[1] : "61892";
                
                // Tự động săn tìm Endpoint THỰC SỰ của Tab này
                let modelName = "x253B2_Model"; // Fallback
                let scriptIdx = html.indexOf(`ojs['${ohkePrefix}']`);
                if (scriptIdx !== -1) {
                    let urlIdx = html.indexOf('let url =', scriptIdx);
                    if (urlIdx !== -1) {
                        let snippet = html.substring(urlIdx, urlIdx + 100);
                        let m = snippet.match(/\/([a-zA-Z0-9_]+)_(?:Viewer|Model)/);
                        if (m) {
                            modelName = m[1] + "_Model";
                        }
                    }
                }
                
                let apiUrl = `/${tenantId}/appstart/classhub/${modelName}`;
                console.log(`🎯 [API SCANNER] Endpoint của Tab ${fieldSubformId} là: ${apiUrl}`);
                
                let regexEntity = /data-entity=(['"])([\s\S]*?)\1/g;
                
                // Bước 2: Vòng lặp bắn API phân trang cho Tab hiện tại
                while(true) {
                    console.log(`🔄 [API SCANNER] [Tab ${fieldSubformId}] Đang tải Trang ${page}...`);
                    
                    let payload = {
                        ":exchange": { "p2c": { "end_date": null, "start_date": null }, "c2p": {} },
                        ":field_subform_id": parseInt(fieldSubformId, 10),
                        ":master_readonly": null,
                        ":referrer": baseUrl,
                        "arguments": [],
                        "data_query_id": dataQueryId,
                        "father_master_key": null,
                        "master_key": null,
                        "master_object_class_code": "",
                        "master_object_class_name": "",
                        "media": "screen",
                        "ohke_prefix": ohkePrefix,
                        "page": page,
                        "params": { "end_date": null, "start_date": null }
                    };
                
                    let apiRes = await fetch(page === 0 ? apiUrl : `${apiUrl}?__ajax_page=${page}&page=${page}&p=${page}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    let apiText = await apiRes.text();
                    let pageItems = [];
                    let htmlStr = "";
                    let apiJson = null;
                    
                    if (apiText.startsWith('{') || apiText.startsWith('[')) {
                        apiJson = JSON.parse(apiText);
                        
                        // NẾU LÀ TRANG 0: MÁY CHỦ SẼ CẤP PHÁT PHIÊN LÀM VIỆC MỚI, CHÚNG TA PHẢI LƯU LẠI CHO CÁC TRANG SAU!
                        if (page === 0 && apiJson.data_query_id) {
                            dataQueryId = apiJson.data_query_id;
                        }

                        let extractArray = (obj) => {
                            if (Array.isArray(obj)) {
                                if (obj.length > 0 && (obj[0].class_schedule_slot_id || obj[0].class_hour_code)) return obj;
                                for (let i = 0; i < obj.length; i++) {
                                    let res = extractArray(obj[i]);
                                    if (res.length > 0) return res;
                                }
                            } else if (typeof obj === 'object' && obj !== null) {
                                for (let key in obj) {
                                    let res = extractArray(obj[key]);
                                    if (res.length > 0) return res;
                                }
                            }
                            return [];
                        };
                        pageItems = extractArray(apiJson);
                    } else if (apiText.trim().startsWith('<')) {
                        htmlStr = apiText;
                    }

                    if (htmlStr) {
                        regexEntity.lastIndex = 0;
                        let match;
                        while ((match = regexEntity.exec(htmlStr)) !== null) {
                            let rawMatch = match[2];
                            
                            let decodedStr = "";
                            try {
                                decodedStr = this.decodeOhkeJSON(rawMatch);
                                
                                // LỌC CHUẨN DOM
                                if (!decodedStr.includes('class_schedule_slot_id') && 
                                    !decodedStr.includes('class_hour_code') && 
                                    !decodedStr.includes('master_key')) {
                                    continue; 
                                }

                                let subEnt = JSON.parse(decodedStr);
                                pageItems.push(subEnt);
                            } catch (e) {
                                console.error("❌ [API SCANNER] Gãy Parse JSON:", e.message);
                            }
                        }
                    }
                    
                    if (pageItems.length === 0) {
                        console.log(`✅ [API SCANNER] Dừng lặp. Không tìm thấy dữ liệu hợp lệ ở Trang ${page}.`);
                        break;
                    }

                    // PHÁT HIỆN LẶP LẠI (PER TAB)
                    let isDuplicate = false;
                    if (pageItems.length > 0 && tabItems.length > 0) {
                        let firstItemKey = pageItems[0].class_schedule_slot_id || pageItems[0].master_key || pageItems[0].class_hour_code;
                        let existingItem = tabItems.find(i => (i.class_schedule_slot_id || i.master_key || i.class_hour_code) === firstItemKey);
                        if (existingItem) isDuplicate = true;
                    }

                    if (isDuplicate) {
                        console.log(`✅ [API SCANNER] Dừng lặp. Phát hiện dữ liệu trả về bị trùng lặp ở Tab ${fieldSubformId}.`);
                        break;
                    }
                    
                    console.log(`✅ [API SCANNER] [Tab ${fieldSubformId} - Trang ${page}] Thu được ${pageItems.length} lớp học hợp lệ.`);
                    tabItems = tabItems.concat(pageItems);
                    
                    // THÊM VÀO TỔNG CỤC BỘ
                    let newItemsCount = 0;
                    for (let item of pageItems) {
                        let id = String(item.class_schedule_slot_id || item.master_key || item.id || item.class_hour_code);
                        if (!allFoundIds.has(id)) {
                            allFoundIds.add(id);
                            allItems.push(item);
                            newItemsCount++;
                        }
                    }
                    
                    page++;
                    if (page > 30) {
                        console.warn("⚠️ [API SCANNER] Đạt giới hạn 30 trang. Dừng an toàn.");
                        break; 
                    }
                    await new Promise(r => setTimeout(r, 200));
                } // End while(true)
            } // End for (let tab of uniqueTabs)
            
            console.log(`🎉 [API SCANNER RESULT] Tổng thu hoạch: ${allItems.length} lớp học!`);
            return allItems;
        } catch (error) {
            console.error("💥 [API SCANNER] Sập luồng:", error);
            return allItems;
        }
    },

    getTeacherNameAPI: async function(baseUrl) {
        try {
            let res = await fetch(baseUrl);
            let html = await res.text();
            
            // Tìm chuỗi [1234] Họ và Tên bằng Regex
            // Sử dụng [^<"\n] để bắt trọn mọi ký tự tiếng Việt mà không sợ bị đứt quãng
            let match = html.match(/\[\d+\]\s+([^<"\n]+)/);
            if (match && match[1] && match[1].trim().length > 3) {
                let rawName = match[1].trim();
                // Giải mã các ký tự Unicode dạng \u1ec5 thành chữ cái thực tế (ễ)
                let decodedName = rawName.replace(/\\u([0-9a-fA-F]{4})/g, (m, c) => String.fromCharCode(parseInt(c, 16)));
                return decodedName;
            }
            return "Không tìm thấy";
        } catch(e) {
            console.error("❌ [API SCANNER] Lỗi lấy tên giáo viên qua API:", e);
            return "Lỗi API";
        }
    }
};
