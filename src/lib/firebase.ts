import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Firebase web configuration is public client configuration. Keep the known
// Flux project values as a fallback so a deployment that omits .env.local can
// still authenticate instead of silently creating a disabled auth instance.
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBV_ev8AVpKwgioPSSWiBYf8UU09bLbWOU",
  authDomain: "flux-544a6.firebaseapp.com",
  projectId: "flux-544a6",
  storageBucket: "flux-544a6.firebasestorage.app",
  messagingSenderId: "475310930388",
  appId: "1:475310930388:web:b6dfe7518bb06d5e01be41",
  measurementId: "G-SMS9G4W1ZV",
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId,
};

// Netlify may prerender client routes before environment variables are loaded.
// The fallback above keeps Firebase valid during that build-time evaluation.
const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

type FirebaseAuth = ReturnType<typeof getAuth>;
type FirebaseDb = ReturnType<typeof getFirestore>;
type FirebaseStorageInstance = ReturnType<typeof getStorage>;

// The non-null casts preserve the existing service API for older service
// modules. The fallback config above means these services are real Firebase
// instances, never placeholder objects.
const auth = isFirebaseConfigured
  ? getAuth(app)
  : (null as unknown as FirebaseAuth);
const db = isFirebaseConfigured
  ? getFirestore(app)
  : (null as unknown as FirebaseDb);
const storage = isFirebaseConfigured
  ? getStorage(app)
  : (null as unknown as FirebaseStorageInstance);

let analytics: Analytics | undefined;
if (isFirebaseConfigured && typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) analytics = getAnalytics(app);
  });
}

export { app, auth, db, storage, analytics, isFirebaseConfigured };
