import { FirebaseError, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
}

function firebaseConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function isFirebaseLoginConfigured(): boolean {
  return firebaseConfig() !== null;
}

function firebaseAuth(): Auth {
  const config = firebaseConfig();
  if (!config) throw new Error('Firebase Google login is not configured');
  app ??= initializeApp(config);
  auth ??= getAuth(app);
  return auth;
}

export async function signInWithGoogleAndGetIdToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const credential = await signInWithPopup(firebaseAuth(), provider);
    return await credential.user.getIdToken();
  } catch (error) {
    if (error instanceof FirebaseError) throw new Error(error.message);
    throw error;
  }
}
