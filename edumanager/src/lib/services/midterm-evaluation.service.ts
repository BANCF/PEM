import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

import { GradeData } from "@/lib/services/grade.service";

export interface SubjectScore {
  tx1?: number | string | null;
  tx2?: number | string | null;
  gk?: number | string | null;
  evaluation?: string; // "Đạt" | "Chưa đạt" cho môn nhận xét
  comment?: string;
}

export interface MidtermEvaluationData {
  id?: string;
  classId: string;
  studentId: string;
  academicYear: string;
  semester: number; // 1: Giữa HK1 (GHKI), 2: Giữa HK2 (GHKII)
  generalComment: string; // Nhận xét chung của GVCN
  subjects: Record<string, SubjectScore>; // key: subject id (toan, van, anh, khtn, ...)
  createdAt?: any;
  updatedAt?: any;
}

export interface MidtermSubjectConfig {
  id: string;
  name: string;
  isEvaluationOnly: boolean;
  hasComment: boolean;
  aliases: string[];
}

export const MIDTERM_SUBJECTS: MidtermSubjectConfig[] = [
  {
    id: "toan",
    name: "Toán",
    isEvaluationOnly: false,
    hasComment: true,
    aliases: ["toán", "toan", "math"],
  },
  {
    id: "van",
    name: "Ngữ Văn",
    isEvaluationOnly: false,
    hasComment: true,
    aliases: ["ngữ văn", "ngu van", "văn", "van", "literature"],
  },
  {
    id: "anh",
    name: "Tiếng Anh",
    isEvaluationOnly: false,
    hasComment: true,
    aliases: ["tiếng anh", "tieng anh", "anh", "english"],
  },
  {
    id: "khtn",
    name: "Khoa học tự nhiên",
    isEvaluationOnly: false,
    hasComment: false,
    aliases: ["khoa học tự nhiên", "khtn", "vật lý", "hóa học", "sinh học", "vat ly", "hoa hoc", "sinh hoc"],
  },
  {
    id: "lsdl",
    name: "Lịch sử - Địa Lý",
    isEvaluationOnly: false,
    hasComment: false,
    aliases: ["lịch sử - địa lý", "lịch sử - địa lí", "lịch sử và địa lí", "lịch sử", "địa lý", "lich su", "dia ly"],
  },
  {
    id: "gdcd",
    name: "GDCD",
    isEvaluationOnly: false,
    hasComment: false,
    aliases: ["gdcd", "giáo dục công dân", "giao duc cong dan"],
  },
  {
    id: "congnghe",
    name: "Công nghệ",
    isEvaluationOnly: false,
    hasComment: false,
    aliases: ["công nghệ", "cong nghe"],
  },
  {
    id: "tinhoc",
    name: "Tin học",
    isEvaluationOnly: false,
    hasComment: false,
    aliases: ["tin học", "tin hoc"],
  },
  {
    id: "nghethuat_theduc",
    name: "Âm nhạc - Mĩ thuật - Thể dục",
    isEvaluationOnly: true,
    hasComment: false,
    aliases: ["âm nhạc - mĩ thuật - thể dục", "thể dục", "nghệ thuật", "âm nhạc", "mĩ thuật", "gdqp", "giáo dục thể chất"],
  },
];

const COLLECTION_NAME = "midterm_evaluations";

