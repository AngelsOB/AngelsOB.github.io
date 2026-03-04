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

// Lazy initialization — avoids crashing during Next.js static build
// when FIREBASE_ADMIN_KEY is not available.
export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop) {
    return Reflect.get(getFirestore(getAdminApp()), prop);
  },
});

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop) {
    return Reflect.get(getAuth(getAdminApp()), prop);
  },
});
