import { useEffect, useCallback } from 'react';
import { db } from '../Firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, onSnapshot, orderBy, Unsubscribe } from 'firebase/firestore';

interface Message {
  id: string | number;
  senderId?: string;
  delivered?: boolean;
  read?: boolean;
  deliveredAt?: number;
  readAt?: number;
  [key: string]: any;
}

interface UseFirestoreMessagesProps {
  chatId: string | null;
  currentUserId: string;
  otherUserId: string | null;
  onMessagesUpdate: (messages: Message[]) => void;
}

export const useFirestoreMessages = ({
  chatId,
  currentUserId,
  otherUserId,
  onMessagesUpdate,
}: UseFirestoreMessagesProps) => {
  
  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!chatId || !otherUserId || !currentUserId || !chatId.includes('_')) return;

    try {
      const messagesRef = collection(db, 'directChats', chatId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '==', otherUserId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      const now = Date.now();

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          read: true,
          readAt: now,
          delivered: true,
          deliveredAt: now,
        });
      });

      await batch.commit();
      console.log(`✅ Marked ${snapshot.size} messages as read`);
    } catch (err) {
      console.error('❌ Error marking messages as read:', err);
    }
  }, [chatId, otherUserId, currentUserId]);

  // Mark messages as delivered
  const markMessagesAsDelivered = useCallback(async () => {
    if (!chatId || !otherUserId || !currentUserId || !chatId.includes('_')) return;

    try {
      const messagesRef = collection(db, 'directChats', chatId, 'messages');
      const q = query(
        messagesRef,
        where('senderId', '==', otherUserId),
        where('delivered', '==', false)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      const now = Date.now();

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          delivered: true,
          deliveredAt: now,
        });
      });

      await batch.commit();
      console.log(`✅ Marked ${snapshot.size} messages as delivered`);
    } catch (err) {
      console.error('❌ Error marking messages as delivered:', err);
    }
  }, [chatId, otherUserId, currentUserId]);

  // Listen to messages in real-time
  useEffect(() => {
    if (!chatId || !chatId.includes('_')) {
      onMessagesUpdate([]);
      return;
    }

    const messagesRef = collection(db, 'directChats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      const messages: Message[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          senderId: data.senderId || '',
          text: data.message || '',
          message: data.message || '',
          senderName: data.senderName || '',
          senderImage: data.senderImage || null,
          createdAt: data.createdAt || 0,
          delivered: data.delivered || false,
          read: data.read || false,
          deliveredAt: data.deliveredAt || 0,
          readAt: data.readAt || 0,
          sent: data.senderId === currentUserId,
          time: formatMessageTime(data.createdAt || 0),
        };
      });

      onMessagesUpdate(messages);
    }, (error) => {
      console.error('Error listening to messages:', error);
    });

    return () => unsubscribe();
  }, [chatId, currentUserId, onMessagesUpdate]);

  // Auto-mark as delivered when chat is opened
  useEffect(() => {
    if (chatId && otherUserId) {
      markMessagesAsDelivered();
    }
  }, [chatId, otherUserId, markMessagesAsDelivered]);

  return { markMessagesAsRead, markMessagesAsDelivered };
};

// Format message time to match Android format
function formatMessageTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const date = new Date(timestamp);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}
