import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Scopes configured for Google Drive integration
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata'
];

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// In-memory cache for access token (DO NOT store in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  description?: string;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      currentUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('لم يتم استلام رمز الوصول من Google');
    }

    cachedAccessToken = credential.accessToken;
    currentUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return currentUser;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  currentUser = null;
};

/**
 * List backup files in Google Drive matching the app's backup tag
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول إلى Google أولاً');

  const q = "trashed = false and name contains 'mawhiba_reports_backup'";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,createdTime,modifiedTime,size,description)&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`فشل الاتصال بـ Google Drive: ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Upload a new backup JSON file to Google Drive
 */
export async function saveBackupToDrive(
  payload: any,
  centerName: string = ''
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول إلى Google أولاً');

  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
  const filename = `mawhiba_reports_backup_${centerName ? centerName.replace(/\s+/g, '_') + '_' : ''}${dateStr}.json`;

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: `نسخة احتياطية لتقارير الموهوبين - ${centerName || 'المركز'} - تاريخ ${d.toLocaleDateString('ar-SA')}`
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`فشل حفظ النسخة في Google Drive: ${err}`);
  }

  const result = await res.json();
  return { id: result.id, name: filename };
}

/**
 * Download a backup file by ID from Google Drive
 */
export async function downloadBackupFromDrive(fileId: string): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول إلى Google أولاً');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`فشل تحميل النسخة من Google Drive: ${err}`);
  }

  return await res.json();
}

/**
 * Upload an exported document (PDF / Word) directly to Google Drive
 */
export async function uploadDocumentToDrive(
  filename: string,
  mimeType: string,
  blob: Blob
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول إلى Google أولاً');

  const metadata = {
    name: filename,
    mimeType: mimeType,
    description: 'تم تصديره عبر نظام تقارير مراكز الموهوبين'
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`فشل رفع المستند إلى Google Drive: ${err}`);
  }

  const result = await res.json();
  return { id: result.id, name: filename };
}

/**
 * Delete a file in Google Drive (must be called only after user confirmation!)
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول إلى Google أولاً');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`فشل حذف الملف: ${err}`);
  }
}
