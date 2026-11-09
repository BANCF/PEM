/**
 * Module xử lý văn bản, giải mã HTML/JSON của Ohke và đối sánh tên/ID chuẩn 3.8.11
 */

const JSON_UNICODE_ESCAPE_RE = new RegExp(String.fromCharCode(92, 92) + 'u([0-9a-fA-F]{4})', 'g');

const NAMED_HTML_ENTITIES: Record<string, string> = {
    '&Agrave;': 'À', '&Aacute;': 'Á', '&Acirc;': 'Â', '&Atilde;': 'Ã', '&Auml;': 'Ä', '&Aring;': 'Å',
    '&Egrave;': 'È', '&Eacute;': 'É', '&Ecirc;': 'Ê', '&Euml;': 'Ë',
    '&Igrave;': 'Ì', '&Iacute;': 'Í', '&Icirc;': 'Î', '&Iuml;': 'Ï',
    '&Ograve;': 'Ò', '&Oacute;': 'Ó', '&Ocirc;': 'Ô', '&Otilde;': 'Õ', '&Ouml;': 'Ö',
    '&Ugrave;': 'Ù', '&Uacute;': 'Ú', '&Ucirc;': 'Û', '&Uuml;': 'Ü', '&Utilde;': 'Ũ',
    '&Yacute;': 'Ý',
    '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã', '&auml;': 'ä', '&aring;': 'å',
    '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê', '&euml;': 'ë',
    '&igrave;': 'ì', '&iacute;': 'í', '&icirc;': 'î', '&iuml;': 'ï',
    '&ograve;': 'ò', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ', '&ouml;': 'ö',
    '&ugrave;': 'ù', '&uacute;': 'ú', '&ucirc;': 'û', '&uuml;': 'ü', '&utilde;': 'ũ',
    '&yacute;': 'ý', '&yuml;': 'ÿ',
    '&Dstrok;': 'Đ', '&dstrok;': 'đ', '&ETH;': 'Ð', '&eth;': 'ð',
    '&nbsp;': ' ', '&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&amp;': '&'
};

export const removeTones = (str: unknown): string =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');

export const hasTones = (str: unknown): boolean =>
    removeTones(str) !== String(str || '');

/**
 * Giải mã chữ tiếng Việt bị ClassHub mã hoá nhiều kiểu:
 * "\u0169" (JSON escape), "&#7877;" / "&#x1EC5;" (HTML entity số),
 * "&agrave;" (entity tên), dạng tổ hợp NFD -> chuỗi NFC chuẩn
 */
export const decodeOhkeText = (str: unknown): string => {
    let s = String(str ?? '');
    if (!s) return '';

    s = s.replace(JSON_UNICODE_ESCAPE_RE, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));

    if (s.includes('&')) {
        s = s
            .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)));

        if (/&[a-zA-Z]+;/.test(s)) {
            s = s.replace(/&[a-zA-Z]+;/g, (entity) => NAMED_HTML_ENTITIES[entity] ?? entity);
        }
    }

    return s.normalize('NFC');
};

/**
 * Thuật toán Anti-Corrupt Decode (từ api_scanner.js 3.8.11):
 * Giải mã an toàn các HTML Entity của Ohke, xử lý triệt để lỗi gãy cấu trúc do lồng nháy kép.
 */
export const decodeOhkeJSON = (encodedStr: unknown): string => {
    if (!encodedStr) return '';
    let str = String(encodedStr)
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

    // Bảo vệ chuỗi JSON: nếu Ohke mã hóa ký tự nháy kép lồng bên trong chuỗi giá trị thành \&quot; -> \"
    str = str.replace(/\\&quot;/g, '\\"');
    // Khôi phục các dấu nháy kép còn lại (nháy cấu trúc JSON) thành "
    str = str.replace(/&quot;/g, '"');
    // Xử lý các dấu nháy đơn nếu có
    str = str.replace(/&#39;/g, "'").replace(/&apos;/g, "'");

    return str;
};

/**
 * Chuẩn hoá tên: NFC, gộp khoảng trắng, chữ thường, và thống nhất vị trí dấu thanh kiểu cũ/mới
 * ("hòa" và "hoà", "thủy" và "thuỷ" được coi là một)
 */
export const normalizeName = (str: unknown): string =>
    decodeOhkeText(str)
        .normalize('NFD')
        .replace(/([oO])([\u0300\u0301\u0303\u0309\u0323])([aAeE])(?![\p{L}])/gu, '$1$3$2')
        .replace(/([uU])([\u0300\u0301\u0303\u0309\u0323])([yY])(?![\p{L}])/gu, '$1$3$2')
        .normalize('NFC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\xA0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

export const escapeRegExp = (str: unknown): string =>
    String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * So sánh có dấu; chỉ bỏ dấu khi một bên vốn viết KHÔNG dấu (vd "Nguyen Van An").
 * Không bỏ dấu khi cả hai bên đều có dấu: "Hoa" và "Hoà" là hai người khác nhau.
 */
export const matchWithToneFallback = (
    matcher: (t: string, n: string) => boolean,
    text: unknown,
    name: unknown
): boolean => {
    const t = normalizeName(text);
    const n = normalizeName(name);
    if (!t || !n) return false;
    if (matcher(t, n)) return true;
    if (!hasTones(t) || !hasTones(n)) return matcher(removeTones(t), removeTones(n));
    return false;
};

/**
 * Khớp NGUYÊN CỤM (không khớp chuỗi con): "nguyễn văn an" KHÔNG khớp "nguyễn văn anh"
 */
export const containsWholePhrase = (text: string, phrase: string): boolean => {
    if (!text || !phrase) return false;
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(text);
};

export const nameMatches = (text: unknown, name: unknown): boolean =>
    matchWithToneFallback(containsWholePhrase, text, name);

/**
 * So khớp danh tính GIÁO VIÊN (chặt hơn): tên không được là một phần của tên dài hơn
 * "vũ hoàng linh" KHÔNG khớp "vũ hoàng linh chi" hay "nguyễn vũ hoàng linh"
 */
export const containsExactName = (text: string, name: string): boolean => {
    if (!text || !name) return false;
    return new RegExp(
        `(?<![\\p{L}\\p{N}])(?<!\\p{L}[ \\t]+)${escapeRegExp(name)}(?![\\p{L}\\p{N}])(?![ \\t]+\\p{L})`,
        'u'
    ).test(text);
};

export const teacherNameMatches = (text: unknown, name: unknown): boolean =>
    matchWithToneFallback(containsExactName, text, name);

/**
 * Khớp ID dạng số đứng riêng: "4782" KHÔNG khớp "47826"
 */
export const containsExactId = (text: unknown, id: unknown): boolean => {
    if (!text || !id) return false;
    return new RegExp(`(?<![0-9])${escapeRegExp(String(id))}(?![0-9])`).test(String(text));
};
