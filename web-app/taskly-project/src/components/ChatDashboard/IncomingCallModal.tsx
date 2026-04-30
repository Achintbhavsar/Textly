import React from 'react';

interface IncomingCallModalProps {
  callerName: string;
  callType: 'video' | 'audio';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callerName,
  callType,
  onAccept,
  onReject
}) => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: 40,
        textAlign: 'center',
        maxWidth: 400
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: callType === 'video' ? '#2563eb' : '#10b981',
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span className="material-icons" style={{ fontSize: 40, color: 'white' }}>
            {callType === 'video' ? 'videocam' : 'call'}
          </span>
        </div>
        
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>{callerName}</h2>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>
          Incoming {callType} call...
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button
            onClick={onReject}
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

          <button
            onClick={onAccept}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#22c55e',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span className="material-icons" style={{ fontSize: 28, color: 'white' }}>
              call
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;