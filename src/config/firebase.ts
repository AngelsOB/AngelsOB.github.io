import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBRRrpGLHdbEQ1qz-1sfndlEVtCdxgR0LI",
  authDomain: "brewing-it.firebaseapp.com",
  projectId: "brewing-it",
  storageBucket: "brewing-it.firebasestorage.app",
  messagingSenderId: "416552208396",
  appId: "1:416552208396:web:e9b67b4380efab8c00c629",
  measurementId: "G-KNSC6HBQLK",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
