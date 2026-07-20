import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface GradeData {
  id?: string;
  studentId: string;
  classId: string;
  subject: string;
  academicYear: string;
  semester: number;
  tx1?: number | null;
  tx2?: number | null;
  tx3?: number | null;
  tx4?: number | null;
  gk?: number | null;
  ck?: number | null;
  average?: number | null;
  comment?: string;
  updatedAt?: any;
}

const COLLECTION_NAME = "grades";

export const gradeService = {
  async getGrades(classId: string, subject: string, academicYear: string, semester: number): Promise<GradeData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId),
      where("subject", "==", subject),
      where("academicYear", "==", academicYear),
      where("semester", "==", semester)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as GradeData[];
  },

  async getAllSemesterGrades(classId: string, subject: string, academicYear: string): Promise<GradeData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId),
      where("subject", "==", subject),
      where("academicYear", "==", academicYear)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as GradeData[];
  },

  async getAllGradesForClass(classId: string, academicYear: string): Promise<GradeData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId),
      where("academicYear", "==", academicYear)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as GradeData[];
  },

  async saveGradesBatch(grades: GradeData[]): Promise<void> {
    const batch = writeBatch(db);
    const colRef = collection(db, COLLECTION_NAME);

    grades.forEach((grade) => {
      if (grade.id) {
        // Cập nhật điểm đã có
        const docRef = doc(db, COLLECTION_NAME, grade.id);
        const dataToUpdate = { ...grade, updatedAt: serverTimestamp() };
        delete dataToUpdate.id; // Không update trường id
        batch.update(docRef, dataToUpdate);
      } else {
        // Thêm điểm mới
        const docRef = doc(colRef);
        batch.set(docRef, { ...grade, updatedAt: serverTimestamp() });
      }
    });

    await batch.commit();
  },
};
