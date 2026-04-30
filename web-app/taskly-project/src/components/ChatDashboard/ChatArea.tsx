// src/components/ChatDashboard/ChatArea.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Contact } from './types';
import api from '../../services/api';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useFirestoreTyping } from '../../hooks/useFirestoreTyping';
import { useFirestoreMessages } from '../../hooks/useFirestoreMessages';
import CallWindow from './CallWindow';
import IncomingCallModal from './IncomingCallModal';

// ── Group color helpers
const GROUP_COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#d97706','#dc2626'];
const getColor = (name: string) => GROUP_COLORS[(name?.charCodeAt(0) || 0) % GROUP_COLORS.length];

// ── Group Avatar Component
const GroupAvatar: React.FC<{ members: any[]; name: string; size?: number }> = ({
  members, name, size = 42
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
                color: 'white', fontWeight: 700, fontSize: size * 0.22,
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

interface ChatAreaProps {
  activeContactId: string | null;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setInfoOpen: (open: boolean) => void;
  darkMode: boolean;
  currentUser?: any;
  socket?: any;
}

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen';

const ChatArea: React.FC<ChatAreaProps> = ({
  activeContactId, contacts, setContacts,
  setInfoOpen, darkMode, currentUser, socket
}) => {
  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [isTyping, setIsTyping]       = useState(false);
  const [typingName, setTypingName]   = useState('');
  const [firestoreMessages, setFirestoreMessages] = useState<any[]>([]);
  const messagesEndRef                = useRef<HTMLDivElement>(null);
  const typingTimeoutRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef                   = useRef(false);

  const webRTC = useWebRTC({ socket, currentUserId: currentUser?.id || '' });

  const emojis = ["😀","😂","❤️","👍","🎉","😊","🔥","✅","🙏","💯","😍","🤔","👏","😎","🥳"];
  const statusColors = { online: '#22c55e', away: '#f59e0b', offline: '#94a3b8' };
  const contact = contacts.find(c => c.id === activeContactId);

  // ── FIX 1: Ensure otherUserId is `string | null`, never `undefined`
  const chatId: string | null = contact?.type !== 'group' && contact?.conversationId?.includes('_')
    ? contact.conversationId
    : null;
  const otherUserId: string | null = contact?.type !== 'group'
    ? (contact?.participantId ?? null)
    : null;

  // Firestore typing indicators
  const { onTyping: firestoreOnTyping, stopTyping: firestoreStopTyping } = useFirestoreTyping({
    chatId,
    currentUserId: currentUser?.id || '',
    otherUserId,
    onTypingChange: useCallback((isTyping: boolean) => {
      setIsTyping(isTyping);
      if (isTyping) {
        setTypingName(contact?.name || 'Someone');
      } else {
        setTypingName('');
      }
    }, [contact?.name]),
  });

  // Firestore messages with delivery/read status
  const { markMessagesAsRead } = useFirestoreMessages({
    chatId,
    currentUserId: currentUser?.id || '',
    otherUserId,
    onMessagesUpdate: useCallback((messages: any[]) => {
      setFirestoreMessages(messages);
    }, []),
  });

  const bgColor   = darkMode ? '#0f172a' : '#f8fafc';
  const textColor = darkMode ? '#e2e8f0' : '#1e293b';
  const members   = (contact as any)?.members || [];

  // ── Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contact?.messages?.length, firestoreMessages.length, isTyping]);

  // ── Mark messages as read when viewing chat
  useEffect(() => {
    if (chatId && otherUserId && contact) {
      markMessagesAsRead();
    }
  }, [chatId, otherUserId, contact, markMessagesAsRead]);

  // ── TYPING INDICATORS ONLY — receive-message is handled in ChatDashboard
  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = ({ conversationId, userId }: any) => {
      if (conversationId === activeContactId && userId !== currentUser?.id) {
        const typingContact = contacts.find(c => c.id === conversationId);
        setTypingName(typingContact?.name || 'Someone');
        setIsTyping(true);
      }
    };

    const handleUserStopTyping = ({ conversationId, userId }: any) => {
      if (conversationId === activeContactId && userId !== currentUser?.id) {
        setIsTyping(false);
        setTypingName('');
      }
    };

    socket.on('user-typing',      handleUserTyping);
    socket.on('user-stop-typing', handleUserStopTyping);

    return () => {
      socket.off('user-typing',      handleUserTyping);
      socket.off('user-stop-typing', handleUserStopTyping);
    };
  }, [socket, activeContactId, currentUser, contacts]);

  // ── Mark messages as seen when switching conversations
  useEffect(() => {
    if (!socket || !activeContactId || !contact) return;
    const receiverIds = contact.type === 'group'
      ? ((contact as any).participantIds || []).filter((id: string) => id !== currentUser?.id)
      : [contact.participantId].filter(Boolean);
    if (receiverIds.length > 0) {
      socket.emit('mark-seen', {
        conversationId: activeContactId,
        seenBy: currentUser?.id,
        receiverIds,
      });
    }
  }, [activeContactId, socket, currentUser]);

  // ── Typing emit handler
  const handleTyping = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (!contact) return;

    // Use Firestore typing for direct chats
    if (chatId && contact.type !== 'group') {
      firestoreOnTyping();
      return;
    }

    // Use Socket.io typing for group chats
    if (!socket) return;
    const receiverIds = contact.type === 'group'
      ? ((contact as any).participantIds || []).filter((id: string) => id !== currentUser?.id)
      : [contact.participantId].filter(Boolean);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', {
        conversationId: activeContactId,
        userId: currentUser?.id,
        receiverIds,
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('stop-typing', {
        conversationId: activeContactId,
        userId: currentUser?.id,
        receiverIds,
      });
    }, 1500);
  }, [socket, contact, activeContactId, currentUser, chatId, firestoreOnTyping]);

  const getStatusIcon = (msg: any): string => {
    if (msg.read) return '✓✓';
    if (msg.delivered) return '✓✓';
    return '✓';
  };

  const getStatusColor = (msg: any): string => {
    if (msg.read) return '#60a5fa';
    return 'rgba(255,255,255,0.6)';
  };

  // ── Send message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !contact || sending) return;
    const text = messageText.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Stop typing indicator
    if (chatId && contact.type !== 'group') {
      firestoreStopTyping();
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        const receiverIds = contact.type === 'group'
          ? ((contact as any).participantIds || []).filter((id: string) => id !== currentUser?.id)
          : [contact.participantId].filter(Boolean);
        socket?.emit('stop-typing', {
          conversationId: activeContactId,
          userId: currentUser?.id,
          receiverIds,
        });
      }
    }

    // Optimistic message
    const tempId = Date.now();
    setContacts(prev => prev.map(c =>
      c.id === activeContactId
        ? {
            ...c,
            messages: [...(c.messages || []), { id: tempId, text, sent: true, time, status: 'sending' as MessageStatus }],
            lastMessage: text,
            time,
          }
        : c
    ));
    setMessageText('');
    setShowEmoji(false);

    try {
      setSending(true);
      const res = await (api as any).messages.send(contact.conversationId, text);

      if (res.success && res.data) {
        // ✅ Replace temp message with real one
        setContacts(prev => prev.map(c => {
          if (c.id !== activeContactId) return c;
          return {
            ...c,
            messages: (c.messages || []).map(m =>
              m.id === tempId
                ? { ...m, id: res.data._id, status: 'sent' as MessageStatus }
                : m
            ),
          };
        }));

        // ✅ Emit via socket for real-time delivery to receiver
        if (socket?.connected) {
          const receiverIds = contact.type === 'group'
            ? ((contact as any).participantIds || []).filter((id: string) => id !== currentUser?.id)
            : [contact.participantId].filter((id): id is string => Boolean(id));

          console.log('📤 Emitting send-message:', {
            conversationId: contact.conversationId,
            receiverIds,
            messageId: res.data._id,
          });

          if (receiverIds.length > 0) {
            socket.emit('send-message', {
              conversationId: contact.conversationId,
              chatId: contact.conversationId,
              message: res.data,
              receiverIds,
            });

            // Mark as delivered optimistically
            setContacts(prev => prev.map(c => {
              if (c.id !== activeContactId) return c;
              return {
                ...c,
                messages: (c.messages || []).map(m =>
                  m.id === res.data._id
                    ? { ...m, status: 'delivered' as MessageStatus }
                    : m
                ),
              };
            }));
          } else {
            console.error('❌ receiverIds is empty — message not emitted via socket');
          }
        } else {
          console.error('❌ Socket not connected');
        }
      }
    } catch (err) {
      console.error('❌ Send failed:', err);
      // Revert optimistic message on failure
      setContacts(prev => prev.map(c => {
        if (c.id !== activeContactId) return c;
        return { ...c, messages: (c.messages || []).filter(m => m.id !== tempId) };
      }));
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  if (!contact) {
    return (
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: darkMode ? '#0f172a' : '#f8fafc', flexDirection: 'column', gap: 12
      }}>
        <div style={{ fontSize: 48 }}>💬</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
          Select a chat to start messaging
        </div>
      </main>
    );
  }

  return (
    <main style={{ ...styles.chat, background: bgColor }}>

      {/* ── Header */}
      <div style={{ ...styles.chatHdr, background: darkMode ? '#1e293b' : '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            {contact.type === 'group' ? (
              <GroupAvatar members={members} name={contact.name} size={42} />
            ) : (
              <>
                <div style={{ ...styles.cAv, background: contact.color, width: 42, height: 42 }}>
                  {contact.avatar}
                </div>
                <span style={{ ...styles.sdot, background: statusColors[contact.status] }} />
              </>
            )}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: textColor, fontFamily: 'Inter, sans-serif' }}>
              {contact.name}
            </div>
            {isTyping ? (
              <div style={{ fontSize: 12, marginTop: 1, color: '#3b82f6', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                <TypingDots /> {contact.type === 'group' ? `${typingName} is typing...` : 'typing...'}
              </div>
            ) : (
              <div style={{ fontSize: 12, marginTop: 1, color: contact.type === 'group' ? '#64748b' : statusColors[contact.status], fontFamily: 'Inter, sans-serif', textTransform: 'capitalize' }}>
                {contact.type === 'group'
                  ? `${(contact as any).memberCount || members.length || 0} members`
                  : contact.status}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => {
              if (contact && contact.type !== 'group') {
                webRTC.startCall(
                  contact.participantId || contact.id,
                  'audio',
                  currentUser?.name || currentUser?.displayName || 'Unknown',
                  currentUser?.photoURL || currentUser?.profileUrl || '',
                  contact.name,
                  contact.avatarUrl || ''
                );
              }
            }}
            style={styles.iBtn} title="Voice call"
          >
            <span className="material-icons">call</span>
          </button>
          <button
            onClick={() => {
              if (contact && contact.type !== 'group') {
                webRTC.startCall(
                  contact.participantId || contact.id,
                  'video',
                  currentUser?.name || currentUser?.displayName || 'Unknown',
                  currentUser?.photoURL || currentUser?.profileUrl || '',
                  contact.name,
                  contact.avatarUrl || ''
                );
              }
            }}
            style={styles.iBtn} title="Video call"
          >
            <span className="material-icons">videocam</span>
          </button>
          <button style={styles.iBtn} title="Info" onClick={() => setInfoOpen(true)}>
            <span className="material-icons">info</span>
          </button>
        </div>
      </div>

      {/* ── Messages */}
      <div style={styles.messages}>
        {/* Use Firestore messages for direct chats, fallback to contact.messages for groups */}
        {(() => {
          const displayMessages = chatId && contact.type !== 'group' ? firestoreMessages : (contact.messages || []);
          
          if (!displayMessages || displayMessages.length === 0) {
            return (
              <div style={{ textAlign: 'center', marginTop: 40, color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                <div style={{ fontSize: 14 }}>Say hi to {contact.name}!</div>
              </div>
            );
          }

          return displayMessages.map((msg, i) => (
          <div
            key={msg.id}
            style={{ ...styles.msgRow, justifyContent: msg.sent ? 'flex-end' : 'flex-start', animationDelay: `${i * 0.04}s` }}
          >
            {!msg.sent && (
              <div style={{
                ...styles.cAv,
                background: contact.type === 'group' ? getColor(msg.senderName || '?') : contact.color,
                width: 28, height: 28, fontSize: 10
              }}>
                {contact.type === 'group'
                  ? (msg.senderName?.[0]?.toUpperCase() || '?')
                  : contact.avatar}
              </div>
            )}

            <div style={{
              ...styles.bubble,
              ...(msg.sent
                ? styles.bubbleSent
                : { ...styles.bubbleRecv, background: darkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: darkMode ? '#334155' : '#f1f5f9' }
              )
            }}>
              {!msg.sent && contact.type === 'group' && msg.senderName && (
                <div style={{ fontSize: 10, fontWeight: 700, color: getColor(msg.senderName), marginBottom: 3 }}>
                  {msg.senderName}
                </div>
              )}
              <span style={styles.msgText}>{msg.text || msg.message}</span>
              <span style={{ ...styles.msgTime, display: 'flex', alignItems: 'center', gap: 3 }}>
                {msg.time}
                {msg.sent && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: getStatusColor(msg),
                    letterSpacing: msg.read || msg.delivered ? '-2px' : '0px',
                    marginLeft: 2
                  }}>
                    {getStatusIcon(msg)}
                  </span>
                )}
              </span>
            </div>
          </div>
          ));
        })()}

        {/* ── Typing bubble */}
        {isTyping && (
          <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
            <div style={{
              ...styles.cAv,
              background: contact.type === 'group' ? getColor(typingName) : contact.color,
              width: 28, height: 28, fontSize: 10
            }}>
              {contact.type === 'group' ? (typingName?.[0]?.toUpperCase() || '?') : contact.avatar}
            </div>
            <div style={{ ...styles.bubble, ...styles.bubbleRecv, background: darkMode ? '#1e293b' : '#ffffff', borderColor: darkMode ? '#334155' : '#f1f5f9', padding: '12px 16px' }}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Emoji picker */}
      {showEmoji && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 16px', background: darkMode ? '#1e293b' : '#ffffff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          {emojis.map((emoji, i) => (
            <button key={i} style={styles.eBtn} onClick={() => setMessageText(p => p + emoji)}>{emoji}</button>
          ))}
        </div>
      )}

      {/* ── Input bar */}
      <div style={{ ...styles.inputBar, background: darkMode ? '#1e293b' : '#ffffff' }}>
        <button style={styles.iBtn} onClick={() => setShowEmoji(!showEmoji)}>
          <span className="material-icons">sentiment_satisfied_alt</span>
        </button>
        <button style={styles.iBtn} title="Attach file">
          <span className="material-icons">attach_file</span>
        </button>
        <textarea
          style={{ ...styles.txInput, background: darkMode ? '#0f172a' : '#f8fafc', color: textColor, borderColor: darkMode ? '#334155' : '#e2e8f0' }}
          placeholder="Type a message…"
          value={messageText}
          onChange={handleTyping}
          onKeyDown={handleKeyPress}
          rows={1}
        />
        <button
          style={{ ...styles.sendBtn, opacity: sending ? 0.7 : 1 }}
          onClick={handleSendMessage}
          disabled={sending}
        >
          <span className="material-icons">send</span>
        </button>
      </div>

      {/* ── Incoming Call Modal */}
      {webRTC.incomingCall && (
        <IncomingCallModal
          callerName={webRTC.incomingCall.fromName || 'Unknown'}
          callType={webRTC.incomingCall.callType}
          onAccept={webRTC.acceptCall}
          onReject={webRTC.rejectCall}
        />
      )}

      {/* ── Active Call Window */}
      {webRTC.showCallWindow && (
        <CallWindow
          localStream={webRTC.stream}
          remoteStream={webRTC.remoteStream}
          callDuration={webRTC.callDuration}
          isMuted={webRTC.isMuted}
          isVideoOff={webRTC.isVideoOff}
          onToggleMute={webRTC.toggleMute}
          onToggleVideo={webRTC.toggleVideo}
          onEndCall={() => webRTC.endCall(contact?.participantId || '')}
          darkMode={darkMode}
        />
      )}
    </main>
  );
};

