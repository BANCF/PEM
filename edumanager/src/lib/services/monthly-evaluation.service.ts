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

export interface MonthlyEvaluationData {
  id?: string;
  classId: string;
  studentId: string;
  academicYear: string;
  month: number;
  mathScore: number | null;
  mathComment: string;
  literatureScore: number | null;
  literatureComment: string;
  englishScore: number | null;
  englishComment: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = "monthly_evaluations";

export const monthlyEvaluationService = {
  async getEvaluationsByClassAndMonth(
    classId: string,
    academicYear: string,
    month: number
  ): Promise<MonthlyEvaluationData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId),
      where("academicYear", "==", academicYear),
      where("month", "==", month)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MonthlyEvaluationData[];
  },

  async saveEvaluationsBatch(evaluations: MonthlyEvaluationData[]): Promise<void> {
    const batchPromises = evaluations.map(async (ev) => {
      // Use composite key for document ID to ensure uniqueness per student/month
      // Replace slashes or special chars if any in academicYear just in case, though usually it's "2023-2024"
      const safeYear = ev.academicYear.replace(/[^a-zA-Z0-9-]/g, '_');
      const docId = `${ev.classId}_${safeYear}_${ev.month}_${ev.studentId}`;
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
};
