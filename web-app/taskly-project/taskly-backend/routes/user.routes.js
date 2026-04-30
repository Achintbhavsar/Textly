import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../config/firebase-admin.js';

const router = express.Router();

// ── GET /api/users/search?q=...
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') return res.json({ success: true, data: [] });

    const uid    = req.user.uid;
    const search = q.toLowerCase().trim();
    const snap   = await adminDb.collection('users').get();

    const results = snap.docs
      .map(d => ({ ...d.data(), _id: d.id }))
      .filter(u =>
        u._id !== uid &&
        (u.name?.toLowerCase().includes(search) ||
         u.email?.toLowerCase().includes(search))
      )
      .slice(0, 10)
      .map(u => ({
        _id:        u._id,
        name:       u.name || u.email?.split('@')[0] || 'User',  // ✅ FIX: Add fallback
        email:      u.email      || '',
        profileUrl: u.profileUrl || '',
        status:     u.status     || 'offline',
        vibeStatus: u.vibeStatus || '',
        lastSeen:   u.lastSeen   || null,
      }));

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/users/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const snap = await adminDb.collection('users').doc(uid).get();
    
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const userData = snap.data();
    
    // ✅ FIX: If name is missing, set it from Firebase Auth or email
    if (!userData.name || userData.name.trim() === '') {
      const fallbackName = req.user.name || req.user.email?.split('@')[0] || 'User';
      await adminDb.collection('users').doc(uid).update({ name: fallbackName });
      userData.name = fallbackName;
      console.log(`✅ Fixed missing name for user ${uid}: ${fallbackName}`);
    }
    
    res.json({ success: true, data: { _id: uid, ...userData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/me  — update profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const uid        = req.user.uid;
    const { name, vibeStatus, profileUrl, bio } = req.body;

    const update = {};
    if (name        !== undefined) update.name        = name;
    if (vibeStatus  !== undefined) update.vibeStatus  = vibeStatus;
    if (profileUrl  !== undefined) update.profileUrl  = profileUrl;
    if (bio         !== undefined) update.bio         = bio;

    await adminDb.collection('users').doc(uid).set(update, { merge: true });

    const snap = await adminDb.collection('users').doc(uid).get();

    // Broadcast profile update via socket
    const io = req.app.locals.io;
    if (io && name) {
      io.emit('user-profile-update', { userId: uid, name, vibeStatus, profileUrl });
    }

    console.log(`✅ Profile updated: ${name || uid}`);
    res.json({ success: true, data: { _id: uid, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/privacy
router.put('/privacy', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const {
      showLastSeen, showOnlineStatus, showProfilePhoto,
      showVibeStatus, showReadReceipts, showTyping,
    } = req.body;

    await adminDb.collection('users').doc(uid).set(
      { privacy: { showLastSeen, showOnlineStatus, showProfilePhoto, showVibeStatus, showReadReceipts, showTyping } },
      { merge: true }
    );

    const snap = await adminDb.collection('users').doc(uid).get();
    console.log(`✅ Privacy updated for: ${uid}`);
    res.json({ success: true, data: { _id: uid, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/users/rating
router.post('/rating', authenticate, async (req, res) => {
  try {
    const uid          = req.user.uid;
    const { stars, review } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, message: 'Stars must be between 1 and 5' });
    }

    // Also write to top-level ratings collection (matches frontend)
    await adminDb.collection('ratings').add({
      userId:    uid,
      stars,
      review:    review || '',
      createdAt: Date.now(),
    });

    // Also store on user doc for quick access
    await adminDb.collection('users').doc(uid).set(
      { rating: { stars, review: review || '', ratedAt: Date.now() } },
      { merge: true }
    );

    console.log(`⭐ Rating submitted: ${stars} stars by ${uid}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/users/rating
router.get('/rating', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const snap = await adminDb.collection('users').doc(uid).get();
    res.json({ success: true, data: snap.data()?.rating || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;