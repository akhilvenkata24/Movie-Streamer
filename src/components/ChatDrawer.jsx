import React, { useRef, useState, useEffect } from 'react';
import { socket } from '../hooks/useSocket';

export function ChatDrawer({ 
  roomCode, 
  nickname, 
  isOpen, 
  onClose,
  
  // Media controls passed from useWebRTC
  localStream,
  isAudioMuted,
  isVideoDisabled,
  toggleMic,
  toggleCamera,
  switchCamera,
  isScreenSharing,
  
  // Notification controls passed from App
  notificationsEnabled,
  setNotificationsEnabled
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
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

  // Handle socket message streams
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

    socket.on('receive-message', handleReceiveMessage);
    socket.on('peer-joined', handlePeerJoined);
    socket.on('peer-left', handlePeerLeft);
    socket.on('room-lock-changed', handleRoomLock);

    addSystemMessage('Theater Room active. Share the room link.');

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('peer-joined', handlePeerJoined);
      socket.off('peer-left', handlePeerLeft);
      socket.off('room-lock-changed', handleRoomLock);
    };
  }, []);

  // Send Message
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

  return (
    <div className={`chat-drawer ${isOpen ? 'open' : ''}`}>
      {/* CHAT HEADER */}
      <div className="chat-header">
        <span className="chat-title">💬 Chat Session</span>
        <button 
          className="control-btn chat-toggle-landscape touch-no-zoom"
          onClick={onClose}
          style={{ width: '28px', height: '28px', display: 'none' }}
        >
          ✕
        </button>
      </div>

      {/* CALL MEDIA CONTROL PANEL (Netflix Style Red Round buttons) */}
      {localStream && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '12px 8px',
          borderBottom: '1px solid var(--glass-border)',
          background: 'rgba(255,255,255,0.02)',
          gap: '8px'
        }}>
          {/* Mute Mic */}
          <button
            className="btn btn-secondary touch-no-zoom"
            onClick={toggleMic}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: isAudioMuted ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)',
              borderColor: isAudioMuted ? 'var(--accent)' : 'var(--glass-border)'
            }}
            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isAudioMuted ? '🔇 Mic Off' : '🎙️ Mic On'}
          </button>

          {/* Toggle Camera */}
          <button
            className="btn btn-secondary touch-no-zoom"
            onClick={toggleCamera}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: isVideoDisabled ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)',
              borderColor: isVideoDisabled ? 'var(--accent)' : 'var(--glass-border)'
            }}
            title={isVideoDisabled ? 'Enable camera' : 'Disable camera'}
          >
            {isVideoDisabled ? '📷 Cam Off' : '🎥 Cam On'}
          </button>

          {/* Switch camera user/environment */}
          <button
            className="btn btn-secondary touch-no-zoom"
            onClick={switchCamera}
            disabled={isVideoDisabled}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.05)'
            }}
            title="Switch front/rear camera"
          >
            🔄 Swap Lens
          </button>
        </div>
      )}

      {/* SETTINGS / ALERTS TOGGLE BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        fontSize: '0.75rem',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)'
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

      {/* MESSAGES LOG */}
      <div className="messages-list">
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

      {/* INPUT FORM */}
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
