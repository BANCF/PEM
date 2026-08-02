import { db } from "../firebase/client";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";

export type EvaluationStatus = "DRAFT" | "SUBMITTED_GV" | "REVIEWED_TTCM" | "APPROVED_BGH";

export interface CriteriaScoreValue {
  self: number;
  ttcm: number;
  bgh: number;
}

export interface TeacherThiDuaEvaluation {
  id?: string;
  teacherId: string;
  teacherName: string;
  department?: string;
  position?: string;
  month: string; // MM/YYYY
  year: number;
  periodType: "MONTH" | "WEEK";
  week?: number;
  status: EvaluationStatus;
  
  // Scores per criteria ID (e.g. "I.1": { self: 10, ttcm: 10, bgh: 10 })
  scores: Record<string, CriteriaScoreValue>;
  
  totalSelfScore: number;
  totalTtcmScore: number;
  totalBghScore: number;
  
  ranking?: string; // e.g. "Loại A", "Loại B", "Loại C", "Loại D"
  
  selfNote?: string;
  ttcmNote?: string;
  bghNote?: string;
  
  submittedGvAt?: string;
  reviewedTtcmAt?: string;
  reviewedTtcmBy?: string;
  approvedBghAt?: string;
  approvedBghBy?: string;
  
  createdAt: string;
  updatedAt?: string;
}

const COLLECTION_NAME = "teacher_thi_dua_evaluations";

export const teacherThiDuaService = {
  async getEvaluationsForTeacher(teacherId: string, teacherName?: string): Promise<TeacherThiDuaEvaluation[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("teacherId", "==", teacherId)
      );
      const snapshot = await getDocs(q);
      const list: TeacherThiDuaEvaluation[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...(d.data() as any) });
      });

      if (teacherName) {
        const qName = query(
          collection(db, COLLECTION_NAME),
          where("teacherName", "==", teacherName)
        );
        const snapName = await getDocs(qName);
        snapName.forEach(d => {
          if (!list.some(item => item.id === d.id)) {
            list.push({ id: d.id, ...(d.data() as any) });
          }
        });
      }

      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Error getEvaluationsForTeacher:", e);
      return [];
    }
  },

  async getAllEvaluations(): Promise<TeacherThiDuaEvaluation[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const list: TeacherThiDuaEvaluation[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("Error getAllEvaluations:", e);
      return [];
    }
  },

  async getEvaluationById(id: string): Promise<TeacherThiDuaEvaluation | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...(snap.data() as any) };
      }
      return null;
    } catch (e) {
      console.error("Error getEvaluationById:", e);
      return null;
    }
  },

  async saveEvaluation(data: Partial<TeacherThiDuaEvaluation>): Promise<string> {
    try {
      const { id, ...cleanData } = data;
      
      // Loại bỏ hoàn toàn các trường chứa giá trị undefined để tránh lỗi Firebase
      Object.keys(cleanData).forEach(key => {
        if ((cleanData as any)[key] === undefined) {
          delete (cleanData as any)[key];
        }
      });

      if (id) {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
          ...cleanData,
          updatedAt: new Date().toISOString()
        });
        return id;
      } else {
        const now = new Date().toISOString();
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
          ...cleanData,
          createdAt: now,
          updatedAt: now
        });
        return docRef.id;
      }
    } catch (e) {
      console.error("Error saveEvaluation:", e);
      throw e;
    }
  }
};
