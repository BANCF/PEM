const axios = require('axios').default;
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const crypto = require('crypto');

class ClasshubAPI {
    constructor(tenantId = "61892", teacherName = "", onLog = null) {
        this.tenantId = tenantId;
        this.teacherName = teacherName;
        this.myNameLower = teacherName.toLowerCase();
        this.onLog = onLog;
        this.baseUrl = "https://idcloud.vn";
        
        // Khởi tạo trình duyệt ảo tự động quản lý Cookie
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            baseURL: this.baseUrl,
            jar: this.jar,
            withCredentials: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }));
    }

    setRawCookie(cookieString) {
        if (!cookieString) return;
        let cookies = cookieString.split(';');
        for (let c of cookies) {
            try {
                this.jar.setCookieSync(c.trim(), this.baseUrl);
            } catch(e) {}
        }
        this.log("🍪 Đã nạp Cookie thủ công thành công!");
    }

    log(...args) {
        let msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        console.log(msg);
        if (this.onLog) this.onLog(msg);
    }

    normalizeEndpoint(endpoint) {
        if (!endpoint) return "";
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
        if (endpoint.startsWith('/' + this.tenantId)) return endpoint;
        let clean = endpoint.replace(/^\/+/, '');
        return `/${this.tenantId}/appstart/classhub/${clean}`;
    }

    // [CẦN CẤU HÌNH] Hàm gửi RPC tới server
    // Tham số đầu tiên bây giờ là fullUrl thay vì modelName
    async rpcCall(fullUrl, payload) {
        try {
            let res = await this.client.post(fullUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                responseType: 'text' // Lấy text thô để xử lý
            });
            let text = res.data;
            try {
                return JSON.parse(text);
            } catch (e) {
                // Ohke trả về HTML trần (giống lỗi API Hunt)
                return { html: text, isRawHtml: true };
            }
        } catch (err) {
            return { status: "error", error: err.message };
        }
    }

    // [CẦN CẤU HÌNH] Hàm đăng nhập lấy Cookie
    async login(loginUrl, username, password) {
        try {
            this.log(`🔑 Đang đăng nhập vào: ${loginUrl}`);
            
            // Chuyển URL /login thành /jsonPostSignIn theo chuẩn Ohke
            let postUrl = loginUrl.replace(/\/login\/?$/, '/jsonPostSignIn');
            if (postUrl === loginUrl) postUrl += '/jsonPostSignIn'; // Fallback nếu không có đuôi /login

            // Ohke tự động băm (hash) SHA-256 đối với mật khẩu trước khi gửi
            let hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

            let payload = {
                "login-form": {
                    username: username,
                    password: hashedPassword,
                    remember_me: "1"
                }
            };
            
            let res = await this.client.post(postUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*'
                }
            });
            
            this.log("Phản hồi Login:", JSON.stringify(res.data).substring(0, 200));

            // Kiểm tra Cookie đã có chưa
            let cookies = await this.jar.getCookies(this.baseUrl);
            if (res.data && res.data.type === 'success') {
                this.log(`✅ Đăng nhập thành công! Đã lấy được ${cookies.length} Cookies.`);
                return { success: true };
            } else {
                this.log(`⚠️ Đăng nhập thất bại:`, res.data);
                return { success: false, error: res.data.error || "Sai tài khoản hoặc mật khẩu" };
            }
        } catch (err) {
            this.log("❌ Lỗi Đăng nhập:", err.message);
            return { success: false, error: err.message };
        }
    }

    // Quét API ngầm
    async scanAllClasses() {
        this.log("🚀 [API SCANNER] Bắt đầu quét nền tảng ngầm...");
        let targetUrl = `/${this.tenantId}/appstart/classhub/`;
        let html = "";
        try {
            let res = await this.client.get(targetUrl);
            html = res.data;
        } catch(e) {
            this.log("❌ Lỗi lấy trang chủ:", e.message);
            return [];
        }

        // Bóc tách Tabs từ script application/json
        let tabs = [];
        let scriptMatches = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches) {
            for (let s of scriptMatches) {
                let content = s.replace(/<script[^>]*>|<\/script>/gi, '');
                try {
                    let json = JSON.parse(content);
                    if (json.ohke_prefix && json[':field_subform_id']) {
                        tabs.push({ prefix: json.ohke_prefix, id: json[':field_subform_id'] });
                    }
                } catch(e) {}
            }
        }

        // Bóc tách Tabs từ data-env="..."
        let envMatches = html.match(/data-env=(['"])(.*?)\1/g);
        if (envMatches) {
            for (let e of envMatches) {
                let m = e.match(/data-env=(['"])(.*?)\1/);
                if (m) {
                    let content = m[2];
                    // Thay thế TẤT CẢ HTML Entities phổ biến
                    content = content.replace(/&quot;/g, '"')
                                     .replace(/&lbrace;/g, '{')
                                     .replace(/&lcub;/g, '{')
                                     .replace(/&rbrace;/g, '}')
                                     .replace(/&rcub;/g, '}')
                                     .replace(/&lowbar;/g, '_')
                                     .replace(/&colon;/g, ':')
                                     .replace(/&comma;/g, ',')
                                     .replace(/&amp;/g, '&')
                                     .replace(/&lt;/g, '<')
                                     .replace(/&gt;/g, '>');
                    try {
                        let json = JSON.parse(content);
                        if (json.ohke_prefix && json[':field_subform_id']) {
                            tabs.push({ prefix: json.ohke_prefix, id: json[':field_subform_id'] });
                            this.log(`🔍 [Phát hiện Tab từ data-env] Prefix: ${json.ohke_prefix}, ID: ${json[':field_subform_id']}`);
                        }
                    } catch(e) {}
                }
            }
        }

        if (tabs.length === 0) {
            this.log("⚠️ KHÔNG TÌM THẤY TABS. Vui lòng kiểm tra HTML trả về (Đã ghi ra debug_html.html)");
            require('fs').writeFileSync('debug_html.html', html);
        }

        let uniqueTabs = [];
        let seenIds = new Set();
        for (let t of tabs) {
            if (!seenIds.has(t.id.toString())) {
                seenIds.add(t.id.toString());
                uniqueTabs.push(t);
            }
        }

        let allClasses = [];
        for (let tab of uniqueTabs) {
            let modelUrl = `/${this.tenantId}/appstart/classhub/xSB_Model`; // Fallback mặc định

            let scriptIdx = html.indexOf(`ojs['${tab.prefix}']`);
            if (scriptIdx !== -1) {
                let urlIdx = html.indexOf('let url =', scriptIdx);
                if (urlIdx !== -1) {
                    let snippet = html.substring(urlIdx, urlIdx + 200);
                    // Dạng 1: Hardcode chuỗi hoàn chỉnh
                    let m1 = snippet.match(/['"](\/[a-zA-Z0-9_]+\/appstart\/[a-zA-Z0-9_]+\/([a-zA-Z0-9_]+)_(?:Viewer|Model))['"]/);
                    // Dạng 2: Dùng template literal \`${inno.env.appUrl}/xTB_Viewer\`
                    let m2 = snippet.match(/inno\.env\.appUrl}\/([a-zA-Z0-9_]+)_(?:Viewer|Model)/);
                    
                    if (m1) {
                        modelUrl = m1[1];
                    } else if (m2) {
                        let modelName = m2[1] + "_Model";
                        modelUrl = `/${this.tenantId}/appstart/classhub/${modelName}`;
                    } else {
                        this.log(`⚠️ Regex modelUrl KHÔNG MATCH. Snippet: ${snippet}`);
                    }
                } else {
                    this.log(`⚠️ Không tìm thấy 'let url =' cho tab ${tab.prefix}`);
                }
            } else {
                this.log(`⚠️ Không tìm thấy script cho tab ${tab.prefix}`);
            }
            
            this.log(`🔍 [Tab ${tab.id}] Đang gọi API: ${modelUrl}`);

            let page = 0;
            while(true) {
                let payload = {
                    ":exchange": { "p2c": { "end_date": null, "start_date": null }, "c2p": {} },
                    ":field_subform_id": parseInt(tab.id, 10),
                    ":master_readonly": null,
                    ":referrer": `${this.baseUrl}/${this.tenantId}/appstart/classhub/`,
                    "arguments": [],
                    "data_query_id": null,
                    "father_master_key": null,
                    "master_key": null,
                    "master_object_class_code": "",
                    "master_object_class_name": "",
                    "media": "screen",
                    "ohke_prefix": tab.prefix,
                    "page": page,
                    "params": { "end_date": null, "start_date": null }
                };

                let res = await this.rpcCall(modelUrl, payload);
                if (res) {
                    if (res.data && res.data.length > 0) {
                        this.log(`[Tab ${tab.id}][Trang ${page}] Thu được ${res.data.length} dòng (JSON).`);
                        allClasses.push(...res.data);
                        page++;
                    } else if (res.html) {
                        // Trường hợp Ohke trả về HTML chứa data-entity
                        let entityMatches = res.html.match(/data-entity=(['"])(.*?)\1/g);
                        if (entityMatches && entityMatches.length > 0) {
                            this.log(`[Tab ${tab.id}][Trang ${page}] Thu được ${entityMatches.length} dòng (Từ HTML data-entity).`);
                            let extracted = [];
                            for (let e of entityMatches) {
                                let m = e.match(/data-entity=(['"])(.*?)\1/);
                                if (m) {
                                    let str = m[2];
                                    str = str.replace(/&quot;/g, '"')
                                             .replace(/&lbrace;/g, '{')
                                             .replace(/&lcub;/g, '{')
                                             .replace(/&rbrace;/g, '}')
                                             .replace(/&rcub;/g, '}')
                                             .replace(/&lbrack;/g, '[')
                                             .replace(/&rsqb;/g, ']')
                                             .replace(/&lowbar;/g, '_')
                                             .replace(/&colon;/g, ':')
                                             .replace(/&comma;/g, ',')
                                             .replace(/&amp;/g, '&')
                                             .replace(/&lt;/g, '<')
                                             .replace(/&gt;/g, '>');
                                    try {
                                        let parsed = JSON.parse(str);
                                        // Ánh xạ lại các trường để phù hợp với hàm điểm danh
                                        // teaching_hour_past/upcoming dùng 'id' làm teaching_hour_id
                                        if (parsed.study_class_id) {
                                            parsed.teaching_hour_id = parsed.id;
                                            parsed.class_id = parsed.study_class_id;
                                            
                                            // Lấy lesson_id đầu tiên nếu có
                                            if (parsed.lessons && Array.isArray(parsed.lessons) && parsed.lessons.length > 0) {
                                                parsed.lesson_id = parsed.lessons[0].id || parsed.lessons[0];
                                            } else {
                                                parsed.lesson_id = parsed.id; // Fallback
                                            }
                                        }
                                        extracted.push(parsed);
                                    } catch(err) {}
                                }
                            }
                            allClasses.push(...extracted);
                            page++; // Tăng page để lấy trang tiếp theo
                        } else {
                            this.log(`[Tab ${tab.id}][Trang ${page}] HTML không chứa data-entity.`);
                            break;
                        }
                    } else {
                        this.log(`[Tab ${tab.id}][Trang ${page}] Trả về rỗng hoặc lỗi. Chi tiết: ${JSON.stringify(res).substring(0, 150)}`);
                        break;
                    }
                } else {
                    this.log(`❌ [Tab ${tab.id}][Trang ${page}] Lỗi rpcCall (res null)`);
                    break;
                }
            }
        }

        // Decode Entities
        let decodedClasses = [];
        for (let r of allClasses) {
            let entityObj = null;
            let rawEntity = r['data-entity'] || r['ohke-entity'];
            if (rawEntity) {
                try {
                    let decodedStr = Buffer.from(rawEntity, 'base64').toString('utf-8'); // Giả định Base64, tuỳ thuộc vào decodeOhkeJSON
                    // Trong Node.js ta bóc tách Base64 hoặc URI
                    if (decodedStr.includes('%')) decodedStr = decodeURIComponent(decodedStr);
                    entityObj = JSON.parse(decodedStr);
                } catch(e) {
                    entityObj = r; // Fallback
                }
            } else {
                entityObj = r;
            }
            decodedClasses.push({ id: r.id, entity: entityObj, originalData: r });
        }

        this.log(`🎉 [API SCANNER] Tổng thu hoạch: ${decodedClasses.length} lớp học!`);
        return decodedClasses;
    }

    // Helper giải mã HTML entities tiếng Việt
    decodeHtmlEntities(str) {
        if (!str) return '';
        return str.replace(/&Agrave;/g, 'À').replace(/&Aacute;/g, 'Á').replace(/&Acirc;/g, 'Â').replace(/&Atilde;/g, 'Ã')
                  .replace(/&Egrave;/g, 'È').replace(/&Eacute;/g, 'É').replace(/&Ecirc;/g, 'Ê')
                  .replace(/&Igrave;/g, 'Ì').replace(/&Iacute;/g, 'Í')
                  .replace(/&Ograve;/g, 'Ò').replace(/&Oacute;/g, 'Ó').replace(/&Ocirc;/g, 'Ô').replace(/&Otilde;/g, 'Õ')
                  .replace(/&Ugrave;/g, 'Ù').replace(/&Uacute;/g, 'Ú')
                  .replace(/&Yacute;/g, 'Ý')
                  .replace(/&agrave;/g, 'à').replace(/&aacute;/g, 'á').replace(/&acirc;/g, 'â').replace(/&atilde;/g, 'ã')
                  .replace(/&egrave;/g, 'è').replace(/&eacute;/g, 'é').replace(/&ecirc;/g, 'ê')
                  .replace(/&igrave;/g, 'ì').replace(/&iacute;/g, 'í')
                  .replace(/&ograve;/g, 'ò').replace(/&oacute;/g, 'ó').replace(/&ocirc;/g, 'ô').replace(/&otilde;/g, 'õ')
                  .replace(/&ugrave;/g, 'ù').replace(/&uacute;/g, 'ú')
                  .replace(/&yacute;/g, 'ý')
                  .replace(/&utilde;/g, 'ũ').replace(/&Utilde;/g, 'Ũ')
                  .replace(/&Dstrok;/g, 'Đ').replace(/&dstrok;/g, 'đ')
                  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }

    // 4. Lọc lớp học
    filterMyClasses(allClasses) {
        let myClasses = [];
        let myNameLower = this.teacherName.toLowerCase();
        
        for (let c of allClasses) {
            let entity = c.entity || c;
            
            // Các trường có thể chứa tên GV
            let rawTeachers = "";
            if (entity[':field_teacher']) rawTeachers += " " + entity[':field_teacher'];
            if (entity['__main_instructor']) rawTeachers += " " + entity['__main_instructor'];
            if (entity['__instructor_site_ids']) rawTeachers += " " + entity['__instructor_site_ids'];
            
            if (!rawTeachers.trim()) continue;
            
            // Giải mã HTML Entities
            rawTeachers = this.decodeHtmlEntities(rawTeachers);
            
            // Xóa HTML tags và chuẩn hóa
            rawTeachers = rawTeachers.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            
            // Tách các giáo viên
            let parts = rawTeachers.split(/[,;\-]/).map(t => t.trim()).filter(t => t.length > 0);
            
            let isMine = false;
            if (parts.length > 0) {
                // Thuật toán Proximity (Độ gần)
                for (let p of parts) {
                    if (p === myNameLower || p.includes(myNameLower)) {
                        isMine = true;
                        break;
                    }
                    // Tính độ tương đồng từ vựng nếu cần thiết (Ở đây giữ logic cơ bản cho API)
                    let pTokens = p.split(' ').filter(x=>x);
                    let myTokens = myNameLower.split(' ').filter(x=>x);
                    let matches = 0;
                    for (let t of myTokens) {
                        if (pTokens.includes(t)) matches++;
                    }
                    if (matches >= 2 && matches >= Math.ceil(myTokens.length * 0.6)) {
                        isMine = true;
                        break;
                    }
                }
            } else {
                if (rawTeachers.includes(myNameLower)) isMine = true;
            }
            
            if (isMine) myClasses.push(c);
        }
        
        return myClasses;
    }

    getClassUnlockInfo(entityData, bufferMinutes = 5) {
        if (!entityData) return { isSafe: true, unlockTimestamp: 0, timeString: "" };
        let dateStr = entityData.class_schedule_date || entityData.date || entityData.start_date || "";
        if (!dateStr) return { isSafe: true, unlockTimestamp: 0, timeString: "" };
        
        try {
            let timeStr = entityData.class_hour_start_time || entityData.start_time || "00:00:00";
            let year, month, day;
            
            if (dateStr.includes('/')) {
                let parts = dateStr.split('/');
                day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2], 10);
            } else if (dateStr.includes('-')) {
                let parts = dateStr.split('-');
                year = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; day = parseInt(parts[2], 10);
            } else {
                return { isSafe: true, unlockTimestamp: 0, timeString: "" };
            }

            let timeParts = timeStr.split(':');
            let hours = parseInt(timeParts[0], 10) || 0;
            let minutes = parseInt(timeParts[1], 10) || 0;
            
            let startTimestamp = new Date(year, month, day, hours, minutes, 0).getTime();
            if (isNaN(startTimestamp)) return { isSafe: true, unlockTimestamp: 0, timeString: "" };

            let unlockTimestamp = startTimestamp + (bufferMinutes * 60 * 1000);
            let now = Date.now();
            let unlockDate = new Date(unlockTimestamp);
            let timeString = `${String(unlockDate.getHours()).padStart(2, '0')}:${String(unlockDate.getMinutes()).padStart(2, '0')}`;
            
            return { isSafe: now >= unlockTimestamp, unlockTimestamp: unlockTimestamp, timeString: timeString };
        } catch (e) { return { isSafe: true, unlockTimestamp: 0, timeString: "" }; }
    }

    getEligibleClasses(myClasses) {
        let eligible = [];
        for (let c of myClasses) {
            let entity = c.entity;
            let status = String(entity.attendance_sheet_status || entity.status || "").toUpperCase();
            if (status.includes("ACCEPTED")) continue; // Đã chốt sổ
            
            let unlockInfo = this.getClassUnlockInfo(entity, 5);
            if (!unlockInfo.isSafe) continue; // Chưa đến giờ
            
            eligible.push(c);
        }
        return eligible;
    }

    async submitAttendanceFlow(classItem) {
        let entity = classItem.entity;
        let masterKey = classItem.id;
        
        let status = String(entity.attendance_sheet_status || entity.status || "").toUpperCase();
        if (status.includes("ACCEPTED")) {
            this.log(`✅ Lớp [${entity.class_hour_code || entity.class_name || masterKey}] đã chốt sổ (ACCEPTED). Bỏ qua.`);
            return { success: true, class: masterKey, skipped: true };
        }
        
        let unlockInfo = this.getClassUnlockInfo(entity, 5);
        if (!unlockInfo.isSafe) {
            this.log(`⏳ Tiết [${entity.class_hour_code || entity.class_name || masterKey}] chưa đến giờ (Mở khóa lúc ${unlockInfo.timeString}). Bỏ qua.`);
            return { success: true, class: masterKey, skipped: true };
        }

        this.log(`⚡ Đang xử lý điểm danh tiết [${entity.class_hour_code || entity.class_name || masterKey}]...`);

        try {
            // ===============================================
            // 1. API Hunt Giáo viên & BƯỚC 1 (Chuẩn V33 - submitAttendanceFlowV33)
            // ===============================================
            let fetchPayload = {
                master_key: String(masterKey),
                father_master_key: String(masterKey),
                master_object_class_name: "study_student_attendance_sheet",
                master_object_class_code: "DOCTYPE-7004",
                id: null
            };
            let apiUrl = `/${this.tenantId}/appstart/classhub/x24F76_Model`;
            let resModel = await this.rpcCall(apiUrl, fetchPayload);
            
            let instructorId = null;
            let instructorUpdateTime = "";

            if (resModel) {
                // Ưu tiên 1: JSON Data
                if (resModel.data && Array.isArray(resModel.data) && resModel.data.length > 0) {
                    let tRec = resModel.data[0];
                    if (tRec && tRec.id && String(tRec.id) !== String(masterKey)) {
                        instructorId = String(tRec.id);
                        if (tRec.update_time) instructorUpdateTime = tRec.update_time;
                    }
                }
                
                // Ưu tiên 2: Emulate DOM Parser bằng cách chia block HTML
                if (!instructorId && resModel.html) {
                    let blocks = resModel.html.split(/<tr|<li|<div\s+class="card"/i);
                    let targetBlock = null;
                    if (this.myNameLower) {
                        targetBlock = blocks.find(b => b.toLowerCase().includes(this.myNameLower));
                    }
                    if (!targetBlock && blocks.length > 1) targetBlock = blocks[1];

                    if (targetBlock) {
                        let mId = targetBlock.match(/(?:data-id|data-record)="?(\d+)"?/i) || targetBlock.match(/name="id"\s+value="(\d+)"/i);
                        if (mId && mId[1] && mId[1] !== String(masterKey)) {
                            instructorId = mId[1];
                            let mTime = targetBlock.match(/(?:data-update-time|update_time)="([^"]+)"/i) || targetBlock.match(/name="update_time"\s+value="([^"]+)"/i);
                            if (mTime && mTime[1]) instructorUpdateTime = mTime[1];
                            this.log(`  ├─ 🎯 [API Hunt] Bắt chính xác ID từ Block HTML: ${instructorId}`);
                        }
                    }
                }

                // Ưu tiên 3: Regex Fallback
                if (!instructorId) {
                    let rawStr = resModel.html || JSON.stringify(resModel);
                    let mId = rawStr.match(/data-id="(\d+)"/i) || rawStr.match(/id:\s*["']?(\d+)["']?/i);
                    if (mId && mId[1] && mId[1] !== String(masterKey)) {
                        instructorId = mId[1];
                        let mTime = rawStr.match(/(?:data-update-time|update_time)="([^"]+)"/i);
                        if (mTime && mTime[1]) instructorUpdateTime = mTime[1];
                    }
                }
            }

            if (!instructorId) {
                instructorId = entity.instructor_sheet_id || entity.instructor_id || masterKey;
            }

            // Nếu update_time rỗng, tuyệt đối KHÔNG mượn của entity Lớp học (Theo chuẩn V33)
            let tUpdateTime = instructorUpdateTime || "";
            if (tUpdateTime === entity.update_time) tUpdateTime = "";

            this.log(`  ├─ ✔️ Sub-ID GV bóc tách được (V33): ${instructorId} (update_time: "${tUpdateTime}")`);

            // BƯỚC 1: Tick Giáo viên Có mặt (Dùng đúng chuẩn V33)
            this.log(`⏳ [Bước 1/4] Tick trạng thái GV Có mặt...`);
            let payloadTeacherTick = {
                id: parseInt(instructorId),
                field_name: "status",
                begin_state: "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE",
                to_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
                end_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
                is_reversal: 0,
                update_time: tUpdateTime,
                mode: "V",
                entity: { id: parseInt(instructorId), status: "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE" },
                env: { id: parseInt(instructorId), master_key: String(masterKey), father_master_key: String(masterKey) }
            };

            let res1 = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x24F76_jsonPostTransition`, payloadTeacherTick);
            if (!res1 || res1.type !== "success") {
                this.log(`⚠️ Bước 1 (Tick GV) cảnh báo/lỗi:`, res1);
            } else {
                this.log(`  ├─ ✔️ Tick Có mặt GV thành công!`);
            }
            await new Promise(r => setTimeout(r, 100));

            // BƯỚC 2: Chốt sổ Giáo viên sang ACCEPTED (x35FD3_jsonPostTransition)
            this.log(`⏳ [Bước 2/4] Chốt sổ Giáo viên (ACCEPTED)...`);
            let payloadTeacherLock = {
                id: masterKey,
                field_name: "instructor_attendance_status",
                begin_state: entity.instructor_attendance_status || "INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING",
                to_state: "INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED",
                end_state: "INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED",
                is_reversal: 0,
                update_time: entity.update_time || "",
                mode: "V",
                entity: entity,
                env: { id: parseInt(masterKey) }
            };
            let res2 = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x35FD3_jsonPostTransition`, payloadTeacherLock);
            if (!res2 || res2.type !== "success") {
                // Fallback x24F76 if needed
                res2 = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x24F76_jsonPostTransition`, payloadTeacherLock);
            }
            if (!res2 || res2.type !== "success") {
                this.log(`⚠️ Bước 2 thất bại:`, res2);
            } else {
                this.log(`  ├─ ✔️ Chốt sổ GV thành công!`);
            }
            await new Promise(r => setTimeout(r, 100));

            // --- 3. CHỐT HỌC SINH (3-TIER TUẦN TỰ) ---
            let classHourCode = entity.class_hour_code || '';
            let isLessonZero = (classHourCode === 'H0' || String(classHourCode).startsWith('H0.'));
            
            let checkModes = [
                { name: "Tiết trước", endpoint: `/${this.tenantId}/appstart/classhub/bttAction_x2447C_` },
                { name: "Đến trường", endpoint: `/${this.tenantId}/appstart/classhub/bttAction_x2B0CE_` },
                { name: "Tất cả có mặt", endpoint: `/${this.tenantId}/appstart/classhub/bttAction_x2447B_` }
            ];
            if (isLessonZero) checkModes.shift(); 

            let isTrulySuccess = false;

            for (let mode of checkModes) {
                this.log(`🔄 Đang thử chốt Học sinh theo: [${mode.name}]...`);
                
                try {
                    await this.rpcCall(mode.endpoint, { id: String(masterKey) });
                } catch (e3) { }

                let realEnv = {
                    id: String(masterKey),
                    master_key: String(masterKey),
                    father_master_key: String(masterKey)
                };
                let currentEntity = Object.assign({}, entity);

                try {
                    let resRefresh = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x35FD2_Viewer`, { id: String(masterKey) });
                    if (resRefresh) {
                        if (resRefresh.data) {
                            Object.assign(currentEntity, resRefresh.data);
                            if (resRefresh.data.update_time) currentEntity.update_time = resRefresh.data.update_time;
                        }
                        if (resRefresh.html) {
                            let prefixMatch = resRefresh.html.match(/name="ohke_prefix"\s+value="([^"]+)"/);
                            let queryIdMatch = resRefresh.html.match(/name="data_query_id"\s+value="([^"]+)"/);
                            if (prefixMatch) realEnv.ohke_prefix = prefixMatch[1];
                            if (queryIdMatch) realEnv.data_query_id = queryIdMatch[1];
                        }
                    }
                } catch (eRefresh) { }

                let payloadApi4 = {
                    id: parseInt(masterKey) || masterKey,
                    field_name: "attendance_sheet_status",
                    begin_state: currentEntity.attendance_sheet_status || "CLASS_SCHEDULE_SLOT_STATUS_PENDING",
                    to_state: "CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED",
                    end_state: "CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED",
                    is_reversal: 0, 
                    update_time: currentEntity.update_time || entity.update_time || "",
                    mode: "V", 
                    entity: currentEntity, 
                    env: realEnv
                };
                
                try {
                    let res4 = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x35FD2_jsonPostTransition`, payloadApi4);
                    if (res4) {
                        if (res4.type === "success") {
                            isTrulySuccess = true;
                            this.log(`✔️ [API Check] Điểm danh [${mode.name}] chốt sổ thành công!`);
                            break;
                        } else if (res4.type === "error" && res4.code === "ERR_STUDENT_ATTENDANCE_INCOMPLETED") {
                            this.log(`❌ Lỗi Ohke (Tier reject): Học sinh chưa điểm danh đủ. Chuyển Tier...`);
                            continue;
                        } else if (res4.type === "error") {
                            this.log(`⚠️ Lỗi Ohke API: ${res4.message || 'Unknown'}. Vẫn thử tiếp...`);
                        }
                    }
                } catch (e4) { }
            }

            if (!isTrulySuccess) {
                this.log(`⚠️ Các API Tier không xác nhận thành công cho lớp ${masterKey}.`);
            }

            return { success: true, class: classItem.id };
        } catch(e) {
            this.log("❌ Lỗi xử lý lớp:", e.message);
            return { success: false, error: e.message };
        }
    }
}

module.exports = ClasshubAPI;
