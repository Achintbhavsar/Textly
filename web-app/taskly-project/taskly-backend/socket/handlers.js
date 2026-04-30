import { adminDb } from '../config/firebase-admin.js';
import { sendMessageNotification, sendCallNotification } from '../services/onesignal.js';

const userPeerIds    = {};
const connectedUsers = {}; // userId → socketId

let callsListenerActive = false;

const startFirestoreCallListener = (io) => {
  if (callsListenerActive) return;
  callsListenerActive = true;

  console.log('👂 Starting Firestore calls listener for Android → Web calls');

  adminDb.collection('calls')
    .where('callStatus', '==', 'RINGING')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const call = change.doc.data();
          const receiverId = call.receiverId;
          
          if (connectedUsers[receiverId]) {
            console.log(`📡 Forwarding Android call to Web user: ${receiverId}`);
            
            io.to(receiverId).emit('incoming-call', {
              from: call.callerId,
              fromName: call.callerName || 'Someone',
              offer: {
                type: call.offerType,
                sdp: call.offer,
              },
              callType: call.callType === 'VIDEO' ? 'video' : 'audio',
              callId: call.callId,
            });
          }
        }
      });
    }, (error) => {
      console.error('❌ Firestore calls listener error:', error.message);
      callsListenerActive = false;
    });
};

