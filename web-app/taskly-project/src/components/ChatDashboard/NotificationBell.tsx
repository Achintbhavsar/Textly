import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';

interface Props {
  darkMode: boolean;
  onNotificationClick: (link: string) => void;
}

// Notification interface
interface Notification {
  _id: string;
  sender: {
    name?: string;
    avatar?: string;
    profilePic?: string;
  };
  message: string;
  isRead: boolean;
  createdAt: string;
  link: string;
}

// Component
const NotificationBell: React.FC<Props> = ({ darkMode }) => {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useSocket();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Deduplicate notifications
  const deduplicateNotifications = (notifications: Notification[]): Notification[] => {
    const uniqueNotifications = notifications.reduce((acc: Notification[], curr: Notification) => {
      const exists = acc.find((n) => n._id === curr._id); // Avoid duplicate IDs
      if (!exists) acc.push(curr);
      return acc;
    }, []);
    return uniqueNotifications; // Return deduplicated notifications
  };

  const deduplicatedNotifications = deduplicateNotifications(notifications);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleBellClick = () => {
    setOpen((prev) => !prev);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Icon */}
      <button
        onClick={handleBellClick}
        style={{
          width: '40px',
          height: '40px',
          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
          borderRadius: '50%',
          border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
          cursor: 'pointer',
        }}
      >
        🔔
        {unreadCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0 }}>{unreadCount}</span>}
      </button>

      {/* Notification Dropdown */}
      {open && (
        <ul>
          {deduplicatedNotifications.map((notification) => (
            <li key={notification._id}>
              <div>{notification.sender?.name || 'Unknown User'}</div>
              <div>{notification.message}</div>
              <button onClick={() => markAsRead(notification._id)}>Mark as Read</button>
              <button onClick={() => deleteNotification(notification._id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationBell;
