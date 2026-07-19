import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type TeacherRole = "GVCN" | "PCN" | "GVBM";

export interface ClassAssignmentData {
  id?: string;
  classId: string;
  teacherId: string;
  role: TeacherRole;
  subject?: string; // Optional for GVCN/PCN, required for GVBM
  academicYear: string;
  createdAt?: any;
}

const COLLECTION_NAME = "class_assignments";

export const assignmentService = {
  async getAssignmentsByClassId(classId: string): Promise<ClassAssignmentData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ClassAssignmentData[];
  },

  async getAssignmentsByTeacherId(teacherId: string): Promise<ClassAssignmentData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("teacherId", "==", teacherId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ClassAssignmentData[];
  },

  async createAssignment(data: Omit<ClassAssignmentData, "id" | "createdAt">): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async deleteAssignment(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
