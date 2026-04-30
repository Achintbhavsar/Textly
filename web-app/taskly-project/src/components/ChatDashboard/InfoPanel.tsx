import React, { useState } from 'react';
import { Contact } from './types';
import AddMembers from './Addmembers';  // ← FIXED: Corrected file name

interface InfoPanelProps {
  activeContactId: string;
  contacts: Contact[];
  onClose: () => void;
  darkMode: boolean;
  onUpdateContact?: (updatedContact: Contact) => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ 
  activeContactId, 
  contacts, 
  onClose, 
  darkMode,
  onUpdateContact 
}) => {
  const [showAddMembers, setShowAddMembers] = useState(false);
  
  const contact = contacts.find(c => c.id === activeContactId);
  const statusColors = { online: '#22c55e', away: '#f59e0b', offline: '#94a3b8' };

  if (!contact) return null;

  const isGroup = contact.type === 'group';
  const sentCount = contact.messages.filter(m => m.sent).length;
  const bgColor = darkMode ? '#1e293b' : '#ffffff';
  const textColor = darkMode ? '#e2e8f0' : '#0f172a';

  // Group color for avatar
  const groupColor = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2'][
    contact.name?.length % 6 || 0
  ];

  // If showing Add Members modal
  if (showAddMembers && isGroup) {
    return (
      <AddMembers
        conversation={contact}
        onClose={() => setShowAddMembers(false)}
        onMembersAdded={(updatedConv) => {
          onUpdateContact?.(updatedConv);
          setShowAddMembers(false);
        }}
      />
    );
  }

  return (
    <div style={{ ...styles.infoPanel, background: bgColor }}>
      <div style={styles.infoPanelHeader}>
        <button
          onClick={onClose}
          style={styles.closeBtn}
          title="Close"
        >
          <span className="material-icons">close</span>
        </button>
        
        {/* Avatar - colored for groups */}
        <div
          style={{
            ...styles.infoAv,
            background: isGroup ? groupColor : contact.color,
          }}
        >
          {contact.avatar}
        </div>

        <div style={{ ...styles.infoName, color: textColor }}>{contact.name}</div>
        
        {/* Status or member count */}
        {isGroup ? (
          <div style={styles.infoStatusLine}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {(contact as any).participants?.length || 0} members
            </span>
          </div>
        ) : (
          <div style={styles.infoStatusLine}>
            <span
              style={{
                ...styles.infoDot,
                background: statusColors[contact.status]
              }}
            ></span>
            <span style={styles.infoStatus}>{contact.status}</span>
          </div>
        )}
      </div>

      {/* Quick buttons - only for individual chats */}
      {!isGroup && (
        <div style={styles.quickButtons}>
          <button style={styles.infoQuickBtn}>
            <span className="material-icons">call</span>
            Audio
          </button>
          <button style={styles.infoQuickBtn}>
            <span className="material-icons">videocam</span>
            Video
          </button>
        </div>
      )}

      {/* Add Members button - ONLY for groups */}
      {isGroup && (
        <>
          <div style={styles.infoDivider}></div>
          <div style={styles.infoSection}>
            <button
              onClick={() => setShowAddMembers(true)}
              style={{
                ...styles.optionBtn,
                color: '#2563eb',
                padding: '12px 0',
                fontWeight: 600
              }}
            >
              <span className="material-icons">person_add</span>
              Add Members
            </button>
          </div>
        </>
      )}

      <div style={styles.infoDivider}></div>

      {/* Stats */}
      <div style={styles.infoStats}>
        <div style={styles.statRow}>
          <span style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>Messages</span>
          <span style={{ ...styles.statValue, color: textColor }}>{contact.messages.length}</span>
        </div>
      </div>

      <div style={styles.infoStats}>
        <div style={styles.statRow}>
          <span style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>Sent by you</span>
          <span style={{ ...styles.statValue, color: textColor }}>{sentCount}</span>
        </div>
      </div>

      {/* Members List - ONLY for groups */}
      {isGroup && (contact as any).participants && (
        <>
          <div style={styles.infoDivider}></div>
          <div style={styles.infoSection}>
            <div style={styles.sectionLabel}>
              {(contact as any).participants.length} Members
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(contact as any).participants.map((member: any) => (
                <div
                  key={member._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 0'
                  }}
                >
                  {/* Member avatar */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {member.name?.[0]?.toUpperCase()}
                  </div>

                  {/* Member info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: textColor,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {member.name}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {member.vibeStatus || member.email}
                    </div>
                  </div>

                  {/* Admin badge */}
                  {((contact as any).admins?.includes(member._id) || 
                    (contact as any).admin === member._id) && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#2563eb',
                      background: '#eff6ff',
                      padding: '3px 6px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Shared Media */}
      <div style={styles.infoDivider}></div>
      <div style={styles.infoSection}>
        <div style={styles.sectionLabel}>Shared Media</div>
        <div style={styles.mediaGrid}>
          {[210, 220, 230, 240, 250, 260].map((hue, i) => (
            <div
              key={i}
              style={{
                height: '58px',
                borderRadius: '8px',
                background: `hsl(${hue},65%,88%)`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* Options */}
      <div style={styles.infoDivider}></div>
      <div style={styles.infoSection}>
        <div style={styles.sectionLabel}>Options</div>
        <button style={styles.optionBtn}>
          <span className="material-icons">notifications_off</span>
          Mute notifications
        </button>
        <button style={{ ...styles.optionBtn, color: '#ef4444' }}>
          <span className="material-icons">{isGroup ? 'logout' : 'block'}</span>
          {isGroup ? 'Exit group' : 'Block contact'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  infoPanel: {
    width: '272px',
    borderLeft: '1px solid #e2e8f0',
    overflowY: 'auto' as const,
    flexShrink: 0,
  },
  infoPanelHeader: {
    textAlign: 'center' as const,
    padding: '28px 20px 16px',
    position: 'relative' as const,
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s',
  },
  infoAv: {
    width: '72px',
    height: '72px',
    fontSize: '24px',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    margin: '0 auto 12px',
    fontWeight: 700,
  },
  infoName: {
    fontSize: '16px',
    fontWeight: 700,
  },
  infoStatusLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    marginTop: '5px',
  },
  infoDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  infoStatus: {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'capitalize' as const,
  },
  quickButtons: {
    display: 'flex',
    gap: '8px',
    padding: '0 16px 20px',
  },
  infoQuickBtn: {
    flex: 1,
    padding: '9px 6px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#334155',
    fontSize: '11.5px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.12s',
  },
  infoDivider: {
    height: '1px',
    background: '#f1f5f9',
  },
  infoStats: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 18px',
    borderBottom: '1px solid #f8fafc',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    fontSize: '13px',
  },
  statValue: {
    fontSize: '13px',
    fontWeight: 600,
  },
  infoSection: {
    padding: '14px 18px',
  },
  sectionLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '10px',
  },
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
  },
  optionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#475569',
    fontWeight: 500,
    width: '100%',
    fontFamily: 'Inter, sans-serif',
  },
};

export default InfoPanel;