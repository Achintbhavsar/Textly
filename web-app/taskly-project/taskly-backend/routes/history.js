import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../config/firebase-admin.js';
import {
  detectDevice,
  detectBrowser,
  detectOS,
  getLocationFromIP,
  getRealIP,
  formatLocation,
} from '../utils/deviceDetection.js';

const router = express.Router();

/**
 * POST /api/history/log
 * Called by the frontend after a successful Firebase sign-in.
 * Logs device, browser, OS, IP and location into Firestore.
 */
router.post('/log', authenticate, async (req, res) => {
  try {
    const uid       = req.user.uid;
    const ipAddress = getRealIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const { status = 'success', failureReason = null } = req.body;

    const entry = {
      uid,
      email:         req.user.email || '',
      status,
      ipAddress,
      userAgent,
      device:        detectDevice(userAgent),
      browser:       detectBrowser(userAgent),
      os:            detectOS(userAgent),
      location:      getLocationFromIP(ipAddress),
      failureReason,
      timestamp:     Date.now(),
    };

    const ref = await adminDb
      .collection('loginHistory')
      .doc(uid)
      .collection('entries')
      .add(entry);

    // Keep only the 100 most recent entries per user
    const allEntries = await adminDb
      .collection('loginHistory')
      .doc(uid)
      .collection('entries')
      .orderBy('timestamp', 'desc')
      .get();

    if (allEntries.size > 100) {
      const batch = adminDb.batch();
      allEntries.docs.slice(100).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    res.json({ success: true, data: { id: ref.id, ...entry } });
  } catch (error) {
    console.error('Log history error:', error);
    res.status(500).json({ success: false, message: 'Failed to log login history' });
  }
});

/**
 * GET /api/history
 * Returns paginated login history for the authenticated user.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const uid          = req.user.uid;
    const limit        = parseInt(req.query.limit) || 50;
    const page         = parseInt(req.query.page)  || 1;
    const statusFilter = req.query.status;

    let query = adminDb
      .collection('loginHistory')
      .doc(uid)
      .collection('entries')
      .orderBy('timestamp', 'desc');

    const allSnap = await query.get();
    let entries   = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (statusFilter && ['success', 'failed'].includes(statusFilter)) {
      entries = entries.filter(e => e.status === statusFilter);
    }

    const total     = entries.length;
    const paginated = entries.slice((page - 1) * limit, page * limit);

    const formatted = paginated.map(e => ({
      id:            e.id,
      email:         e.email,
      status:        e.status,
      timestamp:     e.timestamp,
      device:        e.device,
      browser:       e.browser,
      os:            e.os,
      location:      formatLocation(e.location || {}),
      ipAddress:     e.ipAddress,
      failureReason: e.failureReason || null,
    }));

    res.json({
      success: true,
      data: {
        history: formatted,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve login history' });
  }
});

/**
 * GET /api/history/stats
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const snap = await adminDb
      .collection('loginHistory')
      .doc(uid)
      .collection('entries')
      .orderBy('timestamp', 'desc')
      .get();

    const all = snap.docs.map(d => d.data());

    const stats = {
      totalLogins:      all.length,
      successfulLogins: all.filter(h => h.status === 'success').length,
      failedLogins:     all.filter(h => h.status === 'failed').length,
      uniqueDevices:    new Set(all.map(h => h.device)).size,
      uniqueLocations:  new Set(all.map(h => formatLocation(h.location || {}))).size,
      browsers:         {},
      devices:          {},
      recentActivity:   [],
    };

    all.forEach(e => {
      stats.browsers[e.browser] = (stats.browsers[e.browser] || 0) + 1;
      stats.devices[e.device]   = (stats.devices[e.device]   || 0) + 1;
    });

    stats.recentActivity = all.slice(0, 5).map(e => ({
      status:    e.status,
      timestamp: e.timestamp,
      device:    e.device,
      browser:   e.browser,
      location:  formatLocation(e.location || {}),
    }));

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve statistics' });
  }
});

/**
 * DELETE /api/history  — clear all entries
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    const uid  = req.user.uid;
    const snap = await adminDb
      .collection('loginHistory')
      .doc(uid)
      .collection('entries')
      .get();

    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    res.json({ success: true, message: 'Login history cleared successfully' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear login history' });
  }
});

/**
 * DELETE /api/history/:id  — delete single entry
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const ref = adminDb
      .collection('loginHistory')
      .doc(uid)
      .collection('entries')
      .doc(req.params.id);

    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Login history entry not found' });
    }

    await ref.delete();
    res.json({ success: true, message: 'Login history entry deleted' });
  } catch (error) {
    console.error('Delete history entry error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete login history entry' });
  }
});

export default router;
