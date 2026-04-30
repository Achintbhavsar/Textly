import { adminAuth, adminDb } from '../config/firebase-admin.js';

/**
 * authenticate — verifies Firebase ID token sent from frontend
 * Replaces old JWT + MongoDB User.findById approach
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth check:', authHeader ? 'Token present' : 'NO TOKEN');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    // Attach Firestore user data so routes can read name, email, etc.
    const snap     = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = snap.exists ? snap.data() : {};

    req.user = {
      _id:   decoded.uid,   // kept for backward-compat with existing route handlers
      uid:   decoded.uid,
      email: decoded.email || userData.email || '',
      name:  userData.name || decoded.name || '',
      ...userData,
    };

    console.log('✅ Authenticated user:', decoded.uid);
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

/**
 * optionalAuth — same as authenticate but doesn't block if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token   = authHeader.split(' ')[1];
      const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
      if (decoded) {
        const snap     = await adminDb.collection('users').doc(decoded.uid).get();
        const userData = snap.exists ? snap.data() : {};
        req.user = {
          _id:   decoded.uid,
          uid:   decoded.uid,
          email: decoded.email || userData.email || '',
          name:  userData.name || '',
          ...userData,
        };
      }
    }
    next();
  } catch (_) {
    next();
  }
};