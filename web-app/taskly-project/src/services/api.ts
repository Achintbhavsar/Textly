import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../Firebase/config';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Always attach fresh Firebase ID token
    this.client.interceptors.request.use(async (config) => {
      const token = auth.currentUser
        ? await auth.currentUser.getIdToken()
        : localStorage.getItem('taskly_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('taskly_token');
          localStorage.removeItem('taskly_user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // ── AUTH — verify token via Express (uses Firebase Admin)
  auth = {
    verify: async (token: string): Promise<ApiResponse<{ user: any }>> => {
      const response: AxiosResponse<ApiResponse<{ user: any }>> =
        await this.client.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
      return response.data;
    },
  };

  // ── HISTORY — now Firestore via Express backend
  history = {
    /** Log a login event — call after Firebase signIn succeeds */
    log: async (status: 'success' | 'failed' = 'success', failureReason?: string): Promise<ApiResponse> => {
      try {
        const response = await this.client.post('/api/history/log', { status, failureReason });
        return response.data;
      } catch {
        return { success: false, message: 'History log failed (non-critical)' };
      }
    },
    getHistory: async (limit = 50, page = 1): Promise<ApiResponse<any>> => {
      const response = await this.client.get('/api/history', { params: { limit, page } });
      return response.data;
    },
    clearHistory: async (): Promise<ApiResponse> => {
      const response = await this.client.delete('/api/history');
      return response.data;
    },
  };

  // ── USERS — Firestore (direct)
  users = {
    search: async (q: string): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        const snap = await getDocs(collection(db, 'users'));
        const search = q.toLowerCase();
        const results = snap.docs
          .map(d => ({ ...d.data(), _id: d.id }))
          .filter((u: any) =>
            (u.name?.toLowerCase().includes(search) ||
              u.email?.toLowerCase().includes(search)) &&
            u.uid !== uid
          );
        return { success: true, data: results };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    getMe: async (): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };
        const snap = await getDoc(doc(db, 'users', uid));
        return { success: true, data: snap.data() };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    updateProfile: async (data: {
      name?: string;
      bio?: string;
      profileUrl?: string;
      vibeStatus?: string;
    }): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };
        await setDoc(doc(db, 'users', uid), data, { merge: true });
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    updatePrivacy: async (privacy: any): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };
        await setDoc(doc(db, 'users', uid), { privacy }, { merge: true });
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    submitRating: async (rating: { stars: number; review: string }): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };
        await addDoc(collection(db, 'ratings'), {
          userId: uid,
          ...rating,
          createdAt: Date.now(),
        });
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },
  };

  // ── CONVERSATIONS — Firestore (direct)
  conversations = {
    getAll: async (): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };

        const directSnap = await getDocs(
          query(collection(db, 'directChats'), where('participants', 'array-contains', uid))
        );
        const directChats = await Promise.all(
          directSnap.docs.map(async (d) => {
            const data    = d.data();
            const otherId = data.participants?.find((p: string) => p !== uid);
            const otherSnap = otherId ? await getDoc(doc(db, 'users', otherId)) : null;
            const otherUser = otherSnap?.data();
            return {
              ...data,
              _id:  d.id,
              type: 'direct',
              participants: [
                { _id: uid },
                { _id: otherId, name: otherUser?.name, isOnline: otherUser?.status === 'online', avatar: otherUser?.profileUrl },
              ],
              lastMessageAt: data.lastMessageTime ? new Date(data.lastMessageTime).toISOString() : null,
            };
          })
        );

        const groupSnap = await getDocs(
          query(collection(db, 'groups'), where('participants', 'array-contains', uid))
        );
        const groups = await Promise.all(
          groupSnap.docs.map(async (d) => {
            const data        = d.data();
            const memberSnaps = await Promise.all(
              (data.participants || []).map((pid: string) => getDoc(doc(db, 'users', pid)))
            );
            const members = memberSnaps.map(s => ({
              _id:      s.id,
              name:     s.data()?.name,
              isOnline: s.data()?.status === 'online',
              avatar:   s.data()?.profileUrl,
            }));
            return {
              ...data,
              _id:  d.id,
              id:   d.id,
              type: 'group',
              participants:  members,
              lastMessageAt: data.lastMessageTime ? new Date(data.lastMessageTime).toISOString() : null,
            };
          })
        );

        return { success: true, data: [...directChats, ...groups] };
      } catch (err: any) {
        console.error('❌ getAll conversations error:', err);
        return { success: false, message: err.message };
      }
    },

    createDirect: async (otherUserId: string): Promise<ApiResponse> => {
      try {
        const uid    = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };

        const chatId = [uid, otherUserId].sort().join('_');
        const ref    = doc(db, 'directChats', chatId);
        const snap   = await getDoc(ref);
        if (snap.exists()) return { success: true, data: { ...snap.data(), _id: chatId } };

        const otherSnap = await getDoc(doc(db, 'users', otherUserId));
        const otherUser = otherSnap.data();
        const chatData  = {
          chatId,
          participants:        [uid, otherUserId],
          lastMessage:         '',
          lastMessageTime:     0,
          otherUserId,
          otherUserName:       otherUser?.name       || '',
          otherUserEmail:      otherUser?.email      || '',
          otherUserProfileUrl: otherUser?.profileUrl || '',
        };

        await setDoc(ref, chatData);
        return { success: true, data: { ...chatData, _id: chatId } };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    createGroup: async (name: string, participantIds: string[]): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };

        const allParticipants = [uid, ...participantIds];
        const groupData = {
          name,
          description:     '',
          groupImage:      '',
          createdBy:       uid,
          createdAt:       Date.now(),
          participants:    allParticipants,
          admins:          [uid],
          lastMessage:     '',
          lastMessageTime: 0,
        };

        const ref = await addDoc(collection(db, 'groups'), groupData);
        return {
          success: true,
          data: {
            ...groupData,
            _id:  ref.id,
            id:   ref.id,
            type: 'group',
            participants: allParticipants.map(id => ({ _id: id })),
          },
        };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    addMembers: async (conversationId: string, participantIds: string[]): Promise<ApiResponse> => {
      try {
        const ref  = doc(db, 'groups', conversationId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return { success: false, message: 'Group not found' };
        const current = snap.data()?.participants || [];
        const updated = [...new Set([...current, ...participantIds])];
        await updateDoc(ref, { participants: updated });
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },
  };

  // ── MESSAGES — Firestore (direct)
  messages = {
    getMessages: async (conversationId: string): Promise<ApiResponse> => {
      try {
        const isGroup = !conversationId.includes('_');
        const colName = isGroup ? 'groups' : 'directChats';
        const snap    = await getDocs(
          query(collection(db, colName, conversationId, 'messages'), orderBy('createdAt', 'asc'))
        );
        const messages = snap.docs.map(d => {
          const data = d.data();
          return {
            ...data,
            _id:     d.id,
            text:    data.message,
            content: data.message,
            sender:  { _id: data.senderId, name: data.senderName },
          };
        });
        return { success: true, data: messages };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    send: async (conversationId: string, text: string): Promise<ApiResponse> => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return { success: false, message: 'Not logged in' };

        const senderSnap = await getDoc(doc(db, 'users', uid));
        const sender     = senderSnap.data();
        const isGroup    = !conversationId.includes('_');
        const colName    = isGroup ? 'groups' : 'directChats';

        const msgData = {
          id:          '',
          senderId:    uid,
          message:     text,
          createdAt:   Date.now(),
          senderName:  sender?.name       || '',
          senderImage: sender?.profileUrl || null,
          imageUrl:    null,
          delivered:   false,
          read:        false,
          deliveredAt: 0,
          readAt:      0,
        };

        const ref = await addDoc(collection(db, colName, conversationId, 'messages'), msgData);
        await updateDoc(ref, { id: ref.id });
        await setDoc(
          doc(db, colName, conversationId),
          { lastMessage: text, lastMessageTime: Date.now() },
          { merge: true }
        );

        return {
          success: true,
          data: {
            ...msgData,
            id:      ref.id,
            _id:     ref.id,
            text,
            content: text,
            sender:  { _id: uid, name: sender?.name },
          },
        };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },
  };

  // ── HEALTH
  health = async (): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await this.client.get('/health');
    return response.data;
  };
}

const api = new ApiService();
export default api;