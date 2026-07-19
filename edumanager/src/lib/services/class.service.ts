import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface ClassData {
  id?: string;
  name: string;
  grade: string;
  academicYear: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = "classes";

export const classService = {
  async getAllClasses(): Promise<ClassData[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ClassData[];
  },

  async getClassById(id: string): Promise<ClassData | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as ClassData;
    }
    return null;
  },

  async createClass(data: Omit<ClassData, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateClass(id: string, data: Partial<Omit<ClassData, "id" | "createdAt" | "updatedAt">>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteClass(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },
};
