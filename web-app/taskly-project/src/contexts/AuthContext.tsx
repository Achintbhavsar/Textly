// src/contexts/AuthContext.tsx
//
// ── WHAT CHANGED FROM YOUR OLD FILE:
//    1. Removed: api.auth.login()     → replaced with Firebase signInWithEmailAndPassword()
//    2. Removed: api.auth.signup()    → replaced with Firebase createUserWithEmailAndPassword()
//    3. Removed: api.auth.verify()    → replaced with Firebase onAuthStateChanged() listener
//    4. Removed: localStorage token check on startup → Firebase handles session automatically
//    5. Removed: loginHistory (was MongoDB-only feature, not in Android app)
//    6. Added:   onAuthStateChanged() → auto-restores session on page refresh
//    7. Added:   upsertUserDoc()      → creates/updates user document in Firestore
//    8. Added:   status field         → sets "online"/"offline" in Firestore (matches Android)
//    9. Added:   profileUrl field     → matches Android User model (was "avatar" before)
//   10. User.uid now equals Firebase uid → same as Android, so cross-platform chat works
//
// ── WHAT STAYED THE SAME:
//    initOneSignal() call after login
//    logoutOneSignal() call on logout
//    setError() for showing errors in UI
//    googleLogin() still works (now uses Firebase credential instead of your backend)

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../Firebase/config';
import { initOneSignal, logoutOneSignal } from '../services/onesignal';
import api from '../services/api';

// ── User shape — matches Android User model exactly
//    uid + id are both the Firebase UID
//    profileUrl matches Android (NOT avatar/avatarUrl)
//    status is "online"/"offline" string (NOT isOnline boolean)
export interface User {
  id:          string;
  uid:         string;
  email:       string;
  name:        string;
  profileUrl:  string;
  bio:         string;
  phoneNumber: string;
  status:      string;
  oneSignalId: string;
}