const TypingDots: React.FC = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width: 6, height: 6, borderRadius: '50%', background: '#3b82f6',
        display: 'inline-block', animation: 'typingBounce 1.2s infinite ease-in-out',
        animationDelay: `${i * 0.2}s`
      }} />
    ))}
    <style>{`@keyframes typingBounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }`}</style>
  </span>
);

const styles: Record<string, React.CSSProperties> = {
  chat:       { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  chatHdr:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  cAv:        { borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 },
  sdot:       { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', border: '2px solid white' },
  iBtn:       { background: 'none', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  messages:   { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 },
  msgRow:     { display: 'flex', alignItems: 'flex-end', gap: 8 },
  bubble:     { maxWidth: '60%', padding: '10px 14px', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  bubbleSent: { background: '#2563eb', color: 'white', borderBottomRightRadius: 4 },
  bubbleRecv: { borderBottomLeftRadius: 4, border: '1px solid #f1f5f9' },
  msgText:    { fontSize: 13.5, lineHeight: 1.55 },
  msgTime:    { fontSize: 10, opacity: 0.6, alignSelf: 'flex-end', marginTop: 3 },
  eBtn:       { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 6 },
  inputBar:   { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid #e2e8f0', flexShrink: 0 },
  txInput:    { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13.5, fontFamily: 'Inter, sans-serif', outline: 'none', lineHeight: 1.5, resize: 'none', height: 42 },
  sendBtn:    { width: 42, height: 42, borderRadius: 8, background: '#2563eb', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' },
};

export default ChatArea;