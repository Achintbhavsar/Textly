import React, {
  createContext, useContext,
  useEffect, useState, useRef, ReactNode
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Notification type ← ADD
export interface INotification {
  _id: string;
  recipient: string;
  sender: {
    _id: string;
    name: string;
    profilePic?: string;
  };
  type: 'message' | 'friend_request' | 'mention';
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: INotification[];                          // ← ADD
  unreadCount: number;                                     // ← ADD
  markAsRead: (id: string) => Promise<void>;               // ← ADD
  markAllAsRead: () => Promise<void>;                      // ← ADD
  deleteNotification: (id: string) => Promise<void>;       // ← ADD
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],       // ← ADD
  unreadCount: 0,          // ← ADD
  markAsRead: async () => {},       // ← ADD
  markAllAsRead: async () => {},    // ← ADD
  deleteNotification: async () => {}, // ← ADD
});

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<INotification[]>([]); // ← ADD

  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);

  // ── Fetch existing notifications on login ← ADD
  useEffect(() => {
    if (!user?.id) return;
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        const data = await res.json();
        if (Array.isArray(data)) setNotifications(data);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    fetchNotifications();
  }, [user?.id]);

  // ── Socket setup
  useEffect(() => {
    if (!user?.id) return;
    if (userIdRef.current === user.id) return;

    if (socketRef.current) {
      console.log('🧹 Cleaning old socket');
      socketRef.current.disconnect();
    }

    console.log('🔌 Creating socket for:', user.id);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
      setIsConnected(true);
      newSocket.emit('user-online', user.id);
      console.log('📡 Joined room for:', user.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('🚨 Connection error:', err.message);
    });

    // ── Listen for real-time notifications ← ADD
    newSocket.on('newNotification', (notification: INotification) => {
      console.log('🔔 New notification received:', notification);
      setNotifications(prev => [notification, ...prev]);
    });

    socketRef.current = newSocket;
    userIdRef.current = user.id;
    setSocket(newSocket);

    return () => {
      if (!user) {
        console.log('🧹 User logged out, disconnecting');
        newSocket.disconnect();
        socketRef.current = null;
        userIdRef.current = null;
      }
    };
  }, [user?.id]);

  // ── Logout cleanup
  useEffect(() => {
    if (!user && socketRef.current) {
      console.log('🧹 Logout cleanup');
      socketRef.current.disconnect();
      socketRef.current = null;
      userIdRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setNotifications([]); // ← ADD: clear on logout
    }
  }, [user]);

  // ── Notification helpers ← ADD
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        credentials: 'include',
      });
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('markAsRead error:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        credentials: 'include',
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('markAllAsRead error:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error('deleteNotification error:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      notifications,    // ← ADD
      unreadCount,      // ← ADD
      markAsRead,       // ← ADD
      markAllAsRead,    // ← ADD
      deleteNotification, // ← ADD
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);