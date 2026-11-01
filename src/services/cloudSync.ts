import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SCOPES } from './googleDrive';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));

let cachedGoogleAccessToken: string | null = null;

export function getCachedGoogleToken() {
  return cachedGoogleAccessToken;
}

export function setCachedGoogleToken(t: string | null) {
  cachedGoogleAccessToken = t;
}

// Test connection on boot
export async function testCloudConnection(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (user) {
      await getDocFromServer(doc(db, 'users', user.uid));
    }
    return true;
  } catch (err: any) {
    if (err?.message?.includes('the client is offline')) {
      console.warn('Firestore client is offline or network is disconnected.');
      return false;
    }
    return true;
  }
}

/**
 * Sign in with Google (OAuth Popup)
 */
export async function signInWithGoogleAccount(): Promise<{ user: User; accessToken?: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedGoogleAccessToken = credential.accessToken;
  }
  await saveUserMetadata(result.user);
  return { user: result.user, accessToken: cachedGoogleAccessToken || undefined };
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  await saveUserMetadata(cred.user);
  return cred.user;
}

/**
 * Register with Email and Password
 */
export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  await saveUserMetadata(cred.user);
  return cred.user;
}

/**
 * Send password reset email
 */
export async function resetUserPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Log out from Firebase
 */
export async function logoutUser(): Promise<void> {
  cachedGoogleAccessToken = null;
  await signOut(auth);
}

/**
 * Update user document in Firestore
 */
async function saveUserMetadata(user: User): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || '',
        updatedAt: Date.now()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not save user metadata:', e);
  }
}

/**
 * Save single app document (report, photo, profile) to Firestore under the user
 */
export async function saveDocToCloud(userId: string, docId: string, payload: any): Promise<void> {
  if (!userId || !docId) return;
  const docRef = doc(db, 'users', userId, 'docs', docId);
  await setDoc(docRef, {
    id: docId,
    userId,
    kind: docId.startsWith('rec_') ? 'record' : docId.startsWith('ph_') ? 'photo' : 'profile',
    data: payload,
    updatedAt: Date.now()
  });
}

/**
 * Delete single app document from Firestore
 */
export async function deleteDocFromCloud(userId: string, docId: string): Promise<void> {
  if (!userId || !docId) return;
  const docRef = doc(db, 'users', userId, 'docs', docId);
  await deleteDoc(docRef);
}

/**
 * Fetch all documents saved by user in Firestore
 */
export async function fetchAllDocsFromCloud(userId: string): Promise<Record<string, any>> {
  if (!userId) return {};
  const colRef = collection(db, 'users', userId, 'docs');
  const snap = await getDocs(colRef);
  const out: Record<string, any> = {};
  snap.forEach((d) => {
    const item = d.data();
    if (item && item.id) {
      out[item.id] = item.data;
    }
  });
  return out;
}

/**
 * Upload multiple local documents to cloud (e.g. on initial sign in)
 */
export async function uploadLocalDocsToCloud(
  userId: string,
  localDocs: Record<string, any>,
  onProgress?: (count: number, total: number) => void
): Promise<number> {
  if (!userId) return 0;
  const entries = Object.entries(localDocs);
  let done = 0;
  for (const [id, data] of entries) {
    if (data != null) {
      await saveDocToCloud(userId, id, data);
      done++;
      if (onProgress) onProgress(done, entries.length);
    }
  }
  return done;
}

/**
 * Subscribe to real-time changes in user docs
 */
export function subscribeToUserDocs(
  userId: string,
  onRemoteChange: (id: string, data: any | null) => void
) {
  if (!userId) return () => {};
  const colRef = collection(db, 'users', userId, 'docs');
  return onSnapshot(colRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const docData = change.doc.data();
      const docId = docData?.id || change.doc.id;
      if (change.type === 'removed') {
        onRemoteChange(docId, null);
      } else {
        onRemoteChange(docId, docData.data);
      }
    });
  }, (err) => {
    console.warn('Real-time sync snapshot error:', err);
  });
}
