import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_ADMIN_KEY;

  if (!serviceAccount) {
    throw new Error("FIREBASE_ADMIN_KEY environment variable is not set");
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccount) as ServiceAccount),
  });
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
