import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../config/firebase-admin.js';
import { sendMessageNotification } from '../services/onesignal.js';

const router = express.Router();

// Helper: write notification to Firestore
const createNotification = async (recipientUid, sender, type, message, link = null, metadata = {}) => {
  await adminDb
    .collection('notifications')
    .doc(recipientUid)
    .collection('items')
    .add({
      recipientUid,
      senderUid:    sender.uid,
      senderName:   sender.name  || '',
      senderAvatar: sender.profileUrl || '',
      type,
      message,
      link,
      isRead:    false,
      metadata,
      createdAt: Date.now(),
    });
};

// ── POST /api/messages/send
router.post('/send', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { text } = req.body;
    const conversationId = req.body.conversationId || req.body.chatId;

    if (!conversationId || !text) {
      return res.status(400).json({ success: false, message: 'conversationId and text are required' });
    }

    const isGroup = !conversationId.includes('_');
    const colName = isGroup ? 'groups' : 'directChats';

    const senderSnap = await adminDb.collection('users').doc(uid).get();
    const sender     = { uid, ...senderSnap.data() };

    const msgData = {
      id:          '',
      senderId:    uid,
      senderName:  sender.name        || '',
      senderImage: sender.profileUrl  || null,
      message:     text,
      imageUrl:    null,
      delivered:   false,
      read:        false,
      deliveredAt: 0,
      readAt:      0,
      createdAt:   Date.now(),
    };

    const msgRef = await adminDb
      .collection(colName)
      .doc(conversationId)
      .collection('messages')
      .add(msgData);

    await msgRef.update({ id: msgRef.id });

    // Update conversation preview
    await adminDb.collection(colName).doc(conversationId).set(
      { lastMessage: text, lastMessageTime: Date.now() },
      { merge: true }
    );

    // Get participants to notify
    const convSnap = await adminDb.collection(colName).doc(conversationId).get();
    const convData = convSnap.data() || {};
    const participants = convData.participants || [];
    const receivers    = participants.filter(p => p !== uid);

    const io = req.app.locals.io;

    const msgDataToSend = {
      ...msgData,
      id:  msgRef.id,
      _id: msgRef.id,
      text: msgData.message,
      content: msgData.message,
      sender: { _id: uid, name: sender.name },
    };

    for (const receiverId of receivers) {
      try {
        const truncated = `${sender.name || 'Someone'}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`;
        await createNotification(
          receiverId, sender, 'message', truncated,
          `/dashboard?conversation=${conversationId}`,
          { conversationId }
        );

        if (io) {
          io.to(receiverId).emit('receive-message', {
            conversationId,
            chatId: conversationId,
            message: msgDataToSend
          });
          io.to(receiverId).emit('new-message', {
            conversationId,
            chatId: conversationId,
            message: msgDataToSend
          });

          const notifSnap = await adminDb
            .collection('notifications').doc(receiverId).collection('items')
            .orderBy('createdAt', 'desc').limit(1).get();
          const notif = notifSnap.docs[0]
            ? { id: notifSnap.docs[0].id, ...notifSnap.docs[0].data() }
            : null;
          if (notif) io.to(receiverId).emit('newNotification', notif);
        }

        const userSnap = await adminDb.collection('users').doc(receiverId).get();
        if (userSnap.exists && userSnap.data().status !== 'online') {
          await sendMessageNotification({
            recipientUserId: receiverId,
            senderName:      sender.name || 'Someone',
            messageText:     text,
            conversationId,
            chatId:          conversationId,
          });
        }
      } catch (notifErr) {
        console.error('⚠️ Notification error:', notifErr.message);
      }
    }

    console.log(`✅ Message saved: "${text}" in conv: ${conversationId}`);
    res.json({
      success: true,
      data: {
        ...msgData,
        id:  msgRef.id,
        _id: msgRef.id,
        text,
        content: text,
        sender: { _id: uid, name: sender.name },
      },
    });
  } catch (err) {
    console.error('❌ Send message error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/messages/:conversationId
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const isGroup = !conversationId.includes('_');
    const colName = isGroup ? 'groups' : 'directChats';

    const snap = await adminDb
      .collection(colName)
      .doc(conversationId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        _id:     d.id,
        text:    data.message,
        content: data.message,
        sender:  { _id: data.senderId, name: data.senderName },
      };
    });

    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;