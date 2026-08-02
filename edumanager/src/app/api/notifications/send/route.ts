import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getMessaging } from "firebase-admin/messaging";

export async function POST(req: Request) {
  try {
    const { userId, title, message, link } = await req.json();

    if (!userId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Admin DB not initialized" }, { status: 500 });
    }

    // Lấy danh sách FCM Tokens của người dùng
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const fcmTokens: string[] = userData?.fcmTokens || [];

    if (fcmTokens.length > 0) {
      try {
        const messaging = getMessaging();
        const pushTitle = title || "Thông báo từ PEM Pascal";
        const pushMessage = message || "Bạn vừa nhận được 1 thông báo mới từ hệ thống.";

        const response = await messaging.sendEachForMulticast({
          tokens: fcmTokens,
          data: {
            title: pushTitle,
            message: pushMessage,
            body: pushMessage,
            link: link || "/dashboard/evaluations",
            tag: `pem-${Date.now()}`
          }
        });

        console.log(`Successfully delivered ${response.successCount} FCM push messages to user ${userId}`);
      } catch (fcmErr) {
        console.error("FCM Multicast Send Error:", fcmErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Send Notification Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
