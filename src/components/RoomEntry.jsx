import React, { useState, useEffect } from 'react';
import { socket } from '../hooks/useSocket';

export function RoomEntry({ onJoinSuccess, initialRoomCode }) {
  const [view, setView] = useState('menu'); // menu, create, join
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-fill room code from URL if provided (from invite link)
  useEffect(() => {
    if (initialRoomCode) {
      setView('join');
      setJoinCodeInput(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  // Create Room flow
  const handleCreateRoom = () => {
    setIsLoading(true);
    setError('');
    
    // Connect socket if not connected
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('create-room', (response) => {
      setIsLoading(false);
      if (response.success) {
        setRoomCode(response.code);
        setView('create');
      } else {
        setError('Failed to create room. Please try again.');
      }
    });
  };

  // Join Room flow
  const handleJoinRoom = (e) => {
    if (e) e.preventDefault();
    if (joinCodeInput.trim().length !== 6) {
      setError('Room code must be exactly 6 characters.');
      return;
    }

    setIsLoading(true);
    setError('');

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join-room', { code: joinCodeInput }, (response) => {
      setIsLoading(false);
      if (response.success) {
        // Successfully joined room
        const finalName = nickname.trim() || 'Guest';
        onJoinSuccess({
          roomCode: response.code,
          role: 'guest',
          nickname: finalName,
          peers: response.peers
        });
      } else {
        setError(response.error || 'Failed to join room.');
      }
    });
  };

  // Auto-submit Join Room when code reaches 6 characters
  useEffect(() => {
    if (joinCodeInput.trim().length === 6 && view === 'join') {
      handleJoinRoom();
    }
  }, [joinCodeInput, view]);

  // Enter created room as Host
  const handleEnterCreatedRoom = () => {
    const finalName = nickname.trim() || 'Host';
    onJoinSuccess({
      roomCode,
      role: 'host',
      nickname: finalName,
      peers: []
    });
  };

  // Handle Share Room code/link
  const handleShare = async () => {
    const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
    const shareData = {
      title: 'Join my Watch Party!',
      text: `Let's watch a movie together! Use Room Code: ${roomCode}`,
      url: inviteUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        console.log('Shared successfully');
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Clipboard copy fallback
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
        setError('Failed to copy invite link. Please copy code manually.');
      }
    }
  };

  return (
    <div className="entry-container">
      <div className="entry-card glass-panel">
        
        {/* LOGO */}
        <div className="entry-logo">
          <span className="logo-icon">🎬</span>
          <span className="logo-text text-gradient">CineSync</span>
        </div>

        <p className="entry-tagline">Watch movies together in perfect sync.</p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '10px',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            animation: 'slide-up 0.2s ease-out'
          }}>
            {error}
          </div>
        )}

        {/* LOADING INDICATOR */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '30px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--glass-border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'voice-bounce 1s infinite linear'
            }} />
            <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Connecting to theater...
            </p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* VIEW 1: MAIN MENU */}
            {view === 'menu' && (
              <div className="entry-options">
                <button 
                  className="btn btn-primary touch-no-zoom" 
                  onClick={handleCreateRoom}
                >
                  Create Room
                </button>
                <button 
                  className="btn btn-secondary touch-no-zoom" 
                  onClick={() => setView('join')}
                >
                  Join Room
                </button>
              </div>
            )}

            {/* VIEW 2: CREATE ROOM DISPLAY */}
            {view === 'create' && (
              <div className="room-display">
                <div className="input-group" style={{ marginBottom: '10px' }}>
                  <label className="input-label">Your Nickname</label>
                  <input 
                    type="text" 
                    placeholder="Enter nickname (optional)" 
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={15}
                    className="input-field"
                  />
                </div>

                <div className="input-label" style={{ alignSelf: 'flex-start' }}>Room Code</div>
                <div className="room-code-box">{roomCode}</div>
                <p className="room-help-text">Share the code or link with one friend.</p>

                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                  <button 
                    className="btn btn-secondary touch-no-zoom" 
                    onClick={handleShare}
                    style={{ flex: 1 }}
                  >
                    {copied ? 'Copied Link! ✅' : '🔗 Share Link'}
                  </button>
                  <button 
                    className="btn btn-primary touch-no-zoom" 
                    onClick={handleEnterCreatedRoom}
                    style={{ flex: 1.2 }}
                  >
                    Enter Room 🍿
                  </button>
                </div>

                <button 
                  className="btn btn-secondary touch-no-zoom" 
                  onClick={() => setView('menu')}
                  style={{ border: 'none', background: 'transparent', padding: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}
                >
                  ← Back to main menu
                </button>
              </div>
            )}

            {/* VIEW 3: JOIN ROOM INPUT */}
            {view === 'join' && (
              <form onSubmit={handleJoinRoom} className="room-display">
                <div className="input-group" style={{ marginBottom: '5px' }}>
                  <label className="input-label">Your Nickname</label>
                  <input 
                    type="text" 
                    placeholder="Enter nickname (optional)" 
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={15}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Enter 6-Digit Room Code</label>
                  <input 
                    type="text" 
                    placeholder="E.G. AB12CD" 
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    autoFocus
                    className="input-field"
                    style={{ 
                      textAlign: 'center', 
                      fontSize: '1.4rem', 
                      letterSpacing: '0.15em', 
                      textTransform: 'uppercase',
                      fontWeight: '700'
                    }}
                  />
                </div>

                <button 
                  type="submit"
                  className="btn btn-primary touch-no-zoom" 
                  disabled={joinCodeInput.trim().length !== 6}
                >
                  Join Party 🎉
                </button>

                <button 
                  type="button"
                  className="btn btn-secondary touch-no-zoom" 
                  onClick={() => {
                    setView('menu');
                    setJoinCodeInput('');
                    setError('');
                  }}
                  style={{ border: 'none', background: 'transparent', padding: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}
                >
                  ← Cancel and go back
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