interface AuthContextType {
  user:         User | null;
  loading:      boolean;
  error:        string | null;
  login:        (email: string, password: string) => Promise<void>;
  logout:       () => Promise<void>;
  signup:       (name: string, email: string, password: string) => Promise<void>;
  googleLogin:  (idToken: string) => Promise<void>;
  setError:     (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Converts Firebase user + Firestore document into our app's User shape
const buildUser = (firebaseUser: any, firestoreData?: any): User => {
  const displayName = firestoreData?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
  return {
    id:          firebaseUser.uid,
    uid:         firebaseUser.uid,
    email:       firebaseUser.email || '',
    name:        displayName,
    profileUrl:  firestoreData?.profileUrl || firebaseUser.photoURL || '',
    bio:         firestoreData?.bio || '',
    phoneNumber: firestoreData?.phoneNumber || '',
    status:      'online',
    oneSignalId: firestoreData?.oneSignalId || '',
  };
};

// ── Creates user document in Firestore if it doesn't exist yet
//    If it already exists (returning user), just updates status to "online"
//    Document structure matches Android User model exactly
const upsertUserDoc = async (firebaseUser: any, extraName?: string) => {
  const ref  = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  // Determine the best name to use
  const userName = extraName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';

  if (!snap.exists()) {
    // Create new user document
    await setDoc(ref, {
      uid:         firebaseUser.uid,
      name:        userName,
      email:       firebaseUser.email || '',
      profileUrl:  firebaseUser.photoURL || '',
      bio:         '',
      phoneNumber: '',
      status:      'online',
      oneSignalId: '',
      createdAt:   serverTimestamp(),
    });
    console.log(`✅ Created Firestore user doc for: ${userName} (${firebaseUser.uid})`);
  } else {
    // Update existing user - set status online and update name if it was empty
    const existingData = snap.data();
    const updates: any = { status: 'online' };
    
    // If name is missing or empty, update it
    if (!existingData.name || existingData.name.trim() === '') {
      updates.name = userName;
      console.log(`✅ Updated missing name for user: ${userName} (${firebaseUser.uid})`);
    }
    
    await setDoc(ref, updates, { merge: true });
  }

  const updated = await getDoc(ref);
  return updated.data();
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Triggers initOneSignal every time user logs in or page reloads with active session
  useEffect(() => {
    if (user?.uid) {
      initOneSignal(user.uid);
    }
  }, [user?.uid]);

  // ── onAuthStateChanged replaces the old localStorage token check
  //    Firebase automatically restores the session on page refresh
  //    No need to manually read/write taskly_token anymore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const firestoreData = await upsertUserDoc(firebaseUser);
          const appUser       = buildUser(firebaseUser, firestoreData);
          setUser(appUser);

          // Still saving token for Socket.io backend compatibility
          const token = await firebaseUser.getIdToken();
          localStorage.setItem('taskly_token', token);
          localStorage.setItem('taskly_user', JSON.stringify(appUser));
        } catch (err) {
          console.error('❌ Auth restore error:', err);
        }
      } else {
        setUser(null);
        localStorage.removeItem('taskly_token');
        localStorage.removeItem('taskly_user');
      }
      setLoading(false);
    });

    return () => unsubscribe(); // cleanup listener on unmount
  }, []);

  // ── Login: replaces api.auth.login() + JWT
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password);
      const firestoreData    = await upsertUserDoc(fbUser);
      const appUser          = buildUser(fbUser, firestoreData);
      setUser(appUser);

      const token = await fbUser.getIdToken();
      localStorage.setItem('taskly_token', token);
      localStorage.setItem('taskly_user', JSON.stringify(appUser));

      // Log login history to Firestore via backend (captures IP + device info)
      api.history.log('success').catch(() => {}); // non-blocking
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const msg = err.code === 'auth/invalid-credential'
        ? 'Invalid email or password'
        : err.message || 'Login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Signup: replaces api.auth.signup()
  //    Also calls updateProfile() to set displayName on Firebase Auth
  const signup = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    console.log('🔵 Signup started with name:', name);
    
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase user created:', fbUser.uid);
      
      await updateProfile(fbUser, { displayName: name });
      console.log('✅ DisplayName set to:', name);

      const firestoreData = await upsertUserDoc(fbUser, name);
      console.log('✅ Firestore document created:', firestoreData);
      
      const appUser = buildUser(fbUser, { ...firestoreData, name });
      console.log('✅ App user built:', appUser);
      
      setUser(appUser);

      const token = await fbUser.getIdToken();
      localStorage.setItem('taskly_token', token);
      localStorage.setItem('taskly_user', JSON.stringify(appUser));
      console.log('✅ User saved to localStorage');

      // Log signup as first login history entry
      api.history.log('success').catch(() => {}); // non-blocking
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Email already in use'
        : err.message || 'Signup failed';
      console.error('❌ Signup error:', msg);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Google login: replaces api.auth.googleLogin()
  //    Pass the Google ID token from your existing Google Sign-In button
  const googleLogin = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const credential       = GoogleAuthProvider.credential(idToken);
      const { user: fbUser } = await signInWithCredential(auth, credential);
      const firestoreData    = await upsertUserDoc(fbUser);
      const appUser          = buildUser(fbUser, firestoreData);
      setUser(appUser);

      const token = await fbUser.getIdToken();
      localStorage.setItem('taskly_token', token);
      localStorage.setItem('taskly_user', JSON.stringify(appUser));

      // Log Google login history
      api.history.log('success').catch(() => {}); // non-blocking
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const msg = err.message || 'Google login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Logout: sets status "offline" in Firestore BEFORE signing out
  //    This is important — Android users will see you go offline correctly
  const logout = async () => {
    try {
      if (auth.currentUser) {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          { status: 'offline' },
          { merge: true }
        );
      }
      await logoutOneSignal();
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('taskly_token');
      localStorage.removeItem('taskly_user');
    } catch (err) {
      console.error('❌ Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout,
      signup,
      googleLogin,
      setError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};