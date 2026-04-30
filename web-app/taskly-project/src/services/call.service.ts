import { db } from '../Firebase/config';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Call, CallStatus, CallType, IceCandidate } from '../types/call.types';

export class CallService {
  private static CALLS_COLLECTION = 'calls';

  // Create a new call document in Firestore
  static async createCall(callData: {
    callerId: string;
    callerName: string;
    callerImage: string;
    receiverId: string;
    receiverName: string;
    receiverImage: string;
    callType: 'audio' | 'video';
    offer: RTCSessionDescriptionInit;
  }): Promise<string> {
    const callId = `${callData.callerId}_${callData.receiverId}_${Date.now()}`;
    
    const call: Call = {
      callId,
      callerId: callData.callerId,
      callerName: callData.callerName,
      callerImage: callData.callerImage,
      receiverId: callData.receiverId,
      receiverName: callData.receiverName,
      receiverImage: callData.receiverImage,
      callType: callData.callType === 'video' ? CallType.VIDEO : CallType.VOICE,
      callStatus: CallStatus.RINGING,
      offer: callData.offer.sdp || '',
      offerType: callData.offer.type || null,
      answer: null,
      answerType: null,
      iceCandidates: [],
      timestamp: Date.now(),
      isGroupCall: false,
      groupId: null,
      groupName: null,
      participants: [callData.callerId, callData.receiverId],
    };

    await setDoc(doc(db, this.CALLS_COLLECTION, callId), call);
    console.log('✅ Call created in Firestore:', callId);
    return callId;
  }

  // Update call status
  static async updateCallStatus(callId: string, status: CallStatus): Promise<void> {
    const callRef = doc(db, this.CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      callStatus: status,
    });
    console.log(`✅ Call ${callId} status updated to ${status}`);
  }

  // Add answer to call
  static async addAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const callRef = doc(db, this.CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      answer: answer.sdp || '',
      answerType: answer.type,
      callStatus: CallStatus.ACCEPTED,
    });
    console.log(`✅ Answer added to call ${callId}`);
  }

  // Add ICE candidate to subcollection (matching Android pattern)
  static async addIceCandidate(
    callId: string,
    candidate: RTCIceCandidate,
    userId: string
  ): Promise<void> {
    const candidateData: IceCandidate = {
      sdp: candidate.candidate,
      sdpMid: candidate.sdpMid || '',
      sdpMLineIndex: candidate.sdpMLineIndex || 0,
      userId,
    };

    const candidateId = `${Date.now()}_${userId}`;
    await setDoc(
      doc(db, this.CALLS_COLLECTION, callId, 'iceCandidates', candidateId),
      candidateData
    );
    console.log(`✅ ICE candidate added to call ${callId}`);
  }

  // Listen to call updates
  static listenToCall(
    callId: string,
    onUpdate: (call: Call) => void,
    onError?: (error: Error) => void
  ): () => void {
    const callRef = doc(db, this.CALLS_COLLECTION, callId);
    
    const unsubscribe = onSnapshot(
      callRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const callData = snapshot.data() as Call;
          onUpdate(callData);
        }
      },
      (error) => {
        console.error('❌ Error listening to call:', error);
        onError?.(error);
      }
    );

    return unsubscribe;
  }

  // Listen to incoming ICE candidates (excluding own)
  static listenToIncomingIceCandidates(
    callId: string,
    currentUserId: string,
    onCandidate: (candidate: IceCandidate) => void
  ): () => void {
    const iceCandidatesRef = collection(db, this.CALLS_COLLECTION, callId, 'iceCandidates');
    
    const unsubscribe = onSnapshot(iceCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data() as IceCandidate;
          // Only process candidates from other user
          if (candidate.userId !== currentUserId) {
            onCandidate(candidate);
          }
        }
      });
    });

    return unsubscribe;
  }

  // Listen to incoming calls for a user
  static listenToIncomingCalls(
    userId: string,
    onIncomingCall: (call: Call) => void
  ): () => void {
    const callsRef = collection(db, this.CALLS_COLLECTION);
    const q = query(
      callsRef,
      where('receiverId', '==', userId),
      where('callStatus', '==', CallStatus.RINGING)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const call = change.doc.data() as Call;
          onIncomingCall(call);
        }
      });
    });

    return unsubscribe;
  }

  // End call
  static async endCall(callId: string): Promise<void> {
    await this.updateCallStatus(callId, CallStatus.ENDED);
  }

  // Reject call
  static async rejectCall(callId: string): Promise<void> {
    await this.updateCallStatus(callId, CallStatus.REJECTED);
  }

  // Mark call as missed
  static async markAsMissed(callId: string): Promise<void> {
    await this.updateCallStatus(callId, CallStatus.MISSED);
  }
}
