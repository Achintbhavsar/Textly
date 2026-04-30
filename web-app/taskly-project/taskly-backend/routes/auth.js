import express from 'express';
import { adminAuth } from '../config/firebase-admin.js';

const router = express.Router();

/**
 * GET /api/auth/verify
 * Verifies a Firebase ID token and returns the decoded user info.
 * Called by frontend to confirm a valid session on the backend.
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    res.json({
      success: true,
      data: {
        user: {
          id:    decoded.uid,
          uid:   decoded.uid,
          email: decoded.email || '',
          name:  decoded.name  || '',
        },
      },
    });
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});

export default router;