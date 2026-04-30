// src/components/ChatDashboard/types.ts

export type Section = 'chats' | 'friends' | 'notifications' | 'settings';

export interface Message {
  id: string | number;
  text: string;
  sent: boolean;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'seen';
  senderName?: string;
  senderAvatar?: string;
}

export interface Contact {
  id: string;
  conversationId: string;

  // ── Direct chat fields
  participantId?: string;

  // ── Group chat fields
  participantIds?: string[];     // all member IDs except current user
  memberCount?: number;
  members?: any[];
  groupAdmin?: string;

  // ── Common fields
  type: 'direct' | 'group';
  name: string;
  avatar: string;
  avatarUrl?: string;
  color: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
  lastMessage: string;
  time: string;
  unread: number;
  messages: Message[];
  vibeStatus?: string;
}