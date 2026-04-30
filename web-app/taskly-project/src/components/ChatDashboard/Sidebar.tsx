// src/components/ChatDashboard/Sidebar.tsx

import React, { useState } from 'react';
import { Contact, Section } from './types';
import { useSocket } from '../../contexts/SocketContext';
import api from '../../services/api';

// ── Group color helpers
const GROUP_COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#d97706','#dc2626'];
const getColor = (name: string) => GROUP_COLORS[(name?.charCodeAt(0) || 0) % GROUP_COLORS.length];

// ── Group Avatar Component
const GroupAvatar: React.FC<{ members: any[]; name: string; size?: number }> = ({
  members, name, size = 44
}) => {
  const visible = members.slice(0, 4);

  if (visible.length === 0) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 800, fontSize: size * 0.25, flexShrink: 0
      }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  if (visible.length <= 2) {
    return (
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        {visible.map((m, i) => {
          const mname = m?.name || m?.email || '?';
          return (
            <div key={i} style={{
              position: 'absolute',
              width: size * 0.65, height: size * 0.65,
              borderRadius: '50%', background: getColor(mname),
              border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: size * 0.22,
              top: i === 0 ? 0 : undefined,
              bottom: i === 1 ? 0 : undefined,
              left: i === 0 ? 0 : undefined,
              right: i === 1 ? 0 : undefined,
            }}>
              {mname[0]?.toUpperCase()}
            </div>
          );
        })}
      </div>
    );
  }

  const half = Math.ceil(visible.length / 2);
  const rows = [visible.slice(0, half), visible.slice(half)];

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      border: '2px solid #e2e8f0'
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', flex: 1 }}>
          {row.map((m, ci) => {
            const mname = m?.name || m?.email || '?';
            return (
              <div key={ci} style={{
                flex: 1, background: getColor(mname),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700,
                fontSize: size * 0.22,
                borderRight: ci < row.length - 1 ? '1px solid white' : 'none',
                borderBottom: ri === 0 ? '1px solid white' : 'none',
              }}>
                {mname[0]?.toUpperCase()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Privacy Row Component
const PrivacyRow: React.FC<{
  item: { label: string; desc: string };
  darkMode: boolean;
  textColor: string;
  value: boolean;
  onChange: (val: boolean) => void;
}> = ({ item, textColor, value, onChange }) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid #f1f5f9', gap: 12
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: textColor }}>{item.label}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '42px', height: '24px', borderRadius: '12px', cursor: 'pointer',
          position: 'relative', transition: 'background 0.2s',
          border: 'none', outline: 'none', flexShrink: 0,
          background: value ? '#2563eb' : '#e2e8f0'
        }}
      >
        <div style={{
          position: 'absolute', top: '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          background: 'white', transition: 'transform 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: `translateX(${value ? 20 : 3}px)`
        }} />
      </button>
    </div>
  );
};

