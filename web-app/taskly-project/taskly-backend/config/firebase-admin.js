import admin from 'firebase-admin';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath    = path.join(__dirname, 'serviceAccountKey.json');

let credential;

if (existsSync(keyPath)) {
  // ── Local development: use downloaded service-account JSON
  const require    = createRequire(import.meta.url);
  const serviceAcc = require('./serviceAccountKey.json');
  credential       = admin.credential.cert(serviceAcc);
  console.log('🔑 Firebase Admin: using serviceAccountKey.json');
} else {
  // ── Production / CI: read from environment variables
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ Firebase Admin credentials missing!');
    console.error('   Provide config/serviceAccountKey.json  OR  set env vars:');
    console.error('   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }
  credential = admin.credential.cert({
    type:         'service_account',
    project_id:   process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  console.log('🔑 Firebase Admin: using environment variables');
}

if (!admin.apps.length) {
  admin.initializeApp({ credential });
}

export const adminDb   = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
