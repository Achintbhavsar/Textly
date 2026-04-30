import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../config/firebase-admin.js';

const router = express.Router();

// ── GET /api/conversations  — all chats for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log(`📋 Loading conversations for: ${uid}`);

    const [directSnap, groupSnap] = await Promise.all([
      adminDb.collection('directChats').where('participants', 'array-contains', uid).get(),
      adminDb.collection('groups').where('participants', 'array-contains', uid).get(),
    ]);

    const directChats = await Promise.all(
      directSnap.docs.map(async d => {
        const data    = d.data();
        const otherId = data.participants?.find(p => p !== uid);
        
        let other = null;
        if (otherId) {
          const otherSnap = await adminDb.collection('users').doc(otherId).get();
          const otherData = otherSnap.data();
          
          // ✅ FIX: Ensure name has a fallback value
          other = {
            ...otherData,
            name: otherData?.name || otherData?.email?.split('@')[0] || 'User',
            profileUrl: otherData?.profileUrl || '',
            status: otherData?.status || 'offline',
            vibeStatus: otherData?.vibeStatus || ''
          };
        }
        
        return {
          ...data,
          _id:  d.id,
          type: 'direct',
          participants: [
            { _id: uid },
            { _id: otherId, ...other },
          ],
          lastMessageAt: data.lastMessageTime ? new Date(data.lastMessageTime).toISOString() : null,
        };
      })
    );

    const groups = await Promise.all(
      groupSnap.docs.map(async d => {
        const data    = d.data();
        const members = await Promise.all(
          (data.participants || []).map(async pid => {
            const userSnap = await adminDb.collection('users').doc(pid).get();
            const u = userSnap.data();
            
            // ✅ FIX: Ensure name has a fallback value
            return {
              _id: pid,
              name: u?.name || u?.email?.split('@')[0] || 'User',
              profileUrl: u?.profileUrl || '',
              status: u?.status || 'offline'
            };
          })
        );
        return {
          ...data,
          _id:  d.id,
          id:   d.id,
          type: 'group',
          participants:  members,
          lastMessageAt: data.lastMessageTime ? new Date(data.lastMessageTime).toISOString() : null,
        };
      })
    );

    const all = [...directChats, ...groups].sort(
      (a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
    );

    console.log(`✅ Found ${all.length} conversations`);
    res.json({ success: true, data: all });
  } catch (err) {
    console.error('❌ Get conversations error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/conversations/direct  — create or get direct chat
router.post('/direct', authenticate, async (req, res) => {
  try {
    const uid    = req.user.uid;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    console.log(`💬 Direct chat: ${uid} ↔ ${userId}`);
    const chatId = [uid, userId].sort().join('_');
    const ref    = adminDb.collection('directChats').doc(chatId);
    const snap   = await ref.get();

    if (snap.exists()) {
      return res.json({ success: true, data: { ...snap.data(), _id: chatId } });
    }

    const otherUser = (await adminDb.collection('users').doc(userId).get()).data();
    const chatData  = {
      chatId,
      participants:        [uid, userId],
      lastMessage:         '',
      lastMessageTime:     0,
      otherUserId:         userId,
      otherUserName:       otherUser?.name        || '',
      otherUserEmail:      otherUser?.email       || '',
      otherUserProfileUrl: otherUser?.profileUrl  || '',
    };

    await ref.set(chatData);
    res.json({ success: true, data: { ...chatData, _id: chatId } });
  } catch (err) {
    console.error('❌ Create direct error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/conversations/group  — create group chat
router.post('/group', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { name, participantIds } = req.body;

    if (!name || !participantIds?.length) {
      return res.status(400).json({ success: false, message: 'name and participantIds are required' });
    }

    const allParticipants = [...new Set([uid, ...participantIds])];
    const groupData = {
      name,
      description:     '',
      groupImage:      '',
      createdBy:       uid,
      createdAt:       Date.now(),
      participants:    allParticipants,
      admins:          [uid],
      lastMessage:     '',
      lastMessageTime: 0,
    };

    const ref = await adminDb.collection('groups').add(groupData);
    console.log('✅ Group created:', ref.id);

    const io = req.app.locals.io;
    if (io) {
      allParticipants.forEach(pid => {
        io.to(pid).emit('group-created', {
          conversation: { ...groupData, _id: ref.id, id: ref.id, type: 'group' },
        });
      });
    }

    res.json({
      success: true,
      data: {
        ...groupData,
        _id:  ref.id,
        id:   ref.id,
        type: 'group',
      },
    });
  } catch (err) {
    console.error('❌ Create group error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/conversations/:id/add-members
router.post('/:id/add-members', authenticate, async (req, res) => {
  try {
    const uid            = req.user.uid;
    const conversationId = req.params.id;
    const { participantIds } = req.body;

    if (!participantIds?.length) {
      return res.status(400).json({ success: false, message: 'participantIds are required' });
    }

    const ref  = adminDb.collection('groups').doc(conversationId);
    const snap = await ref.get();
    if (!snap.exists()) return res.status(404).json({ success: false, message: 'Group not found' });

    const data    = snap.data();
    const admins  = data.admins || [];
    if (!admins.includes(uid)) {
      return res.status(403).json({ success: false, message: 'Only admins can add members' });
    }

    const current    = data.participants || [];
    const newMembers = participantIds.filter(id => !current.includes(id));
    if (!newMembers.length) {
      return res.status(400).json({ success: false, message: 'All selected users are already members' });
    }

    const updated = [...current, ...newMembers];
    await ref.update({ participants: updated });

    const io = req.app.locals.io;
    if (io) {
      updated.forEach(pid => {
        io.to(pid).emit('members-added', { conversationId, newMemberIds: newMembers });
      });
    }

    res.json({ success: true, message: `${newMembers.length} member(s) added` });
  } catch (err) {
    console.error('❌ Add members error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;