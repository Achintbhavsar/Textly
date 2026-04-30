import { useEffect, useRef, useCallback } from 'react';
import { db } from '../Firebase/config';
import { doc, setDoc, updateDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

interface UseFirestoreTypingProps {
  chatId: string | null;
  currentUserId: string;
  otherUserId: string | null;
  onTypingChange: (isTyping: boolean) => void;
}

export const useFirestoreTyping = ({
  chatId,
  currentUserId,
  otherUserId,
  onTypingChange,
}: UseFirestoreTypingProps) => {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerRef = useRef<Unsubscribe | null>(null);

  // Set typing status in Firestore
  const setTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!chatId || !currentUserId || !chatId.includes('_')) return;

    try {
      const typingRef = doc(db, 'directChats', chatId, 'typing', currentUserId);
      const data = {
        isTyping,
        timestamp: Date.now(),
      };

      try {
        await updateDoc(typingRef, data);
      } catch {
        await setDoc(typingRef, data);
      }
    } catch (err) {
      console.error('Error updating typing status:', err);
    }
  }, [chatId, currentUserId]);

  // Trigger typing indicator
  const onTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 3000);
  }, [setTypingStatus]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingStatus(false);
  }, [setTypingStatus]);

  // Listen for other user's typing status
  useEffect(() => {
    if (!chatId || !otherUserId || !chatId.includes('_')) {
      onTypingChange(false);
      return;
    }

    if (listenerRef.current) {
      listenerRef.current();
    }

    const typingRef = doc(db, 'directChats', chatId, 'typing', otherUserId);
    
    try {
      listenerRef.current = onSnapshot(typingRef, (snapshot) => {
        if (!snapshot.exists()) {
          onTypingChange(false);
          return;
        }

        const data = snapshot.data();
        const isTyping = data?.isTyping || false;
        const timestamp = data?.timestamp || 0;
        const isRecent = (Date.now() - timestamp) < 4000;

        onTypingChange(isTyping && isRecent);
      }, (error) => {
        console.error('Error listening to typing status:', error);
        onTypingChange(false);
      });
    } catch (error) {
      console.error('Error setting up typing listener:', error);
      onTypingChange(false);
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [chatId, otherUserId, onTypingChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (listenerRef.current) {
        listenerRef.current();
      }
      if (chatId && currentUserId) {
        setTypingStatus(false);
      }
    };
  }, [chatId, currentUserId, setTypingStatus]);

  return { onTyping, stopTyping };
};
