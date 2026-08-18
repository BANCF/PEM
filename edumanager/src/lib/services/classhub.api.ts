import crypto from "crypto";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export class ClasshubAPI {
    tenantId: string;
    teacherName: string;
    myNameLower: string;
    baseUrl: string;
    cookieString: string;
    onLog: any;
    jar: CookieJar;
    client: any;
    logBuffer: string[];

    constructor(tenantId = "61892", teacherName = "", cookieString = "", onLog: any = null) {
        this.tenantId = tenantId;
        this.teacherName = teacherName;
        this.myNameLower = teacherName ? teacherName.toLowerCase() : "";
        this.baseUrl = "https://idcloud.vn";
        this.cookieString = cookieString;
        this.onLog = onLog;
        this.logBuffer = [];
        
        // Khởi tạo trình duyệt ảo tự động quản lý Cookie
        this.jar = new CookieJar();
        
        // Nạp cookie vào jar từ chuỗi cấu hình ban đầu
        if (cookieString) {
            // Chuỗi cookie từ header thường phân tách bằng dấu phẩy nếu ghép nhiều cookie, hoặc dấu chấm phẩy
            let cookies = cookieString.split(/,(?=\s*[A-Za-z0-9_-]+\=)|;/);
            for (let c of cookies) {
                try {
                    if (c.trim()) this.jar.setCookieSync(c.trim(), this.baseUrl);
                } catch (e: any) {}
            }
        }
        
        this.client = wrapper(axios.create({
            baseURL: this.baseUrl,
            jar: this.jar,
            withCredentials: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }));
    }

    async clientGet(url: string) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        try {
            const res = await this.client.get(fullUrl);
            return { data: res.data };
        } catch(e: any) {
            return { error: e.message };
        }
    }

    log(...args: any[]) {
        let msg = args.map((a: any) => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        this.logBuffer.push(msg);
        console.log(msg);
        if (this.onLog) this.onLog(msg);
    }

    normalizeEndpoint(endpoint: string) {
        if (!endpoint) return "";
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
        if (endpoint.startsWith('/' + this.tenantId)) return endpoint;
        let clean = endpoint.replace(/^\/+/, '');
        return `/${this.tenantId}/appstart/classhub/${clean}`;
    }

    // Hàm gửi RPC tới server
    async rpcCall(url: string, payload: any) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        try {
            let res = await this.client.post(fullUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'ohke-ajax': '1',
                    'User-Agent': 'Mozilla/5.0'
                },
                responseType: 'text' // Lấy text thô để xử lý
            });
            let text = res.data;
            if (typeof text === 'object') return text;
            try { return JSON.parse(text); } catch (e: any) { return { html: text, isRawHtml: true }; }
        } catch (err: any) { return { status: "error", error: err.message }; }
    }
    async login(loginUrl: string, username: string, password: string) {
        try {
            this.log(`🔑 Đang đăng nhập vào: ${loginUrl}`);
            
            // Chuyển URL /login thành /jsonPostSignIn theo chuẩn Ohke
            let postUrl = loginUrl.replace(/\/login\/?$/, '/jsonPostSignIn');
            if (postUrl === loginUrl) postUrl += '/jsonPostSignIn'; // Fallback nếu không có đuôi /login

            // Ohke tự động băm (hash) SHA-256 đối với mật khẩu trước khi gửi
            let hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

            let payload: any = {
                "login-form": {
                    username: username,
                    password: hashedPassword,
                    remember_me: "1",
                    __password: "LAa0S"
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
        } catch (err: any) {
            this.log("❌ Lỗi Đăng nhập:", err.message);
            return { success: false, error: err.message };
        }
    }

    async autoHuntTeacherName() {
        try {
            this.log("🔍 Đang tự động tìm Tên Giáo viên từ hệ thống...");
            let res = await this.clientGet(`/${this.tenantId}/appstart/classhub/`);
            let html = res.data;
            
            let foundName = null;

            // Ưu tiên 1: Lấy trực tiếp từ biến Ohke.worker (Chính xác 100%)
            let workerMatch = html.match(/Ohke\.worker\s*=\s*(\{.*?\});/);
            if (workerMatch && workerMatch[1]) {
                try {
                    let worker = JSON.parse(workerMatch[1]);
                    if (worker && worker.name) {
                        foundName = worker.name.trim();
                    }
                } catch (e: any) {}
            }

            // Ưu tiên 2: Tìm định dạng "[ID] Họ và Tên" (Ví dụ: "[123456] Vũ Hoàng Linh")
            if (!foundName) {
                let match = html.match(/\[\d+\]\s+([A-ZÀ-Ỹa-zà-ỹ\s]{4,50})/);
                if (match && match[1]) foundName = match[1].trim().split('\n')[0].trim();
            }
            
            // Ưu tiên 3: Định dạng <span class="title"> Vũ Hoàng Linh </span>
            if (!foundName) {
                let match = html.match(/<span[^>]*class=["']title["'][^>]*>\s*([A-ZÀ-Ỹa-zà-ỹ\s]{4,50})\s*<\/span>/i);
                if (match && match[1]) foundName = match[1].trim().split('\n')[0].trim();
            }

            if (foundName) {
                this.teacherName = foundName;
                this.myNameLower = foundName.toLowerCase();
                this.log(`✅ Đã nhận diện được tên Giáo viên: ${this.teacherName}`);
                return { success: true, name: this.teacherName };
            } else {
                this.log("⚠️ Không thể tự động quét ra tên Giáo viên từ HTML.");
                return { success: false };
            }
        } catch (e: any) {
            this.log("❌ Lỗi khi quét tên Giáo viên:", e.message);
            return { success: false, error: e.message };
        }
    }

    // Quét API ngầm
    async scanAllClasses() {
        this.log("🚀 [API SCANNER] Bắt đầu quét nền tảng ngầm...");
        let targetUrl = `/${this.tenantId}/appstart/classhub/`;
        let html = "";
        try {
            let res = await this.clientGet(targetUrl);
            html = res.data;
        } catch (e: any) {
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
                } catch (e: any) {}
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
                    } catch (e: any) {}
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
                let payload: any = {
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
                        let items = res.data.map((item: any) => {
                            if (typeof item === 'object') item.sourceApi = modelUrl;
                            return item;
                        });
                        allClasses.push(...items);
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
                                        parsed.sourceApi = modelUrl;
                                        extracted.push(parsed);
                                    } catch (err: any) {}
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
                } catch (e: any) {
                    entityObj = r; // Fallback
                }
            } else {
                entityObj = r;
            }
            decodedClasses.push({ id: r.id, entity: entityObj, sourceApi: r.sourceApi || entityObj.sourceApi, originalData: r });
        }

        this.log(`🎉 [API SCANNER] Tổng thu hoạch: ${decodedClasses.length} lớp học!`);
        return decodedClasses;
    }

    // Helper giải mã HTML entities tiếng Việt
    decodeHtmlEntities(str: any) {
        if (!str) return '';
        str = str.replace(/&#(\d+);/g, (match: any, dec: any) => String.fromCharCode(dec));
        str = str.replace(/&#x([0-9a-fA-F]+);/g, (match: any, hex: any) => String.fromCharCode(parseInt(hex, 16)));
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

    advancedUnicodeSanitize(str: any) {
        if (!str) return "";
        return String(str)
            .normalize('NFC')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\xA0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    stripVietnameseTones(str: string) {
        if (!str) return "";
        return String(str).normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }

    calculate3TierNameScore(blockText: any, nameLower: string) {
        if (!nameLower) return 0;

        let cleanBlock = this.advancedUnicodeSanitize(blockText);
        let cleanMyName = this.advancedUnicodeSanitize(nameLower);

        if (cleanBlock.includes(cleanMyName)) return 1000;

        let pTokens = cleanBlock.split(/[\s,\.\-]+/).filter((x: any) => x);
        let myTokens = cleanMyName.split(/[\s,\.\-]+/).filter((x: any) => x);
        
        let exactMatches = 0;
        for (let t of myTokens) {
            if (pTokens.includes(t)) exactMatches++;
        }
        if (exactMatches >= Math.ceil(myTokens.length * 0.6)) {
            return 500 + exactMatches;
        }

        let unaccentBlockTokens = pTokens.map((t: string) => this.stripVietnameseTones(t));
        let unaccentMyTokens = myTokens.map((t: string) => this.stripVietnameseTones(t));

        let unaccentMatches = 0;
        for (let t of unaccentMyTokens) {
            if (unaccentBlockTokens.includes(t)) unaccentMatches++;
        }
        
        return unaccentMatches;
    }

    findBestMatchBlock(blocks: any[], nameLower: string) {
        let bestBlock = null;
        let highestScore = 0;
        let myTokensLen = nameLower ? nameLower.split(/[\s,\.\-]+/).filter((x: any) => x).length : 0;
        let threshold = Math.ceil(myTokensLen * 0.5);

        for (let b of blocks) {
            let score = this.calculate3TierNameScore(this.decodeHtmlEntities(b), nameLower);
            if (score > highestScore && score >= threshold) {
                highestScore = score;
                bestBlock = b;
            }
        }
        return bestBlock;
    }

    filterMyClasses(allClasses: any) {
        let myClasses = [];
        let myNameLower = this.teacherName.toLowerCase();
        
        for (let c of allClasses) {
            let entity = c.entity || c;
            
            // Các trường có thể chứa tên GV
            let rawTeachers = "";
            if (entity[':field_teacher']) rawTeachers += " " + entity[':field_teacher'];
            if (entity['__main_instructor']) rawTeachers += " " + entity['__main_instructor'];
            if (entity['__instructor_site_ids']) rawTeachers += " " + entity['__instructor_site_ids'];
            if (entity.instructor && entity.instructor.name) rawTeachers += " " + entity.instructor.name;
            if (entity.instructor_name) rawTeachers += " " + entity.instructor_name;
            if (entity.teacher_name) rawTeachers += " " + entity.teacher_name;
            
            if (!rawTeachers.trim()) continue;
            
            // Giải mã HTML Entities
            rawTeachers = this.decodeHtmlEntities(rawTeachers);
            
            // Xóa HTML tags và chuẩn hóa
            rawTeachers = rawTeachers.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            
            // Tách các giáo viên
            let parts = rawTeachers.split(/[,;\-]/).map((t: any) => t.trim()).filter((t: any) => t.length > 0);
            
            let isMine = false;
            let myTokensLen = myNameLower.split(/[\s,\.\-]+/).filter((x: any) => x).length;
            let threshold = Math.ceil(myTokensLen * 0.5);
            if (parts.length > 0) {
                for (let p of parts) {
                    if (this.calculate3TierNameScore(p, myNameLower) >= threshold) {
                        isMine = true;
                        break;
                    }
                }
            } else {
                if (this.calculate3TierNameScore(rawTeachers, myNameLower) >= threshold) isMine = true;
            }
            
            if (isMine) myClasses.push(c);
        }
        
        return myClasses;
    }

    getClassUnlockInfo(entityData: any, bufferMinutes = 5) {
        if (!entityData) return { isSafe: false, unlockTimestamp: Infinity, timeString: "Lỗi dữ liệu" };
        let dateStr = entityData.class_schedule_date || entityData.date || entityData.start_date || entityData.teaching_date || "";
        if (!dateStr) return { isSafe: false, unlockTimestamp: Infinity, timeString: "Không có lịch" };
        
        try {
            let timeStr = entityData.class_hour_start_time || entityData.start_time || entityData.teaching_start_time || "00:00:00";
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
            
            let yStr = String(year).padStart(4, '0');
            let mStr = String(month + 1).padStart(2, '0');
            let dStr = String(day).padStart(2, '0');
            let hStr = String(hours).padStart(2, '0');
            let minStr = String(minutes).padStart(2, '0');
            
            let isoStr = `${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:00+07:00`;
            let startTimestamp = new Date(isoStr).getTime();
            
            if (isNaN(startTimestamp)) return { isSafe: false, unlockTimestamp: Infinity, timeString: "Lỗi định dạng giờ" };

            let unlockTimestamp = startTimestamp + (bufferMinutes * 60 * 1000);
            let now = Date.now();
            
            let timeString = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(new Date(unlockTimestamp));
            
            return { isSafe: now >= unlockTimestamp, unlockTimestamp: unlockTimestamp, timeString: timeString };
        } catch (e: any) { return { isSafe: true, unlockTimestamp: 0, timeString: "" }; }
    }

    getEligibleClasses(myClasses: any) {
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

    async revertFutureClasses(myClasses: any) {
        this.log(`DEBUG: Nhận được ${myClasses.length} lớp từ scanAllClasses!`);
        let futureClasses = [];
        for (let c of myClasses) {
            let entity = c.entity || {};
            let studentStatus = String(entity.attendance_sheet_status || "").toUpperCase();
            let teacherStatus = String(entity.instructor_attendance_status || entity.instructor_attendance_sheet_status || "").toUpperCase();
            let oldStatus = String(entity.status || "").toUpperCase();
            
            let isSubmitted = studentStatus.includes("ACCEPTED") || teacherStatus.includes("ACCEPTED") || oldStatus.includes("ACCEPTED");
            
            this.log(`DEBUG Class [${entity.class_hour_code || entity.class_name}]: HS=${studentStatus}, GV=${teacherStatus}, T=${oldStatus} => isSubmitted=${isSubmitted}`);

            if (!isSubmitted) continue; // Bỏ qua nếu chưa chốt

            let unlockInfo = this.getClassUnlockInfo(entity, 5);
            this.log(`DEBUG Class [${entity.class_hour_code || entity.class_name}]: isSafe=${unlockInfo.isSafe}`);

            if (!unlockInfo.isSafe) { // Chưa đến giờ => Bị chốt nhầm ở tương lai
                futureClasses.push(c);
            }
        }

        if (futureClasses.length === 0) {
            this.log("✅ Không có lớp tương lai nào bị chốt nhầm.");
            return { success: true, count: 0 };
        }

        this.log(`⚠️ PHÁT HIỆN ${futureClasses.length} LỚP TƯƠNG LAI BỊ CHỐT NHẦM! Bắt đầu hủy chốt sổ...`);

        for (let c of futureClasses) {
            await this.revertAttendanceFlow(c);
        }

        this.log(`🎉 ĐÃ HỦY CHỐT SỔ THÀNH CÔNG CHO ${futureClasses.length} LỚP TƯƠNG LAI!`);
        return { success: true, count: futureClasses.length };
    }

    async revertAttendanceFlow(classItem: any) {
        let entity = classItem.entity;
        let masterKey = classItem.id;
        
        this.log(`⚡ Đang HỦY chốt sổ tiết [${entity.class_hour_code || entity.class_name || masterKey}]...`);

        // Lấy update_time mới nhất của class
        let classUpdateTime = entity.update_time || "";
        let exactViewerEndpoint = classItem.sourceApi ? classItem.sourceApi.replace('_Model', '_Viewer') : `/${this.tenantId}/appstart/classhub/x35FD2_Viewer`;
        try {
            let cvRes = await this.rpcCall(exactViewerEndpoint, { id: String(masterKey) });
            if (cvRes && cvRes.data && cvRes.data.update_time) {
                classUpdateTime = cvRes.data.update_time;
            } else if (cvRes && cvRes.html) {
                let mTime = cvRes.html.match(/(?:data-update-time|update_time)="([^"]+)"/i);
                if (mTime && mTime[1]) classUpdateTime = mTime[1];
            }
        } catch (e: any) {}

        // 1. Hủy chốt sổ Học sinh
        try {
            this.log(`  ⏳ Đang hủy chốt sổ Học sinh...`);
            let studentPayload = {
                id: String(masterKey),
                field_name: 'attendance_sheet_status',
                begin_state: 'CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED',
                end_state: 'CLASS_SCHEDULE_SLOT_STATUS_PENDING',
                is_reversal: 0,
                update_time: classUpdateTime
            };
            let resStudent = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x35FD2_jsonPostTransition`, studentPayload);
            if (resStudent && (resStudent.success || resStudent.type === "success")) {
                this.log(`  ├─ ✔️ Hủy chốt sổ Học sinh thành công!`);
                if (resStudent.data && resStudent.data.update_time) classUpdateTime = resStudent.data.update_time;
            } else {
                this.log(`  ├─ ⚠️ Lỗi hủy Học sinh: ${JSON.stringify(resStudent)}`);
            }
        } catch (e: any) {
            this.log(`  ├─ ❌ Lỗi gọi API hủy HS: ${e.message}`);
        }

        // 2. Hủy chốt sổ Giáo viên
        try {
            this.log(`  ⏳ Đang hủy chốt sổ Giáo viên...`);
            let teacherPayload = {
                id: String(masterKey),
                field_name: 'instructor_attendance_status',
                begin_state: 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED',
                end_state: 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING',
                is_reversal: 0,
                update_time: classUpdateTime
            };
            let resTeacher = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x35FD3_jsonPostTransition`, teacherPayload);
            if (resTeacher && (resTeacher.success || resTeacher.type === "success")) {
                this.log(`  ├─ ✔️ Hủy chốt sổ Giáo viên thành công!`);
            } else {
                this.log(`  ├─ ⚠️ Lỗi hủy Giáo viên: ${JSON.stringify(resTeacher)}`);
            }
        } catch (e: any) {
            this.log(`  ├─ ❌ Lỗi gọi API hủy GV: ${e.message}`);
        }
        return { success: true };
    }

    async submitAttendanceFlow(classItem: any) {
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
            
            let instructorId: any = null;
            let instructorUpdateTime = "";
            let instructorBeginState = "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE";

            // BƯỚC ĐỘT PHÁ (Priority 0): SUPER HUNT MAX
            // Gọi thẳng API Viewer GỐC của Lớp học (lấy từ sourceApi) để lấy HTML render chuẩn xác nhất!
            let exactViewerEndpoint = classItem.sourceApi ? classItem.sourceApi.replace('_Model', '_Viewer') : `/${this.tenantId}/appstart/classhub/x35FD2_Viewer`;
            
            try {
                let cvRes = await this.rpcCall(exactViewerEndpoint, { id: String(masterKey) });
                if (cvRes && cvRes.html && this.myNameLower) {
                    let blocks = cvRes.html.split(/<tr|<li|<div\s+class="card"/i);
                    // Lọc thẻ HTML để so sánh tên chính xác
                    let targetBlock = this.findBestMatchBlock(blocks, this.myNameLower);
                    
                    if (!targetBlock) {
                        this.log(`  ├─ ⚠️ [SUPER HUNT MAX] Không tìm thấy tên "${this.myNameLower}" trong ${blocks.length} block HTML của ${exactViewerEndpoint}`);
                        // Nếu vẫn không tìm thấy bằng tên, thử tìm bằng ID fallback
                        let fallbackId = entity.instructor_sheet_id || entity.instructor_id;
                        if (fallbackId) {
                            targetBlock = blocks.find((b: any) => b.includes(`="${fallbackId}"`) || b.includes(`='${fallbackId}'`));
                            if (!targetBlock) {
                                this.log(`  ├─ ⚠️ [SUPER HUNT MAX] Cả fallback ID "${fallbackId}" cũng không có trong HTML.`);
                            } else {
                                this.log(`  ├─ 🎯 [SUPER HUNT MAX] Khớp bằng Fallback ID ${fallbackId} (Bỏ qua tên).`);
                            }
                        }
                    }

                    if (targetBlock) {
                        let mId = targetBlock.match(/(?:data-id|data-record)="?(\d+)"?/i) || targetBlock.match(/name="id"\s+value="(\d+)"/i);
                        let fallbackId = entity.instructor_sheet_id || entity.instructor_id;
                        if (!mId && fallbackId && targetBlock.includes(String(fallbackId))) {
                            mId = [null, String(fallbackId)]; // Force use fallback ID if found in block
                        }

                        if (mId && mId[1] && mId[1] !== String(masterKey) && parseInt(mId[1]) > 1000) {
                            instructorId = mId[1];
                            let mTime = targetBlock.match(/(?:data-update-time|update_time)="([^"]+)"/i) || targetBlock.match(/name="update_time"\s+value="([^"]+)"/i);
                            if (mTime && mTime[1]) instructorUpdateTime = mTime[1];
                            
                            let mStatus = targetBlock.match(/status="([^"]+)"/i) || targetBlock.match(/name="status"\s+value="([^"]+)"/i);
                            if (mStatus && mStatus[1]) instructorBeginState = mStatus[1];

                            this.log(`  ├─ 🎯 [SUPER HUNT MAX] BẮT ĐƯỢC ID TỪ CLASS VIEWER HTML: ${instructorId} (UpdateTime: ${instructorUpdateTime})`);
                        } else {
                            let snip = targetBlock.replace(/\s+/g, ' ').substring(0, 150);
                            this.log(`  ├─ ⚠️ [SUPER HUNT MAX] Target block có nhưng không trích xuất được data-id. Snippet: ${snip}...`);
                        }
                    }
                } else if (!cvRes || !cvRes.html) {
                    this.log(`  ├─ ⚠️ [SUPER HUNT MAX] API ${exactViewerEndpoint} trả về rỗng hoặc lỗi phân quyền.`);
                }
            } catch (e: any) {
                this.log(`  ├─ ⚠️ [SUPER HUNT MAX] Lỗi kết nối: ${e.message}`);
            }

            // Nếu Super Hunt thất bại, mới dùng Model API cũ
            if (!instructorId && resModel) {
                // Ưu tiên 1: Quét HTML Block từ resModel
                if (resModel.html && this.myNameLower) {
                    let blocks = resModel.html.split(/<tr|<li|<div\s+class="card"/i);
                    let targetBlock = this.findBestMatchBlock(blocks, this.myNameLower);
                    if (targetBlock) {
                        let mId = targetBlock.match(/(?:data-id|data-record)="?(\d+)"?/i) || targetBlock.match(/name="id"\s+value="(\d+)"/i);
                        if (mId && mId[1] && mId[1] !== String(masterKey) && parseInt(mId[1]) > 1000) {
                            instructorId = mId[1];
                            let mTime = targetBlock.match(/(?:data-update-time|update_time)="([^"]+)"/i) || targetBlock.match(/name="update_time"\s+value="([^"]+)"/i);
                            if (mTime && mTime[1]) instructorUpdateTime = mTime[1];
                            
                            let mStatus = targetBlock.match(/status="([^"]+)"/i) || targetBlock.match(/name="status"\s+value="([^"]+)"/i);
                            if (mStatus && mStatus[1]) instructorBeginState = mStatus[1];

                            this.log(`  ├─ 🎯 [API Hunt] BẮT ĐƯỢC ID TỪ HTML MODEL (KHỚP TÊN): ${instructorId} (UpdateTime: ${instructorUpdateTime})`);
                        }
                    }
                }

                // Ưu tiên 2: JSON Data (Sử dụng hàm trích xuất string để chống lỗi Unicode Escape)
                if (!instructorId && resModel.data && Array.isArray(resModel.data) && resModel.data.length > 0) {
                    if (this.myNameLower) {
                        const extractStr = (obj: any) => {
                            let s = "";
                            if (typeof obj === 'string') return obj.toLowerCase() + " ";
                            if (typeof obj === 'object' && obj !== null) {
                                for (let k in obj) s += extractStr(obj[k]);
                            }
                            return s;
                        };
                        let tRec = null;
                        let highestScore = 0;
                        let myTokensLen = this.myNameLower.split(/[\s,\.\-]+/).filter((x: any) => x).length;
                        let threshold = Math.ceil(myTokensLen * 0.5);
                        for (let r of resModel.data) {
                            let score = this.calculate3TierNameScore(extractStr(r), this.myNameLower);
                            if (score > highestScore && score >= threshold) {
                                highestScore = score;
                                tRec = r;
                            }
                        }
                        if (tRec && tRec.id && String(tRec.id) !== String(masterKey)) {
                            instructorId = String(tRec.id);
                            this.log(`  ├─ 🎯 [API Hunt] BẮT ĐƯỢC ID TỪ JSON MODEL (KHỚP TÊN): ${instructorId}`);
                        }
                    }
                }

                // Ưu tiên 3: Regex Fallback tìm trong HTML
                if (!instructorId && resModel.html) {
                    let targetBlock = null;
                    let blocks = resModel.html.split(/<tr|<li|<div\s+class="card"/i);
                    if (blocks.length === 2) {
                        targetBlock = blocks[1];
                    } else if (blocks.length > 2) {
                        let fallbackId = entity.instructor_sheet_id || entity.instructor_id;
                        if (fallbackId) {
                            targetBlock = blocks.find((b: any) => b.includes(`="${fallbackId}"`) || b.includes(`='${fallbackId}'`));
                        }
                    }
                    if (targetBlock) {
                        let mId = targetBlock.match(/(?:data-id|data-record)="?(\d+)"?/i) || targetBlock.match(/name="id"\s+value="(\d+)"/i);
                        if (mId && mId[1] && mId[1] !== String(masterKey) && parseInt(mId[1]) > 1000) {
                            instructorId = mId[1];
                            let mTime = targetBlock.match(/(?:data-update-time|update_time)="([^"]+)"/i) || targetBlock.match(/name="update_time"\s+value="([^"]+)"/i);
                            if (mTime && mTime[1]) instructorUpdateTime = mTime[1];
                            
                            let mStatus = targetBlock.match(/status="([^"]+)"/i) || targetBlock.match(/name="status"\s+value="([^"]+)"/i);
                            if (mStatus && mStatus[1]) instructorBeginState = mStatus[1];

                            this.log(`  ├─ ⚠️ [API Hunt] Fallback lấy ID từ HTML block đầu tiên: ${instructorId}`);
                        }
                    }
                }

                // ĐỒNG BỘ CHÍNH XÁC UPDATE_TIME VÀ STATUS TỪ JSON BẰNG ID VỪA CHỐT
                if (instructorId && resModel.data && Array.isArray(resModel.data)) {
                    let exactRec = resModel.data.find((r: any) => String(r.id) === String(instructorId));
                    if (exactRec) {
                        if (exactRec.update_time) instructorUpdateTime = exactRec.update_time;
                        if (exactRec.status) instructorBeginState = exactRec.status;
                        this.log(`  ├─ 🔍 [Hunt Sync] Đã đồng bộ UpdateTime="${instructorUpdateTime}", Status="${instructorBeginState}" từ JSON.`);
                    }
                }
            }

            if (!instructorId) {
                this.log(`  ├─ ❌ [CRITICAL ERROR] Không xác định được ID giáo viên chuẩn (So khớp tên 3-Tier thất bại). Tạm dừng điểm danh lớp này!`);
                return { success: false, class: masterKey, error: "Không tìm thấy ID giáo viên chuẩn" };
            }

            // Gọi Viewer để xác nhận chính xác update_time và trạng thái hiện tại (Chống lỗi OCC)
            if (instructorId && String(instructorId) !== String(masterKey)) {
                try {
                    let tViewerRes = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x24F76_Viewer`, { id: String(instructorId) });
                    if (tViewerRes && tViewerRes.data && tViewerRes.data.update_time) {
                        instructorUpdateTime = tViewerRes.data.update_time;
                        if (tViewerRes.data.status) instructorBeginState = tViewerRes.data.status;
                        this.log(`  ├─ 🚑 [Rescue Hunt] Lấy update_time từ x24F76_Viewer (JSON): ${instructorUpdateTime}`);
                    } else if (tViewerRes && tViewerRes.html) {
                        let mTime = tViewerRes.html.match(/(?:data-update-time|update_time)="([^"]+)"/i) || tViewerRes.html.match(/name="update_time"\s+value="([^"]+)"/i);
                        if (mTime && mTime[1]) {
                            instructorUpdateTime = mTime[1];
                            this.log(`  ├─ 🚑 [Rescue Hunt] Cứu vớt update_time từ x24F76_Viewer (HTML): ${instructorUpdateTime}`);
                        } else {
                            let snip = tViewerRes.html.replace(/\s+/g, ' ').substring(0, 150);
                            this.log(`  ├─ ⚠️ [Rescue Hunt] HTML của x24F76_Viewer không chứa update_time! Snippet: ${snip}...`);
                        }
                        let mStatus = tViewerRes.html.match(/status="([^"]+)"/i) || tViewerRes.html.match(/name="status"\s+value="([^"]+)"/i);
                        if (mStatus && mStatus[1]) instructorBeginState = mStatus[1];
                    }
                } catch (e: any) {
                    this.log(`  ├─ ⚠️ [Rescue Hunt] Gọi x24F76_Viewer thất bại: ${e.message}`);
                }
            }

            // Nếu update_time rỗng, tuyệt đối KHÔNG mượn của entity Lớp học (Theo chuẩn V33)
            // Đã xóa bỏ logic tự động xóa update_time khi trùng với entity để tránh lỗi OCC
            let tUpdateTime = instructorUpdateTime || "";

            if (!instructorBeginState || !instructorBeginState.includes("INSTRUCTOR_ATTENDANCE_STATUS_")) {
                instructorBeginState = "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE";
            }

            this.log(`  ├─ ✔️ Sub-ID GV bóc tách được (V33): ${instructorId} (update_time: "${tUpdateTime}", status: "${instructorBeginState}")`);

            // BƯỚC 1: Tick Giáo viên Có mặt (Dùng đúng chuẩn V33)
            this.log(`⏳ [Bước 1/4] Tick trạng thái GV Có mặt...`);
            let payloadTeacherTick = {
                id: parseInt(instructorId),
                field_name: "status",
                begin_state: instructorBeginState,
                to_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
                end_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
                is_reversal: 0,
                update_time: tUpdateTime,
                mode: "V",
                entity: { id: parseInt(instructorId), status: instructorBeginState },
                env: { id: parseInt(instructorId), master_key: String(masterKey), father_master_key: String(masterKey) }
            };

            let res1 = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x24F76_jsonPostTransition`, payloadTeacherTick);
            if (!res1 || res1.type !== "success") {
                this.log(`⚠️ Bước 1 (Tick GV) cảnh báo/lỗi:`, res1);
            } else {
                this.log(`  ├─ ✔️ Tick Có mặt GV thành công!`);
            }
            await new Promise((r: any) => setTimeout(r, 100));

            // Làm mới update_time của Lớp học trước khi chốt Giáo viên để tránh lỗi OCC
            try {
                let resRefreshMaster = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x35FD2_Viewer`, { id: String(masterKey) });
                if (resRefreshMaster && resRefreshMaster.data && resRefreshMaster.data.update_time) {
                    entity.update_time = resRefreshMaster.data.update_time;
                }
            } catch (eRefresh) { }

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
            await new Promise((r: any) => setTimeout(r, 100));

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

                let realEnv: any = {
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
        } catch (e: any) {
            this.log("❌ Lỗi xử lý lớp:", e.message);
            return { success: false, error: e.message };
        }
    }
}