interface SidebarProps {
  activeSection: Section;
  setActiveContactId: (id: string | null) => void;
  activeContactId: string | null;
  contacts: Contact[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  currentUser?: any;
  onNewChat?: () => void;
  onNewGroup?: () => void;
  setActiveSection: (section: Section) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  setActiveContactId,
  activeContactId,
  contacts,
  darkMode,
  onToggleDarkMode,
  onNewChat,
  onNewGroup,
  setActiveSection,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsPanel, setSettingsPanel] = useState<string | null>(null);

  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileVibe, setProfileVibe] = useState(currentUser?.vibeStatus || '👋 Hey, I am using Textly!');
  const [saving, setSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [starRating, setStarRating] = useState(4);
  const [review, setReview] = useState('');
  const [ratingSaved, setRatingSaved] = useState(false);

  const [privacy, setPrivacy] = useState({
    showLastSeen: true, showOnlineStatus: true, showProfilePhoto: true,
    showVibeStatus: true, showReadReceipts: true, showTyping: true,
  });
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await api.users.updateProfile({ name: profileName, vibeStatus: profileVibe });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      alert('❌ Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    try {
      setPrivacySaving(true);
      await api.users.updatePrivacy(privacy);
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 3000);
    } catch (err) {
      alert('❌ Failed to save privacy settings');
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleSubmitRating = async () => {
    try {
      await api.users.submitRating({ stars: starRating, review });
      setRatingSaved(true);
      setTimeout(() => setRatingSaved(false), 3000);
    } catch (err) {
      alert('❌ Failed to submit rating');
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors = { online: '#22c55e', away: '#f59e0b', offline: '#94a3b8' };
  const bgColor = darkMode ? '#1e293b' : '#ffffff';
  const textColor = darkMode ? '#e2e8f0' : '#0f172a';
  const secondaryText = darkMode ? '#94a3b8' : '#64748b';

  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useSocket();

  return (
    <aside style={{ ...styles.sidebar, background: bgColor }}>

      {/* ── CHATS SECTION ── */}
      {activeSection === 'chats' && (
        <div style={styles.panelContent}>
          <div style={styles.sbHead}>
            <span style={{ ...styles.sbTitle, color: textColor }}>Messages</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={styles.iBtn} title="New Group" onClick={onNewGroup}>
                <span className="material-icons" style={{ fontSize: 20 }}>group_add</span>
              </button>
              <button style={styles.iBtn} title="New Chat" onClick={onNewChat}>
                <span className="material-icons">person_add</span>
              </button>
            </div>
          </div>

          <div style={styles.searchWrap}>
            <span className="material-icons" style={styles.searchIco}>search</span>
            <input
              style={{
                ...styles.searchIn,
                background: darkMode ? '#0f172a' : '#f8fafc',
                color: darkMode ? '#e2e8f0' : '#334155'
              }}
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={styles.listScroll}>
            {filteredContacts.map(contact => {
              const isActive = contact.id === activeContactId;
              const members = (contact as any).members || [];

              return (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    paddingTop: 11, paddingBottom: 11, paddingRight: 16,
                    paddingLeft: isActive ? 13 : 16,
                    cursor: 'pointer', transition: 'background 0.1s',
                    borderBottom: '1px solid #f8fafc',
                    background: isActive ? '#eff6ff' : 'transparent',
                    borderLeft: isActive ? '3px solid #2563eb' : 'none',
                  }}
                  onClick={() => setActiveContactId(contact.id)}
                >
                  {/* ── Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {contact.type === 'group' ? (
                      <GroupAvatar members={members} name={contact.name} size={44} />
                    ) : (
                      <>
                        <div style={{
                          ...styles.cAv, background: contact.color,
                          width: '44px', height: '44px'
                        }}>
                          {contact.avatar}
                        </div>
                        <span style={{ ...styles.sdot, background: statusColors[contact.status] }} />
                      </>
                    )}
                  </div>

                  {/* ── Info */}
                  <div style={styles.cInfo}>
                    <div style={styles.cRow}>
                      <span style={{ ...styles.cName, color: textColor }}>
                        {contact.name}
                      </span>
                      <span style={styles.cTime}>{contact.time}</span>
                    </div>
                    <div style={styles.cRow}>
                      <span style={{ ...styles.cLast, color: secondaryText }}>
                        {contact.type === 'group' && !contact.lastMessage
                          ? `${(contact as any).memberCount || members.length || 0} members`
                          : contact.lastMessage}
                      </span>
                      {contact.unread > 0 && (
                        <span style={styles.cBadge}>{contact.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FRIENDS SECTION ── */}
      {activeSection === 'friends' && (
        <div style={styles.panelContent}>
          <div style={styles.sbHead}>
            <span style={{ ...styles.sbTitle, color: textColor }}>Friends</span>
          </div>
          <div style={styles.listScroll}>
            {contacts.filter(c => c.type === 'direct').length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: secondaryText }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                <div style={{ fontSize: '16px', fontWeight: '500' }}>No friends yet</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Start a chat to add friends!</div>
              </div>
            ) : (
              contacts.filter(c => c.type === 'direct').map(contact => (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px', cursor: 'pointer',
                    borderBottom: '1px solid #f8fafc',
                    background: contact.id === activeContactId ? '#eff6ff' : 'transparent',
                    borderLeft: contact.id === activeContactId ? '3px solid #2563eb' : '3px solid transparent',
                  }}
                  onClick={() => { setActiveContactId(contact.id); setActiveSection('chats'); }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ ...styles.cAv, background: contact.color, width: '44px', height: '44px' }}>
                      {contact.avatar}
                    </div>
                    <span style={{ ...styles.sdot, background: contact.status === 'online' ? '#22c55e' : contact.status === 'away' ? '#f59e0b' : '#94a3b8' }} />
                  </div>
                  <div style={styles.cInfo}>
                    <div style={{ ...styles.cName, color: textColor }}>{contact.name}</div>
                    <div style={{ fontSize: '12px', color: contact.status === 'online' ? '#22c55e' : secondaryText }}>
                      {contact.status === 'online' ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS SECTION ── */}
      {activeSection === 'notifications' && (
        <div style={styles.panelContent}>
          <div style={styles.sbHead}>
            <span style={{ ...styles.sbTitle, color: textColor }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{ ...styles.iBtn, fontSize: '12px', padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none' }}
              >
                Mark All Read
              </button>
            )}
          </div>
          <div style={styles.listScroll}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: secondaryText }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔔</div>
                <div style={{ fontSize: '16px', fontWeight: '500' }}>No notifications</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>You're all caught up!</div>
              </div>
            ) : (
              notifications.map((notification: any) => (
                <div
                  key={notification._id}
                  onClick={async () => {
                    if (!notification.isRead) await markAsRead(notification._id);
                    if (notification.link) {
                      const params = new URLSearchParams(notification.link.split('?')[1]);
                      const conversationId = params.get('conversation');
                      if (conversationId) {
                        setActiveContactId(conversationId);
                        setActiveSection('chats');
                      }
                    }
                  }}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: notification.isRead ? 'transparent' : '#eff6ff',
                    borderLeft: notification.isRead ? '3px solid transparent' : '3px solid #3b82f6',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0,
                    }}>
                      {notification.sender?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{
                          fontSize: '14px', fontWeight: notification.isRead ? '500' : '600',
                          color: textColor, whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis', flex: 1, marginRight: '8px',
                        }}>
                          {notification.sender?.name || 'Someone'}
                        </div>
                        <div style={{ fontSize: '11px', color: secondaryText, flexShrink: 0 }}>
                          {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: secondaryText, lineHeight: '1.4' }}>
                        {notification.message}
                      </div>
                      {!notification.isRead && (
                        <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', marginTop: '8px' }} />
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotification(notification._id); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '4px', opacity: 0.7, flexShrink: 0 }}
                    >×</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS SECTION ── */}
      {activeSection === 'settings' && (
        <div style={styles.panelContent}>
          <div style={{ ...styles.panelHdr, color: textColor }}>Settings</div>
          <div style={styles.listScroll}>

            {/* Profile Card */}
            <div
              style={{
                margin: '10px 12px 14px', padding: '14px',
                background: darkMode ? 'linear-gradient(135deg, #1e3a8a22, #2563eb22)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                borderRadius: '12px', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer'
              }}
              onClick={() => setSettingsPanel('editProfile')}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0,
                border: '2px solid white', boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
              }}>
                {(profileName || currentUser?.name)?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#93c5fd' : '#1e3a8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profileName || currentUser?.name || 'Your Name'}
                </div>
                <div style={{ fontSize: 11, color: darkMode ? '#60a5fa' : '#3b82f6', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser?.email || ''}
                </div>
                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 3 }}>{profileVibe}</div>
              </div>
              <span className="material-icons" style={{ color: '#3b82f6', fontSize: 18 }}>edit</span>
            </div>

            <div style={styles.secLabel}>Preferences</div>

            <div style={styles.setRow} onClick={onToggleDarkMode}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#f5f3ff' }}>
                  <span className="material-icons" style={{ color: '#7c3aed', fontSize: 18 }}>dark_mode</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: textColor }}>Dark Mode</div>
                  <div style={styles.setSub}>Switch to dark theme</div>
                </div>
              </div>
              <button style={{ ...styles.toggle, background: darkMode ? '#2563eb' : '#e2e8f0' }}>
                <div style={{ ...styles.toggleThumb, transform: `translateX(${darkMode ? 20 : 3}px)` }} />
              </button>
            </div>

            <div style={styles.setRow} onClick={() => setSettingsPanel('language')}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#eff6ff' }}>
                  <span className="material-icons" style={{ color: '#2563eb', fontSize: 18 }}>language</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: textColor }}>Language</div>
                  <div style={styles.setSub}>App display language</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>English</span>
                <span className="material-icons" style={{ color: '#94a3b8', fontSize: 16 }}>chevron_right</span>
              </div>
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '8px 16px' }} />
            <div style={styles.secLabel}>Account</div>

            <div style={styles.setRow} onClick={() => setSettingsPanel('editProfile')}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#eff6ff' }}>
                  <span className="material-icons" style={{ color: '#2563eb', fontSize: 18 }}>person_outline</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: textColor }}>Edit Profile</div>
                  <div style={styles.setSub}>Name, avatar, vibe status</div>
                </div>
              </div>
              <span className="material-icons" style={{ color: '#94a3b8', fontSize: 16 }}>chevron_right</span>
            </div>

            <div style={styles.setRow} onClick={() => setSettingsPanel('privacy')}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#f0fdf4' }}>
                  <span className="material-icons" style={{ color: '#22c55e', fontSize: 18 }}>lock_outline</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: textColor }}>Privacy</div>
                  <div style={styles.setSub}>Who can see your info</div>
                </div>
              </div>
              <span className="material-icons" style={{ color: '#94a3b8', fontSize: 16 }}>chevron_right</span>
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '8px 16px' }} />
            <div style={styles.secLabel}>About & Support</div>

            <div style={styles.setRow} onClick={() => setSettingsPanel('rate')}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#fefce8' }}>
                  <span className="material-icons" style={{ color: '#f59e0b', fontSize: 18 }}>star_outline</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: textColor }}>Rate Textly</div>
                  <div style={styles.setSub}>Love the app? Tell us!</div>
                </div>
              </div>
              <span className="material-icons" style={{ color: '#94a3b8', fontSize: 16 }}>chevron_right</span>
            </div>

            <div style={styles.setRow} onClick={() => setSettingsPanel('about')}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#fff7ed' }}>
                  <span className="material-icons" style={{ color: '#ea580c', fontSize: 18 }}>info_outline</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: textColor }}>About Textly</div>
                  <div style={styles.setSub}>Version, team, licenses</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#eff6ff', color: '#2563eb' }}>v1.0</span>
                <span className="material-icons" style={{ color: '#94a3b8', fontSize: 16 }}>chevron_right</span>
              </div>
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '8px 16px' }} />

            <div style={styles.setRow}>
              <div style={styles.setRowLeft}>
                <div style={{ ...styles.setIcon, background: darkMode ? '#1e293b' : '#fef2f2' }}>
                  <span className="material-icons" style={{ color: '#ef4444', fontSize: 18 }}>logout</span>
                </div>
                <div>
                  <div style={{ ...styles.setLabel, color: '#ef4444' }}>Log Out</div>
                  <div style={styles.setSub}>Sign out of your account</div>
                </div>
              </div>
            </div>

          </div>

          {/* ── DETAIL PANELS ── */}
          {settingsPanel && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: darkMode ? '#1e293b' : '#ffffff',
              zIndex: 10, display: 'flex', flexDirection: 'column',
              animation: 'slideIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <button
                  onClick={() => setSettingsPanel(null)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
                    background: darkMode ? '#0f172a' : 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: darkMode ? '#e2e8f0' : '#475569'
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>arrow_back</span>
                </button>
                <span style={{ fontSize: 16, fontWeight: 700, color: textColor }}>
                  {settingsPanel === 'editProfile' && 'Edit Profile'}
                  {settingsPanel === 'language' && 'Language'}
                  {settingsPanel === 'privacy' && 'Privacy'}
                  {settingsPanel === 'rate' && 'Rate Textly'}
                  {settingsPanel === 'about' && 'About Textly'}
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

                {settingsPanel === 'editProfile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24, background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 28, boxShadow: '0 4px 20px rgba(37,99,235,0.25)' }}>
                        {(profileName || currentUser?.name)?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: textColor }}>{profileName || currentUser?.name}</div>
                      <div style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%' }} /> Online
                      </div>
                    </div>
                    <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>Personal Info</div>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>FULL NAME</div>
                        <input style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13.5, fontFamily: 'Inter, sans-serif', outline: 'none', background: darkMode ? '#1e293b' : '#f8fafc', color: textColor }} value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your name" />
                      </div>
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>EMAIL</div>
                        <input style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13.5, fontFamily: 'Inter, sans-serif', outline: 'none', background: darkMode ? '#1e293b' : '#f8fafc', color: textColor, opacity: 0.7 }} defaultValue={currentUser?.email} disabled />
                      </div>
                    </div>
                    <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>Vibe Status</div>
                      <div style={{ padding: '12px 16px' }}>
                        <input style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13.5, fontFamily: 'Inter, sans-serif', outline: 'none', background: darkMode ? '#1e293b' : '#f8fafc', color: textColor }} value={profileVibe} onChange={e => setProfileVibe(e.target.value)} placeholder="Set a vibe status..." />
                      </div>
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving} style={{ background: profileSaved ? '#22c55e' : saving ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: saving ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}>
                      <span className="material-icons" style={{ fontSize: 18 }}>{profileSaved ? 'check_circle' : saving ? 'autorenew' : 'check'}</span>
                      {profileSaved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {settingsPanel === 'language' && (
                  <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    {[
                      { flag: '🇺🇸', name: 'English', native: 'English', selected: true },
                      { flag: '🇮🇳', name: 'Hindi', native: 'हिन्दी', selected: false },
                      { flag: '🇮🇳', name: 'Gujarati', native: 'ગુજરાતી', selected: false },
                      { flag: '🇪🇸', name: 'Spanish', native: 'Español', selected: false },
                      { flag: '🇫🇷', name: 'French', native: 'Français', selected: false },
                      { flag: '🇩🇪', name: 'German', native: 'Deutsch', selected: false },
                      { flag: '🇯🇵', name: 'Japanese', native: '日本語', selected: false },
                    ].map((lang, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: lang.selected ? (darkMode ? '#1e3a8a22' : '#eff6ff') : 'transparent' }}>
                        <span style={{ fontSize: 22 }}>{lang.flag}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: textColor }}>{lang.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{lang.native}</div>
                        </div>
                        {lang.selected && <span className="material-icons" style={{ color: '#2563eb', fontSize: 20 }}>check_circle</span>}
                      </div>
                    ))}
                  </div>
                )}

                {settingsPanel === 'privacy' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>Visibility</div>
                      <PrivacyRow item={{ label: 'Last Seen', desc: 'Who can see when you were last online' }} darkMode={darkMode} textColor={textColor} value={privacy.showLastSeen} onChange={v => setPrivacy(p => ({ ...p, showLastSeen: v }))} />
                      <PrivacyRow item={{ label: 'Online Status', desc: 'Show when you are active' }} darkMode={darkMode} textColor={textColor} value={privacy.showOnlineStatus} onChange={v => setPrivacy(p => ({ ...p, showOnlineStatus: v }))} />
                      <PrivacyRow item={{ label: 'Profile Photo', desc: 'Who can see your profile picture' }} darkMode={darkMode} textColor={textColor} value={privacy.showProfilePhoto} onChange={v => setPrivacy(p => ({ ...p, showProfilePhoto: v }))} />
                      <PrivacyRow item={{ label: 'Vibe Status', desc: 'Who can see your vibe status' }} darkMode={darkMode} textColor={textColor} value={privacy.showVibeStatus} onChange={v => setPrivacy(p => ({ ...p, showVibeStatus: v }))} />
                    </div>
                    <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>Messages</div>
                      <PrivacyRow item={{ label: 'Read Receipts', desc: 'Let others know when you read messages' }} darkMode={darkMode} textColor={textColor} value={privacy.showReadReceipts} onChange={v => setPrivacy(p => ({ ...p, showReadReceipts: v }))} />
                      <PrivacyRow item={{ label: 'Typing Indicator', desc: 'Show when you are typing' }} darkMode={darkMode} textColor={textColor} value={privacy.showTyping} onChange={v => setPrivacy(p => ({ ...p, showTyping: v }))} />
                    </div>
                    <button onClick={handleSavePrivacy} disabled={privacySaving} style={{ background: privacySaved ? '#22c55e' : privacySaving ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: privacySaving ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}>
                      <span className="material-icons" style={{ fontSize: 18 }}>{privacySaved ? 'check_circle' : 'lock'}</span>
                      {privacySaved ? 'Settings Saved!' : privacySaving ? 'Saving...' : 'Save Privacy Settings'}
                    </button>
                  </div>
                )}

                {settingsPanel === 'rate' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 48 }}>{ratingSaved ? '🎉' : '😍'}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: textColor }}>{ratingSaved ? 'Thank you!' : 'Enjoying Textly?'}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>{ratingSaved ? 'Your feedback means a lot to us! ❤️' : 'Your feedback helps us improve!'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[1,2,3,4,5].map(i => (
                          <span key={i} onClick={() => setStarRating(i)} style={{ fontSize: 32, cursor: 'pointer', color: i <= starRating ? '#f59e0b' : '#e2e8f0', userSelect: 'none', transition: 'color 0.15s' }}>★</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{starRating} out of 5 stars</div>
                      <textarea value={review} onChange={e => setReview(e.target.value)} style={{ width: '100%', height: 80, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', resize: 'none', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', background: darkMode ? '#1e293b' : '#f8fafc', color: textColor }} placeholder="Tell us what you think... (optional)" />
                      <button onClick={handleSubmitRating} style={{ background: ratingSaved ? '#22c55e' : '#f59e0b', color: 'white', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif', cursor: 'pointer', width: '100%', transition: 'background 0.2s' }}>
                        {ratingSaved ? '✅ Rating Submitted!' : '⭐ Submit Rating'}
                      </button>
                    </div>
                  </div>
                )}

                {settingsPanel === 'about' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb, #7c3aed)', borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'white' }}>
                      <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, fontFamily: 'monospace' }}>T</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>Textly</div>
                      <div style={{ fontSize: 12, opacity: 0.8, textAlign: 'center' }}>Real-time chat for everyone, everywhere</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20 }}>v1.0.0 • Build 2026</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[{ value: '2', label: 'Developers' }, { value: '∞', label: 'Messages' }, { value: '100%', label: 'Free' }].map((s, i) => (
                        <div key={i} style={{ flex: 1, background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, textTransform: 'uppercase' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: darkMode ? '#0f172a' : '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px 8px', borderBottom: '1px solid #f1f5f9' }}>Tech Stack</div>
                      {[
                        { label: 'Frontend', value: 'React + TypeScript' },
                        { label: 'Backend', value: 'Node.js + Express' },
                        { label: 'Database', value: 'MongoDB' },
                        { label: 'Real-time', value: 'Socket.io' },
                        { label: 'Mobile', value: 'Android (Kotlin)' },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 500, color: textColor }}>{item.label}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', paddingBottom: 8 }}>Made with ❤️ by Dhruv & Achint · 2026</div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: '300px', height: '100%', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', overflow: 'hidden' },
  panelContent: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  sbHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  sbTitle: { fontSize: '18px', fontWeight: 700 },
  iBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '7px', borderRadius: '8px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  searchWrap: { position: 'relative', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  searchIco: { position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '18px', pointerEvents: 'none' },
  searchIn: { width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' },
  listScroll: { flex: 1, overflowY: 'auto' },
  cAv: { borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '13px' },
  sdot: { position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid white' },
  cInfo: { flex: 1, minWidth: 0 },
  cRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' },
  cName: { fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cTime: { fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginLeft: '6px' },
  cLast: { fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  cBadge: { background: '#2563eb', color: 'white', fontSize: '10px', fontWeight: 700, borderRadius: '20px', padding: '2px 6px', flexShrink: 0, marginLeft: '4px' },
  panelHdr: { padding: '16px 18px 12px', fontSize: '17px', fontWeight: 700, borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  secLabel: { padding: '14px 18px 6px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  setRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.1s' },
  setRowLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  setIcon: { width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  setLabel: { fontSize: '13.5px', fontWeight: 500 },
  setSub: { fontSize: '11.5px', color: '#94a3b8', marginTop: '1px' },
  toggle: { width: '42px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', border: 'none', outline: 'none', flexShrink: 0 },
  toggleThumb: { position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
};

export default Sidebar;