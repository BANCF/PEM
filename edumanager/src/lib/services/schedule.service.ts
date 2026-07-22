import { db } from "../firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";

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
