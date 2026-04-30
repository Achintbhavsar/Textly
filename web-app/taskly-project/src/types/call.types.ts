// Call data models matching Android side

export interface IceCandidate {
  sdp: string;
  sdpMid: string;
  sdpMLineIndex: number;
  userId: string;
}

export enum CallType {
  VOICE = 'VOICE',
  VIDEO = 'VIDEO'
}

export enum CallStatus {
  RINGING = 'RINGING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  ENDED = 'ENDED',
  MISSED = 'MISSED',
  BUSY = 'BUSY'
}

export interface Call {
  callId: string;
  callerId: string;
  callerName: string;
  callerImage: string;
  receiverId: string;
  receiverName: string;
  receiverImage: string;
  callType: CallType;
  callStatus: CallStatus;
  offer?: string | null;
  offerType?: string | null;
  answer?: string | null;
  answerType?: string | null;
  iceCandidates: IceCandidate[];
  timestamp: number;
  isGroupCall: boolean;
  groupId?: string | null;
  groupName?: string | null;
  participants: string[];
}

// Socket event payloads for WebRTC signaling
export interface CallOfferPayload {
  to: string;
  offer: RTCSessionDescriptionInit;
  callType: 'audio' | 'video';
  callerName?: string;
  conversationId?: string;
}

export interface CallAnswerPayload {
  to: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  to: string;
  candidate: RTCIceCandidate;
}

export interface IncomingCallData {
  from: string;
  fromName: string;
  offer: RTCSessionDescriptionInit;
  callType: 'audio' | 'video';
}

export interface EndCallPayload {
  to: string;
}
