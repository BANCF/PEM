import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BJIAdA_hDMLR2dBCmSXonTtJWq8wJ7wIexkObcbnFYKsSm0mFzahj_DRBqQRrhbmb4iXTn1pdESIF_sMvW6ZPVA";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "AV7azbriBw-PGKthFYDIPwCpmxVq0hXmQeyLJVZWHv8";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:bancf.pascal@gmail.com";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    console.error("VAPID setup error:", e);
  }
}

export async function POST(req: Request) {
  try {
    const { userId, title, message, link } = await req.json();

    if (!userId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Admin DB not initialized" }, { status: 500 });
    }

    // Lấy danh sách Web Push Subscriptions của người dùng
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const pushSubscriptions: any[] = userDoc.data()?.pushSubscriptions || [];

    const payload = JSON.stringify({
      title,
      message,
      link: link || "/dashboard/evaluations",
    });

    if (pushSubscriptions.length > 0) {
      await Promise.all(
        pushSubscriptions.map((sub) =>
          webpush.sendNotification(sub, payload).catch((err) => {
            console.error("WebPush send error:", err);
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Send Notification Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
