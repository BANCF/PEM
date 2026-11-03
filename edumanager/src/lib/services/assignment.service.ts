import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
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
  updatedAt?: any;
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
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateAssignment(
    id: string,
    data: Partial<Omit<ClassAssignmentData, "id" | "createdAt">>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteAssignment(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  /**
   * Batch replaces/syncs assignments for one or more classes
   * Automatically commits in chunks of 400 to respect Firestore limits
   */
  async batchSyncAssignments(
    academicYear: string,
    newAssignments: Omit<ClassAssignmentData, "id" | "createdAt">[],
    targetClassIds?: string[]
  ): Promise<{ created: number; deleted: number }> {
    const classIdSet = targetClassIds && targetClassIds.length > 0
      ? new Set(targetClassIds)
      : new Set(newAssignments.map((a) => a.classId));

    // 1. Fetch existing assignments for target classes in this academic year
    const existingSnap = await getDocs(
      query(collection(db, COLLECTION_NAME), where("academicYear", "==", academicYear))
    );

    const docsToDelete: string[] = [];
    existingSnap.docs.forEach((d) => {
      const data = d.data();
      if (classIdSet.has(data.classId)) {
        docsToDelete.push(d.id);
      }
    });

    // 2. Perform deletions and insertions in chunks of 400
    const CHUNK_SIZE = 400;

    // Delete existing
    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
      chunk.forEach((docId) => {
        batch.delete(doc(db, COLLECTION_NAME, docId));
      });
      await batch.commit();
    }

    // Insert new
    for (let i = 0; i < newAssignments.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = newAssignments.slice(i, i + CHUNK_SIZE);
      chunk.forEach((assign) => {
        const newDocRef = doc(collection(db, COLLECTION_NAME));
        batch.set(newDocRef, {
          ...assign,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return {
      deleted: docsToDelete.length,
      created: newAssignments.length,
    };
  },
};