export const setupSocketHandlers = (io) => {
  startFirestoreCallListener(io);
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── User comes online
    socket.on('user-online', async (userId) => {
      if (!userId) {
        console.log('⚠️  user-online called without userId');
        return;
      }

      if (connectedUsers[userId] && connectedUsers[userId] !== socket.id) {
        console.log(`⚠️ User ${userId} already connected! Disconnecting old socket.`);
        io.to(connectedUsers[userId]).emit('duplicate-login', 'You have been logged out due to a new login.');
        io.to(connectedUsers[userId]).disconnectSockets(true);
      }

      connectedUsers[userId] = socket.id;
      socket.userId          = userId;
      socket.join(userId);

      console.log(`🟢 User online: ${userId} (Socket: ${socket.id})`);

      try {
        // Update Firestore users/{uid} — matches frontend's status field
        await adminDb.collection('users').doc(userId).set(
          { status: 'online', lastSeen: Date.now() },
          { merge: true }
        );
      } catch (err) {
        console.error('❌ Firestore error in user-online:', err.message);
      }

      socket.broadcast.emit('user-status-change', { userId, isOnline: true, status: 'online' });
    });

    // ── Forward messages to receiver(s) + Save to Firestore + OneSignal push notification
    socket.on('send-message', async ({ conversationId, chatId, message, receiverIds }) => {
      const targetId = conversationId || chatId;
      console.log('📨 send-message received:', { targetId, messageId: message?._id || message?.id, receiverIds });

      if (!targetId || !message || !receiverIds?.length) {
        console.error('❌ send-message missing required fields');
        return;
      }

      try {
        // ── STEP 0: Save message to Firestore if not already saved
        const isGroup = !targetId.includes('_');
        const colName = isGroup ? 'groups' : 'directChats';
        
        const senderId = message.senderId || message.sender?._id || socket.userId;
        const messageText = message.message || message.text || message.content || '';
        
        // Check if message already exists in Firestore
        let messageId = message._id || message.id;
        let savedMessage = message;
        
        if (!messageId || messageId.toString().length < 10) {
          // Message not saved yet, save it to Firestore
          console.log('💾 Saving message to Firestore:', { targetId, senderId, messageText });
          
          const senderSnap = await adminDb.collection('users').doc(senderId).get();
          const senderData = senderSnap.data() || {};
          
          const msgData = {
            id: '',
            senderId: senderId,
            senderName: message.senderName || senderData.name || '',
            senderImage: message.senderImage || senderData.profileUrl || null,
            message: messageText,
            imageUrl: message.imageUrl || null,
            delivered: false,
            read: false,
            deliveredAt: 0,
            readAt: 0,
            createdAt: message.createdAt || Date.now(),
          };
          
          const msgRef = await adminDb
            .collection(colName)
            .doc(targetId)
            .collection('messages')
            .add(msgData);
          
          await msgRef.update({ id: msgRef.id });
          messageId = msgRef.id;
          
          // Update conversation preview
          await adminDb.collection(colName).doc(targetId).set(
            { lastMessage: messageText, lastMessageTime: Date.now() },
            { merge: true }
          );
          
          savedMessage = {
            ...msgData,
            _id: messageId,
            id: messageId,
            text: messageText,
            content: messageText,
            sender: { _id: senderId, name: msgData.senderName },
          };
          
          console.log('✅ Message saved to Firestore:', messageId);
        } else {
          console.log('✅ Message already has ID, skipping Firestore save:', messageId);
        }

        // ── STEP 1: Emit via socket to all receivers
        receiverIds.forEach(receiverId => {
          console.log(`📤 Forwarding message to room: ${receiverId}`);
          io.to(receiverId).emit('receive-message', { 
            conversationId: targetId, 
            chatId: targetId, 
            message: savedMessage 
          });
          io.to(receiverId).emit('new-message', { 
            conversationId: targetId, 
            chatId: targetId, 
            message: savedMessage 
          });
        });

        // ── STEP 1.5: Auto-mark as delivered if receiver is online (for direct chats)
        if (targetId.includes('_')) {
          const onlineReceivers = receiverIds.filter(rid => connectedUsers[rid]);
          if (onlineReceivers.length > 0) {
            try {
              const msgRef = adminDb
                .collection('directChats')
                .doc(targetId)
                .collection('messages')
                .doc(messageId);
              
              await msgRef.update({
                delivered: true,
                deliveredAt: Date.now(),
              });
              
              console.log(`✅ Auto-marked message as delivered (receiver online)`);
            } catch (err) {
              console.error('❌ Error auto-marking as delivered:', err.message);
            }
          }
        }

        // ── STEP 2: OneSignal push for offline users
        for (const receiverId of receiverIds) {
          const isOnline = !!connectedUsers[receiverId];
          if (!isOnline) {
            console.log(`🔔 User ${receiverId} is offline, sending push notification`);
            await sendMessageNotification({
              recipientUserId: receiverId,
              senderName: savedMessage.senderName || 'Someone',
              messageText: messageText,
              conversationId: targetId,
              chatId: targetId,
            });
          } else {
            console.log(`✅ User ${receiverId} is online via socket, skipping push`);
          }
        }
      } catch (err) {
        console.error('❌ Error in send-message handler:', err.message);
      }
    });

    // ── Mark messages as seen
    socket.on('mark-seen', async ({ conversationId, chatId, seenBy, receiverIds }) => {
      const targetId = conversationId || chatId;
      console.log('👁️  mark-seen:', { targetId, seenBy, receiverIds });
      if (!targetId || !seenBy || !receiverIds?.length) return;
      
      // Update Firestore for direct chats
      if (targetId.includes('_')) {
        try {
          const messagesRef = adminDb
            .collection('directChats')
            .doc(targetId)
            .collection('messages');
          
          const unreadSnapshot = await messagesRef
            .where('senderId', '!=', seenBy)
            .where('read', '==', false)
            .get();
          
          if (!unreadSnapshot.empty) {
            const batch = adminDb.batch();
            const now = Date.now();
            
            unreadSnapshot.docs.forEach(doc => {
              batch.update(doc.ref, {
                read: true,
                readAt: now,
                delivered: true,
                deliveredAt: now,
              });
            });
            
            await batch.commit();
            console.log(`✅ Marked ${unreadSnapshot.size} messages as read in Firestore`);
          }
        } catch (err) {
          console.error('❌ Error marking messages as seen in Firestore:', err.message);
        }
      }
      
      receiverIds.forEach(rid => io.to(rid).emit('messages-seen', { conversationId: targetId, chatId: targetId, seenBy }));
    });

    // ── Typing
    socket.on('typing', async ({ conversationId, chatId, userId, receiverIds, userName }) => {
      const targetId = conversationId || chatId;
      console.log('⌨️  Typing event:', { targetId, userId, receiverIds });
      if (!receiverIds?.length || !targetId || !userId) return;
      
      // Update Firestore typing status for direct chats
      if (targetId.includes('_')) {
        try {
          await adminDb
            .collection('directChats')
            .doc(targetId)
            .collection('typing')
            .doc(userId)
            .set({
              isTyping: true,
              timestamp: Date.now(),
            }, { merge: true });
        } catch (err) {
          console.error('❌ Error updating Firestore typing status:', err.message);
        }
      }
      
      receiverIds.forEach(rid =>
        io.to(rid).emit('user-typing', { conversationId: targetId, chatId: targetId, userId, userName: userName || 'Someone' })
      );
    });

    // ── Stop-typing
    socket.on('stop-typing', async ({ conversationId, chatId, userId, receiverIds }) => {
      const targetId = conversationId || chatId;
      if (!receiverIds || !targetId || !userId) return;
      
      // Update Firestore typing status for direct chats
      if (targetId.includes('_')) {
        try {
          await adminDb
            .collection('directChats')
            .doc(targetId)
            .collection('typing')
            .doc(userId)
            .set({
              isTyping: false,
              timestamp: Date.now(),
            }, { merge: true });
        } catch (err) {
          console.error('❌ Error updating Firestore stop-typing status:', err.message);
        }
      }
      
      receiverIds.forEach(rid => io.to(rid).emit('user-stop-typing', { conversationId: targetId, chatId: targetId, userId }));
    });

    // ── WebRTC: call offer + OneSignal push
    socket.on('call-offer', async ({ to, offer, callType, callerName, conversationId, callId }) => {
      console.log(`📞 call-offer from ${socket.userId} to ${to}, callerName: ${callerName}`);
      
      // Get caller info from Firestore if callerName is missing
      let finalCallerName = callerName;
      if (!finalCallerName || finalCallerName === 'Unknown') {
        try {
          const callerSnap = await adminDb.collection('users').doc(socket.userId).get();
          const callerData = callerSnap.data();
          finalCallerName = callerData?.name || callerData?.email?.split('@')[0] || 'Someone';
          console.log(`✅ Fetched caller name from Firestore: ${finalCallerName}`);
        } catch (err) {
          console.error('❌ Error fetching caller name:', err.message);
          finalCallerName = 'Someone';
        }
      }
      
      io.to(to).emit('incoming-call', {
        from: socket.userId,
        fromName: finalCallerName,
        offer,
        callType,
        callId
      });

      try {
        await sendCallNotification({
          recipientUserId: to,
          callerName: finalCallerName,
          callType: callType || 'audio',
          conversationId: conversationId || to,
        });
        console.log(`🔔 Call notification sent to: ${to}`);
      } catch (err) {
        console.error('❌ Failed to send call notification:', err.message);
      }
    });

    // ── WebRTC: call answer
    socket.on('call-answer', ({ to, answer }) => {
      console.log(`📞 call-answer from ${socket.userId} to ${to}`);
      io.to(to).emit('call-answered', { answer });
    });

    // ── WebRTC: ICE candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { candidate });
    });

    // ── WebRTC: call rejected
    socket.on('call-rejected', ({ to }) => {
      console.log(`📞 call-rejected from ${socket.userId} to ${to}`);
      io.to(to).emit('call-rejected');
    });

    // ── WebRTC: call ended
    socket.on('call-ended', ({ to }) => {
      console.log(`📞 call-ended from ${socket.userId} to ${to}`);
      io.to(to).emit('call-ended');
    });

    // ── WebRTC: end call (legacy)
    socket.on('end-call', ({ to }) => {
      console.log(`📞 end-call from ${socket.userId} to ${to}`);
      io.to(to).emit('call-ended');
    });

    // ── User disconnects → set offline in Firestore
    socket.on('disconnect', async () => {
      if (!socket.userId) {
        console.log(`🔴 Socket disconnected: ${socket.id} (No userId assigned)`);
        return;
      }

      console.log(`🔴 User offline: ${socket.userId} (Socket: ${socket.id})`);
      delete connectedUsers[socket.userId];
      delete userPeerIds[socket.userId];

      try {
        await adminDb.collection('users').doc(socket.userId).set(
          { status: 'offline', lastSeen: Date.now() },
          { merge: true }
        );
      } catch (err) {
        console.error('❌ Firestore error on disconnect:', err.message);
      }

      socket.broadcast.emit('user-status-change', {
        userId:   socket.userId,
        isOnline: false,
        status:   'offline',
        lastSeen: Date.now(),
      });
    });
  });
};