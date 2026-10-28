import * as XLSX from "xlsx";
import { FullScheduleData } from "./schedule.service";

export const TEACHER_ALIASES: Record<string, string> = {
  "Linh": "Vũ Linh",
  "M Hiếu": "Mạnh Hiếu",
  "K.Huyền": "Khánh Huyền",
  "Trọng": "Xuân Trọng",
  "Nguyệt": "Minh Nguyệt",
};

export const normalizeTeacherNames = (rawName: string): string[] => {
  if (!rawName) return [];
  const parts = rawName.split(/[\/,]/).map(t => t.trim()).filter(t => t);
  return parts.map(p => TEACHER_ALIASES[p] || p);
};

export interface ParseOptions {
  clbTeachers?: string[];
  updatedBy?: string;
  weekName?: string;
}

export function parseScheduleExcel(
  buffer: ArrayBuffer | Buffer,
  options: ParseOptions = {}
): FullScheduleData {
  const { clbTeachers = [], updatedBy = "Hệ thống", weekName = "TKB Chính thức" } = options;
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // 1. Phân tích Sheet TKB SangChieu (TKB theo Lớp và Môn học)
  const sangChieuSheetName =
    workbook.SheetNames.find(
      (s) => s.toLowerCase().includes("sangchieu") || s.toLowerCase().includes("sáng chiều")
    ) || workbook.SheetNames[0];

  const sangChieuSheet = workbook.Sheets[sangChieuSheetName];
  if (!sangChieuSheet) {
    throw new Error("Không tìm thấy sheet TKB SangChieu hoặc sheet đầu tiên trong file.");
  }

  const sangChieuData = XLSX.utils.sheet_to_json(sangChieuSheet, {
    header: 1,
    defval: null,
  }) as any[][];

  if (!sangChieuData || sangChieuData.length < 3) {
    throw new Error("File không đúng định dạng chuẩn TKB");
  }

  const classColMap: Record<number, { className: string; pCol: number; tCol: number }> = {};
  const row1 = sangChieuData[1] || [];

  for (let c = 0; c < row1.length; c++) {
    const val = row1[c];
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (!["thứ", "tiết", "thời gian"].includes(trimmed.toLowerCase())) {
        // Tìm cột 'Tiết' gần nhất về phía bên trái
        let pCol = 1;
        for (let p = c - 1; p >= 0; p--) {
          if (row1[p] && typeof row1[p] === "string" && row1[p].toString().trim().toLowerCase() === "tiết") {
            pCol = p;
            break;
          }
        }
        // Tìm cột 'Thời gian' gần nhất về phía bên trái
        let tCol = pCol + 1;
        for (let t = c - 1; t >= 0; t--) {
          if (
            row1[t] &&
            typeof row1[t] === "string" &&
            row1[t].toString().trim().toLowerCase().includes("thời gian")
          ) {
            tCol = t;
            break;
          }
        }
        classColMap[c] = { className: trimmed, pCol, tCol };
      }
    }
  }

  const teachersSchedule: Record<string, Record<string, any[]>> = {};
  const classesSchedule: Record<string, Record<string, any[]>> = {};
  let currentDay: string | null = null;

  for (let r = 2; r < sangChieuData.length; r++) {
    const row = sangChieuData[r];
    if (!row) continue;

    if (row[0]) {
      const dayStr = row[0].toString().trim();
      const m = dayStr.match(/\d+/);
      if (m) currentDay = m[0];
    }
    if (!currentDay) continue;

    for (const cStr in classColMap) {
      const c = parseInt(cStr);
      const { className, pCol, tCol } = classColMap[c];

      const rawPeriod = row[pCol];
      const rawTime = row[tCol];

      if (rawPeriod === null || rawPeriod === undefined) continue;

      let periodClean = rawPeriod.toString().trim();
      const periodMatch = periodClean.match(/^\d+/);
      if (!periodMatch) continue;
      periodClean = periodMatch[0];

      const timeClean = rawTime ? rawTime.toString().trim() : "";
      const subject = row[c];
      let teacherStr = row[c + 1];

      if (subject && typeof subject === "string") {
        const subjectTrimmed = subject.trim();

        if (subjectTrimmed.toLowerCase().includes("clb") && clbTeachers.length > 0) {
          teacherStr = clbTeachers.join(", ");
        }

        if (!subjectTrimmed || subjectTrimmed === "0") continue;

        if (!classesSchedule[className]) classesSchedule[className] = {};
        if (!classesSchedule[className][currentDay]) classesSchedule[className][currentDay] = [];

        const existingClassPeriod = classesSchedule[className][currentDay].find(
          (p: any) => p.period === periodClean
        );

        if (!existingClassPeriod) {
          classesSchedule[className][currentDay].push({
            period: periodClean,
            time: timeClean,
            className,
            subject: subjectTrimmed,
            teacher: teacherStr ? teacherStr.toString().trim() : "",
          });
        }
      }
    }
  }

  // 2. Phân tích Sheet TKB GV (Ưu tiên nguồn dữ liệu TKB Giáo viên chuẩn xác 100%)
  const gvSheetName = workbook.SheetNames.find(
    (s) => s.toLowerCase().includes("tkb gv") || s.toLowerCase().includes("tkb_gv")
  );

  if (gvSheetName && workbook.Sheets[gvSheetName]) {
    const gvSheet = workbook.Sheets[gvSheetName];
    const gvData = XLSX.utils.sheet_to_json(gvSheet, { header: 1, defval: null }) as any[][];

    if (gvData && gvData.length >= 4) {
      const rowDays = gvData[1] || [];
      const rowPeriods = gvData[2] || [];

      for (let r = 3; r < gvData.length; r++) {
        const row = gvData[r];
        if (!row || !row[1]) continue;

        const rawTeacherName = row[1].toString().trim();
        if (!rawTeacherName || rawTeacherName.toLowerCase() === "tên gv") continue;

        const teacherNames = normalizeTeacherNames(rawTeacherName);

        let curDay = "2";
        for (let c = 2; c < row.length; c++) {
          if (rowDays[c]) {
            const dMatch = rowDays[c].toString().trim().match(/\d+/);
            if (dMatch) curDay = dMatch[0];
          }

          const rawPeriod = rowPeriods[c];
          if (!rawPeriod) continue;

          const pMatch = rawPeriod.toString().trim().match(/^\d+/);
          if (!pMatch) continue;
          const periodClean = pMatch[0];

          const className = row[c] ? row[c].toString().trim() : "";
          if (!className || className === "0") continue;

          let subject = "Giảng dạy";
          let time = "";

          if (classesSchedule[className] && classesSchedule[className][curDay]) {
            const matchInClass = classesSchedule[className][curDay].find(
              (item) => item.period === periodClean
            );
            if (matchInClass) {
              subject = matchInClass.subject;
              time = matchInClass.time;
            }
          }

          for (const tName of teacherNames) {
            if (!teachersSchedule[tName]) teachersSchedule[tName] = {};
            if (!teachersSchedule[tName][curDay]) teachersSchedule[tName][curDay] = [];

            const existingT = teachersSchedule[tName][curDay].find(
              (p: any) => p.period === periodClean && p.className === className
            );
            if (!existingT) {
              teachersSchedule[tName][curDay].push({
                period: periodClean,
                time,
                className,
                subject,
                teacher: rawTeacherName,
              });
            }
          }
        }
      }
    }
  }

  // 3. Bổ sung các tiết bị thiếu từ TKB SangChieu sang TKB GV
  for (const className in classesSchedule) {
    for (const curDay in classesSchedule[className]) {
      for (const classPeriod of classesSchedule[className][curDay]) {
        if (classPeriod.teacher) {
          const tNames = normalizeTeacherNames(classPeriod.teacher);
          for (const tName of tNames) {
            if (!teachersSchedule[tName]) teachersSchedule[tName] = {};
            if (!teachersSchedule[tName][curDay]) teachersSchedule[tName][curDay] = [];

            const existingT = teachersSchedule[tName][curDay].find(
              (p: any) => p.period === classPeriod.period
            );
            if (!existingT) {
              teachersSchedule[tName][curDay].push({
                period: classPeriod.period,
                time: classPeriod.time,
                className: className,
                subject: classPeriod.subject,
                teacher: tName,
              });
            }
          }
        }
      }
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    updatedBy,
    weekName,
    teachers: teachersSchedule,
    classes: classesSchedule,
  };
}
