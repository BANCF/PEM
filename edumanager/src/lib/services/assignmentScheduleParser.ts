import * as XLSX from "xlsx";
import { TEACHER_ALIASES } from "./scheduleParser";

export interface ParsedAssignmentItem {
  className: string;
  rawSubject: string;
  subject?: string;
  role: "GVBM" | "GVCN" | "PCN";
  rawTeacher: string;
}

export interface AssignmentParseResult {
  sheetName: string;
  classes: string[];
  assignments: ParsedAssignmentItem[];
  uniqueTeachers: string[];
}

export interface UserCandidate {
  id: string;
  fullName: string;
  email?: string;
  role?: string;
  scheduleName?: string;
}

export interface TeacherMatch {
  rawTeacher: string;
  matchedUser?: UserCandidate;
  confidence: "EXACT" | "ALIAS" | "ENDS_WITH" | "FIRST_LAST" | "INCLUDES" | "NONE";
}

/**
 * Normalizes subject names and identifies GVCN role from schedule rows
 */
export function normalizeSubjectAndRole(rawSubj: string): { role: "GVBM" | "GVCN"; subject?: string } {
  const s = rawSubj.trim();
  const lower = s.toLowerCase();

  // 1. Homeroom teacher (GVCN)
  if (
    lower.includes("shl") ||
    lower.includes("chào cờ") ||
    lower.includes("sinh hoạt lớp") ||
    lower.includes("shl/gdcd")
  ) {
    return { role: "GVCN", subject: undefined };
  }

  // 2. Standard subjects
  if (lower.startsWith("toán tc") || lower.startsWith("toán nc") || lower.startsWith("toán tư duy") || lower.startsWith("toán chuyên")) {
    return { role: "GVBM", subject: "Toán" };
  }
  if (lower === "toán" || lower === "toán học") return { role: "GVBM", subject: "Toán" };
  if (lower === "ngữ văn" || lower === "văn") return { role: "GVBM", subject: "Ngữ Văn" };
  if (lower.startsWith("tiếng việt") || lower.startsWith("tập đọc")) return { role: "GVBM", subject: "Tiếng Việt" };
  if (lower === "tiếng anh" || lower === "grammar" || lower.startsWith("tiếng anh nc") || lower === "anh chuyên") {
    return { role: "GVBM", subject: "Tiếng Anh" };
  }
  if (lower === "sử" || lower === "lịch sử") return { role: "GVBM", subject: "Lịch Sử" };
  if (lower === "địa" || lower === "địa lý" || lower === "địa lí") return { role: "GVBM", subject: "Địa Lý" };
  if (lower === "sử/địa") return { role: "GVBM", subject: "Lịch sử - Địa lý" };
  if (lower === "gdcd" || lower.includes("giáo dục công dân")) return { role: "GVBM", subject: "GDCD" };
  if (lower === "khtn-lí" || lower === "vật lý" || lower === "vật lí") return { role: "GVBM", subject: "Vật Lý" };
  if (lower === "khtn-hóa" || lower === "hóa học" || lower === "hóa") return { role: "GVBM", subject: "Hóa Học" };
  if (lower === "khtn-sinh" || lower === "sinh học" || lower === "sinh") return { role: "GVBM", subject: "Sinh Học" };
  if (lower.includes("tin học") || lower === "ict" || lower === "tin") return { role: "GVBM", subject: "Tin Học" };
  if (lower.includes("công nghệ") || lower === "cn/stem") return { role: "GVBM", subject: "Công Nghệ" };
  if (lower === "mĩ thuật" || lower === "mỹ thuật") return { role: "GVBM", subject: "Mĩ thuật" };
  if (lower === "âm nhạc") return { role: "GVBM", subject: "Âm nhạc" };
  if (lower === "ân/mt" || lower === "td/ân/mt") return { role: "GVBM", subject: "Nghệ Thuật" };
  if (
    lower.includes("thể dục") ||
    lower === "taekwondo" ||
    lower === "bóng rổ" ||
    lower === "bóng đá" ||
    lower.includes("thể chất")
  ) {
    return { role: "GVBM", subject: "Thể Dục" };
  }

  // 3. Fallback: Keep specialized subject names (e.g. Science VN, Maths VN, ESL, Ielts, HĐTN, KNS, STEAM, Robotics)
  return { role: "GVBM", subject: s };
}

/**
 * Remove Vietnamese accents and trim
 */
