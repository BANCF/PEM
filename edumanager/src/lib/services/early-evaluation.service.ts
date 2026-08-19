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

export interface EarlyEvaluationData {
  id?: string;
  classId: string;
  studentId: string;
  academicYear: string;
  mathScore: number | null;
  mathComment: string;
  literatureScore: number | null;
  literatureComment: string;
  englishScore: number | null;
  englishComment: string;
  behavior: string;
  activity: string;
  learning: string;
  improvement: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = "early_evaluations";

export const earlyEvaluationService = {
  async getEvaluationsByClass(
    classId: string,
    academicYear: string
  ): Promise<EarlyEvaluationData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId),
      where("academicYear", "==", academicYear)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EarlyEvaluationData[];
  },

  async saveEvaluationsBatch(evaluations: EarlyEvaluationData[]): Promise<void> {
    const batchPromises = evaluations.map(async (ev) => {
      let docRef;
      const dataToSave = { ...ev, updatedAt: serverTimestamp() };
      delete dataToSave.id;

      if (ev.id) {
        docRef = doc(db, COLLECTION_NAME, ev.id);
      } else {
        // Find existing to avoid duplicate
        const q = query(
          collection(db, COLLECTION_NAME),
          where("classId", "==", ev.classId),
          where("studentId", "==", ev.studentId),
          where("academicYear", "==", ev.academicYear)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          docRef = existing.docs[0].ref;
        } else {
          docRef = doc(collection(db, COLLECTION_NAME));
          (dataToSave as any).createdAt = serverTimestamp();
        }
      }

      return setDoc(docRef, dataToSave, { merge: true });
    });

    await Promise.all(batchPromises);
  },
};
