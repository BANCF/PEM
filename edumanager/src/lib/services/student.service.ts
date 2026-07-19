import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface StudentData {
  id?: string;
  studentCode: string;
  fullName: string;
  classId: string;
  dob?: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = "students";

export const studentService = {
  async getStudentsByClassId(classId: string): Promise<StudentData[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("classId", "==", classId)
    );
    const snapshot = await getDocs(q);
    const students = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StudentData[];
    
    // Sort in memory to avoid requiring a composite index in Firestore
    return students.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async getStudentById(id: string): Promise<StudentData | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as StudentData;
    }
    return null;
  },

  async createStudent(data: Omit<StudentData, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateStudent(id: string, data: Partial<Omit<StudentData, "id" | "createdAt" | "updatedAt">>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteStudent(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
