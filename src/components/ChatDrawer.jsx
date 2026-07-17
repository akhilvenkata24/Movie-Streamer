import React, { useRef, useState, useEffect } from 'react';
import { socket } from '../hooks/useSocket';

export function ChatDrawer({ 
  roomCode, 
  nickname, 
  isOpen, 
  onClose,
  
  // Media controls
  localStream,
  isAudioMuted,
  isVideoDisabled,
  toggleMic,
  toggleCamera,
  switchCamera,
  isScreenSharing,
  isPeerScreenSharing,
  toggleScreenShare,

  // Room controls
  isRoomLocked,
  toggleRoomLock,
  connectionQuality,
  onLeaveRoom,
  
  // Notification controls
  notificationsEnabled,
  setNotificationsEnabled
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  const addSystemMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        type: 'system',
        text,
        timestamp: Date.now()
      }
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Handle incoming messages & triggers
  useEffect(() => {
    const handleReceiveMessage = (message) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${message.timestamp}-${Math.random()}`,
          type: 'incoming',
          senderName: message.senderName,
          text: message.text,
          timestamp: message.timestamp
        }
      ]);
    };

    const handlePeerJoined = () => {
      addSystemMessage('Partner joined the party.');
    };

    const handlePeerLeft = () => {
      addSystemMessage('Partner left the party.');
    };

    const handleRoomLock = ({ isLocked }) => {
      addSystemMessage(isLocked ? 'Host locked the room.' : 'Host unlocked the room.');
    };

    const handleScreenShareStarted = () => {
      addSystemMessage('Partner started screen sharing.');
    };

    const handleScreenShareStopped = () => {
      addSystemMessage('Partner stopped screen sharing.');
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('peer-joined', handlePeerJoined);
    socket.on('peer-left', handlePeerLeft);
    socket.on('room-lock-changed', handleRoomLock);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);

    addSystemMessage('Theater active. Controls are below.');

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('peer-joined', handlePeerJoined);
      socket.off('peer-left', handlePeerLeft);
      socket.off('room-lock-changed', handleRoomLock);
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageData = {
      roomCode,
      message: inputText.trim(),
      senderName: nickname
    };

    socket.emit('send-message', messageData);

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: 'outgoing',
        senderName: nickname,
        text: inputText.trim(),
        timestamp: Date.now()
      }
    ]);

    setInputText('');
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getQualityLabel = () => {
    if (connectionQuality === 'good') return '🟢 Good';
    if (connectionQuality === 'fair') return '🟡 Fair';
    return '🔴 Poor';
  };

  return (
    <div className={`chat-drawer ${isOpen ? 'open' : ''}`}>
      {/* 1. MASTER CONTROL PANEL HEADER (Room info, Quality & Leave) */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--glass-border)',
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* Room badge + Copy Link + Exit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', color: '#e50914' }}>
              CODE: {roomCode}
            </span>
            <button 
              className="btn btn-secondary touch-no-zoom"
              onClick={handleCopyLink}
              style={{ padding: '4px 8px', fontSize: '0.65rem', borderRadius: '4px', width: 'auto', background: 'rgba(255,255,255,0.05)' }}
            >
              {copied ? 'Copied! ✅' : '🔗 Copy Invite'}
            </button>
          </div>

          <button 
            className="btn btn-danger touch-no-zoom"
            onClick={onLeaveRoom}
            style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '4px', width: 'auto', background: 'var(--accent)' }}
          >
            🚪 LEAVE
          </button>
        </div>

        {/* Connection quality + lock */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Signal: <strong>{getQualityLabel()}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>Status: <strong>{isRoomLocked ? '🔒 Locked' : '🔓 Open'}</strong></span>
          </div>

          <button
            className="touch-no-zoom"
            onClick={toggleRoomLock}
            style={{
              background: 'transparent',
              border: 'none',
              color: isRoomLocked ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: '700',
              textTransform: 'uppercase',
              fontSize: '0.7rem'
            }}
          >
            {isRoomLocked ? 'Unlock Room' : 'Lock Room'}
          </button>
        </div>
      </div>

      {/* 2. CALL MEDIA & SCREEN SHARE CONTROL PANEL (Netflix Style Red Round buttons) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '12px',
        borderBottom: '1px solid var(--glass-border)',
        background: '#181818',
        gap: '6px'
      }}>
        {/* Mic Toggle */}
        <button
          className="btn btn-secondary touch-no-zoom"
          onClick={toggleMic}
          style={{
            padding: '8px 2px',
            fontSize: '0.7rem',
            borderRadius: '6px',
            flexDirection: 'column',
            gap: '4px',
            background: isAudioMuted ? 'rgba(229, 9, 20, 0.25)' : 'rgba(255,255,255,0.04)',
            borderColor: isAudioMuted ? 'var(--accent)' : 'transparent',
            height: '52px'
          }}
        >
          <span style={{ fontSize: '1rem' }}>{isAudioMuted ? '🔇' : '🎙️'}</span>
          <span>{isAudioMuted ? 'Muted' : 'Mic On'}</span>
        </button>

        {/* Camera Toggle */}
        <button
          className="btn btn-secondary touch-no-zoom"
          onClick={toggleCamera}
          style={{
            padding: '8px 2px',
            fontSize: '0.7rem',
            borderRadius: '6px',
            flexDirection: 'column',
            gap: '4px',
            background: isVideoDisabled ? 'rgba(229, 9, 20, 0.25)' : 'rgba(255,255,255,0.04)',
            borderColor: isVideoDisabled ? 'var(--accent)' : 'transparent',
            height: '52px'
          }}
        >
          <span style={{ fontSize: '1rem' }}>{isVideoDisabled ? '❌' : '🎥'}</span>
          <span>{isVideoDisabled ? 'Cam Off' : 'Cam On'}</span>
        </button>

        {/* Swap lens */}
        <button
          className="btn btn-secondary touch-no-zoom"
          onClick={switchCamera}
          disabled={isVideoDisabled}
          style={{
            padding: '8px 2px',
            fontSize: '0.7rem',
            borderRadius: '6px',
            flexDirection: 'column',
            gap: '4px',
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'transparent',
            height: '52px',
            opacity: isVideoDisabled ? 0.3 : 1
          }}
        >
          <span style={{ fontSize: '1rem' }}>🔄</span>
          <span>Swap Cam</span>
        </button>

        {/* Screen Share */}
        <button
          className="btn btn-secondary touch-no-zoom"
          onClick={toggleScreenShare}
          disabled={isPeerScreenSharing}
          style={{
            padding: '8px 2px',
            fontSize: '0.7rem',
            borderRadius: '6px',
            flexDirection: 'column',
            gap: '4px',
            background: isScreenSharing ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
            borderColor: 'transparent',
            height: '52px',
            color: '#fff',
            opacity: isPeerScreenSharing ? 0.3 : 1
          }}
          title={isPeerScreenSharing ? 'Another participant is currently sharing.' : 'Share screen'}
        >
          <span style={{ fontSize: '1rem' }}>{isScreenSharing ? '🛑' : '🖥️'}</span>
          <span>{isScreenSharing ? 'Stop' : 'Share'}</span>
        </button>
      </div>

      {/* 3. SETTINGS / ALERTS TOGGLE BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        fontSize: '0.75rem',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)',
        background: '#111'
      }}>
        <span>Overlay Notifications</span>
        <button
          className="touch-no-zoom"
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          style={{
            background: notificationsEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.7rem',
            fontWeight: '700'
          }}
        >
          {notificationsEnabled ? '🔔 ACTIVE' : '🔕 MUTED'}
        </button>
      </div>

      {/* 4. MESSAGES LOG */}
      <div className="messages-list" style={{ flex: 1 }}>
        {messages.map((msg) => (
          msg.type === 'system' ? (
            <div key={msg.id} className="system-message">
              {msg.text}
            </div>
          ) : (
            <div 
              key={msg.id} 
              className={`message-bubble ${msg.type === 'outgoing' ? 'outgoing' : 'incoming'}`}
            >
              <div className="message-sender">
                {msg.type === 'outgoing' ? 'You' : msg.senderName}
              </div>
              <div className="message-content">{msg.text}</div>
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 5. INPUT FORM */}
      <form onSubmit={handleSendMessage} className="chat-input-bar">
        <input
          type="text"
          placeholder="Type message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="chat-input touch-no-zoom"
          maxLength={150}
        />
        <button 
          type="submit" 
          className="chat-send-btn touch-no-zoom"
          disabled={!inputText.trim()}
        >
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
