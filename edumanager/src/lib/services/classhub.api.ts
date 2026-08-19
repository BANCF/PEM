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
        if (this.onLog) {
            this.onLog(msg);
        } else {
            console.log(msg);
        }
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
    async scanAllClasses(forceSync: boolean = false) {
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

        let allClasses: any[] = [];
        
        let startDateStr = "";
        let endDateStr = "";
        
        let maxPages = forceSync ? -1 : 2;

        if (!forceSync) {
            // Chỉ lấy hôm nay (Mặc dù Ohke có thể phớt lờ tham số này)
            let today = new Date();
            const formatDate = (d: Date) => {
                let y = d.getFullYear();
                let m = String(d.getMonth() + 1).padStart(2, '0');
                let day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            startDateStr = formatDate(today);
            endDateStr = formatDate(today);
            
            // Ưu tiên chỉ quét tab 152496 (Lịch dạy hôm nay) để tăng tốc độ nếu có
            if (uniqueTabs.some((t: any) => String(t.id) === "152496")) {
                uniqueTabs = uniqueTabs.filter((t: any) => String(t.id) === "152496");
                this.log(`📅 Đang quét NHANH lớp HÔM NAY (Chỉ quét Tab 152496)...`);
            } else {
                this.log(`📅 Đang quét lớp HÔM NAY (${startDateStr})...`);
            }
        } else {
            this.log(`📅 [FORCE SYNC] Đang quét TẤT CẢ CÁC LỚP (Bỏ qua giới hạn ngày)...`);
        }

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
                    ":exchange": { "p2c": { "end_date": endDateStr, "start_date": startDateStr }, "c2p": {} },
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
                    "params": { "end_date": endDateStr, "start_date": startDateStr }
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
                        if (maxPages !== -1 && page >= maxPages) break;
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
                            if (maxPages !== -1 && page >= maxPages) break;
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

    async filterMyClassesAsync(allClasses: any[]) {
        let matchedClasses: any[] = [];
        let unverifiedClasses: any[] = [];
        let myNameLower = this.teacherName.toLowerCase();
        
        for (let c of allClasses) {
            let entity = c.entity || c;
            
            // Các trường có thể chứa tên GV
            const extractNames = (field: any): string => {
                if (!field) return "";
                if (Array.isArray(field)) {
                    return field.map((f: any) => typeof f === 'object' && f !== null ? (f.name || f.teacher_name || f.instructor_name || "") : String(f)).join(", ");
                }
                if (typeof field === 'object' && field !== null) {
                    return field.name || field.teacher_name || field.instructor_name || "";
                }
                return String(field);
            };

            let rawTeachers = "";
            rawTeachers += " " + extractNames(entity[':field_teacher']);
            rawTeachers += " " + extractNames(entity['__main_instructor']);
            rawTeachers += " " + extractNames(entity['__instructor_site_ids']);
            rawTeachers += " " + extractNames(entity.instructor);
            rawTeachers += " " + extractNames(entity.instructor_name);
            rawTeachers += " " + extractNames(entity.teacher_name);
            
            let isMine = false;
            let parts = rawTeachers.split(',').map(s => s.trim()).filter(s => s);
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
            
            // Fallback JSON string
            if (!isMine) {
                let rawEntityString = JSON.stringify(entity).toLowerCase();
                let cleanRawString = this.advancedUnicodeSanitize(rawEntityString);
                let cleanMyName = this.advancedUnicodeSanitize(myNameLower);
                if (cleanRawString.includes(cleanMyName)) {
                    isMine = true;
                }
            }
            
            if (isMine) {
                matchedClasses.push(c);
            } else {
                unverifiedClasses.push(c);
            }
        }
        
        // Giai đoạn 2: SUPER HUNT MAX cho Unverified Classes
        if (unverifiedClasses.length > 0) {
            this.log(`🔍 [HYBRID SUPER HUNT] Có ${unverifiedClasses.length} tiết nghi ngờ có trợ giảng nhưng API giấu tên. Đang kích hoạt Hunt HTML...`);
            let rescueCount = 0;
            const CONCURRENCY = 5;
            
            for (let i = 0; i < unverifiedClasses.length; i += CONCURRENCY) {
                const batch = unverifiedClasses.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(async (c) => {
                    try {
                        let masterKey = c.id || c.class_schedule_slot_id || c.master_key;
                        let exactViewerEndpoint = c.sourceApi ? c.sourceApi.replace('_Model', '_Viewer') : `/${this.tenantId}/appstart/classhub/x35FD2_Viewer`;
                        if (!exactViewerEndpoint.startsWith('/')) {
                            exactViewerEndpoint = `/${this.tenantId}/appstart/classhub/${exactViewerEndpoint}`;
                        }
                        
                        let cvRes = await this.rpcCall(exactViewerEndpoint, { id: String(masterKey) });
                        if (cvRes && cvRes.html) {
                            let cleanHtml = cvRes.html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').toLowerCase();
                            let cleanMyName = this.advancedUnicodeSanitize(myNameLower);
                            if (cleanHtml.includes(cleanMyName)) {
                                matchedClasses.push(c);
                                rescueCount++;
                            }
                        }
                    } catch (e) {
                        // Bỏ qua lỗi mạng
                    }
                }));
            }
            if (rescueCount > 0) {
                this.log(`🎉 [HYBRID SUPER HUNT] Đã CỨU VỚT thành công ${rescueCount} lớp bị API giấu tên!`);
            } else {
                this.log(`[HYBRID SUPER HUNT] Hoàn tất.`);
            }
        }
        
        return matchedClasses;
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
            
            if (resModel && !resModel.data && resModel.html) {
                let entityMatches = resModel.html.match(/data-entity=(['"])(.*?)\1/g);
                if (entityMatches && entityMatches.length > 0) {
                    resModel.data = [];
                    for (let e of entityMatches) {
                        let m = e.match(/data-entity=(['"])(.*?)\1/);
                        if (m) {
                            let str = m[2];
                            str = str.replace(/&quot;/g, '"').replace(/&lbrace;/g, '{').replace(/&lcub;/g, '{')
                                     .replace(/&rbrace;/g, '}').replace(/&rcub;/g, '}').replace(/&lbrack;/g, '[')
                                     .replace(/&rsqb;/g, ']').replace(/&lowbar;/g, '_').replace(/&colon;/g, ':')
                                     .replace(/&comma;/g, ',').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                                     .replace(/&gt;/g, '>');
                            try {
                                resModel.data.push(JSON.parse(str));
                            } catch(err) {}
                        }
                    }
                }
            }

            let instructorId: any = null;
            let instructorUpdateTime = "";
            let instructorBeginState = "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE";
            
            let allCandidateIds: string[] = []; // Chứa danh sách ID cho chiến dịch Multi-Fire

            // CHIẾN DỊCH BẮT SÓNG ID GIÁO VIÊN VÀ UPDATE_TIME (100% THUẦN API - ZERO DOM)
            if (this.myNameLower) {
                const extractStr = (obj: any): string => {
                    let s = "";
                    if (typeof obj === 'string') return obj.toLowerCase() + " ";
                    if (typeof obj === 'object' && obj !== null) {
                        for (let k in obj) s += extractStr(obj[k]);
                    }
                    return s;
                };

                // TIER 1: Strict JSON Field Hunt
                if (resModel && resModel.data && Array.isArray(resModel.data) && resModel.data.length > 0) {
                    let tRec: any = null;
                    let highestScore = 0;
                    let myTokensLen = this.myNameLower.split(/[\s,\.\-]+/).filter((x: any) => x).length;
                    let threshold = Math.ceil(myTokensLen * 0.5);

                    for (let r of resModel.data) {
                        let nameToTest = "";
                        if (r.worker_site_name) nameToTest += r.worker_site_name + " ";
                        if (r.worker_name) nameToTest += r.worker_name + " ";
                        if (r.name) nameToTest += r.name + " ";
                        if (r.instructor_name) nameToTest += r.instructor_name + " ";
                        if (r.instructor && r.instructor.name) nameToTest += r.instructor.name + " ";
                        if (r.instructor && r.instructor.worker_site_name) nameToTest += r.instructor.worker_site_name + " ";
                        
                        nameToTest = this.decodeHtmlEntities(nameToTest); // Giải mã HTML Entities cho các tên phức tạp
                        let score = this.calculate3TierNameScore(nameToTest.toLowerCase(), this.myNameLower);
                        if (score > highestScore && score >= threshold) {
                            highestScore = score;
                            tRec = r;
                        }
                    }
                    if (tRec && tRec.id && String(tRec.id) !== String(masterKey)) {
                        instructorId = String(tRec.id);
                        if (tRec.update_time) instructorUpdateTime = tRec.update_time;
                        if (tRec.status) instructorBeginState = tRec.status;
                        this.log(`  ├─ 🎯 [TIER 1 - JSON Strict] BẮT ĐƯỢC ID: ${instructorId} (UpdateTime: ${instructorUpdateTime})`);
                    }
                }

                // TIER 2: Proximity Index (Khoảng cách không gian RAW String)
                if (!instructorId) {
                    let rawStr = resModel ? (resModel.html || JSON.stringify(resModel)) : "";
                    rawStr = this.decodeHtmlEntities(rawStr); // Giải mã HTML Entity trước khi Regex và so khớp khoảng cách
                    
                    let idMatches = [...rawStr.matchAll(/data-id=\\?["'](\d{6,8})\\?["']/g)];
                    if (idMatches.length === 0) idMatches = [...rawStr.matchAll(/&quot;id&quot;&colon;&quot;(\d{6,8})&quot;/g)];
                    if (idMatches.length === 0) idMatches = [...rawStr.matchAll(/\\?["']id\\?["']\s*:\s*\\?["']?(\d{6,8})\\?["']?/g)];
                    if (idMatches.length === 0) idMatches = [...rawStr.matchAll(/"id"\s*:\s*"?(\d{6,8})"?/g)];

                    let candidateIds = [...new Set(idMatches.map(m => m[1]))].filter(id => id !== String(masterKey));

                    if (candidateIds.length > 0) {
                        let cleanRawStr = this.advancedUnicodeSanitize(rawStr);
                        let cleanMyName = this.advancedUnicodeSanitize(this.myNameLower);
                        
                        let nameIdx = cleanRawStr.indexOf(cleanMyName);
                        // Fallback siêu mạnh: Thử bóc dấu tiếng Việt nếu tìm nguyên bản không thấy
                        if (nameIdx === -1) {
                            let noToneRaw = this.stripVietnameseTones(cleanRawStr);
                            let noToneMyName = this.stripVietnameseTones(cleanMyName);
                            nameIdx = noToneRaw.indexOf(noToneMyName);
                        }

                        if (nameIdx !== -1) {
                            let bestId = candidateIds[0];
                            let minDiff = Infinity;
                            for (let cid of candidateIds) {
                                // Tìm ID trong cleanRawStr để đồng bộ hệ quy chiếu với nameIdx
                                let idx = cleanRawStr.indexOf(cid);
                                let diff = Math.abs(idx - nameIdx);
                                if (diff < minDiff) { minDiff = diff; bestId = cid; }
                            }
                            instructorId = bestId;
                            this.log(`  ├─ 🎯 [TIER 2 - Proximity Index] BẮT ĐƯỢC ID GẦN TÊN "${this.myNameLower}" NHẤT: ${instructorId}`);

                            if (resModel && resModel.data && Array.isArray(resModel.data)) {
                                let exactRec = resModel.data.find((r: any) => String(r.id) === String(instructorId));
                                if (exactRec) {
                                    if (exactRec.update_time) instructorUpdateTime = exactRec.update_time;
                                    if (exactRec.status) instructorBeginState = exactRec.status;
                                }
                            }
                        }
                    }
                }

                // TIER 2.5: SUPER HUNT MAX (Dùng Viewer Gốc của Lớp học nếu x24F76_Model trống/lỗi)
                if (!instructorId) {
                    let exactViewerEndpoint = classItem.sourceApi ? classItem.sourceApi.replace('_Model', '_Viewer') : `/${this.tenantId}/appstart/classhub/x35FD2_Viewer`;
                    let classViewerEndpoints = [
                        exactViewerEndpoint,
                        `/${this.tenantId}/appstart/classhub/x35FD2_Viewer`,
                        `/${this.tenantId}/appstart/classhub/x253B0_Viewer`,
                        `/${this.tenantId}/appstart/classhub/x253B1_Viewer`,
                        `/${this.tenantId}/appstart/classhub/x253B2_Viewer`,
                        `/${this.tenantId}/appstart/classhub/x26D5E_Viewer`,
                        `/${this.tenantId}/appstart/classhub/x2DEAC_Viewer`
                    ];
                    
                    classViewerEndpoints = [...new Set(classViewerEndpoints)];

                    for (let vp of classViewerEndpoints) {
                        if (!vp.startsWith('/')) vp = `/${this.tenantId}/appstart/classhub/${vp}`;
                        
                        try {
                            let resViewer = await this.rpcCall(vp, { id: String(masterKey) });
                            let viewerStr = resViewer ? (resViewer.html || JSON.stringify(resViewer)) : "";
                            viewerStr = this.decodeHtmlEntities(viewerStr);
                            
                            let idMatches = [...viewerStr.matchAll(/data-id=\\?["'](\d{6,8})\\?["']/g)];
                            if (idMatches.length === 0) idMatches = [...viewerStr.matchAll(/data-record=\\?["'](\d{6,8})\\?["']/g)];
                            if (idMatches.length === 0) idMatches = [...viewerStr.matchAll(/name=\\?["']id\\?["']\s+value=\\?["'](\d{6,8})\\?["']/g)];
                            if (idMatches.length === 0) idMatches = [...viewerStr.matchAll(/&quot;id&quot;&colon;&quot;(\d{6,8})&quot;/g)];
                            if (idMatches.length === 0) idMatches = [...viewerStr.matchAll(/\\?["']id\\?["']\s*:\s*\\?["']?(\d{6,8})\\?["']?/g)];
                            if (idMatches.length === 0) idMatches = [...viewerStr.matchAll(/"id"\s*:\s*"?(\d{6,8})"?/g)];

                            let candidateIds = [...new Set(idMatches.map(m => m[1]))].filter(id => id !== String(masterKey));

                            if (candidateIds.length > 0) {
                                let cleanRawStr = this.advancedUnicodeSanitize(viewerStr);
                                let cleanMyName = this.advancedUnicodeSanitize(this.myNameLower);
                                
                                let nameIdx = cleanRawStr.indexOf(cleanMyName);
                                if (nameIdx === -1) {
                                    let noToneRaw = this.stripVietnameseTones(cleanRawStr);
                                    let noToneMyName = this.stripVietnameseTones(cleanMyName);
                                    nameIdx = noToneRaw.indexOf(noToneMyName);
                                }

                                if (nameIdx !== -1) {
                                    let bestId = candidateIds[0];
                                    let minDiff = Infinity;
                                    for (let cid of candidateIds) {
                                        let idx = cleanRawStr.indexOf(cid);
                                        let diff = Math.abs(idx - nameIdx);
                                        if (diff < minDiff) { minDiff = diff; bestId = cid; }
                                    }
                                    instructorId = bestId;
                                    this.log(`  ├─ 🎯 [TIER 2.5 - Khớp Tên] BẮT ĐƯỢC ID TỪ ${vp}: ${instructorId}`);
                                    break;
                                } else {
                                    // Kích hoạt Chiến dịch Multi-Fire: Bắn toàn bộ ID để Ohke tự chặn các ID sai
                                    allCandidateIds = candidateIds;
                                    this.log(`  ├─ ⚠️ [TIER 2.5 - Vét cạn Fallback] KÍCH HOẠT MULTI-FIRE VỚI ${allCandidateIds.length} IDs TỪ ${vp} (Tên GV không khớp chính xác)`);
                                    break;
                                }
                            }
                        } catch (e: any) {
                            // Ignore errors and try the next endpoint
                        }
                    }
                }

                // TIER 3: Fallback ID Entity Gốc
                if (!instructorId && allCandidateIds.length === 0) {
                    let fallbackId = entity.instructor_sheet_id || entity.instructor_attendance_id || entity.instructor_id;
                    if (fallbackId && String(fallbackId) !== String(masterKey)) {
                        instructorId = String(fallbackId);
                        this.log(`  ├─ 🎯 [TIER 3 - Fallback Entity] Khớp bằng ID gốc của lớp: ${instructorId}`);
                        if (resModel && resModel.data && Array.isArray(resModel.data)) {
                            let fbRec = resModel.data.find((r: any) => String(r.id) === String(fallbackId));
                            if (fbRec) {
                                if (fbRec.update_time) instructorUpdateTime = fbRec.update_time;
                                if (fbRec.status) instructorBeginState = fbRec.status;
                            }
                        }
                    }
                }
            }

            if (!instructorId && allCandidateIds.length === 0) {
                this.log(`  ├─ ❌ [CRITICAL ERROR] Không xác định được ID giáo viên chuẩn (So khớp tên 3-Tier thất bại). Tạm dừng điểm danh lớp này!`);
                return { success: false, class: masterKey, error: "Không tìm thấy ID giáo viên chuẩn" };
            }

            if (instructorId) {
                allCandidateIds = [String(instructorId)];
            }

            let finalInstructorId: any = null;
            let finalInstructorUpdateTime = "";
            let finalInstructorBeginState = "";
            let isTeacherDone = false;

            for (let testId of allCandidateIds) {
                let tUpdateTime = instructorUpdateTime;
                let tBeginState = instructorBeginState || "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE";

                // Gọi Viewer để xác nhận chính xác update_time và trạng thái hiện tại (Chống lỗi OCC)
                try {
                    let tViewerRes = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x24F76_Viewer`, { id: String(testId) });
                    if (tViewerRes && tViewerRes.data && tViewerRes.data.update_time) {
                        tUpdateTime = tViewerRes.data.update_time;
                        if (tViewerRes.data.status) tBeginState = tViewerRes.data.status;
                    } else if (tViewerRes && tViewerRes.html) {
                        let mTime = tViewerRes.html.match(/(?:data-update-time|update_time)="([^"]+)"/i) || tViewerRes.html.match(/name="update_time"\s+value="([^"]+)"/i);
                        if (mTime && mTime[1]) tUpdateTime = mTime[1];
                        let mStatus = tViewerRes.html.match(/status="([^"]+)"/i) || tViewerRes.html.match(/name="status"\s+value="([^"]+)"/i);
                        if (mStatus && mStatus[1]) tBeginState = mStatus[1];
                    }
                } catch (e: any) {}

                if (!tBeginState || !tBeginState.includes("INSTRUCTOR_ATTENDANCE_STATUS_")) {
                    tBeginState = "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE";
                }

                let currentIsDone = tBeginState.includes('ACCEPTED') || tBeginState.includes('PRESENT') || tBeginState.includes('FULL_ATTENDANCE');

                // BƯỚC 1: Tick Giáo viên Có mặt (Thử nghiệm Permission)
                this.log(`⏳ [Multi-Fire] Đang thử cấp quyền trên ID: ${testId}...`);
                let payloadTeacherTick = {
                    id: parseInt(testId),
                    field_name: "status",
                    begin_state: tBeginState,
                    to_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
                    end_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
                    is_reversal: 0,
                    update_time: tUpdateTime,
                    mode: "V",
                    entity: { id: parseInt(testId), status: tBeginState },
                    env: { id: parseInt(testId), master_key: String(masterKey), father_master_key: String(masterKey) }
                };

                let res1 = await this.rpcCall(`/${this.tenantId}/appstart/classhub/x24F76_jsonPostTransition`, payloadTeacherTick);
                
                if (res1 && res1.type === "success") {
                    this.log(`  ├─ ✔️ TRÚNG ĐÍCH! Tick Có mặt thành công cho quyền ID: ${testId}`);
                    finalInstructorId = testId;
                    finalInstructorUpdateTime = res1.data?.update_time || tUpdateTime;
                    finalInstructorBeginState = "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT";
                    isTeacherDone = true;
                    break; // Đã tìm thấy ID đúng của user, thoát vòng lặp!
                } else if (res1 && res1.code && (res1.code.includes("DENIED") || res1.code.includes("READ_ONLY"))) {
                    this.log(`  ├─ ⚠️ ID ${testId} bị từ chối (Không phải quyền của bạn). Bỏ qua...`);
                } else if (res1 && res1.code && res1.code.includes("INVALID_TRANSITION")) {
                    this.log(`  ├─ ✔️ ID ${testId} TRÚNG ĐÍCH! (Đã điểm danh trước đó)`);
                    finalInstructorId = testId;
                    finalInstructorUpdateTime = tUpdateTime;
                    finalInstructorBeginState = tBeginState;
                    isTeacherDone = true;
                    break;
                } else {
                    this.log(`  ├─ ⚠️ Lỗi không xác định khi tick ID ${testId}:`, res1);
                }
            }

            if (!finalInstructorId) {
                this.log(`  ├─ ❌ [CRITICAL ERROR] Tất cả ID dự phòng đều không thuộc quyền điểm danh của bạn!`);
                return { success: false, class: masterKey, error: "Không tìm thấy ID giáo viên chuẩn (Multi-Fire thất bại)" };
            }

            instructorId = finalInstructorId;
            instructorBeginState = finalInstructorBeginState;
            instructorUpdateTime = finalInstructorUpdateTime;

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
            await new Promise((r: any) => setTimeout(r, 50));

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



