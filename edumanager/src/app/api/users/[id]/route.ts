import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Firebase Admin is not properly initialized. Check FIREBASE_PRIVATE_KEY in production environment variables." }, { status: 500 });
    }

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(userId);
    } catch (e: any) {
      console.warn("User not found in Auth or already deleted:", e.message);
    }

    // 2. Delete from `users` collection
    await adminDb.collection("users").doc(userId).delete();

    // 3. Delete all evaluations where teacherId == userId
    const evalsQuery = await adminDb.collection("evaluations").where("teacherId", "==", userId).get();
    const batch = adminDb.batch();
    
    evalsQuery.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    
    // 4. Delete all class assignments where teacherId == userId
    const assignsQuery = await adminDb.collection("class_assignments").where("teacherId", "==", userId).get();
    assignsQuery.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
