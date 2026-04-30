import React, { useEffect, useRef, useState } from 'react';

interface VideoCallProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callDuration: string;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  remoteName: string;
}

const VideoCall: React.FC<VideoCallProps> = ({
  localStream,
  remoteStream,
  callDuration,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  remoteName
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Set local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0f172a',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Remote Video (Main) */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e293b'
      }}>
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            textAlign: 'center',
            color: 'white'
          }}>
            <div style={{
              width: 120,
              height: 120,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              fontWeight: 700
            }}>
              {remoteName[0]?.toUpperCase()}
            </div>
            <p style={{ fontSize: 18, opacity: 0.7 }}>Connecting...</p>
          </div>
        )}

        {/* Remote Name Tag */}
        <div style={{
          position: 'absolute',
          top: 24,
          left: 24,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          padding: '12px 20px',
          borderRadius: 12,
          color: 'white',
          fontSize: 16,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span className="material-icons" style={{ fontSize: 20, color: '#22c55e' }}>
            videocam
          </span>
          {remoteName}
        </div>

        {/* Call Duration */}
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          padding: '12px 20px',
          borderRadius: 12,
          color: 'white',
          fontSize: 16,
          fontWeight: 600,
          fontFamily: 'monospace'
        }}>
          {callDuration}
        </div>

        {/* Local Video (Picture-in-Picture) */}
        {localStream && (
          <div style={{
            position: 'absolute',
            bottom: 100,
            right: 24,
            width: 200,
            height: 150,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '3px solid rgba(255,255,255,0.2)'
          }}>
            {isVideoOff ? (
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 32,
                fontWeight: 700
              }}>
                <span className="material-icons" style={{ fontSize: 48 }}>
                  videocam_off
                </span>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)' // Mirror effect
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        height: 100,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 24px'
      }}>
        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.15)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        {/* Video Toggle Button */}
        <button
          onClick={onToggleVideo}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.15)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isVideoOff ? 'videocam_off' : 'videocam'}
          </span>
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span className="material-icons" style={{ fontSize: 24, color: 'white' }}>
            {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#ef4444',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
            marginLeft: 16
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(239, 68, 68, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.4)';
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

export default VideoCall;