import { db } from "./client";
import { collection, addDoc } from "firebase/firestore";

export const logAuditAction = async (
  userId: string,
  userEmail: string,
  action: string,
  details: string
) => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      userId,
      userEmail,
      action,
      details,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Lỗi ghi log:", error);
  }
};