export function removeVietnameseAccents(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

/**
 * Parses sheet 'P.công giảng dạy' from an Excel workbook buffer
 */
export function parseAssignmentsFromExcel(buffer: ArrayBuffer | Buffer): AssignmentParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });

  // Locate the sheet
  const sheetName = wb.SheetNames.find(
    (s) =>
      s.toLowerCase().includes("p.công") ||
      s.toLowerCase().includes("p.cong") ||
      s.toLowerCase().includes("phân công giảng dạy") ||
      s.toLowerCase().includes("phan cong giang day")
  );

  if (!sheetName) {
    throw new Error("Không tìm thấy sheet 'P.công giảng dạy' trong file Excel này.");
  }

  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

  if (!data || data.length < 5) {
    throw new Error("Dữ liệu sheet 'P.công giảng dạy' không hợp lệ hoặc quá ngắn.");
  }

  // Locate header row containing class names
  let headerRowIdx = -1;
  for (let r = 0; r < 10; r++) {
    const row = data[r] || [];
    const hasMon = row.some((c) => String(c).toLowerCase().includes("môn"));
    const hasLop = row.some((c) => String(c).toLowerCase().includes("lớp"));
    if (hasMon && hasLop) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx === -1) headerRowIdx = 3;

  const headerRow = data[headerRowIdx] || [];
  const classCols: { col: number; className: string }[] = [];

  for (let c = 1; c < headerRow.length; c++) {
    const name = headerRow[c] ? String(headerRow[c]).trim() : "";
    if (name) {
      classCols.push({ col: c, className: name });
    }
  }

  if (classCols.length === 0) {
    throw new Error("Không tìm thấy danh sách Lớp học ở dòng tiêu đề.");
  }

  // Dedup map: `${className}_${role}_${subject || 'HOMEROOM'}_${rawTeacher}` -> ParsedAssignmentItem
  const assignmentMap = new Map<string, ParsedAssignmentItem>();
  const teacherSet = new Set<string>();

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r] || [];
    const rawSubj = row[0] ? String(row[0]).trim() : "";
    if (!rawSubj || rawSubj === "1" || !isNaN(Number(rawSubj))) continue;

    const { role, subject } = normalizeSubjectAndRole(rawSubj);

    for (const { col, className } of classCols) {
      const rawTeacherVal = row[col] ? String(row[col]).trim() : "";
      if (
        !rawTeacherVal ||
        rawTeacherVal === "0" ||
        rawTeacherVal === "-" ||
        !isNaN(Number(rawTeacherVal))
      ) {
        continue;
      }

      // Check if combined names (e.g. "Bình/Lan" or "Linh/Giang")
      const teachers = rawTeacherVal.includes("/")
        ? rawTeacherVal.split("/").map((t) => t.trim()).filter((t) => t)
        : [rawTeacherVal];

      for (const t of teachers) {
        if (!t) continue;
        teacherSet.add(t);

        // Deduplication key
        const key =
          role === "GVCN"
            ? `${className}_GVCN`
            : `${className}_GVBM_${subject}_${t}`;

        if (!assignmentMap.has(key)) {
          assignmentMap.set(key, {
            className,
            rawSubject: rawSubj,
            subject,
            role,
            rawTeacher: t,
          });
        }
      }
    }
  }

  return {
    sheetName,
    classes: classCols.map((c) => c.className),
    assignments: Array.from(assignmentMap.values()),
    uniqueTeachers: Array.from(teacherSet).sort(),
  };
}

/**
 * Intelligent matching of a raw teacher name/alias with system users
 */
export function matchTeacher(
  rawTeacher: string,
  users: UserCandidate[],
  customAliases: Record<string, string> = {}
): TeacherMatch {
  const clean = rawTeacher.trim();
  const normClean = removeVietnameseAccents(clean);

  // 1. User specified scheduleName
  const userByScheduleName = users.find(
    (u) => u.scheduleName && removeVietnameseAccents(u.scheduleName) === normClean
  );
  if (userByScheduleName) {
    return { rawTeacher, matchedUser: userByScheduleName, confidence: "EXACT" };
  }

  // 2. Custom or built-in alias
  const targetAlias = customAliases[clean] || TEACHER_ALIASES[clean];
  if (targetAlias) {
    const normAlias = removeVietnameseAccents(targetAlias);
    const u = users.find((u) => removeVietnameseAccents(u.fullName) === normAlias);
    if (u) return { rawTeacher, matchedUser: u, confidence: "ALIAS" };
  }

  // 3. Exact full name match
  const exactUser = users.find((u) => removeVietnameseAccents(u.fullName) === normClean);
  if (exactUser) return { rawTeacher, matchedUser: exactUser, confidence: "EXACT" };

  // 4. Name ends with (e.g. 'Thu Huệ' matches 'Nguyễn Thị Thu Huệ', 'Lan Phương' matches 'Nguyễn Lan Phương')
  const endsWithUser = users.find((u) =>
    removeVietnameseAccents(u.fullName).endsWith(normClean)
  );
  if (endsWithUser) return { rawTeacher, matchedUser: endsWithUser, confidence: "ENDS_WITH" };

  // 5. First & Last word match (e.g. 'Vũ Linh' matches 'Vũ Ngọc Linh')
  const rParts = normClean.split(/\s+/);
  if (rParts.length === 2) {
    const firstLastUser = users.find((u) => {
      const fParts = removeVietnameseAccents(u.fullName).split(/\s+/);
      return (
        fParts.length >= 2 &&
        fParts[0] === rParts[0] &&
        fParts[fParts.length - 1] === rParts[1]
      );
    });
    if (firstLastUser) return { rawTeacher, matchedUser: firstLastUser, confidence: "FIRST_LAST" };
  }

  // 6. Name includes
  const includesUser = users.find((u) =>
    removeVietnameseAccents(u.fullName).includes(normClean)
  );
  if (includesUser) return { rawTeacher, matchedUser: includesUser, confidence: "INCLUDES" };

  return { rawTeacher, confidence: "NONE" };
}

