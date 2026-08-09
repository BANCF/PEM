import { db } from "../firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";

// --- Weekly Schedule Interfaces ---

export interface WeeklyActivity {
  id: string;
  task: string;
  requirement: string;
  assignee: string;
}

export interface WeeklyCategory {
  categoryName: string;
  activities: WeeklyActivity[];
}

export interface WeeklyDay {
  dayName: string;
  categories: WeeklyCategory[];
}

export interface WeeklyScheduleData {
  updatedAt: string;
  updatedBy: string;
  title: string;
  days: WeeklyDay[];
}

// --- Duty Schedule Interfaces ---

export interface DutyShift {
  id: string;
  content: string;
  assignee: string;
}

export interface DutyDay {
  dayName: string;
  shifts: DutyShift[];
}

export interface DutyWeek {
  weekName: string;
  days: DutyDay[];
}

export interface DutyMonth {
  monthName: string;
  weeks: DutyWeek[];
}

export interface DutyScheduleData {
  updatedAt: string;
  updatedBy: string;
  months: DutyMonth[];
}

// --- API Functions ---

export const getWeeklySchedule = async (): Promise<WeeklyScheduleData | null> => {
  try {
    const docRef = doc(db, "schedules", "weekly");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as WeeklyScheduleData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching weekly schedule:", error);
    throw error;
  }
};

export const saveWeeklySchedule = async (data: WeeklyScheduleData): Promise<void> => {
  try {
    const docRef = doc(db, "schedules", "weekly");
    await setDoc(docRef, data);
  } catch (error) {
    console.error("Error saving weekly schedule:", error);
    throw error;
  }
};

export const getDutySchedule = async (): Promise<DutyScheduleData | null> => {
  try {
    const docRef = doc(db, "schedules", "duty");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as DutyScheduleData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching duty schedule:", error);
    throw error;
  }
};

export const saveDutySchedule = async (data: DutyScheduleData): Promise<void> => {
  try {
    const docRef = doc(db, "schedules", "duty");
    await setDoc(docRef, data);
  } catch (error) {
    console.error("Error saving duty schedule:", error);
    throw error;
  }
};
