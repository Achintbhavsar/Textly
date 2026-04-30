import { useEffect, useRef, useState } from 'react';
import { CallService } from '../services/call.service';
import { Call, CallStatus, CallType } from '../types/call.types';

interface UseWebRTCProps {
  socket: any;
  currentUserId: string;
}

export const useWebRTC = ({ socket, currentUserId: _currentUserId }: UseWebRTCProps) => {
  const [stream, setStream]             = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callActive, setCallActive]     = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [showCallWindow, setShowCallWindow] = useState(false);
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus]     = useState<CallStatus>(CallStatus.RINGING);
  const [isConnected, setIsConnected]   = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const remoteUserIdRef   = useRef<string | null>(null);
  const currentCallIdRef  = useRef<string | null>(null);
  const isCallerRef       = useRef<boolean>(false);
  const answerProcessedRef = useRef(false);
  const callListenerRef   = useRef<(() => void) | null>(null);
  const iceListenerRef    = useRef<(() => void) | null>(null);
  const incomingCallListenerRef = useRef<(() => void) | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

  // ── Get user media
  const getUserMedia = async (video = true): Promise<MediaStream | null> => {
    try {
      console.log('🎥 Requesting media:', { video, audio: true });
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720, facingMode: 'user' } : false,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      console.log('✅ Media stream obtained, tracks:', mediaStream.getTracks().map(t => t.kind));
      streamRef.current = mediaStream;
      setStream(mediaStream);
      return mediaStream;
    } catch (error: any) {
      console.error('❌ Failed to get user media:', error);
      if (error.name === 'NotAllowedError') {
        alert('Camera/microphone access denied. Please allow access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera or microphone found on this device.');
      } else {
        alert(`Media error: ${error.message}`);
      }
      return null;
    }
  };

  // ── Create peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
      ],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && currentCallIdRef.current) {
        console.log('🧊 Sending ICE candidate to Firestore');
        const candidate = event.candidate;
        CallService.addIceCandidate(
          currentCallIdRef.current,
          candidate,
          _currentUserId
        ).catch(err => console.error('❌ Failed to save ICE candidate:', err));
      }
    };

    pc.ontrack = (event) => {
      console.log('✅ ontrack event fired!');
      console.log('  - Track kind:', event.track.kind);
      console.log('  - Track id:', event.track.id);
      console.log('  - Track enabled:', event.track.enabled);
      console.log('  - Track readyState:', event.track.readyState);
      console.log('  - Streams:', event.streams.length);
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('  - Stream id:', stream.id);
        console.log('  - Stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        
        setRemoteStream(stream);
        setCallActive(true);
        setIsConnected(true);
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        if (!timerRef.current) {
          startTimer();
        }
      } else {
        console.warn('⚠️ ontrack fired but no streams available');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('📡 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
        console.log('✅ Peer connection established!');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.error('❌ Peer connection failed/disconnected');
        cleanup();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    pc.onnegotiationneeded = () => {
      console.log('🔄 Negotiation needed');
    };

    return pc;
  };

  // ── Start call (caller side)
  const startCall = async (
    receiverId: string,
    callType: 'video' | 'audio',
    callerName: string,
    callerImage = '',
    receiverName = '',
    receiverImage = ''
  ) => {
    try {
      console.log('🎬 Starting call with params:', {
        receiverId,
        callType,
        callerName
      });

      if (!callerName || callerName === 'Unknown') {
        console.error('❌ Caller name is missing or Unknown!');
      }

      remoteUserIdRef.current = receiverId;
      isCallerRef.current = true;
      answerProcessedRef.current = false;
      pendingIceCandidates.current = [];

      // Show call window immediately when starting call
      setShowCallWindow(true);

      const mediaStream = await getUserMedia(callType === 'video');
      if (!mediaStream) {
        setShowCallWindow(false);
        return;
      }

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add tracks to peer connection
      mediaStream.getTracks().forEach(track => {
        console.log('➕ Adding local track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
        pc.addTrack(track, mediaStream);
      });

      console.log('📤 Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      console.log('✅ Offer created, SDP length:', offer.sdp?.length);
      
      await pc.setLocalDescription(offer);
      console.log('✅ Local description (offer) set, signaling state:', pc.signalingState);

      // Save call to Firestore for Android sync
      const callId = await CallService.createCall({
        callerId: _currentUserId,
        callerName,
        callerImage,
        receiverId,
        receiverName,
        receiverImage,
        callType,
        offer,
      });
      currentCallIdRef.current = callId;
      console.log('✅ Call saved to Firestore:', callId);

      // Start listening for call updates and ICE candidates
      startFirestoreListeners(callId, true);

      // Also emit via Socket.IO for real-time
      console.log('📡 Emitting call-offer via Socket.IO');
      socket?.emit('call-offer', {
        to: receiverId,
        offer,
        callType,
        callerName,
        callId,
      });
    } catch (error) {
      console.error('❌ Error in startCall:', error);
      cleanup();
    }
  };

  // ── Firestore listeners for call updates and ICE candidates
  const startFirestoreListeners = (callId: string, isCaller: boolean) => {
    stopFirestoreListeners();

    console.log(`👂 Starting Firestore listeners, callId: ${callId}, isCaller: ${isCaller}`);

    callListenerRef.current = CallService.listenToCall(
      callId,
      async (call: Call) => {
        console.log('📥 Call update:', call.callStatus);
        setCallStatus(call.callStatus);

        switch (call.callStatus) {
          case CallStatus.ACCEPTED:
            // Only process answer if we are the caller
            if (isCaller && call.answer && call.answerType && !answerProcessedRef.current) {
              answerProcessedRef.current = true;
              console.log('📥 Caller received answer, setting remote description...');
              console.log('  - Answer SDP length:', call.answer.length);
              
              try {
                if (!peerConnectionRef.current) {
                  console.error('❌ Peer connection is null!');
                  return;
                }
                
                const currentState = peerConnectionRef.current.signalingState;
                console.log('  - Current signaling state:', currentState);
                
                if (currentState === 'have-local-offer') {
                  const answer = new RTCSessionDescription({
                    type: call.answerType as RTCSdpType,
                    sdp: call.answer,
                  });
                  
                  await peerConnectionRef.current.setRemoteDescription(answer);
                  console.log('✅ Remote answer set successfully!');
                  console.log('  - New signaling state:', peerConnectionRef.current.signalingState);
                  
                  // Process any pending ICE candidates
                  if (pendingIceCandidates.current.length > 0) {
                    console.log('🧊 Adding', pendingIceCandidates.current.length, 'pending ICE candidates');
                    for (const candidate of pendingIceCandidates.current) {
                      try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                      } catch (err) {
                        console.error('❌ Error adding pending ICE candidate:', err);
                      }
                    }
                    pendingIceCandidates.current = [];
                  }
                } else {
                  console.warn('⚠️ Cannot set remote answer, wrong signaling state:', currentState);
                }
              } catch (error) {
                console.error('❌ Error setting remote answer:', error);
              }
            }
            break;

          case CallStatus.RINGING:
            console.log('📞 Call is ringing...');
            break;

          case CallStatus.REJECTED:
          case CallStatus.ENDED:
            console.log('📴 Call ended:', call.callStatus);
            cleanup();
            break;
        }
      },
      (error) => console.error('❌ Call listener error:', error)
    );

    iceListenerRef.current = CallService.listenToIncomingIceCandidates(
      callId,
      _currentUserId,
      async (candidate) => {
        console.log('🧊 Received ICE candidate from Firestore');
        
        if (!peerConnectionRef.current) {
          console.warn('⚠️ Peer connection is null, queueing ICE candidate');
          pendingIceCandidates.current.push({
            candidate: candidate.sdp,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          });
          return;
        }
        
        if (!peerConnectionRef.current.remoteDescription) {
          console.warn('⚠️ Remote description not set yet, queueing ICE candidate');
          pendingIceCandidates.current.push({
            candidate: candidate.sdp,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          });
          return;
        }
        
        try {
          const iceCandidate = new RTCIceCandidate({
            candidate: candidate.sdp,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          });
          await peerConnectionRef.current.addIceCandidate(iceCandidate);
          console.log('✅ ICE candidate added');
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      }
    );
  };

  const stopFirestoreListeners = () => {
    if (callListenerRef.current) {
      callListenerRef.current();
      callListenerRef.current = null;
    }
    if (iceListenerRef.current) {
      iceListenerRef.current();
      iceListenerRef.current = null;
    }
  };

  // ── Process incoming offer (receiver side)
  const processIncomingOffer = async (call: Call) => {
    if (!call.offer || !call.offerType) return;

    const mediaStream = await getUserMedia(call.callType === CallType.VIDEO);
    if (!mediaStream) return;

    const pc = createPeerConnection();
    peerConnectionRef.current = pc;

    mediaStream.getTracks().forEach(track => {
      console.log('➕ Adding local track:', track.kind);
      pc.addTrack(track, mediaStream);
    });

    try {
      const offer = new RTCSessionDescription({
        type: call.offerType as RTCSdpType,
        sdp: call.offer,
      });
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await CallService.addAnswer(currentCallIdRef.current!, answer);
      console.log('✅ Answer sent to Firestore');

      socket?.emit('call-answer', {
        to: call.callerId,
        answer,
      });
    } catch (error) {
      console.error('❌ Error processing offer:', error);
      cleanup();
    }
  };

  // ── Accept call (receiver side)
  const acceptCall = async () => {
    if (!incomingCall) {
      console.error('❌ No incoming call to accept');
      return;
    }

    try {
      console.log('✅ Accepting', incomingCall.callType, 'call from:', incomingCall.from);
      console.log('📋 Offer type:', incomingCall.offer?.type, 'SDP length:', incomingCall.offer?.sdp?.length);

      remoteUserIdRef.current = incomingCall.from;
      isCallerRef.current = false;
      answerProcessedRef.current = false;
      pendingIceCandidates.current = [];

      const callId = incomingCall.callId || `${incomingCall.from}_${_currentUserId}_${Date.now()}`;
      currentCallIdRef.current = callId;

      // Show call window immediately
      setShowCallWindow(true);
      setIncomingCall(null);

      // Set connection timeout (30 seconds)
      connectionTimeoutRef.current = setTimeout(() => {
        if (!remoteStream) {
          console.error('❌ Connection timeout - no remote stream received');
          alert('Connection failed. Please try again.');
          cleanup();
        }
      }, 30000);

      // Get user media
      const mediaStream = await getUserMedia(incomingCall.callType === 'video');
      if (!mediaStream) {
        console.error('❌ Failed to get user media');
        setShowCallWindow(false);
        return;
      }

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      mediaStream.getTracks().forEach(track => {
        console.log('➕ Adding local track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
        pc.addTrack(track, mediaStream);
      });

      // Set remote description (offer from caller)
      console.log('📥 Setting remote description (offer)...');
      const offerDesc = new RTCSessionDescription(incomingCall.offer);
      await pc.setRemoteDescription(offerDesc);
      console.log('✅ Remote description set, signaling state:', pc.signalingState);

      // Process any pending ICE candidates
      if (pendingIceCandidates.current.length > 0) {
        console.log('🧊 Adding', pendingIceCandidates.current.length, 'pending ICE candidates');
        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('❌ Error adding pending ICE candidate:', err);
          }
        }
        pendingIceCandidates.current = [];
      }
      
      // Create answer
      console.log('📤 Creating answer...');
      const answer = await pc.createAnswer();
      console.log('✅ Answer created, SDP length:', answer.sdp?.length);
      
      await pc.setLocalDescription(answer);
      console.log('✅ Local description (answer) set, signaling state:', pc.signalingState);

      // Save answer to Firestore
      await CallService.addAnswer(callId, answer);
      console.log('✅ Answer saved to Firestore');

      // Emit answer via Socket.IO
      socket?.emit('call-answer', {
        to: incomingCall.from,
        answer,
      });
      console.log('✅ Answer emitted via Socket.IO');
      
      // Start listening for call updates and ICE candidates
      startFirestoreListeners(callId, false);
      
    } catch (error) {
      console.error('❌ Error in acceptCall:', error);
      cleanup();
    }
  };

  // ── Reject call
  const rejectCall = async () => {
    if (incomingCall) {
      socket?.emit('call-rejected', { to: incomingCall.from });
      
      if (currentCallIdRef.current) {
        await CallService.rejectCall(currentCallIdRef.current);
      }
      
      setIncomingCall(null);
    }
  };

  // ── End call
  const endCall = async (otherUserId?: string) => {
    const target = otherUserId || remoteUserIdRef.current;
    if (target) {
      socket?.emit('call-ended', { to: target });
    }
    
    if (currentCallIdRef.current) {
      await CallService.endCall(currentCallIdRef.current);
    }
    
    cleanup();
  };

  // ── Cleanup
  const cleanup = () => {
    console.log('🧹 Cleaning up WebRTC');

    stopFirestoreListeners();
    
    if (incomingCallListenerRef.current) {
      incomingCallListenerRef.current();
      incomingCallListenerRef.current = null;
    }

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    remoteUserIdRef.current = null;
    currentCallIdRef.current = null;
    isCallerRef.current = false;
    answerProcessedRef.current = false;
    pendingIceCandidates.current = [];
    setStream(null);
    setRemoteStream(null);
    setCallActive(false);
    setIsConnected(false);
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIncomingCall(null);
    setCallStatus(CallStatus.RINGING);
    setShowCallWindow(false);
  };

  // ── Toggle mute
  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // ── Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // ── Start timer
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // ── Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Firestore listener for incoming calls (Android → Web)
  useEffect(() => {
    if (!_currentUserId) return;

    console.log('👂 Starting Firestore incoming call listener for:', _currentUserId);
    
    incomingCallListenerRef.current = CallService.listenToIncomingCalls(
      _currentUserId,
      (call: Call) => {
        console.log('📞 Incoming call from Firestore (Android):', call);
        
        if (currentCallIdRef.current === call.callId) {
          console.log('⚠️ Call already processed, skipping');
          return;
        }
        
        currentCallIdRef.current = call.callId;
        
        setIncomingCall({
          from: call.callerId,
          fromName: call.callerName,
          offer: {
            type: call.offerType as RTCSdpType,
            sdp: call.offer,
          },
          callType: call.callType === CallType.VIDEO ? 'video' : 'audio',
          callId: call.callId,
        });
      }
    );

    return () => {
      if (incomingCallListenerRef.current) {
        incomingCallListenerRef.current();
        incomingCallListenerRef.current = null;
      }
    };
  }, [_currentUserId]);

  // ── Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: any) => {
      console.log('📞 Incoming call data (Socket.IO):', {
        from: data.from,
        fromName: data.fromName,
        callType: data.callType,
        callId: data.callId
      });
      
      if (!data.fromName || data.fromName === 'Unknown') {
        console.warn('⚠️ Caller name is missing or Unknown!');
      }
      
      const callId = data.callId || `${data.from}_${_currentUserId}_${Date.now()}`;
      
      if (currentCallIdRef.current === callId) {
        console.log('⚠️ Call already processed, skipping');
        return;
      }
      
      currentCallIdRef.current = callId;
      
      setIncomingCall(data);
    };

    const handleCallAnswered = async (data: any) => {
      console.log('✅ Call answered by remote (Socket.IO)');
      
      if (!peerConnectionRef.current) {
        console.error('❌ Cannot process answer: peer connection is null');
        return;
      }
      
      if (!data.answer) {
        console.error('❌ No answer in data');
        return;
      }
      
      const currentState = peerConnectionRef.current.signalingState;
      console.log('  - Current signaling state:', currentState);
      
      if (currentState === 'have-local-offer' && !answerProcessedRef.current) {
        answerProcessedRef.current = true;
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          console.log('✅ Remote description set from Socket.IO answer');
          console.log('  - New signaling state:', peerConnectionRef.current.signalingState);
          
          // Process any pending ICE candidates
          if (pendingIceCandidates.current.length > 0) {
            console.log('🧊 Adding', pendingIceCandidates.current.length, 'pending ICE candidates');
            for (const candidate of pendingIceCandidates.current) {
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error('❌ Error adding pending ICE candidate:', err);
              }
            }
            pendingIceCandidates.current = [];
          }
        } catch (error) {
          console.error('❌ Error setting remote description from Socket.IO answer:', error);
        }
      } else {
        console.warn('⚠️ Cannot process answer, signaling state:', currentState, 'already processed:', answerProcessedRef.current);
      }
    };

    const handleIceCandidate = async (data: any) => {
      console.log('🧊 Received ICE candidate via Socket.IO');
      
      if (!data.candidate) {
        console.warn('⚠️ No candidate in data');
        return;
      }
      
      if (!peerConnectionRef.current) {
        console.warn('⚠️ Peer connection is null, queueing ICE candidate');
        pendingIceCandidates.current.push(data.candidate);
        return;
      }
      
      if (!peerConnectionRef.current.remoteDescription) {
        console.warn('⚠️ Remote description not set, queueing ICE candidate');
        pendingIceCandidates.current.push(data.candidate);
        return;
      }
      
      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log('✅ ICE candidate added via Socket.IO');
      } catch (error) {
        console.error('❌ Error adding ICE candidate via Socket.IO:', error);
      }
    };

    const handleCallRejected = () => {
      console.log('❌ Call was rejected');
      alert('Call was rejected.');
      cleanup();
    };

    const handleCallEnded = () => {
      console.log('📴 Call ended by remote');
      cleanup();
    };

    socket.on('incoming-call',  handleIncomingCall);
    socket.on('call-answered',  handleCallAnswered);
    socket.on('ice-candidate',  handleIceCandidate);
    socket.on('call-rejected',  handleCallRejected);
    socket.on('call-ended',     handleCallEnded);

    return () => {
      socket.off('incoming-call',  handleIncomingCall);
      socket.off('call-answered',  handleCallAnswered);
      socket.off('ice-candidate',  handleIceCandidate);
      socket.off('call-rejected',  handleCallRejected);
      socket.off('call-ended',     handleCallEnded);
    };
  }, [socket]);

  return {
    stream,
    remoteStream,
    callActive,
    incomingCall,
    isMuted,
    isVideoOff,
    callDuration: formatDuration(callDuration),
    callStatus,
    isConnected,
    showCallWindow,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
};
