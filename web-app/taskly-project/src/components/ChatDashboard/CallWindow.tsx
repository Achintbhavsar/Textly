import React, { useRef, useEffect } from 'react';

interface CallWindowProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callDuration: string;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  darkMode: boolean;
}

const CallWindow: React.FC<CallWindowProps> = ({
  localStream,
  remoteStream,
  callDuration,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log('📹 Local stream changed:', localStream ? 'Available' : 'null');
    if (localStream) {
      console.log('  - Local stream tracks:', localStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));
    }
    
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => console.error('❌ Local video play error:', err));
    }
  }, [localStream]);

  useEffect(() => {
    console.log('📺 Remote stream changed:', remoteStream ? 'Available' : 'null');
    if (remoteStream) {
      console.log('  - Remote stream id:', remoteStream.id);
      console.log('  - Remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));
    }
    
    if (remoteVideoRef.current && remoteStream) {
      console.log('✅ Setting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play()
        .then(() => console.log('✅ Remote video playing'))
        .catch(err => console.error('❌ Remote video play error:', err));
    }
  }, [remoteStream]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Remote video or connecting state */}
      {remoteStream ? (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#000'
            }}
          />
          {/* Debug info */}
          <div style={{
            position: 'absolute',
            top: 60,
            left: 20,
            background: 'rgba(0,0,0,0.7)',
            padding: '8px 12px',
            borderRadius: 8,
            color: 'white',
            fontSize: 12,
            fontFamily: 'monospace'
          }}>
            Remote: {remoteStream.getTracks().length} tracks
          </div>
        </>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          color: 'white'
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTopColor: 'white',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ fontSize: 18, fontWeight: 500 }}>Connecting...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Local video (PiP) */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 200,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        border: '2px solid white'
      }}>
        {!isVideoOff ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#64748b' }}>
              videocam_off
            </span>
          </div>
        )}
      </div>

      {/* Timer */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0,0,0,0.5)',
        padding: '8px 16px',
        borderRadius: 20,
        color: 'white'
      }}>
        {callDuration}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        display: 'flex',
        gap: 16
      }}>
        <button
          onClick={onToggleMute}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isMuted ? '#ef4444' : '#334155',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        <button
          onClick={onToggleVideo}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isVideoOff ? '#ef4444' : '#334155',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isVideoOff ? 'videocam_off' : 'videocam'}
          </span>
        </button>

        <button
          onClick={onEndCall}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#ef4444',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-icons" style={{ fontSize: 28, color: 'white' }}>
            call_end
          </span>
        </button>
      </div>
    </div>
  );
};

export default CallWindow;