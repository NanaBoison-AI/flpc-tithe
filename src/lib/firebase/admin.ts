import "server-only";
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function init() {
  if (getApps().length) return getApps()[0];
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }),
    });
  }
  // Emulator / ADC fallback (emulators need only a project id)
  return initializeApp({ projectId: FIREBASE_PROJECT_ID, credential: process.env.FIRESTORE_EMULATOR_HOST ? undefined : applicationDefault() });
}
export const adminAuth = () => getAuth(init());
export const adminDb = () => getFirestore(init());
