import React, { useRef, useState, useEffect, useCallback } from 'react';
import { socket } from '../hooks/useSocket';

const PRELOADED_VIDEOS = [
  {
    title: 'Tears of Steel (Sci-Fi)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    sourceType: 'preloaded'
  },
  {
    title: 'Sintel (Fantasy)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    sourceType: 'preloaded'
  },
  {
    title: 'Big Buck Bunny (Animation)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    sourceType: 'preloaded'
  }
];

export function VideoPlayer({ 
  roomCode, 
  role, 
  sendSyncMessage, 
  registerOnMessage, 
  peerConnected, 
  onChatToggle, 
  chatOpen,
  isRoomLocked,
  toggleRoomLock,
  connectionQuality,
  isScreenSharing,
  isPeerScreenSharing,
  remoteScreenStream,
  toggleScreenShare,
  localStream,
  isVideoDisabled,
  overlayMessages
}) {
  const videoRef = useRef(null);
  const remoteScreenRef = useRef(null);
  const localVideoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const isRemoteActionRef = useRef(false);
  const lastTapRef = useRef({ time: 0, x: 0 });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen state listener
  useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // Hook local video self preview stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Error playing self preview:', e));
    }
  }, [localStream, isVideoDisabled]);

  // Hook remote screen share stream
  useEffect(() => {
    if (remoteScreenRef.current && remoteScreenStream) {
      console.log('Hooking remote screen share stream to video element');
      remoteScreenRef.current.srcObject = remoteScreenStream;
      remoteScreenRef.current.play().catch(e => console.log('Error playing remote screen:', e));
    }
  }, [remoteScreenStream, isPeerScreenSharing]);

  const [videoState, setVideoState] = useState({
    url: PRELOADED_VIDEOS[0].url,
    title: PRELOADED_VIDEOS[0].title,
    sourceType: 'preloaded',
    fileName: '',
    fileSize: 0
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Menus
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  
  // Double-tap skip animations
  const [doubleTapState, setDoubleTapState] = useState({ show: false, side: 'left', animate: false });
  // Local File loading warning
  const [localFileWarning, setLocalFileWarning] = useState(null);

  const fileInputRef = useRef(null);

  // Hook remote screen stream
  useEffect(() => {
    if (remoteScreenRef.current && remoteScreenStream) {
      console.log('Hooking remote screen sharing stream to video player element');
      remoteScreenRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream, isPeerScreenSharing]);

  // Format time
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const hrs = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds - hrs * 3600) / 60);
    const secs = Math.floor(timeInSeconds - hrs * 3600 - mins * 60);
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Show/Hide controls timer
  const triggerShowControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Auto hide screen controls if playing movie and menus are closed
    if (isPlaying && !isPeerScreenSharing && !isScreenSharing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowVideoMenu(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  }, [isPlaying, isPeerScreenSharing, isScreenSharing]);

  // Handle Play/Pause
  const handlePlayToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    triggerShowControls();

    if (video.paused) {
      video.play().catch(e => console.log('Playback error:', e));
      setIsPlaying(true);
      sendSyncMessage({ type: 'play', time: video.currentTime });
    } else {
      video.pause();
      setIsPlaying(false);
      sendSyncMessage({ type: 'pause', time: video.currentTime });
    }
  };

  // Handle Seek
  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newPercent = clickX / width;
    const newTime = newPercent * video.duration;

    if (!isNaN(newTime)) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
      sendSyncMessage({ type: 'seek', time: newTime });
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      videoRef.current.volume = nextMuted ? 0 : volume || 0.5;
    }
  };

  // Handle Playback Rate
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      sendSyncMessage({ type: 'speed', speed });
    }
  };

  // Change Video Source
  const changeVideoSource = (source) => {
    setVideoState({
      url: source.url,
      title: source.title,
      sourceType: source.sourceType,
      fileName: source.fileName || '',
      fileSize: source.fileSize || 0
    });
    setLocalFileWarning(null);
    setShowVideoMenu(false);
    setIsPlaying(false);
    setCurrentTime(0);

    sendSyncMessage({
      type: 'change-video',
      url: source.url,
      additionalData: {
        url: source.url,
        title: source.title,
        sourceType: source.sourceType,
        fileName: source.fileName || '',
        fileSize: source.fileSize || 0
      }
    });
  };

  // Handle Custom URL Submit
  const handleCustomUrlSubmit = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    changeVideoSource({
      title: 'Custom URL Stream',
      url: customUrl,
      sourceType: 'url'
    });
    setCustomUrl('');
    setShowUrlInput(false);
  };

  // Handle Local File Selection
  const handleLocalFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    changeVideoSource({
      title: file.name,
      url: fileUrl,
      sourceType: 'local',
      fileName: file.name,
      fileSize: file.size
    });
  };

  const triggerLocalFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Copy room link to clipboard
  const handleCopyRoomCode = () => {
    const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Double-tap skip handler
  const handleTouchStart = (e) => {
    if (isPeerScreenSharing || isScreenSharing) return; // Skip double tap on active screen shares

    const touch = e.touches[0];
    const now = Date.now();
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = touch.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const timeDiff = now - lastTapRef.current.time;

    if (timeDiff < 300 && Math.abs(clickX - lastTapRef.current.x) < 40) {
      e.preventDefault();
      const video = videoRef.current;
      if (!video) return;

      if (clickPercent < 0.4) {
        const targetTime = Math.max(0, video.currentTime - 10);
        video.currentTime = targetTime;
        setCurrentTime(targetTime);
        sendSyncMessage({ type: 'seek', time: targetTime });

        setDoubleTapState({ show: true, side: 'left', animate: true });
        setTimeout(() => setDoubleTapState({ show: false, side: 'left', animate: false }), 500);
      } else if (clickPercent > 0.6) {
        const targetTime = Math.min(video.duration || 0, video.currentTime + 10);
        video.currentTime = targetTime;
        setCurrentTime(targetTime);
        sendSyncMessage({ type: 'seek', time: targetTime });

        setDoubleTapState({ show: true, side: 'right', animate: true });
        setTimeout(() => setDoubleTapState({ show: false, side: 'right', animate: false }), 500);
      }
    } else {
      lastTapRef.current = { time: now, x: clickX };
      
      if (e.target.closest('.video-controls') === null) {
        if (controlsVisible) {
          setControlsVisible(false);
        } else {
          triggerShowControls();
        }
      }
    }
  };

  // Receive WebRTC / Socket sync commands
  const handleRemoteEvent = useCallback((data) => {
    const video = videoRef.current;
    const actionType = data.type || data.action;
    
    // Ignore events if user is looking at screen share
    if (isPeerScreenSharing || isScreenSharing) {
      if (actionType === 'change-video') {
        const addData = data.additionalData || data;
        setVideoState({
          url: addData.sourceType === 'local' ? '' : addData.url,
          title: addData.title,
          sourceType: addData.sourceType,
          fileName: addData.fileName || '',
          fileSize: addData.fileSize || 0
        });
        if (addData.sourceType === 'local') {
          setLocalFileWarning({ fileName: addData.fileName, fileSize: addData.fileSize });
        }
      }
      return;
    }

    if (!video) return;
    isRemoteActionRef.current = true;

    const actionTime = data.time !== undefined ? data.time : data.currentTime;
    const actionSpeed = data.speed !== undefined ? data.speed : data.speed;

    switch (actionType) {
      case 'play':
        if (actionTime !== undefined && Math.abs(video.currentTime - actionTime) > 1.2) {
          video.currentTime = actionTime;
          setCurrentTime(actionTime);
        }
        video.play().then(() => setIsPlaying(true)).catch(e => console.log(e));
        break;

      case 'pause':
        video.pause();
        setIsPlaying(false);
        if (actionTime !== undefined) {
          video.currentTime = actionTime;
          setCurrentTime(actionTime);
        }
        break;

      case 'seek':
        if (actionTime !== undefined) {
          video.currentTime = actionTime;
          setCurrentTime(actionTime);
        }
        break;

      case 'speed':
        if (actionSpeed !== undefined) {
          video.playbackRate = actionSpeed;
          setPlaybackSpeed(actionSpeed);
        }
        break;

      case 'change-video':
        const addData = data.additionalData || data;
        if (addData.sourceType === 'local') {
          setLocalFileWarning({
            fileName: addData.fileName,
            fileSize: addData.fileSize
          });
          setVideoState({
            url: '',
            title: addData.fileName,
            sourceType: 'local',
            fileName: addData.fileName,
            fileSize: addData.fileSize
          });
        } else {
          setLocalFileWarning(null);
          setVideoState({
            url: addData.url,
            title: addData.title,
            sourceType: addData.sourceType,
            fileName: '',
            fileSize: 0
          });
        }
        setIsPlaying(false);
        setCurrentTime(0);
        break;
      
      case 'request-sync':
        if (role === 'host') {
          sendSyncMessage({
            type: 'respond-sync',
            time: video.currentTime,
            playing: !video.paused,
            speed: video.playbackRate,
            additionalData: {
              url: videoState.url,
              title: videoState.title,
              sourceType: videoState.sourceType,
              fileName: videoState.fileName,
              fileSize: videoState.fileSize
            }
          });
        }
        break;

      case 'respond-sync':
        if (role === 'guest') {
          const syncData = data.additionalData;
          if (syncData) {
            if (syncData.sourceType === 'local') {
              setLocalFileWarning({
                fileName: syncData.fileName,
                fileSize: syncData.fileSize
              });
              setVideoState({
                url: '',
                title: syncData.fileName,
                sourceType: 'local',
                fileName: syncData.fileName,
                fileSize: syncData.fileSize
              });
            } else {
              setVideoState({
                url: syncData.url,
                title: syncData.title,
                sourceType: syncData.sourceType,
                fileName: '',
                fileSize: 0
              });
            }
          }
          if (actionTime !== undefined) {
            video.currentTime = actionTime;
            setCurrentTime(actionTime);
          }
          if (data.playing) {
            video.play().then(() => setIsPlaying(true)).catch(e => console.log(e));
          } else {
            video.pause();
            setIsPlaying(false);
          }
          if (actionSpeed !== undefined) {
            video.playbackRate = actionSpeed;
            setPlaybackSpeed(actionSpeed);
          }
        }
        break;

      default:
        break;
    }

    setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 50);
  }, [role, videoState, sendSyncMessage, isPeerScreenSharing, isScreenSharing]);

  // Hook listeners
  useEffect(() => {
    registerOnMessage(handleRemoteEvent);
    socket.on('sync-playback', handleRemoteEvent);
    if (role === 'guest' && peerConnected && !isPeerScreenSharing) {
      socket.emit('sync-playback', {
        roomCode,
        action: 'request-sync',
        currentTime: 0,
        playing: false,
        speed: 1
      });
    }
    return () => {
      socket.off('sync-playback', handleRemoteEvent);
    };
  }, [registerOnMessage, handleRemoteEvent, role, peerConnected, roomCode, isPeerScreenSharing]);

  // Handle local video playback listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    
    const onPlay = () => {
      if (isRemoteActionRef.current) return;
      setIsPlaying(true);
      sendSyncMessage({ type: 'play', time: video.currentTime });
    };

    const onPause = () => {
      if (isRemoteActionRef.current) return;
      setIsPlaying(false);
      sendSyncMessage({ type: 'pause', time: video.currentTime });
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoState.url, sendSyncMessage, isPeerScreenSharing, isScreenSharing]);

  // Autohide controls logic
  useEffect(() => {
    triggerShowControls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, triggerShowControls]);

  // Quality indicator helper
  const getQualityText = () => {
    if (connectionQuality === 'good') return '🟢 Good Connection';
    if (connectionQuality === 'fair') return '🟡 Fair Connection';
    return '🔴 Poor Connection';
  };

  const handlePlayerClick = (e) => {
    // If clicking inside control panels, dropdown menus, inputs, or play buttons, ignore
    if (
      e.target.closest('.controls-top') || 
      e.target.closest('.controls-bottom') || 
      e.target.closest('.select-dropdown') || 
      e.target.closest('.center-play-btn') ||
      e.target.closest('.select-menu-container') ||
      e.target.tagName === 'FORM' ||
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'BUTTON'
    ) {
      return;
    }
    
    if (controlsVisible) {
      setControlsVisible(false);
    } else {
      triggerShowControls();
    }
  };

  return (
    <div 
      className="video-container" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onClick={handlePlayerClick}
    >
      {/* 1. REMOTE SCREEN SHARE RENDERING */}
      {isPeerScreenSharing && remoteScreenStream ? (
        <video 
          className="video-element"
          ref={remoteScreenRef}
          autoPlay
          playsInline
          muted
        />
      ) : isScreenSharing ? (
        /* 2. LOCAL SCREEN SHARER WATERMARK */
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '3rem', animation: 'pulse-glow 2s infinite' }}>🖥️</span>
          <h3 style={{ fontSize: '1.2rem', margin: '16px 0 8px', color: 'var(--accent)' }}>You are sharing your screen</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '300px' }}>
            Your partner sees everything on your screen in real-time.
          </p>
        </div>
      ) : (
        /* 3. NORMAL MOVIE STREAM RENDERING */
        <>
          {localFileWarning && !videoState.url && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              padding: '24px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '3rem', marginBottom: '16px' }}>🍿</span>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Partner loaded a local file</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', maxWidth: '340px' }}>
                Load your local file:<br/>
                <strong style={{ color: '#fff' }}>{localFileWarning.fileName}</strong><br/>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ({(localFileWarning.fileSize / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </p>
              <button className="btn btn-primary touch-no-zoom" onClick={triggerLocalFilePicker} style={{ maxWidth: '240px' }}>
                Load Local File
              </button>
            </div>
          )}

          {videoState.url ? (
            <video 
              className="video-element"
              ref={videoRef}
              src={videoState.url}
              playsInline
            />
          ) : (
            !localFileWarning && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No video loaded. Select a source from the top-right.
              </div>
            )
          )}
        </>
      )}

      {/* LOCAL USER SELF PREVIEW (Mirrored FaceTime-Style overlay) */}
      {localStream && !isVideoDisabled && (
        <div style={{
          position: 'absolute',
          bottom: isPeerScreenSharing || isScreenSharing ? '24px' : '72px',
          right: '16px',
          width: '72px',
          height: '96px',
          borderRadius: '8px',
          border: '1px solid var(--accent)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          zIndex: 45,
          background: '#000',
          pointerEvents: 'none'
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '2px',
            left: '4px',
            fontSize: '0.5rem',
            fontWeight: '800',
            color: '#fff',
            background: 'rgba(0,0,0,0.6)',
            padding: '1px 3px',
            borderRadius: '2px'
          }}>
            YOU
          </div>
        </div>
      )}
      {/* TRANSIENT CHAT OVERLAY BUBBLES (Rendered inside video player to remain visible in fullscreen) */}
      {!chatOpen && overlayMessages && overlayMessages.length > 0 && (
        <div className="chat-overlay-container" style={{ bottom: isPeerScreenSharing || isScreenSharing ? '24px' : '84px', zIndex: 120 }}>
          {overlayMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`chat-overlay-bubble ${msg.isFading ? 'fade-out' : ''}`}
            >
              <span className="chat-overlay-sender">{msg.sender}</span>
              <span>{msg.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* DOUBLE TAP ANIMATIONS */}
      {!isPeerScreenSharing && !isScreenSharing && (
        <>
          <div className={`double-tap-indicator left ${doubleTapState.show && doubleTapState.side === 'left' ? 'animate' : ''}`}>
            <div className="skip-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
            </div>
            <span className="double-tap-text">10s backward</span>
          </div>

          <div className={`double-tap-indicator right ${doubleTapState.show && doubleTapState.side === 'right' ? 'animate' : ''}`}>
            <div className="skip-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            </div>
            <span className="double-tap-text">10s forward</span>
          </div>
        </>
      )}

      {/* CENTER MOVIE PLAY BUTTON */}
      {!isPlaying && videoState.url && !isPeerScreenSharing && !isScreenSharing && (
        <button 
          className={`center-play-btn touch-no-zoom`}
          onClick={handlePlayToggle}
        >
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      )}

      {/* OVERLAY CONTROLS */}
      {!isPeerScreenSharing && !isScreenSharing && (
        <div className={`video-controls ${controlsVisible ? 'visible' : ''}`}>
          
          {/* TOP BAR CONTROLS */}
          <div className="controls-top">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div 
                className="room-badge touch-no-zoom" 
                onClick={handleCopyRoomCode} 
                style={{ cursor: 'pointer' }}
                title="Click to copy invite link"
              >
                <span className={`badge-pulse ${peerConnected ? '' : 'disconnected'}`}></span>
                <span>Room: {roomCode} {copied ? '(Copied! ✅)' : '(Invite 🔗)'}</span>
              </div>

              {/* Room Lock Button */}
              <button 
                className="control-btn touch-no-zoom"
                onClick={toggleRoomLock}
                style={{ width: '28px', height: '28px', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)', padding: 0 }}
                title={isRoomLocked ? 'Room is Locked' : 'Room is Open'}
              >
                {isRoomLocked ? '🔒' : '🔓'}
              </button>

              {/* Quality Indicator */}
              {peerConnected && (
                <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '4px 8px', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)', borderRadius: '4px' }}>
                  {getQualityText()}
                </span>
              )}
            </div>

            {/* Video Library / Speed buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="select-menu-container">
                <button 
                  className="control-btn touch-no-zoom" 
                  onClick={() => {
                    setShowVideoMenu(!showVideoMenu);
                    setShowSpeedMenu(false);
                    setShowUrlInput(false);
                  }}
                  style={{ width: 'auto', padding: '0 12px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)', gap: '4px' }}
                >
                  🍿 Movie Library ▼
                </button>

                {showVideoMenu && (
                  <div className="select-dropdown" style={{ right: 0 }}>
                    <div style={{ padding: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', fontWeight: '700', textTransform: 'uppercase' }}>Select Video</div>
                    {PRELOADED_VIDEOS.map((vid, idx) => (
                      <button 
                        key={idx}
                        className={`select-item ${videoState.url === vid.url ? 'active' : ''}`}
                        onClick={() => changeVideoSource(vid)}
                      >
                        {vid.title}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
                    <button 
                      className={`select-item ${videoState.sourceType === 'url' ? 'active' : ''}`}
                      onClick={() => {
                        setShowUrlInput(true);
                        setShowVideoMenu(false);
                      }}
                    >
                      🌐 Custom Stream URL
                    </button>
                    <button 
                      className={`select-item ${videoState.sourceType === 'local' ? 'active' : ''}`}
                      onClick={() => {
                        triggerLocalFilePicker();
                        setShowVideoMenu(false);
                      }}
                    >
                      📁 Play Local File
                    </button>
                  </div>
                )}
              </div>

              {/* Playback speed dropdown */}
              <div className="select-menu-container">
                <button 
                  className="control-btn touch-no-zoom" 
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowVideoMenu(false);
                    setShowUrlInput(false);
                  }}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)' }}
                >
                  {playbackSpeed}x
                </button>

                {showSpeedMenu && (
                  <div className="select-dropdown" style={{ right: 0, width: '90px' }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((sp) => (
                      <button 
                        key={sp}
                        className={`select-item ${playbackSpeed === sp ? 'active' : ''}`}
                        onClick={() => handleSpeedChange(sp)}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CUSTOM NET URL INPUT POPUP */}
          {showUrlInput && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--glass-bg-dense)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '24px',
              zIndex: 110,
              width: '90%',
              maxWidth: '360px',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <form onSubmit={handleCustomUrlSubmit}>
                <h4 style={{ marginBottom: '14px', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--accent)' }}>Paste Direct MP4 URL</h4>
                <input 
                  type="url" 
                  placeholder="https://example.com/movie.mp4" 
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="input-field"
                  required
                  style={{ marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary touch-no-zoom" onClick={() => setShowUrlInput(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary touch-no-zoom" style={{ flex: 1.5 }}>
                    Play Stream
                  </button>
                </div>
              </form>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="video/*" 
            onChange={handleLocalFileChange}
          />

          {/* BOTTOM TIMELINE & PLAYER CONTROLS */}
          <div className="controls-bottom">
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🍿 NOW PLAYING: {videoState.title.toUpperCase()}
            </div>

            <div className="progress-container">
              <span className="time-display">{formatTime(currentTime)}</span>
              <div className="progress-bar-wrapper" onClick={handleSeek}>
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <div 
                  className="progress-handle" 
                  style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="time-display">{formatTime(duration)}</span>
            </div>

            <div className="controls-row">
              <div className="controls-left">
                {/* Play button */}
                <button className="control-btn touch-no-zoom" onClick={handlePlayToggle}>
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>

                {/* Volume slider */}
                <div className="volume-container">
                  <button className="control-btn touch-no-zoom" onClick={handleMuteToggle}>
                    {isMuted || volume === 0 ? (
                      <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM19 12c0 3.28-2.16 6.03-5.14 7v2.06c4.09-.94 7.14-4.57 7.14-9s-3.05-8.06-7.14-9v2.06c2.98.97 5.14 3.72 5.14 7zM3 9v6h4l5 5V4L7 9H3z"/></svg>
                    ) : volume < 0.5 ? (
                      <svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    )}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={isMuted ? 0 : volume} 
                    onChange={handleVolumeChange}
                    className="volume-slider touch-no-zoom"
                  />
                </div>
              </div>

              <div className="controls-right">
                {/* Chat Toggle */}
                <button 
                  className="control-btn chat-toggle-landscape touch-no-zoom" 
                  onClick={onChatToggle}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.8rem', gap: '4px', display: 'none', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)' }}
                >
                  💬 Chat {chatOpen ? '◀' : '▶'}
                </button>

                {/* Fullscreen toggle */}
                <button className="control-btn touch-no-zoom" onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else if (containerRef.current) {
                    containerRef.current.requestFullscreen().catch(e => console.log(e));
                  }
                }}>
                  {isFullscreen ? (
                    <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', fill: '#fff' }}>
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', fill: '#fff' }}>
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
