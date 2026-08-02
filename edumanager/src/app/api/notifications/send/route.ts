import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase/admin";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { userId, title, message, link } = await req.json();

    if (!userId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);

    // Lấy danh sách FCM Tokens của người dùng
    const userDoc = await db.collection("users").doc(userId).get();
    const fcmTokens: string[] = userDoc.data()?.fcmTokens || [];

    if (fcmTokens.length > 0) {
      const messaging = getMessaging(adminApp);

      const response = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title,
          body: message,
        },
        data: {
          title,
          message,
          link: link || "/dashboard/evaluations",
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            title,
            body: message,
            icon: "/logo-pascal-01.png",
            badge: "/logo-pascal-01.png",
            sound: "/sounds/notification.wav",
            vibrate: [500, 200, 500, 200, 500],
          },
          fcmOptions: {
            link: link || "/dashboard/evaluations",
          },
        },
      });

      console.log(`Successfully sent ${response.successCount} FCM push messages to user ${userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Send Notification Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
