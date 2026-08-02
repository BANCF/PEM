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
    // 1. Lưu thông báo vào Firestore cho lịch sử trong App
    await addDoc(collection(db, "notifications"), {
      ...payload,
      read: false,
      createdAt: new Date().toISOString()
    });

    // 2. Gọi API gửi Push Notification ngầm tới điện thoại qua FCM khi app tắt
    fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(e => console.error("Error invoking push API:", e));

  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
