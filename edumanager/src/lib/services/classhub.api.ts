import crypto from 'crypto';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import {
    decodeOhkeJSON,
    decodeOhkeText
} from './classhub/text';
import {
    addDaysYmdVN,
    getClassUnlockInfo,
    type UnlockInfo
} from './classhub/time';
import {
    getClassKey,
    getClassLabel,
    getMyRole,
    isDoneStatus,
    isExcludedByTeacherName,
    parseIdList,
    readWorkerFromHtml,
    recordBelongsToMe,
    type TeacherIdentity,
    type TeacherRole
} from './classhub/identity';
import {
    describeTransition,
    findViewerButtonAction,
    isLoginPage,
    isTeacherRecord,
    modelNameForSubform,
    parseEntities,
    parseViewerJson,
    STUDENT_DELETE_ATTENDANCE_FALLBACK,
    STUDENT_SHEET_DOMAIN,
    TEACHER_LIST_DOMAIN,
    TEACHER_SHEET_DOMAIN,
    transitionReached
} from './classhub/viewer';
import {
    CATCH_UP_DAYS,
    classifyClasses,
    type ClassifyResult,
    type ClasshubUserState,
    createEmptyState,
    describeClassify,
    markClassCompletedInState,
    MAX_FAILS_PER_DAY,
    pruneState,
    recordClassFailureInState,
    runPool,
    unmarkClassCompletedInState
} from './classhub/state';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface ScanOptions {
    daysBack?: number;
    daysAhead?: number;
    forceSync?: boolean;
    maxPages?: number;
    singleFieldSubformId?: number | string | null;
}

export interface SubmitAttendanceOptions {
    dryRun?: boolean;
}

export interface SubmitAttendanceResult {
    success: boolean;
    skipped?: boolean;
    dryRun?: boolean;
    status: 'success' | 'skipped' | 'done' | 'failed' | 'dry_run';
    class: string;
    label?: string;
    role?: TeacherRole;
    isCatchUp?: boolean;
    reason?: string;
    error?: string;
    durationMs?: number;
    plan?: {
        role: TeacherRole;
        teacherRecordIds: string[];
        pendingTickIds: string[];
        willUnlockTeacherSheet: boolean;
        willLockTeacherSheet: boolean;
        willLockStudentSheet: boolean;
    };
}

export class ClasshubAPI {
    tenantId: string;
    teacherId: string;
    teacherName: string;
    myNameLower: string;
    baseUrl: string;
    cookieString: string;
    onLog: ((msg: string) => void) | null;
    jar: CookieJar;
    client: any;
    logBuffer: string[];
    state: ClasshubUserState;
    private cachedHomeHtml: string | null = null;

