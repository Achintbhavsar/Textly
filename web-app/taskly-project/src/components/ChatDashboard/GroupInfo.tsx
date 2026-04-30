import React, { useState } from 'react';
import AddMembers from './Addmembers';

interface GroupInfoProps {
  conversation: any;
  onClose: () => void;
  onUpdate: (conversation: any) => void;
}

export const GroupInfo: React.FC<GroupInfoProps> = ({
  conversation,
  onClose,
  onUpdate
}) => {
  const [showAddMembers, setShowAddMembers] = useState(false);

  const isGroup = conversation.type === 'group';
  const groupColor = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2'][
    conversation.name?.length % 6 || 0
  ];

  if (showAddMembers) {
    return (
      <AddMembers
        conversation={conversation}
        onClose={() => setShowAddMembers(false)}
        onMembersAdded={(updatedConversation: any) => {
            onUpdate(updatedConversation);
          setShowAddMembers(false);
        }}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        width: 440,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {isGroup ? 'Group Info' : 'Contact Info'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              color: '#64748b'
            }}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Avatar & Name */}
          <div style={{
            padding: '32px 20px',
            textAlign: 'center',
            borderBottom: '1px solid #f1f5f9'
          }}>
            {isGroup ? (
              <div style={{
                width: 100,
                height: 100,
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${groupColor}, ${groupColor}aa)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                fontWeight: 800,
                color: 'white',
                boxShadow: `0 8px 24px ${groupColor}40`
              }}>
                {conversation.name?.[0]?.toUpperCase() || '👥'}
              </div>
            ) : (
              <div style={{
                width: 100,
                height: 100,
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                fontWeight: 800,
                color: 'white'
              }}>
                {conversation.participants?.[0]?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              {isGroup ? conversation.name : conversation.participants?.[0]?.name}
            </h2>

            {!isGroup && (
              <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                {conversation.participants?.[0]?.email}
              </p>
            )}

            {isGroup && (
              <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                {conversation.participants?.length} members
              </p>
            )}
          </div>

          {/* Group Actions */}
          {isGroup && (
            <div style={{ padding: '8px 0' }}>
              <button
                onClick={() => setShowAddMembers(true)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span className="material-icons" style={{ fontSize: 20, color: '#2563eb' }}>
                    person_add
                  </span>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                    Add Members
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Invite people to this group
                  </div>
                </div>
                <span className="material-icons" style={{ fontSize: 18, color: '#94a3b8' }}>
                  chevron_right
                </span>
              </button>
            </div>
          )}

          {/* Members List */}
          {isGroup && (
            <div>
              <div style={{
                padding: '12px 20px',
                background: '#f8fafc',
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {conversation.participants?.length} Members
              </div>

              <div style={{ padding: '8px 0' }}>
                {conversation.participants?.map((member: any) => (
                  <div
                    key={member._id}
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#3b82f6',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700
                      }}>
                        {member.name?.[0]?.toUpperCase()}
                      </div>
                      {member.isOnline && (
                        <span style={{
                          position: 'absolute',
                          bottom: 2,
                          right: 2,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#22c55e',
                          border: '2px solid white'
                        }} />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                        {member.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {member.vibeStatus || member.email}
                      </div>
                    </div>

                    {/* Admin badge */}
                    {(conversation.admins?.includes(member._id) || 
                      conversation.admin === member._id) && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#2563eb',
                        background: '#eff6ff',
                        padding: '4px 8px',
                        borderRadius: 12
                      }}>
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Options */}
          <div style={{ padding: '16px 0', borderTop: '1px solid #f1f5f9' }}>
            <button
              style={{
                width: '100%',
                padding: '14px 20px',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ fontSize: 20, color: '#ef4444' }}>
                  {isGroup ? 'logout' : 'block'}
                </span>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
                  {isGroup ? 'Exit Group' : 'Block User'}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};