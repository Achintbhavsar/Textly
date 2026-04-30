import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCA-DQ1xTDLyJTN9Dbib6C1Tgu_owQTDow",
  authDomain: "textly-b5357.firebaseapp.com",
  databaseURL: "https://textly-b5357-default-rtdb.firebaseio.com/",
  projectId: "textly-b5357",
  storageBucket: "textly-b5357.firebasestorage.app",
  messagingSenderId: "807504745298",
  appId: "1:807504745298:web:efc9afedfbf53a8b1d608b",
  measurementId: "G-DKYGZWQ4EV"
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export default app;
