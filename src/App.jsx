import React, { useState, useEffect, useRef } from 'react';
import { useSocketConnection, socket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { RoomEntry } from './components/RoomEntry';
import { VideoPlayer } from './components/VideoPlayer';
import { ChatDrawer } from './components/ChatDrawer';
import { GlassModal } from './components/GlassModal';
import { FloatingCamera } from './components/FloatingCamera';

function App() {
  const isSocketConnected = useSocketConnection();
  const [roomData, setRoomData] = useState(null); // { roomCode, role, nickname }
  const [chatOpen, setChatOpen] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [errorModal, setErrorModal] = useState({ open: false, title: '', desc: '' });
  
  // Notification states
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [overlayMessages, setOverlayMessages] = useState([]); // [{ id, sender, text, isFading }]

  const remoteAudioRef = useRef(null);

  // Parse room code from URL parameters for invite links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && room.trim().length === 6) {
      setInitialRoomCode(room.trim().toUpperCase());
    }
  }, []);

  // Handle Mobile Viewport Height Bug (100vh scrolling issue)
  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Triggered when user enters room successfully
  const handleJoinSuccess = (data) => {
    setRoomData(data);
    if (window.innerWidth > 1024) {
      setChatOpen(true);
    }
  };

  // Leave room and reset states
  const handleLeaveRoom = () => {
    if (socket.connected) {
      socket.disconnect();
    }
    setRoomData(null);
    setInitialRoomCode('');
    setOverlayMessages([]);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Mount WebRTC hooks if we are inside a room
  const webrtc = useWebRTC(
    roomData?.roomCode || '',
    roomData?.role || ''
  );

  // Hook remote audio stream to audio element
  useEffect(() => {
    if (remoteAudioRef.current && webrtc.remoteCameraStream) {
      console.log('Attaching remote audio tracks to DOM element');
      remoteAudioRef.current.srcObject = webrtc.remoteCameraStream;
    }
  }, [webrtc.remoteCameraStream]);

  // Handle incoming messages for transient overlays when chat is closed
  useEffect(() => {
    const handleReceiveMessage = (message) => {
      // Check if chat is closed and alerts are active
      if (!chatOpen && notificationsEnabled) {
        const msgId = Date.now() + Math.random();
        
        setOverlayMessages((prev) => [
          ...prev,
          {
            id: msgId,
            sender: message.senderName,
            text: message.text,
            isFading: false
          }
        ]);

        // Start fade out at 3.6 seconds
        setTimeout(() => {
          setOverlayMessages((prev) => 
            prev.map(m => m.id === msgId ? { ...m, isFading: true } : m)
          );
        }, 3600);

        // Remove bubble from DOM at 4.0 seconds
        setTimeout(() => {
          setOverlayMessages((prev) => prev.filter(m => m.id !== msgId));
        }, 4000);
      }
    };

    socket.on('receive-message', handleReceiveMessage);
    return () => {
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [chatOpen, notificationsEnabled]);

  // Clean up socket listener for room full errors
  useEffect(() => {
    const handleJoinError = ({ error }) => {
      setErrorModal({
        open: true,
        title: 'Access Denied',
        desc: error || 'Failed to enter the watch room.'
      });
      setRoomData(null);
    };

    socket.on('join-error', handleJoinError);
    return () => {
      socket.off('join-error', handleJoinError);
    };
  }, []);

  return (
    <div className="app-container">
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        style={{ display: 'none' }}
      />

      {/* VIEW 1: ENTRY SCREEN */}
      {!roomData ? (
        <RoomEntry 
          onJoinSuccess={handleJoinSuccess} 
          initialRoomCode={initialRoomCode}
        />
      ) : (
        /* VIEW 2: WATCH THEATER ROOM */
        <div className={`watch-room ${chatOpen ? 'chat-active' : ''}`}>
          
          {/* Main Stage Video Player */}
          <VideoPlayer
            roomCode={roomData.roomCode}
            role={roomData.role}
            sendSyncMessage={webrtc.sendSyncMessage}
            registerOnMessage={webrtc.registerOnMessage}
            peerConnected={webrtc.peerId !== null}
            onChatToggle={() => setChatOpen(!chatOpen)}
            chatOpen={chatOpen}

            // WebRTC controls
            isRoomLocked={webrtc.isRoomLocked}
            toggleRoomLock={webrtc.toggleRoomLock}
            connectionQuality={webrtc.connectionQuality}
            isScreenSharing={webrtc.isScreenSharing}
            isPeerScreenSharing={webrtc.isPeerScreenSharing}
            remoteScreenStream={webrtc.remoteScreenStream}
            toggleScreenShare={webrtc.toggleScreenShare}
            
            // Self preview props
            localStream={webrtc.localStream}
            isVideoDisabled={webrtc.isVideoDisabled}

            // Message overlay props
            overlayMessages={overlayMessages}
          />

          {/* DRAGGABLE PEER CAMERA WIDGET */}
          {webrtc.peerId !== null && (
            <FloatingCamera
              remoteStream={webrtc.remoteCameraStream}
              isPeerVideoDisabled={webrtc.isPeerVideoDisabled}
              nickname={roomData.role === 'host' ? 'Guest' : 'Host'}
            />
          )}

          {/* Sidebar Chat Drawer & Media Buttons */}
          <ChatDrawer
            roomCode={roomData.roomCode}
            nickname={roomData.nickname}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}

            // WebRTC states
            localStream={webrtc.localStream}
            isAudioMuted={webrtc.isAudioMuted}
            isVideoDisabled={webrtc.isVideoDisabled}
            toggleMic={webrtc.toggleMic}
            toggleCamera={webrtc.toggleCamera}
            switchCamera={webrtc.switchCamera}
            isScreenSharing={webrtc.isScreenSharing}
            isPeerScreenSharing={webrtc.isPeerScreenSharing}
            toggleScreenShare={webrtc.toggleScreenShare}

            // Room states
            isRoomLocked={webrtc.isRoomLocked}
            toggleRoomLock={webrtc.toggleRoomLock}
            connectionQuality={webrtc.connectionQuality}
            onLeaveRoom={handleLeaveRoom}

            // Overlay notifications
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
          />
        </div>
      )}

      {/* ALERTS MODAL */}
      <GlassModal
        isOpen={errorModal.open}
        title={errorModal.title}
        description={errorModal.desc}
        showClose
        onClose={() => setErrorModal({ open: false, title: '', desc: '' })}
      />
    </div>
  );
}

export default App;
