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
};
