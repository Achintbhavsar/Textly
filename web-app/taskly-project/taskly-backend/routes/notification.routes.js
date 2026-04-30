import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../config/firebase-admin.js';

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
const notifCol = (uid) =>
  adminDb.collection('notifications').doc(uid).collection('items');

// ── GET /api/notifications  — all notifications for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const snap = await notifCol(uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notifications' });
  }
});

// ── GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const snap = await notifCol(uid).where('isRead', '==', false).get();
    res.json({ success: true, data: { count: snap.size } });
  } catch (error) {
    console.error('❌ Unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
});

// ── PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const uid    = req.user.uid;
    const snap   = await notifCol(uid).where('isRead', '==', false).get();
    const batch  = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
    await batch.commit();
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
});

// ── PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const ref = notifCol(uid).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    await ref.update({ isRead: true });
    res.json({ success: true, data: { id: req.params.id, ...snap.data(), isRead: true } });
  } catch (error) {
    console.error('❌ Mark read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

// ── DELETE /api/notifications/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const ref  = notifCol(uid).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    await ref.delete();
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

// ── DELETE /api/notifications  — delete all
router.delete('/', authenticate, async (req, res) => {
  try {
    const uid   = req.user.uid;
    const snap  = await notifCol(uid).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true, message: 'All notifications deleted' });
  } catch (error) {
    console.error('❌ Delete all notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notifications' });
  }
});

export default router;