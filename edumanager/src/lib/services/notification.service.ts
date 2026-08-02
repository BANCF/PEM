import { db } from "../firebase/client";
import { collection, addDoc } from "firebase/firestore";

export interface SendNotificationPayload {
  userId: string;
  title: string;
  message: string;
  link?: string;
}

export const sendNotification = async (payload: SendNotificationPayload): Promise<void> => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...payload,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
