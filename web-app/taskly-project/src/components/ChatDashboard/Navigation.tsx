import React from 'react';
import { Section } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

interface NavigationProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  darkMode: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ activeSection, setActiveSection, darkMode }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  
  
  // Toggle notification panel like other sections
  const toggleNotifications = () => {
    if (activeSection === 'notifications') {
      // If already on notifications, go back to chats
      setActiveSection('chats');
    } else {
      // Switch to notifications panel
      setActiveSection('notifications');
    }
  };

  return (
    <nav className={`navigation ${darkMode ? 'dark' : 'light'}`}>
      <div className="nav-logo" title="Textly">
        <span className="material-icons">textsms</span>
      </div>

      <div className="nav-group">
        <button
          className={`nav-btn ${activeSection === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveSection('chats')}
          title="Chats"
        >
          <span className="material-icons">chat_bubble_outline</span>
        </button>

        <button
          className={`nav-btn ${activeSection === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveSection('friends')}
          title="Friends"
        >
          <span className="material-icons">group</span>
        </button>
        
        <button
          className={`nav-btn ${activeSection === 'notifications' ? 'active' : ''}`}
          onClick={toggleNotifications}
          title="Notifications"
        >
          <span className="material-icons">notifications</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: '#ef4444',
              color: 'white',
              fontSize: 10,
              fontWeight: 'bold',
              borderRadius: '50%',
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="nav-bottom">
        <button
          className={`nav-btn ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
          title="Settings"
        >
          <span className="material-icons">settings</span>
        </button>
        <button
          className="nav-btn logout-btn"
          onClick={logout}
          title="Logout"
        >
          <span className="material-icons">logout</span>
        </button>
        <div className="nav-divider"></div>
        <div className="nav-user-avatar" title={user?.name || 'My Profile'}>
          {getUserInitials()}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