    constructor(
        tenantId = '61892',
        teacherName = '',
        cookieString = '',
        onLog: ((msg: string) => void) | null = null,
        initialState?: Partial<ClasshubUserState> | null
    ) {
        this.tenantId = tenantId;
        this.teacherId = '';
        this.teacherName = teacherName;
        this.myNameLower = teacherName ? teacherName.toLowerCase() : '';
        this.baseUrl = 'https://idcloud.vn';
        this.cookieString = cookieString;
        this.onLog = onLog;
        this.logBuffer = [];
        this.state = pruneState(initialState || createEmptyState());

        this.jar = new CookieJar();

        if (cookieString) {
            const cookies = cookieString.split(/,(?=\s*[A-Za-z0-9_-]+=)|;/);
            for (const c of cookies) {
                try {
                    if (c.trim()) this.jar.setCookieSync(c.trim(), this.baseUrl);
                } catch {
                    // Ignore malformed cookie fragment
                }
            }
        }

        this.client = wrapper(
            axios.create({
                baseURL: this.baseUrl,
                jar: this.jar,
                withCredentials: true,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
        );
    }

    getMyIdentity(): TeacherIdentity {
        return { id: this.teacherId, name: this.teacherName };
    }

    log(...args: any[]) {
        const msg = args.map((a: any) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
        this.logBuffer.push(msg);
        if (this.onLog) {
            this.onLog(msg);
        } else {
            console.log(msg);
        }
    }

    normalizeEndpoint(endpoint: string): string {
        if (!endpoint) return '';
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
        const clean = endpoint.replace(/^\/+/, '');
        if (clean.startsWith('appstart/')) return `/${this.tenantId}/${clean}`;
        if (clean.startsWith(`${this.tenantId}/`)) return `/${clean}`;
        return `/${this.tenantId}/appstart/classhub/${clean}`;
    }

    async clientGet(url: string): Promise<{ data?: string; status?: number; responseUrl?: string; error?: string }> {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        try {
            const res = await this.client.get(fullUrl, { responseType: 'text' });
            const responseUrl = res.request?.res?.responseUrl || fullUrl;
            const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            return { data: text, status: res.status, responseUrl };
        } catch (e: any) {
            return { error: e.message, status: e.response?.status };
        }
    }

    /**
     * Gửi RPC tới Ohke Server (chuẩn 3.8.11 rpcCallHeadlessV33, phát hiện SESSION_EXPIRED)
     */
    async rpcCall(endpoint: string, payload: any, extraHeaders?: Record<string, string>): Promise<any> {
        const normalized = this.normalizeEndpoint(endpoint);
        const fullUrl = normalized.startsWith('http') ? normalized : `${this.baseUrl}${normalized}`;
        try {
            const res = await this.client.post(fullUrl, payload || {}, {
                headers: {
                    'Content-Type': 'application/json',
                    'ohke-ajax': '1',
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Mozilla/5.0',
                    ...(extraHeaders || {})
                },
                responseType: 'text',
                validateStatus: () => true
            });

            const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
            const responseUrl = res.request?.res?.responseUrl || fullUrl;

            if (res.status === 401 || res.status === 403 || isLoginPage(responseUrl, text)) {
                return {
                    status: 'error',
                    type: 'error',
                    code: 'SESSION_EXPIRED',
                    error: 'Phiên đăng nhập đã hết hạn'
                };
            }

            if (res.status < 200 || res.status >= 300) {
                return {
                    status: 'error',
                    type: 'error',
                    code: `HTTP_${res.status}`,
                    error: `HTTP ${res.status}`
                };
            }

            if (typeof res.data === 'object' && res.data !== null) return res.data;
            try {
                return JSON.parse(text);
            } catch {
                return { html: text, isRawHtml: true };
            }
        } catch (err: any) {
            return { status: 'error', type: 'error', error: err.message };
        }
    }

    async login(loginUrl: string, username: string, password: string) {
        try {
            this.log(`🔑 Đang đăng nhập vào: ${loginUrl}`);
            let postUrl = loginUrl.replace(/\/login\/?$/, '/jsonPostSignIn');
            if (postUrl === loginUrl && !postUrl.endsWith('/jsonPostSignIn')) postUrl += '/jsonPostSignIn';

            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            const payload = {
                'login-form': {
                    username,
                    password: hashedPassword,
                    remember_me: '1',
                    __password: 'LAa0S'
                }
            };

            const res = await this.client.post(postUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'ohke-ajax': '1',
                    Accept: 'application/json, text/plain, */*'
                }
            });

            const cookies = await this.jar.getCookies(this.baseUrl);
            if (res.data && res.data.type === 'success') {
                this.log(`✅ Đăng nhập thành công! Đã lấy được ${cookies.length} Cookies.`);
                return { success: true };
            } else {
                this.log(`⚠️ Đăng nhập thất bại:`, res.data);
                return { success: false, error: res.data?.error || 'Sai tài khoản hoặc mật khẩu' };
            }
        } catch (err: any) {
            this.log('❌ Lỗi Đăng nhập:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Nhận diện danh tính Giáo viên (ID + Tên) từ biến Ohke.worker (chuẩn 3.8.11 waitForIdentityV33).
     * Tuyệt đối không đoán/gán cứng tên: sai danh tính = điểm danh nhầm người khác.
     */
    async autoHuntTeacherName(maxAttempts = 3): Promise<{ success: boolean; id?: string; name?: string; error?: string }> {
        if (this.teacherId && this.teacherName) {
            return { success: true, id: this.teacherId, name: this.teacherName };
        }

        this.log('🔍 Đang xác định danh tính Giáo viên (ID + Họ tên) từ Ohke.worker...');
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const res = await this.clientGet(`/${this.tenantId}/appstart/classhub/`);
                if (res.status === 401 || res.status === 403 || isLoginPage(res.responseUrl, res.data)) {
                    const errMsg = 'Phiên đăng nhập ClassHub đã hết hạn (SESSION_EXPIRED).';
                    this.log(`❌ ${errMsg}`);
                    return { success: false, error: errMsg };
                }

                if (res.data) {
                    const found = readWorkerFromHtml(res.data);
                    if (found && (found.id || found.name)) {
                        this.teacherId = found.id;
                        this.teacherName = found.name;
                        this.myNameLower = found.name.toLowerCase();
                        this.cachedHomeHtml = res.data;
                        this.log(`🪪 Giáo viên: [${this.teacherId || '?'}] ${this.teacherName}`);
                        return { success: true, id: this.teacherId, name: this.teacherName };
                    }
                }
            } catch (e: any) {
                this.log(`⚠️ Lần thử ${attempt + 1}/${maxAttempts} lỗi khi lấy danh tính: ${e.message}`);
            }

            if (attempt < maxAttempts - 1) {
                await delay(800);
            }
        }

        this.log('❌ Không xác định được danh tính Giáo viên từ Ohke.worker.');
        return { success: false, error: 'Không xác định được danh tính giáo viên đang đăng nhập.' };
    }

    async requireIdentity(): Promise<TeacherIdentity> {
        const res = await this.autoHuntTeacherName(3);
        const identity = this.getMyIdentity();
        if (!res.success || (!identity.id && !identity.name)) {
            throw new Error(res.error || 'Không xác định được danh tính giáo viên đang đăng nhập.');
        }
        return identity;
    }

    /**
     * Quét danh sách lớp học qua đường hầm API (port nguyên bản OhkeHeadlessScanner.scanAllClasses 3.8.11)
     */
    async scanAllClasses(optionsOrForceSync: boolean | ScanOptions = false): Promise<any[]> {
        const opts: ScanOptions =
            typeof optionsOrForceSync === 'boolean'
                ? {
                      forceSync: optionsOrForceSync,
                      daysBack: optionsOrForceSync ? 30 : CATCH_UP_DAYS,
                      daysAhead: optionsOrForceSync ? 14 : 6
                  }
                : {
                      forceSync: Boolean(optionsOrForceSync.forceSync),
                      daysBack: optionsOrForceSync.daysBack ?? (optionsOrForceSync.forceSync ? 30 : CATCH_UP_DAYS),
                      daysAhead: optionsOrForceSync.daysAhead ?? 6,
                      singleFieldSubformId: optionsOrForceSync.singleFieldSubformId ?? null
                  };

        const daysBack = opts.daysBack ?? CATCH_UP_DAYS;
        const daysAhead = opts.daysAhead ?? 6;
        const singleFieldSubformId = opts.singleFieldSubformId ?? null;

        this.log(`🚀 [API SCANNER 3.8.11] Bắt đầu quét Thuần API (lùi ${daysBack} ngày -> tiến ${daysAhead} ngày)...`);

        const sessionExpired = () =>
            Object.assign(new Error('Phiên đăng nhập đã hết hạn. Hãy kiểm tra lại kết nối ClassHub.'), {
                fatal: true,
                code: 'SESSION_EXPIRED'
            });

        const baseUrl = `/${this.tenantId}/appstart/classhub/`;
        let html = '';

        if (this.cachedHomeHtml) {
            html = this.cachedHomeHtml;
            this.cachedHomeHtml = null; // Chỉ tái sử dụng 1 lần trong cùng phiên quét
        } else {
            const res = await this.clientGet(baseUrl);
            if (res.error || !res.data) {
                throw new Error(`Không tải được trang ClassHub (${res.error || `HTTP ${res.status}`}).`);
            }
            if (res.status === 401 || res.status === 403 || isLoginPage(res.responseUrl, res.data)) {
                throw sessionExpired();
            }
            html = res.data;
        }

        // Nếu chưa nạp danh tính GV thì đọc luôn từ HTML trang chủ
        if (!this.teacherId) {
            const worker = readWorkerFromHtml(html);
            if (worker) {
                this.teacherId = worker.id;
                this.teacherName = worker.name;
                this.myNameLower = worker.name.toLowerCase();
                this.log(`🪪 Giáo viên: [${this.teacherId}] ${this.teacherName}`);
            }
        }

        // Tìm tất cả cặp (ohke_prefix, :field_subform_id) bằng Regex/JSON (thuần API)
        const tabs: Array<{ prefix: string; id: number | string }> = [];
        const pushTab = (json: any) => {
            if (json && json.ohke_prefix && json[':field_subform_id']) {
                tabs.push({ prefix: json.ohke_prefix, id: json[':field_subform_id'] });
            }
        };

        // 1. Trong <script type="application/json">...</script>
        const scriptRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let sm: RegExpExecArray | null;
        while ((sm = scriptRe.exec(html)) !== null) {
            try {
                pushTab(JSON.parse(sm[1]));
            } catch {
                // Ignore non-tab JSON script
            }
        }

        // 2. Trong thuộc tính data-env="..."
        const envRe = /data-env=(['"])(.*?)\1/g;
        let em: RegExpExecArray | null;
        while ((em = envRe.exec(html)) !== null) {
            try {
                pushTab(JSON.parse(decodeOhkeJSON(em[2])));
            } catch {
                // Ignore malformed data-env
            }
        }

        // Lọc trùng lặp
        let uniqueTabs: Array<{ prefix: string; id: number | string }> = [];
        const seenIds = new Set<string>();
        for (const t of tabs) {
            const idStr = String(t.id);
            if (!seenIds.has(idStr)) {
                seenIds.add(idStr);
                uniqueTabs.push(t);
            }
        }

        if (singleFieldSubformId) {
            const matched = uniqueTabs.find(t => String(t.id) === String(singleFieldSubformId));
            if (matched) uniqueTabs = [matched];
            else {
                uniqueTabs = [
                    {
                        id: singleFieldSubformId,
                        prefix: uniqueTabs.length > 0 ? uniqueTabs[0].prefix : 'field-egoacw7rbi'
                    }
                ];
            }
        }

        // Chỉ giữ các tab là DANH SÁCH: trang có dùng "<mã>_Model" (3.8.11)
        if (!singleFieldSubformId) {
            const listTabs = uniqueTabs.filter(t => html.includes(modelNameForSubform(t.id)));
            this.log(
                `🔍 [API SCANNER] ${listTabs.length}/${uniqueTabs.length} tab là danh sách: ${listTabs
                    .map(t => `${t.id}->${modelNameForSubform(t.id)}`)
                    .join(', ')}`
            );
            if (listTabs.length > 0) uniqueTabs = listTabs;
        }

        if (uniqueTabs.length === 0) {
            throw new Error(
                'Không đọc được danh sách lớp từ trang ClassHub (giao diện thay đổi hoặc phiên đăng nhập hết hạn).'
            );
        }

        const startDateStr = addDaysYmdVN(-daysBack);
        const endDateStr = addDaysYmdVN(daysAhead);
        this.log(`📅 Dải ngày quét (VN): ${startDateStr} -> ${endDateStr}`);

        const allItems: any[] = [];
        const allFoundIds = new Set<string>();
        const failedTabs: string[] = [];

        for (const tab of uniqueTabs) {
            try {
                const fieldSubformId = tab.id;
                const ohkePrefix = tab.prefix;
                let dataQueryId: string | null = null;
                let tabItems: any[] = [];
                let page = 0;

                // Endpoint của Tab = "x" + hex(:field_subform_id) + "_Model" (3.8.11)
                const modelName = modelNameForSubform(fieldSubformId);
                const apiUrl = `/${this.tenantId}/appstart/classhub/${modelName}`;

                const regexEntity = /data-entity=(['"])([\s\S]*?)\1/g;

                while (true) {
                    const payload = {
                        ':exchange': { p2c: { end_date: endDateStr, start_date: startDateStr }, c2p: {} },
                        ':field_subform_id': parseInt(String(fieldSubformId), 10),
                        ':master_readonly': null,
                        ':referrer': `${this.baseUrl}${baseUrl}`,
                        arguments: [],
                        data_query_id: dataQueryId,
                        father_master_key: null,
                        master_key: null,
                        master_object_class_code: '',
                        master_object_class_name: '',
                        media: 'screen',
                        ohke_prefix: ohkePrefix,
                        page,
                        params: { end_date: endDateStr, start_date: startDateStr }
                    };

                    const targetEndpoint =
                        page === 0 ? apiUrl : `${apiUrl}?__ajax_page=${page}&page=${page}&p=${page}`;

                    const res = await this.rpcCall(targetEndpoint, payload);
                    if (res?.code === 'SESSION_EXPIRED') throw sessionExpired();
                    if (res?.status === 'error' && res?.code?.startsWith('HTTP_')) {
                        throw new Error(`API ${apiUrl} lỗi ${res.error} (Tab ${fieldSubformId}, trang ${page}).`);
                    }

                    let pageItems: any[] = [];
                    let htmlStr = '';

                    if (res && !res.isRawHtml && typeof res === 'object') {
                        if (page === 0 && res.data_query_id) {
                            dataQueryId = res.data_query_id;
                        }

                        const extractArray = (obj: any): any[] => {
                            if (Array.isArray(obj)) {
                                if (
                                    obj.length > 0 &&
                                    (obj[0]?.class_schedule_slot_id || obj[0]?.class_hour_code || obj[0]?.study_class_id)
                                ) {
                                    return obj;
                                }
                                for (let i = 0; i < obj.length; i++) {
                                    const found = extractArray(obj[i]);
                                    if (found.length > 0) return found;
                                }
                            } else if (typeof obj === 'object' && obj !== null) {
                                for (const key of Object.keys(obj)) {
                                    if (key === 'html') continue;
                                    const found = extractArray(obj[key]);
                                    if (found.length > 0) return found;
                                }
                            }
                            return [];
                        };

                        pageItems = extractArray(res);
                        if (pageItems.length === 0 && typeof res.html === 'string') {
                            htmlStr = res.html;
                        }
                    } else if (res?.html) {
                        htmlStr = res.html;
                    }

                    if (htmlStr) {
                        regexEntity.lastIndex = 0;
                        let match: RegExpExecArray | null;
                        while ((match = regexEntity.exec(htmlStr)) !== null) {
                            try {
                                const decodedStr = decodeOhkeJSON(match[2]);
                                if (
                                    !decodedStr.includes('class_schedule_slot_id') &&
                                    !decodedStr.includes('class_hour_code') &&
                                    !decodedStr.includes('master_key') &&
                                    !decodedStr.includes('study_class_id')
                                ) {
                                    continue;
                                }
                                const subEnt = JSON.parse(decodedStr);
                                pageItems.push(subEnt);
                            } catch {
                                // Ignore broken entity
                            }
                        }
                    }

                    if (pageItems.length === 0) {
                        break;
                    }

                    // Phát hiện lặp lại (per tab) chuẩn 3.8.11
                    let isDuplicate = false;
                    if (pageItems.length > 0 && tabItems.length > 0) {
                        const firstItemKey =
                            pageItems[0].class_schedule_slot_id ||
                            pageItems[0].master_key ||
                            pageItems[0].id ||
                            pageItems[0].class_hour_code;
                        const existingItem = tabItems.find(
                            i =>
                                (i.class_schedule_slot_id || i.master_key || i.id || i.class_hour_code) ===
                                firstItemKey
                        );
                        if (existingItem) isDuplicate = true;
                    }

                    if (isDuplicate) {
                        this.log(
                            `✅ [API SCANNER] Dừng lặp: Phát hiện dữ liệu trang ${page} trùng lặp ở Tab ${fieldSubformId}.`
                        );
                        break;
                    }

                    this.log(
                        `✅ [API SCANNER] [Tab ${fieldSubformId} - Trang ${page}] Thu được ${pageItems.length} tiết học.`
                    );
                    tabItems = tabItems.concat(pageItems);

                    for (const item of pageItems) {
                        const masterKey = getClassKey(item);
                        const dedupeKey = String(
                            masterKey || item.class_schedule_slot_id || item.master_key || item.class_hour_code
                        );
                        if (dedupeKey && !allFoundIds.has(dedupeKey)) {
                            allFoundIds.add(dedupeKey);
                            item.sourceApi = modelName;
                            allItems.push({
                                id: masterKey || dedupeKey,
                                slotId: String(item.class_schedule_slot_id || dedupeKey),
                                sourceApi: modelName,
                                entity: item,
                                originalData: item
                            });
                        }
                    }

                    page++;
                    if (page > 30) {
                        this.log('⚠️ [API SCANNER] Đạt giới hạn 30 trang. Dừng an toàn.');
                        break;
                    }
                    await delay(150);
                }
            } catch (tabError: any) {
                if (tabError.fatal) throw tabError;
                failedTabs.push(`Tab ${tab.id}: ${tabError.message}`);
                this.log(`⚠️ [API SCANNER] Bỏ qua Tab ${tab.id}: ${tabError.message}`);
            }
        }

        if (failedTabs.length === uniqueTabs.length) {
            throw new Error(`Không quét được tab lớp nào (${failedTabs.length} tab lỗi). ${failedTabs[0] || ''}`);
        }

        this.log(`🎉 [API SCANNER RESULT] Tổng thu hoạch: ${allItems.length} tiết học!`);
        return allItems;
    }

    /**
     * Phân loại các tiết học theo chuẩn 3.8.11 (classifyClassesV33)
     */
    classifyAllClasses(
        apiItems: any[],
        bufferMinutes = 5,
        options: { minDateYmd?: string | null; ignoreBlock?: boolean; ignoreCompletedCache?: boolean } = {}
    ): ClassifyResult {
        const identity = this.getMyIdentity();
        const result = classifyClasses(apiItems, identity, this.state, bufferMinutes, options);
        this.log(`📄 Phân loại 3.8.11: ${describeClassify(result)}.`);
        return result;
    }

    getClassUnlockInfo(entityData: any, bufferMinutes = 5): UnlockInfo {
        return getClassUnlockInfo(entityData, bufferMinutes);
    }

    /**
     * Tương thích ngược: trả về danh sách các tiết đã mở khoá và chưa hoàn tất
     */
    getEligibleClasses(allClasses: any[]): any[] {
        const identity = this.getMyIdentity();
        if (identity.id || identity.name) {
            const classified = classifyClasses(allClasses, identity, this.state, 5, { minDateYmd: null });
            return classified.ready;
        }
        return allClasses.filter(c => {
            const entity = c.entity || c;
            const status = String(entity.attendance_sheet_status || entity.status || '').toUpperCase();
            if (status.includes('ACCEPTED')) return false;
            return getClassUnlockInfo(entity, 5).isSafe;
        });
    }

    /**
     * Tương thích ngược: lọc lớp của giáo viên bằng ID + tên chính xác chuẩn 3.8.11 (thay thế hoàn toàn 3-Tier mờ cũ)
     */
    filterMyClasses(allClasses: any[]): any[] {
        const identity = this.getMyIdentity();
        return allClasses.filter(c => {
            const entity = c.entity || c;
            const role = getMyRole(entity, identity.id);
            if (role === 'none') return false;
            if (role === 'unknown' && isExcludedByTeacherName(entity, identity)) return false;
            return true;
        });
    }

    async filterMyClassesAsync(allClasses: any[]): Promise<any[]> {
        return this.filterMyClasses(allClasses);
    }

    /**
     * Gọi Viewer của 1 sổ điểm danh với payload GIỐNG TRÌNH DUYỆT (chuẩn 3.8.11 rpcSheetViewerV33):
     * không có "id", mà là master_key + ":field_subform_id" = số hiệu form (= hex trong mã endpoint).
     * Dự phòng: nếu không đọc được dữ liệu sổ thì thử kiểu cũ {id}.
     */
    async rpcSheetViewer(domain: string, masterKey: string | number): Promise<any> {
        const subformId = parseInt(String(domain).replace(/^x|_$/g, ''), 16);
        const payload = {
            ':field_subform_id': subformId,
            ':master_readonly': 0,
            ':referrer': `${this.baseUrl}/${this.tenantId}/appstart/classhub/`,
            arguments: [],
            father_master_key: String(masterKey),
            master_key: String(masterKey),
            master_object_class_code: 'DOCTYPE-7004',
            master_object_class_name: 'study_student_attendance_sheet',
            media: 'screen',
            params: {}
        };
        const res = await this.rpcCall(domain + 'Viewer', payload);
        if (!(res && res.html && parseViewerJson(res.html, 'data').length > 0)) {
            const legacy = await this.rpcCall(domain + 'Viewer', { id: String(masterKey) });
            if (legacy && legacy.html && parseViewerJson(legacy.html, 'data').length > 0) return legacy;
        }
        return res;
    }

    /**
     * Tìm bản ghi điểm danh GV của 1 tiết chuẩn 3.8.11 (huntTeacherRecordsV33):
     *   1. x24F76_Model {master_key, father_master_key, master_object_class_*, id:null}
     *   2. "Mở lớp" bằng các Viewer {id}: <sourceApi>_Viewer, x35FD2_Viewer, x253B0_Viewer
     *   3. Chưa có bản ghi -> chờ 800ms thử lại (tối đa 3 lần) = "COLD SESSION RETRY"
     */
    async huntTeacherRecords(
        masterKey: string | number,
        sourceApi?: string,
        onRetry?: (attempt: number) => void
    ): Promise<{ records: any[]; classUpdateTime: string }> {
        let records: any[] = [];
        let classUpdateTime = '';

        const addRecords = (arr: any[]) => {
            for (const r of arr || []) {
                if (!r || !r.id || String(r.id) === String(masterKey) || !isTeacherRecord(r)) continue;
                if (!records.some(x => String(x.id) === String(r.id))) records.push(r);
            }
        };

        const readResponse = (res: any) => {
            if (!res) return;
            if (res.data && typeof res.data === 'object') {
                if (Array.isArray(res.data)) {
                    addRecords(res.data);
                } else {
                    if (res.data.update_time && String(res.data.id || masterKey) === String(masterKey)) {
                        classUpdateTime = res.data.update_time;
                    }
                    if (Array.isArray(res.data.co_teachers)) addRecords(res.data.co_teachers);
                }
            }
            if (res.html) {
                const sheet = parseViewerJson(res.html, 'data').find(d => d && String(d.id) === String(masterKey));
                if (sheet && sheet.update_time) classUpdateTime = sheet.update_time;
                addRecords(parseEntities(res.html));
            }
        };

        const fetchPayload = {
            master_key: String(masterKey),
            father_master_key: String(masterKey),
            master_object_class_name: 'study_student_attendance_sheet',
            master_object_class_code: 'DOCTYPE-7004',
            id: null
        };

        const viewerEndpoints = [
            ...new Set(
                [sourceApi ? sourceApi.replace('_Model', '_Viewer') : null, 'x35FD2_Viewer', 'x253B0_Viewer'].filter(
                    Boolean
                ) as string[]
            )
        ];

        const MAX_HUNT_RETRIES = 2;
        for (let attempt = 0; attempt <= MAX_HUNT_RETRIES; attempt++) {
            records = [];
            try {
                readResponse(await this.rpcCall(TEACHER_LIST_DOMAIN + 'Model', fetchPayload));
            } catch {
                // Ignore network glitch
            }
            for (const vEndpoint of viewerEndpoints) {
                try {
                    readResponse(await this.rpcCall(vEndpoint, { id: String(masterKey) }));
                } catch {
                    // Ignore network glitch
                }
            }
            if (records.length > 0) break;
            if (attempt < MAX_HUNT_RETRIES) {
                if (onRetry) onRetry(attempt + 1);
                await delay(800);
            }
        }

        return { records, classUpdateTime };
    }

    /**
     * Điểm danh 1 tiết chuẩn 3.8.11 (submitAttendanceFlowV33) + hỗ trợ chế độ Dry-Run:
     *   - Nhận diện bản ghi của mình theo ID/tên đã giải mã Unicode (không dùng Multi-Fire)
     *   - Vai trò GV chính/phụ lấy từ main_instructor/assistant_instructors
     *   - GV phụ: nếu sổ GV đã khoá mà mình chưa tick -> mở khoá, tick, rồi khoá lại; không chốt sổ HS
     *   - GV chính: sổ GV đã khoá nhưng sổ HS chưa khoá thì vẫn chốt sổ HS
     *   - Kiểm tra chéo bằng API x35FD2_Viewer; tick thất bại thì KHÔNG ghi nhận hoàn tất; tự bắn lại 1 lần sau 1.5s
     */
    async submitAttendanceFlow(
        classItem: any,
        isRetry = false,
        options: SubmitAttendanceOptions = {}
    ): Promise<SubmitAttendanceResult> {
        const entity = classItem?.entity || classItem || {};
        const currentEntity = { ...entity };
        const masterKey = String(getClassKey(entity) || classItem?.id || '');
        let classUpdateTime = entity.update_time || '';
        const startTime = Date.now();

        const classHourCode = entity.class_hour_code || '';
        const isLessonZero = classHourCode === 'H0' || String(classHourCode).startsWith('H0.');
        const label = getClassLabel(entity) || String(masterKey);
        const classTag = [entity.class_name || entity.student_class_name, classHourCode].filter(Boolean).join('·') || masterKey;
        const clog = (msg: string) => this.log(`[${classTag}] ${msg}`);

        const unlockInfo = getClassUnlockInfo(entity, 5);
        if (!unlockInfo.isSafe) {
            clog(`⏳ Tiết chưa đến giờ mở khoá (${unlockInfo.timeString}). Bỏ qua.`);
            return {
                success: true,
                skipped: true,
                status: 'skipped',
                class: masterKey,
                label,
                reason: `Chưa đến giờ (Mở lúc ${unlockInfo.timeString})`
            };
        }

        const myIdentity = this.getMyIdentity();
        const myName = myIdentity.name;
        const myId = myIdentity.id;
        if (!myName && !myId) {
            clog(`❌ Không xác định được danh tính giáo viên đang đăng nhập. Dừng xử lý tiết [${masterKey}] để tránh điểm danh nhầm người.`);
            return {
                success: false,
                status: 'failed',
                class: masterKey,
                label,
                error: 'Không xác định được danh tính giáo viên đang đăng nhập'
            };
        }

        try {
            const myRole = getMyRole(entity, myId);
            const instructorIds = parseIdList(entity.instructor_site_ids);
            if (myRole === 'none' || (myRole === 'unknown' && isExcludedByTeacherName(entity, myIdentity))) {
                clog(`ℹ️ Tiết không có bạn trong danh sách GV (${instructorIds.join(', ') || 'khác tên'}). Bỏ qua.`);
                markClassCompletedInState(this.state, masterKey);
                return {
                    success: true,
                    skipped: true,
                    status: 'skipped',
                    class: masterKey,
                    label,
                    role: 'none',
                    reason: 'Tiết không có bạn trong danh sách GV'
                };
            }

            clog(`⚡ Đang xử lý điểm danh tiết [${classHourCode || masterKey}]${options.dryRun ? ' (CHẾ ĐỘ CHẠY THỬ DRY-RUN)' : ''}...`);

            // ---- 1. TÌM BẢN GHI GV (chuẩn 3.8.11) ----
            const hunt = await this.huntTeacherRecords(masterKey, classItem?.sourceApi, n =>
                clog(`🔄 [COLD SESSION RETRY] Chưa bắt được bản ghi GV nào. Chờ 800ms rồi thử lại (lần ${n})...`)
            );
            if (hunt.classUpdateTime) {
                classUpdateTime = hunt.classUpdateTime;
                currentEntity.update_time = classUpdateTime;
            }

            const allTeachers = hunt.records.map(rec => ({
                rec,
                id: String(rec.id),
                update_time: rec.update_time || '',
                rawStatus: rec.status || '',
                status: rec.status || 'INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE',
                isMine: recordBelongsToMe(rec, '', myIdentity)
            }));

            let targetTeachersToTick = allTeachers.filter(t => t.isMine);
            const teacherStatusRecords = allTeachers.filter(t => /^INSTRUCTOR_ATTENDANCE_STATUS_/i.test(t.rawStatus));
            // Lớp chỉ có đúng 1 GV là mình + chỉ có 1 bản ghi GV -> chắc chắn là của mình (3.8.11 L1007)
            if (
                targetTeachersToTick.length === 0 &&
                instructorIds.length === 1 &&
                instructorIds[0] === String(myId) &&
                teacherStatusRecords.length === 1
            ) {
                targetTeachersToTick = teacherStatusRecords;
            }

            if (targetTeachersToTick.length > 0) {
                clog(
                    `🎯 Đã nhận diện ${targetTeachersToTick.length} bản ghi điểm danh của [${myId}] ${myName} (vai trò: ${
                        myRole === 'main' ? 'GV chính' : myRole === 'assistant' ? 'GV phụ' : 'chưa rõ'
                    }).`
                );
            } else if (allTeachers.length > 0) {
                // Chuẩn 3.8.11: không tick bừa cho người khác, nhưng vẫn chốt sổ
                clog(
                    `⚠️ KHÔNG nhận ra bản ghi của [${myId}] ${myName} trong ${allTeachers.length} bản ghi GV. Bỏ qua bước tick cá nhân, vẫn chốt sổ.`
                );
            } else {
                clog(`⚠️ Không bắt được bản ghi GV nào sau 3 lần thử. Bỏ qua bước tick cá nhân, vẫn chốt sổ.`);
            }

            const pendingTeachersToTick = targetTeachersToTick.filter(t => !isDoneStatus(t.status));

            const masterTeacherStatus = String(
                entity.instructor_attendance_status || entity.instructor_attendance_sheet_status || ''
            ).toUpperCase();
            const isMasterLocked = masterTeacherStatus.includes('ACCEPTED');
            let studentStatus = String(entity.attendance_sheet_status || '').toUpperCase();
            let isStudentLocked = studentStatus.includes('ACCEPTED');

            // Đã tick xong + Sổ GV đã khóa + (GV phụ hoặc sổ HS đã khoá) -> lướt qua an toàn (3.8.11 L1028)
            if (pendingTeachersToTick.length === 0 && isMasterLocked && (myRole !== 'main' || isStudentLocked)) {
                clog(`✅ Lớp đã hoàn tất điểm danh. Lướt qua an toàn!`);
                const durationMs = Date.now() - startTime;
                markClassCompletedInState(this.state, masterKey);
                return {
                    success: true,
                    skipped: true,
                    status: 'done',
                    class: masterKey,
                    label,
                    role: myRole,
                    reason: 'Đã hoàn tất điểm danh từ trước',
                    durationMs
                };
            } else if (pendingTeachersToTick.length === 0 && targetTeachersToTick.length > 0) {
                clog(`✅ Bạn ĐÃ CÓ MẶT từ trước. Bỏ qua bước Tick cá nhân.`);
            }

            // Nếu là chế độ DRY-RUN -> dừng tại đây và trả về kế hoạch chi tiết, KHÔNG gửi bất kỳ lệnh ghi nào
            if (options.dryRun) {
                const plan = {
                    role: myRole,
                    teacherRecordIds: targetTeachersToTick.map(t => t.id),
                    pendingTickIds: pendingTeachersToTick.map(t => t.id),
                    willUnlockTeacherSheet: pendingTeachersToTick.length > 0 && isMasterLocked,
                    willLockTeacherSheet: !isMasterLocked || (pendingTeachersToTick.length > 0 && isMasterLocked),
                    willLockStudentSheet: !isStudentLocked && myRole !== 'assistant'
                };
                clog(
                    `🧪 [DRY-RUN] Kế hoạch: Vai trò=${myRole}, Bản ghi GV=[${plan.teacherRecordIds.join(',') || 'trống'}], Cần tick=[${
                        plan.pendingTickIds.join(',') || 'không'
                    }], Mở khoá sổ GV=${plan.willUnlockTeacherSheet}, Chốt sổ GV=${plan.willLockTeacherSheet}, Chốt sổ HS=${
                        plan.willLockStudentSheet
                    }`
                );
                return {
                    success: true,
                    dryRun: true,
                    status: 'dry_run',
                    class: masterKey,
                    label,
                    role: myRole,
                    reason: `Dry-Run OK (Tick: ${plan.pendingTickIds.length}, Chốt GV: ${plan.willLockTeacherSheet ? 'Có' : 'Không'}, Chốt HS: ${plan.willLockStudentSheet ? 'Có' : 'Không'})`,
                    durationMs: Date.now() - startTime,
                    plan
                };
            }

            const wasMasterLocked = isMasterLocked;
            let didUnlockMaster = false;
            let tickFailed = false;

            // ---- 2. SỔ GV ĐÃ KHOÁ MÀ MÌNH CHƯA TICK -> MỞ KHOÁ (chuẩn 3.8.11 L1043) ----
            if (pendingTeachersToTick.length > 0 && isMasterLocked) {
                clog(`🔓 Sổ GV đã khoá nhưng bạn CHƯA điểm danh -> MỞ KHOÁ để điểm danh, xong sẽ khoá lại...`);
                const exactTransitionEndpoint = classItem?.sourceApi
                    ? classItem.sourceApi.replace('_Model', '_jsonPostTransition')
                    : 'x35FD2_jsonPostTransition';
                const unlockPayload = {
                    id: String(masterKey),
                    field_name: 'instructor_attendance_status',
                    begin_state: 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED',
                    end_state: 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING',
                    is_reversal: 0,
                    update_time: classUpdateTime
                };
                let resUnlock = await this.rpcCall(exactTransitionEndpoint, unlockPayload);
                if (!resUnlock || resUnlock.type === 'error') {
                    resUnlock = await this.rpcCall('x35FD3_jsonPostTransition', unlockPayload);
                }
                clog(
                    transitionReached(resUnlock, unlockPayload.end_state)
                        ? `  ├─ ✔️ Đã mở khóa sổ GV (PENDING).`
                        : `  ├─ ⚠️ Mở khoá sổ GV chưa được xác nhận (${describeTransition(resUnlock)}).`
                );

                didUnlockMaster = true;
                currentEntity.instructor_attendance_status = 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING';
                if (currentEntity.status) currentEntity.status = 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING';
                await delay(500);

                // Đọc lại bản ghi GV lấy update_time mới (chống lỗi ERR_ACS_STATE_CHANGED)
                const fresh = await this.huntTeacherRecords(masterKey, classItem?.sourceApi);
                if (fresh.classUpdateTime) classUpdateTime = fresh.classUpdateTime;
                for (const pt of pendingTeachersToTick) {
                    const fr = fresh.records.find(r => String(r.id) === pt.id);
                    if (fr) {
                        pt.update_time = fr.update_time || pt.update_time;
                        pt.status = fr.status || pt.status;
                    }
                }
            }

            // ---- 3. TICK CÓ MẶT CHO MÌNH (chuẩn 3.8.11 L1077) ----
            for (const t of pendingTeachersToTick) {
                let tBeginState = t.status;
                if (!tBeginState || !tBeginState.includes('INSTRUCTOR_ATTENDANCE_STATUS_')) {
                    tBeginState = 'INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE';
                }

                clog(`⏳ [Bước 1] Tick Có mặt GV (ID: ${t.id})...`);
                const payloadTeacherTick = {
                    id: parseInt(t.id, 10),
                    field_name: 'status',
                    begin_state: tBeginState,
                    to_state: 'INSTRUCTOR_ATTENDANCE_STATUS_PRESENT',
                    end_state: 'INSTRUCTOR_ATTENDANCE_STATUS_PRESENT',
                    is_reversal: 0,
                    update_time: t.update_time,
                    mode: 'V',
                    entity: { id: parseInt(t.id, 10), status: tBeginState },
                    env: { id: parseInt(t.id, 10), master_key: String(masterKey), father_master_key: String(masterKey) }
                };

                try {
                    const res1 = await this.rpcCall(TEACHER_LIST_DOMAIN + 'jsonPostTransition', payloadTeacherTick);
                    if (res1 && res1.type === 'success') {
                        clog(`  ├─ ✔️ Tick Có mặt thành công cho bản ghi ${t.id}.`);
                    } else {
                        tickFailed = true;
                        const code = res1?.code || res1?.message || 'Unknown';
                        clog(
                            /DENIED|READ_ONLY/.test(code)
                                ? `  ├─ ⚠️ Bản ghi ${t.id} bị từ chối quyền (${code}).`
                                : `  ├─ ❌ Không thể Tick cá nhân (Code: ${code})`
                        );
                    }
                } catch {
                    tickFailed = true;
                }
            }

            // ---- 4. LÀM MỚI update_time CỦA TIẾT TRƯỚC KHI CHỐT (chuẩn 3.8.11 L1110) ----
            let classFreshUpdateTime = classUpdateTime;
            let teacherOhkePrefix: string | null = null;
            let teacherDataQueryId: string | null = null;
            try {
                const exactViewerEndpoint = classItem?.sourceApi
                    ? classItem.sourceApi.replace('_Model', '_Viewer')
                    : 'x35FD2_Viewer';
                const resRefreshMaster = await this.rpcCall(exactViewerEndpoint, { id: String(masterKey) });
                if (resRefreshMaster && resRefreshMaster.data && resRefreshMaster.data.update_time) {
                    classFreshUpdateTime = resRefreshMaster.data.update_time;
                }
                if (resRefreshMaster && resRefreshMaster.html) {
                    const sheet = parseViewerJson(resRefreshMaster.html, 'data').find(
                        d => d && String(d.id) === String(masterKey)
                    );
                    const viewerEnv = parseViewerJson(resRefreshMaster.html, 'env')[0];
                    const mTime = resRefreshMaster.html.match(/(?:data-update-time|update_time)="([^"]+)"/i);
                    if (sheet && sheet.update_time) classFreshUpdateTime = sheet.update_time;
                    else if (mTime && mTime[1]) classFreshUpdateTime = mTime[1];
                    const mPrefix = resRefreshMaster.html.match(/name="ohke_prefix"\s*value="([^"]+)"/i);
                    const mQuery = resRefreshMaster.html.match(/name="data_query_id"\s*value="([^"]+)"/i);
                    teacherOhkePrefix = (mPrefix && mPrefix[1]) || (viewerEnv && viewerEnv.ohke_prefix) || null;
                    teacherDataQueryId = (mQuery && mQuery[1]) || (viewerEnv && viewerEnv.data_query_id) || null;
                }
            } catch {
                // Ignore viewer refresh error
            }

            const teacherMockEnv2: any = { id: String(masterKey), master_key: String(masterKey) };
            if (teacherOhkePrefix) teacherMockEnv2.ohke_prefix = teacherOhkePrefix;
            if (teacherDataQueryId) teacherMockEnv2.data_query_id = teacherDataQueryId;

            // ---- 5. CHỐT SỔ GV (x35FD3 -> dự phòng x24F76; luôn chốt, kể cả GV phụ - 3.8.11 L1135) ----
            if (wasMasterLocked && !didUnlockMaster) {
                clog(`✅ Sổ GV đã chốt sẵn từ trước.`);
            } else {
                clog(`⏳ [Bước 2] Chốt sổ Giáo viên (ACCEPTED)...`);
                const payloadApi2 = {
                    id: parseInt(masterKey, 10) || masterKey,
                    field_name: 'instructor_attendance_status',
                    begin_state:
                        currentEntity.instructor_attendance_status || 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING',
                    to_state: 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED',
                    end_state: 'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED',
                    is_reversal: 0,
                    update_time: classFreshUpdateTime || currentEntity.update_time,
                    mode: 'V',
                    entity: currentEntity,
                    env: teacherMockEnv2
                };
                try {
                    let res2 = await this.rpcCall('x35FD3_jsonPostTransition', payloadApi2);
                    if (!res2 || res2.type !== 'success') {
                        res2 = await this.rpcCall('x24F76_jsonPostTransition', payloadApi2);
                    }
                    if (res2 && res2.type === 'success') {
                        clog(
                            transitionReached(res2, payloadApi2.end_state)
                                ? `  ├─ ✔️ Chốt sổ GV thành công!`
                                : `  ├─ ⚠️ Máy chủ báo success nhưng sổ GV là ${res2.data && res2.data.status}.`
                        );
                    } else {
                        clog(`  ├─ ⚠️ Không thể chốt sổ GV (Code: ${res2?.code || 'Unknown'})`);
                    }
                    if (res2 && res2.data) Object.assign(currentEntity, res2.data);
                } catch (e2: any) {
                    clog(`  ├─ ❌ Lỗi khi Chốt sổ GV: ${e2.message}`);
                }
            }

            // ---- 6. CHỐT HỌC SINH (3-TIER TUẦN TỰ - chuẩn 3.8.11 L1166) ----
            studentStatus = String(currentEntity.attendance_sheet_status || '').toUpperCase();
            isStudentLocked = studentStatus.includes('ACCEPTED');
            const isCoTeacher = myRole === 'assistant';

            let isTrulySuccess = false;

            if (isStudentLocked) {
                clog(`✅ Sổ Học sinh đã khóa từ trước. Bỏ qua bước chốt Học sinh.`);
                isTrulySuccess = true;
            } else if (isCoTeacher) {
                clog(`✅ Bạn là GV phụ (Co-teacher), không có quyền chốt Học sinh. Bỏ qua!`);
                isTrulySuccess = true;
            } else {
                const checkModes = [
                    { name: 'Tiết trước', endpoint: 'bttAction_x2447C_' },
                    { name: 'Đến trường', endpoint: 'bttAction_x2B0CE_' },
                    { name: 'Tất cả có mặt', endpoint: 'bttAction_x2447B_' }
                ];
                if (isLessonZero) checkModes.shift();

                for (const mode of checkModes) {
                    clog(`🔄 Đang thử chốt Học sinh theo: [${mode.name}]...`);

                    try {
                        await this.rpcCall(mode.endpoint, { id: String(masterKey) });
                    } catch {
                        // Ignore bttAction error
                    }

                    const realEnv: any = {
                        id: String(masterKey),
                        master_key: String(masterKey),
                        father_master_key: String(masterKey)
                    };

                    try {
                        const resRefresh = await this.rpcCall('x35FD2_Viewer', { id: String(masterKey) });
                        if (resRefresh) {
                            if (resRefresh.html) {
                                const viewerData = parseViewerJson(resRefresh.html, 'data').find(
                                    d => d && String(d.id) === String(masterKey)
                                );
                                const viewerEnv = parseViewerJson(resRefresh.html, 'env')[0];
                                const mPrefix = resRefresh.html.match(/name="ohke_prefix"\s*value="([^"]+)"/i);
                                const mQuery = resRefresh.html.match(/name="data_query_id"\s*value="([^"]+)"/i);
                                const prefix = (mPrefix && mPrefix[1]) || (viewerEnv && viewerEnv.ohke_prefix);
                                const queryId = (mQuery && mQuery[1]) || (viewerEnv && viewerEnv.data_query_id);
                                if (prefix) realEnv.ohke_prefix = prefix;
                                if (queryId) realEnv.data_query_id = queryId;
                                if (viewerData) Object.assign(currentEntity, viewerData);
                            }
                            if (resRefresh.data) {
                                Object.assign(currentEntity, resRefresh.data);
                                if (resRefresh.data.update_time) currentEntity.update_time = resRefresh.data.update_time;
                            }
                        }
                    } catch {
                        // Ignore viewer refresh error
                    }

                    const payloadApi4 = {
                        id: parseInt(masterKey, 10) || masterKey,
                        field_name: 'attendance_sheet_status',
                        begin_state: currentEntity.attendance_sheet_status || 'CLASS_SCHEDULE_SLOT_STATUS_PENDING',
                        to_state: 'CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED',
                        end_state: 'CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED',
                        is_reversal: 0,
                        update_time: currentEntity.update_time || classFreshUpdateTime,
                        mode: 'V',
                        entity: currentEntity,
                        env: realEnv
                    };

                    try {
                        const res4 = await this.rpcCall('x35FD2_jsonPostTransition', payloadApi4);
                        if (res4) {
                            if (res4.type === 'success') {
                                isTrulySuccess = true;
                                clog(`✔️ [API Check] Điểm danh [${mode.name}] chốt sổ thành công!`);
                                break;
                            } else if (res4.type === 'error' && res4.code === 'ERR_STUDENT_ATTENDANCE_INCOMPLETED') {
                                clog(`❌ Lỗi Ohke (Tier reject): Học sinh chưa điểm danh đủ. Chuyển Tier...`);
                                continue;
                            } else {
                                clog(
                                    `⚠️ Lỗi Ohke không xác định: ${
                                        res4.message || res4.code || 'Unknown'
                                    }. Vẫn thử tiếp...`
                                );
                            }
                        }
                    } catch {
                        // Ignore transition exception
                    }
                }
            }

            // Kiểm tra chéo bằng API (chuẩn 3.8.11 L1255): đọc lại sổ HS
            if (!isTrulySuccess && !isCoTeacher) {
                clog(`⚠️ Các API Tier không xác nhận thành công. Chờ 0.6s kiểm tra chéo...`);
                await delay(600);
                try {
                    const check = await this.rpcCall('x35FD2_Viewer', { id: String(masterKey) });
                    const checkData =
                        (check &&
                            check.html &&
                            parseViewerJson(check.html, 'data').find(d => d && String(d.id) === String(masterKey))) ||
                        (check && check.data);
                    if (checkData && String(checkData.attendance_sheet_status || '').toUpperCase().includes('ACCEPTED')) {
                        isTrulySuccess = true;
                        clog(`✔️ [API Check] Sổ Học sinh đã ở trạng thái ACCEPTED.`);
                    }
                } catch {
                    // Ignore check error
                }
            }

            // Chuẩn 3.8.11 L1269: tick cá nhân thất bại -> chưa coi là xong (không ghi nhớ hoàn tất, lượt sau thử lại)
            if (tickFailed && isTrulySuccess) {
                clog(`⚠️ Tick có mặt cho bạn chưa thành công -> tiết này sẽ được thử lại.`);
                isTrulySuccess = false;
            }

            // ---- 7. KẾT THÚC / BẮN LẠI ----
            if (isTrulySuccess) {
                markClassCompletedInState(this.state, masterKey);
                const durationMs = Date.now() - startTime;
                clog(
                    `✅ Thành công! Đã chốt sổ tiết [${classHourCode || masterKey}] trong ${(durationMs / 1000).toFixed(
                        1
                    )}s.`
                );
                return {
                    success: true,
                    status: 'success',
                    class: masterKey,
                    label,
                    role: myRole,
                    durationMs
                };
            }

            if (!isRetry) {
                clog(`🔄 [TỰ ĐỘNG BẮN LẠI] Lần 1 thất bại. Đang thử bắn lại lần 2 sau 1.5 giây...`);
                await delay(1500);
                if (classItem?.entity) classItem.entity.update_time = '';
                return await this.submitAttendanceFlow(classItem, true, options);
            }

            const fails = recordClassFailureInState(this.state, masterKey);
            if (fails >= MAX_FAILS_PER_DAY) {
                clog(`⛔ Tiết [${label}] lỗi ${fails} lần hôm nay -> tạm dừng tới mai, hãy kiểm tra tay.`);
            } else {
                clog(`⚠️ Cảnh báo: Tiết [${classHourCode || masterKey}] API chốt sổ không phản hồi đúng sau 2 lần bắn!`);
            }

            return {
                success: false,
                status: 'failed',
                class: masterKey,
                label,
                role: myRole,
                error: tickFailed
                    ? 'Tick có mặt cá nhân thất bại'
                    : 'API chốt sổ không phản hồi đúng sau 2 lần bắn',
                durationMs: Date.now() - startTime
            };
        } catch (err: any) {
            clog(`❌ Lỗi Sniper tiết ${masterKey}: ${err.message}`);
            recordClassFailureInState(this.state, masterKey);
            return {
                success: false,
                status: 'failed',
                class: masterKey,
                label,
                error: err.message,
                durationMs: Date.now() - startTime
            };
        }
    }

    /**
     * Hủy chốt sổ 1 tiết chuẩn 3.8.11 (revertAttendanceFlowV33):
     * Thứ tự: mở sổ GV -> (đổi tick của mình về NO_ATTENDANCE nếu includeMyTick) -> mở sổ HS -> (xoá điểm danh HS nếu includeStudentTicks).
     * Đọc lại sổ bằng rpcSheetViewer để xác nhận trạng thái thực sự trên máy chủ.
     */
    async revertAttendanceFlow(
        classItemOrMasterKey: any,
        classUpdateTime = '',
        { includeMyTick = false, includeStudentTicks = false } = {}
    ): Promise<{
        success: boolean;
        studentOk: boolean;
        teacherOk: boolean;
        tickOk: boolean;
        studentClearOk: boolean;
    }> {
        let masterKey = classItemOrMasterKey;
        let sourceApi = '';

        if (typeof classItemOrMasterKey === 'object' && classItemOrMasterKey !== null) {
            masterKey =
                (classItemOrMasterKey.entity && getClassKey(classItemOrMasterKey.entity)) ||
                classItemOrMasterKey.id ||
                classItemOrMasterKey.master_key;
            if (!classUpdateTime) {
                classUpdateTime = classItemOrMasterKey.entity ? classItemOrMasterKey.entity.update_time : '';
            }
            sourceApi = classItemOrMasterKey.sourceApi || '';
        }

        const revertEntity =
            (typeof classItemOrMasterKey === 'object' && classItemOrMasterKey?.entity) || {};
        const classTag =
            [revertEntity.class_name || revertEntity.student_class_name, revertEntity.class_hour_code]
                .filter(Boolean)
                .join('·') || String(masterKey);
        const clog = (msg: string) => this.log(`[${classTag}] ${msg}`);

        clog(`⚡ Đang HỦY chốt sổ tiết [${masterKey}]...`);

        const listTransitionEndpoint = sourceApi ? sourceApi.replace('_Model', '_jsonPostTransition') : null;
        const isTransitionOk = (r: any) => !!r && (r.type === 'success' || r.success === true);

        const readSheetState = async (sheetDomain: string) => {
            const res = await this.rpcSheetViewer(sheetDomain, masterKey);
            const html = (res && res.html) || '';
            return {
                data: parseViewerJson(html, 'data')[0] || (res && res.data) || null,
                env: parseViewerJson(html, 'env')[0] || null
            };
        };

        const revertSheet = async (
            label: string,
            fieldName: string,
            beginState: string,
            endState: string,
            sheetDomain: string
        ): Promise<boolean> => {
            try {
                const { data: state, env } = await readSheetState(sheetDomain);
                const current = String((state && state[fieldName]) || '').toUpperCase();
                if (state && !current.includes('ACCEPTED')) {
                    clog(`  ├─ ℹ️ Sổ ${label} đang mở sẵn, không cần hủy.`);
                    return true;
                }
                const payload = {
                    id: parseInt(String(masterKey), 10) || masterKey,
                    field_name: fieldName,
                    begin_state: beginState,
                    end_state: endState,
                    is_reversal: 0,
                    mode: 'V',
                    update_time: (state && state.update_time) || classUpdateTime,
                    entity: state || { id: String(masterKey) },
                    env: {
                        ...(env || {}),
                        id: String(masterKey),
                        master_key: String(masterKey),
                        father_master_key: String(masterKey)
                    }
                };
                let res = await this.rpcCall(sheetDomain + 'jsonPostTransition', payload);
                if (!transitionReached(res, endState) && listTransitionEndpoint) {
                    res = await this.rpcCall(listTransitionEndpoint, payload);
                }
                if (!transitionReached(res, endState)) {
                    clog(`  ├─ ⚠️ Lỗi hủy sổ ${label}: ${describeTransition(res)}`);
                    return false;
                }
                // Đọc lại sổ để XÁC NHẬN
                const after = (await readSheetState(sheetDomain)).data;
                const afterState = String((after && after[fieldName]) || '');
                if (after && afterState === endState) {
                    clog(`  ├─ ✔️ Hủy chốt sổ ${label} thành công (đã đọc lại: ${afterState}).`);
                    return true;
                }
                const closedNote =
                    after && String(after.class_is_not_close) === '0'
                        ? ' - tiết đã ĐÓNG (class_is_not_close=0)'
                        : '';
                clog(
                    `  ├─ ❌ Máy chủ báo thành công nhưng đọc lại sổ ${label} vẫn là ${
                        afterState || 'không rõ'
                    }${closedNote}.`
                );
                return false;
            } catch (e: any) {
                clog(`  ├─ ❌ Lỗi gọi API hủy sổ ${label}: ${e.message}`);
                return false;
            }
        };

        const revertMyTick = async (): Promise<boolean> => {
            const identity = this.getMyIdentity();
            if (!identity.id && !identity.name) {
                clog(`  ├─ ⚠️ Không rõ danh tính giáo viên, bỏ qua hủy tick.`);
                return false;
            }
            const info = await this.huntTeacherRecords(masterKey, sourceApi);
            let mine = info.records.filter(r => recordBelongsToMe(r, '', identity));
            if (mine.length === 0) {
                const revertEntityIds = revertEntity.instructor_site_ids || '';
                const ids = parseIdList(revertEntityIds);
                const statusRecs = info.records.filter(r =>
                    /^INSTRUCTOR_ATTENDANCE_STATUS_/i.test(r.status || '')
                );
                if (ids.length === 1 && ids[0] === String(identity.id) && statusRecs.length === 1) {
                    mine = statusRecs;
                }
            }
            if (mine.length === 0) {
                clog(`  ├─ ⚠️ Không tìm thấy bản ghi điểm danh của bạn trong sổ GV.`);
                return false;
            }

            let allOk = true;
            for (const rec of mine) {
                if (!isDoneStatus(rec.status)) {
                    clog(`  ├─ ℹ️ Bạn đang ở trạng thái chưa điểm danh sẵn.`);
                    continue;
                }
                const payload = {
                    id: parseInt(String(rec.id), 10),
                    field_name: 'status',
                    begin_state: rec.status,
                    to_state: 'INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE',
                    end_state: 'INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE',
                    is_reversal: 0,
                    mode: 'V',
                    update_time: rec.update_time,
                    entity: { id: parseInt(String(rec.id), 10), status: rec.status },
                    env: {
                        id: parseInt(String(rec.id), 10),
                        master_key: String(masterKey),
                        father_master_key: String(masterKey)
                    }
                };
                const res = await this.rpcCall(TEACHER_LIST_DOMAIN + 'jsonPostTransition', payload);
                if (transitionReached(res, 'INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE')) {
                    clog(`  ├─ ✔️ Đã đưa tick của bạn về CHƯA ĐIỂM DANH.`);
                } else {
                    allOk = false;
                    clog(`  ├─ ⚠️ Không hủy được tick (${describeTransition(res)}).`);
                }
            }
            return allOk;
        };

        clog(`  ⏳ Đang hủy chốt sổ Giáo viên...`);
        const teacherOk = await revertSheet(
            'Giáo viên',
            'instructor_attendance_status',
            'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED',
            'INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING',
            TEACHER_SHEET_DOMAIN
        );

        let tickOk = true;
        if (includeMyTick) {
            if (teacherOk) {
                await delay(500);
                clog(`  ⏳ Đang hủy tick có mặt của bạn...`);
                tickOk = await revertMyTick();
            } else {
                tickOk = false;
                clog(`  ├─ ⚠️ Sổ GV chưa mở được nên không thể hủy tick.`);
            }
        }

        clog(`  ⏳ Đang hủy chốt sổ Học sinh...`);
        const studentOk = await revertSheet(
            'Học sinh',
            'attendance_sheet_status',
            'CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED',
            'CLASS_SCHEDULE_SLOT_STATUS_PENDING',
            STUDENT_SHEET_DOMAIN
        );

        let studentClearOk = true;
        if (includeStudentTicks) {
            if (studentOk) {
                try {
                    const viewer = await this.rpcSheetViewer(STUDENT_SHEET_DOMAIN, masterKey);
                    const action =
                        findViewerButtonAction(viewer && viewer.html, 'delete_class_attendance') ||
                        STUDENT_DELETE_ATTENDANCE_FALLBACK;
                    clog(`  ⏳ Đang xoá điểm danh học sinh (${action})...`);
                    const res = await this.rpcCall(action, { id: String(masterKey) });
                    studentClearOk = isTransitionOk(res);
                    clog(
                        studentClearOk
                            ? `  ├─ ✔️ Đã xoá điểm danh học sinh.`
                            : `  ├─ ⚠️ Không xoá được điểm danh học sinh (Code: ${
                                  res?.code || res?.message || 'Unknown'
                              }).`
                    );
                } catch (e: any) {
                    studentClearOk = false;
                    clog(`  ├─ ❌ Lỗi xoá điểm danh học sinh: ${e.message}`);
                }
            } else {
                studentClearOk = false;
                clog(`  ├─ ⚠️ Sổ HS chưa mở được nên không thể xoá điểm danh học sinh.`);
            }
        }

        if (studentOk || teacherOk || (includeMyTick && tickOk)) {
            unmarkClassCompletedInState(this.state, String(masterKey));
        }

        return {
            success: studentOk && teacherOk && tickOk && studentClearOk,
            studentOk,
            teacherOk,
            tickOk,
            studentClearOk
        };
    }

    /**
     * Quét và hủy chốt sổ cho các tiết tương lai bị chốt nhầm (chuẩn 3.8.11 OhkeDebug.revertFutureClasses, bufferMinutes = 0)
     */
    async revertFutureClasses(
        allClasses?: any[],
        options: { includeMyTick?: boolean; includeStudentTicks?: boolean } = {}
    ): Promise<{ success: boolean; count: number; totalFound: number }> {
        const list = allClasses || (await this.scanAllClasses({ daysBack: 0, daysAhead: 14 }));
        const identity = this.getMyIdentity();

        const futureClasses: any[] = [];
        for (const rawData of list) {
            const entity = rawData.entity || rawData;
            const role = getMyRole(entity, identity.id);
            if (role === 'none' || (role === 'unknown' && isExcludedByTeacherName(entity, identity))) continue;

            const studentStatus = String(entity.attendance_sheet_status || '').toUpperCase();
            const teacherStatus = String(
                entity.instructor_attendance_status || entity.instructor_attendance_sheet_status || ''
            ).toUpperCase();
            const oldStatus = String(entity.status || '').toUpperCase();

            const isSubmitted =
                studentStatus.includes('ACCEPTED') ||
                teacherStatus.includes('ACCEPTED') ||
                oldStatus.includes('ACCEPTED');

            if (!isSubmitted) continue;

            const unlockInfo = getClassUnlockInfo(entity, 0); // bufferMinutes = 0 theo 3.8.11
            if (!unlockInfo.isSafe) {
                futureClasses.push(rawData);
            }
        }

        if (futureClasses.length === 0) {
            this.log('✅ Không có lớp tương lai nào bị chốt nhầm.');
            return { success: true, count: 0, totalFound: 0 };
        }

        this.log(`⚠️ PHÁT HIỆN ${futureClasses.length} LỚP TƯƠNG LAI BỊ CHỐT NHẦM! Bắt đầu hủy chốt sổ...`);

        let okCount = 0;
        await runPool(futureClasses, async c => {
            const res = await this.revertAttendanceFlow(c, '', options);
            if (res.success) okCount++;
        });

        if (okCount === futureClasses.length) {
            this.log(`🎉 ĐÃ HỦY CHỐT SỔ THÀNH CÔNG CHO ${okCount} LỚP TƯƠNG LAI!`);
        } else {
            this.log(`⚠️ Hủy chốt sổ thành công ${okCount}/${futureClasses.length} lớp.`);
        }

        return {
            success: okCount === futureClasses.length,
            count: okCount,
            totalFound: futureClasses.length
        };
    }
}
