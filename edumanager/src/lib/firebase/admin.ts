import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

try {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines with actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (error: any) {
  console.error('Firebase admin initialization error', error.stack);
}

// We wrap these in a proxy or just export as is if initialization succeeded.
// If initialization failed, getAuth/getFirestore will throw here and crash the API route (returning HTML).
// To prevent that, we export getters or initialize them conditionally.

let adminAuth: any;
let adminDb: any;

try {
  adminAuth = getAuth();
  adminDb = getFirestore();
} catch (error) {
  console.error("Error getting auth/firestore instances:", error);
}

export { adminAuth, adminDb };