export const midtermEvaluationService = {
  /**
   * Lấy danh sách phiếu điểm giữa kỳ theo lớp, năm học và học kỳ (1: GHKI, 2: GHKII)
   */
  async getEvaluationsByClassAndSemester(
    classId: string,
    academicYear: string,
    semester: number = 1
  ): Promise<MidtermEvaluationData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId),
      where("academicYear", "==", academicYear),
      where("semester", "==", semester)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MidtermEvaluationData[];
  },

  /**
   * Lưu hàng loạt phiếu điểm giữa kỳ (Batch save)
   */
  async saveEvaluationsBatch(evaluations: MidtermEvaluationData[]): Promise<void> {
    const batchPromises = evaluations.map(async (ev) => {
      const safeYear = ev.academicYear.replace(/[^a-zA-Z0-9-]/g, "_");
      const docId = `${ev.classId}_${safeYear}_midterm${ev.semester || 1}_${ev.studentId}`;
      const docRef = doc(db, COLLECTION_NAME, docId);

      const payload: any = {
        ...ev,
        updatedAt: serverTimestamp(),
      };

      if (!ev.id) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(docRef, payload, { merge: true });
    });

    await Promise.all(batchPromises);
  },

  /**
   * Tìm subject config theo tên môn học (hoặc alias)
   */
  findSubjectConfig(subjectName: string): MidtermSubjectConfig | undefined {
    if (!subjectName) return undefined;
    const clean = subjectName.trim().toLowerCase();
    return MIDTERM_SUBJECTS.find(
      (s) => s.id === clean || s.name.toLowerCase() === clean || s.aliases.some((a) => clean.includes(a) || a.includes(clean))
    );
  },

  /**
   * Đồng bộ điểm từ Sổ điểm (GradeData) sang Phiếu báo điểm giữa kỳ (MidtermEvaluationData)
   * ĐẢM BẢO AN TOÀN TUYỆT ĐỐI:
   * - Chỉ cập nhật thông tin của môn tương ứng (subjectName).
   * - Giữ nguyên 100% dữ liệu các môn học khác và generalComment của GVCN.
   * - Giữ nguyên nhận xét cũ của môn nếu grade.comment để trống.
   */
  async syncSubjectGradesToMidterm(
    classId: string,
    academicYear: string,
    semester: number,
    subjectName: string,
    grades: GradeData[]
  ): Promise<number> {
    const subjConfig = this.findSubjectConfig(subjectName);
    if (!subjConfig) {
      console.warn(`[syncSubjectGradesToMidterm] Không tìm thấy cấu hình môn học cho "${subjectName}"`);
      return 0;
    }

    // Lấy dữ liệu midterm hiện có của lớp trong kỳ này
    const existingEvals = await this.getEvaluationsByClassAndSemester(classId, academicYear, semester);
    const evalMap: Record<string, MidtermEvaluationData> = {};
    existingEvals.forEach((e) => {
      evalMap[e.studentId] = e;
    });

    let updatedCount = 0;
    const toSave: MidtermEvaluationData[] = [];

    grades.forEach((grade) => {
      const studentId = grade.studentId;
      if (!studentId) return;

      let currentEval = evalMap[studentId];
      if (!currentEval) {
        // Tạo khung ban đầu cho học sinh nếu chưa có
        const defaultSubjects: Record<string, SubjectScore> = {};
        MIDTERM_SUBJECTS.forEach((subj) => {
          defaultSubjects[subj.id] = {
            tx1: null,
            tx2: null,
            gk: null,
            evaluation: subj.isEvaluationOnly ? "Đạt" : "",
            comment: "",
          };
        });

        currentEval = {
          classId,
          studentId,
          academicYear,
          semester,
          generalComment: "",
          subjects: defaultSubjects,
        };
        evalMap[studentId] = currentEval;
      }

      const existingSubj = currentEval.subjects[subjConfig.id] || {
        tx1: null,
        tx2: null,
        gk: null,
        evaluation: subjConfig.isEvaluationOnly ? "Đạt" : "",
        comment: "",
      };

      if (subjConfig.isEvaluationOnly) {
        const hasAnyScore =
          (grade.tx1 !== null && grade.tx1 !== undefined) ||
          (grade.gk !== null && grade.gk !== undefined) ||
          (grade.ck !== null && grade.ck !== undefined);
        currentEval.subjects[subjConfig.id] = {
          ...existingSubj,
          evaluation: hasAnyScore ? "Đạt" : existingSubj.evaluation || "Đạt",
          comment: grade.comment || existingSubj.comment || "",
        };
      } else {
        currentEval.subjects[subjConfig.id] = {
          ...existingSubj,
          tx1: grade.tx1 !== undefined ? grade.tx1 : existingSubj.tx1 ?? null,
          tx2: grade.tx2 !== undefined ? grade.tx2 : existingSubj.tx2 ?? null,
          gk: grade.gk !== undefined ? grade.gk : existingSubj.gk ?? null,
          comment: grade.comment !== undefined && grade.comment !== "" ? grade.comment : (existingSubj.comment || ""),
        };
      }

      toSave.push(currentEval);
      updatedCount++;
    });

    if (toSave.length > 0) {
      await this.saveEvaluationsBatch(toSave);
    }

    return updatedCount;
  },

  /**
   * Kết hợp dữ liệu Phiếu điểm giữa kỳ với dữ liệu Sổ điểm môn học.
   * Tự động điền các điểm TX1, TX2, GK từ Sổ điểm vào những môn học chưa có điểm trên phiếu.
   * Tuyệt đối không ghi đè nếu trên phiếu đã có điểm hoặc nhận xét.
   */
  mergeEvaluationsWithGrades(
    evaluations: Record<string, MidtermEvaluationData>,
    allGrades: GradeData[],
    semester: number
  ): Record<string, MidtermEvaluationData> {
    const merged = { ...evaluations };
    const semGrades = allGrades.filter((g) => g.semester === semester);

    semGrades.forEach((g) => {
      const studentId = g.studentId;
      if (!studentId || !merged[studentId]) return;

      const cfg = this.findSubjectConfig(g.subject);
      if (!cfg) return;

      const currentSubj = merged[studentId].subjects[cfg.id] || {
        tx1: null,
        tx2: null,
        gk: null,
        evaluation: cfg.isEvaluationOnly ? "Đạt" : "",
        comment: "",
      };

      if (cfg.isEvaluationOnly) {
        if (!currentSubj.evaluation) {
          const hasAny = g.tx1 != null || g.gk != null || g.ck != null;
          currentSubj.evaluation = hasAny ? "Đạt" : "Đạt";
        }
        if (!currentSubj.comment && g.comment) {
          currentSubj.comment = g.comment;
        }
      } else {
        if ((currentSubj.tx1 === null || currentSubj.tx1 === undefined) && g.tx1 !== null && g.tx1 !== undefined) {
          currentSubj.tx1 = g.tx1;
        }
        if ((currentSubj.tx2 === null || currentSubj.tx2 === undefined) && g.tx2 !== null && g.tx2 !== undefined) {
          currentSubj.tx2 = g.tx2;
        }
        if ((currentSubj.gk === null || currentSubj.gk === undefined) && g.gk !== null && g.gk !== undefined) {
          currentSubj.gk = g.gk;
        }
        if (!currentSubj.comment && g.comment) {
          currentSubj.comment = g.comment;
        }
      }

      merged[studentId].subjects[cfg.id] = currentSubj;
    });

    return merged;
  },
};
