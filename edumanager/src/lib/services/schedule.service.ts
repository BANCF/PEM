import { db } from "../firebase/client";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

export interface ScheduleClassInfo {
  period: string;
  time: string;
  className: string;
  subject: string;
  teacher?: string;
}

// Map: Day (e.g. "2", "3") -> Array of ScheduleClassInfo
export type TeacherSchedule = Record<string, ScheduleClassInfo[]>;
export type ClassSchedule = Record<string, ScheduleClassInfo[]>;

export interface FullScheduleData {
  updatedAt: string;
  updatedBy: string;
  weekName?: string;
  teachers: Record<string, TeacherSchedule>;
  classes: Record<string, ClassSchedule>;
}

export const getSchedule = async (): Promise<FullScheduleData | null> => {
  try {
    const docRef = doc(db, "schedules", "current");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as FullScheduleData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching schedule:", error);
    throw error;
  }
};

export const saveSchedule = async (data: FullScheduleData): Promise<void> => {
  try {
    const docRef = doc(db, "schedules", "current");
    await setDoc(docRef, data);
  } catch (error) {
    console.error("Error saving schedule:", error);
    throw error;
  }
};

export const getDraftSchedule = async (): Promise<FullScheduleData | null> => {
  try {
    const docRef = doc(db, "schedules", "draft");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as FullScheduleData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching draft schedule:", error);
    throw error;
  }
};

export const saveDraftSchedule = async (data: FullScheduleData): Promise<void> => {
  try {
    const docRef = doc(db, "schedules", "draft");
    await setDoc(docRef, data);
  } catch (error) {
    console.error("Error saving draft schedule:", error);
    throw error;
  }
};

export const publishDraftSchedule = async (): Promise<void> => {
  try {
    const draftData = await getDraftSchedule();
    if (!draftData) throw new Error("Không tìm thấy TKB Nháp");
    await saveSchedule(draftData);
    await deleteDraftSchedule();
  } catch (error) {
    console.error("Error publishing draft schedule:", error);
    throw error;
  }
};

export const deleteDraftSchedule = async (): Promise<void> => {
  try {
    const docRef = doc(db, "schedules", "draft");
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting draft schedule:", error);
    throw error;
  }
};

export interface ScheduleSettings {
  clbTeachers: string[];
}

export const getScheduleSettings = async (): Promise<ScheduleSettings | null> => {
  try {
    const docRef = doc(db, "settings", "schedule");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as ScheduleSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching schedule settings:", error);
    return null;
  }
};

export const saveScheduleSettings = async (settings: ScheduleSettings): Promise<void> => {
  try {
    const docRef = doc(db, "settings", "schedule");
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Error saving schedule settings:", error);
    throw error;
  }
};
