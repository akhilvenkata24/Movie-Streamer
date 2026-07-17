import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from './useSocket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function useWebRTC(roomCode, role) {
  const [peerId, setPeerId] = useState(null);
  
  // Connection states
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('good'); // good, fair, poor

  // Local Media states
  const [localStream, setLocalStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // user, environment

  // Remote Media states
  const [remoteCameraStream, setRemoteCameraStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [isPeerAudioMuted, setIsPeerAudioMuted] = useState(false);
  const [isPeerVideoDisabled, setIsPeerVideoDisabled] = useState(false);
  const [isPeerScreenSharing, setIsPeerScreenSharing] = useState(false);
  const [peerScreenTrackId, setPeerScreenTrackId] = useState(null);

  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const sendersRef = useRef({ audio: null, video: null, screen: null });
  const onMessageCallbackRef = useRef(null);
  const cameraStreamIdRef = useRef(null);

  const registerOnMessage = useCallback((callback) => {
    onMessageCallbackRef.current = callback;
  }, []);

  // Set up local camera and mic stream
  const initializeLocalMedia = async () => {
    try {
      console.log('Requesting local mic & camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 15 } // Optimize bandwidth on mobile
        }
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Failed to get camera and mic:', err);
      // Fallback: try audio only
      try {
        console.log('Attempting audio-only fallback...');
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioStream);
        setIsVideoDisabled(true);
        return audioStream;
      } catch (audioErr) {
        console.error('Failed to get mic:', audioErr);
        // Return dummy empty stream so components don't crash
        const dummy = new MediaStream();
        setLocalStream(dummy);
        setIsVideoDisabled(true);
        setIsAudioMuted(true);
        return dummy;
      }
    }
  };

  // Set up WebRTC Connection
  const createPeerConnection = useCallback((targetPeerId, currentLocalStream) => {
    if (pcRef.current) {
      console.log('Peer connection already exists.');
      return pcRef.current;
    }

    console.log('Creating RTCPeerConnection to:', targetPeerId);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Attach current local streams
    if (currentLocalStream) {
      currentLocalStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, currentLocalStream);
        if (track.kind === 'audio') sendersRef.current.audio = sender;
        if (track.kind === 'video') sendersRef.current.video = sender;
      });
    }

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('rtc-signal', {
          roomCode,
          targetId: targetPeerId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Handle Session Renegotiation for dynamic track additions (e.g. screen sharing)
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return;
      try {
        console.log('Negotiation needed: renegotiating session...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('rtc-signal', {
          roomCode,
          targetId: targetPeerId,
          signal: { sdp: pc.localDescription }
        });
      } catch (err) {
        console.error('Renegotiation failed:', err);
      }
    };

    // Connection state logging & stats loop
    pc.onconnectionstatechange = () => {
      console.log(`WebRTC Connection State: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setIsP2PConnected(true);
        startStatsMonitor();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsP2PConnected(false);
      }
    };

    // Receive Remote Streams
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.streams[0]?.id);
      const incomingStream = event.streams[0];
      if (!incomingStream) return;
      
      const streamId = incomingStream.id;

      if (!cameraStreamIdRef.current) {
        // First stream received is the camera/audio stream
        cameraStreamIdRef.current = streamId;
        setRemoteCameraStream(incomingStream);
      } else if (streamId === cameraStreamIdRef.current) {
        // Belongs to the camera stream
        setRemoteCameraStream(incomingStream);
      } else {
        // Belongs to a different stream (Screen Share!)
        setRemoteScreenStream(incomingStream);
        setIsPeerScreenSharing(true);
        setPeerScreenTrackId(event.track.id);
      }

      event.track.onended = () => {
        console.log('Track ended:', event.track.kind, streamId);
        if (streamId !== cameraStreamIdRef.current) {
          setIsPeerScreenSharing(false);
          setRemoteScreenStream(null);
          setPeerScreenTrackId(null);
        }
      };
    };

    // Host creates the Data Channel
    if (role === 'host') {
      console.log('Host creating playback sync Data Channel...');
      const dc = pc.createDataChannel('playbackSync', { ordered: true });
      setupDataChannel(dc);
    }

    // Guest listens for the Data Channel
    pc.ondatachannel = (event) => {
      console.log('Guest received Data Channel...');
      setupDataChannel(event.channel);
    };

    // Negotiation logic
    pc.onnegotiationneeded = async () => {
      try {
        console.log('Negotiation needed. Creating offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('rtc-signal', {
          roomCode,
          targetId: targetPeerId,
          signal: { sdp: pc.localDescription }
        });
      } catch (err) {
        console.error('Error during negotiation:', err);
      }
    };

    return pc;
  }, [roomCode, role, peerScreenTrackId]);

  const setupDataChannel = (channel) => {
    dataChannelRef.current = channel;
    channel.onopen = () => setIsP2PConnected(true);
    channel.onclose = () => setIsP2PConnected(false);
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Intercept custom P2P signaling messages
        if (data.type === 'media-mute-status') {
          setIsPeerAudioMuted(data.audioMuted);
          setIsPeerVideoDisabled(data.videoDisabled);
        } else if (data.type === 'peer-screen-share') {
          setIsPeerScreenSharing(data.isSharing);
          setPeerScreenTrackId(data.trackId || null);
          if (!data.isSharing) {
            setRemoteScreenStream(null);
          }
        } else if (onMessageCallbackRef.current) {
          onMessageCallbackRef.current(data);
        }
      } catch (err) {
        console.error('P2P Message Parse Error:', err);
      }
    };
  };

  // Stats Monitor for quality indicator
  const startStatsMonitor = () => {
    const interval = setInterval(async () => {
      if (!pcRef.current || pcRef.current.connectionState !== 'connected') {
        clearInterval(interval);
        return;
      }
      try {
        const stats = await pcRef.current.getStats();
        let rtt = 50; // default good
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime * 1000 || rtt;
          }
        });
        if (rtt < 100) setConnectionQuality('good');
        else if (rtt < 250) setConnectionQuality('fair');
        else setConnectionQuality('poor');
      } catch (err) {
        console.log('Error fetching stats:', err);
      }
    }, 4000);
  };

  // Toggle Room Lock
  const toggleRoomLock = () => {
    socket.emit('toggle-lock-room', { roomCode }, (res) => {
      if (res.success) {
        setIsRoomLocked(res.isLocked);
      }
    });
  };

  // Fallback notification via socket if WebRTC P2P channel is closed
  const notifyMediaStatus = (audioMuted, videoDisabled) => {
    const payload = { type: 'media-mute-status', audioMuted, videoDisabled };
    const sent = sendP2PNotification(payload);
    if (!sent) {
      socket.emit('sync-playback', {
        roomCode,
        action: 'media-mute-status',
        currentTime: 0,
        playing: false,
        speed: 1,
        additionalData: payload
      });
    }
  };

  const notifyScreenShare = (isSharing, trackId = null) => {
    const payload = { type: 'peer-screen-share', isSharing, trackId };
    const sent = sendP2PNotification(payload);
    if (!sent) {
      socket.emit('sync-playback', {
        roomCode,
        action: 'peer-screen-share',
        currentTime: 0,
        playing: false,
        speed: 1,
        additionalData: payload
      });
    }
  };

  // Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        notifyMediaStatus(!audioTrack.enabled, isVideoDisabled);
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
        notifyMediaStatus(isAudioMuted, !videoTrack.enabled);
      }
    }
  };

  // Switch between front/rear cameras (Mobile only)
  const switchCamera = async () => {
    if (!localStream || isVideoDisabled) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const nextFacing = facingMode === 'user' ? 'environment' : 'user';
      console.log(`Switching camera direction to: ${nextFacing}`);

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacing,
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace active WebRTC video sender track
      if (pcRef.current && sendersRef.current.video) {
        await sendersRef.current.video.replaceTrack(newVideoTrack);
      }

      // Stop old video track
      videoTrack.stop();

      // Merge new video track into localStream
      const updatedStream = new MediaStream([
        ...localStream.getAudioTracks(),
        newVideoTrack
      ]);
      
      setLocalStream(updatedStream);
      setFacingMode(nextFacing);
    } catch (err) {
      console.error('Failed to swap camera:', err);
      alert('Failed to switch camera. This device might not have multiple cameras.');
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // STOP SCREEN SHARE
      if (localScreenStream) {
        localScreenStream.getTracks().forEach(t => t.stop());
        setLocalScreenStream(null);
      }
      
      if (pcRef.current && sendersRef.current.screen) {
        pcRef.current.removeTrack(sendersRef.current.screen);
        sendersRef.current.screen = null;
      }
      
      setIsScreenSharing(false);
      socket.emit('stop-screen-share', { roomCode }, () => {});
      notifyScreenShare(false);
    } else {
      // START SCREEN SHARE
      if (isPeerScreenSharing) {
        alert('Another participant is currently screen sharing.');
        return;
      }

      try {
        console.log('Requesting screen capture stream...');
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];
        setLocalScreenStream(screenStream);
        setIsScreenSharing(true);

        socket.emit('start-screen-share', { roomCode }, (res) => {
          if (!res.success) {
            screenStream.getTracks().forEach(t => t.stop());
            setLocalScreenStream(null);
            setIsScreenSharing(false);
            alert(res.error || 'Failed to start screen share.');
            return;
          }

          // Add screen share track to PeerConnection
          if (pcRef.current) {
            sendersRef.current.screen = pcRef.current.addTrack(screenTrack, screenStream);
          }

          // Announce screen track ID to the peer
          notifyScreenShare(true, screenTrack.id);
        });

        // Listen for screen sharing stop via native browser controls
        screenTrack.onended = () => {
          toggleScreenShare(); // Trigger clean stop
        };
      } catch (err) {
        console.error('Screen capture rejected:', err);
      }
    }
  };

  // Helper to send data channel packets safely
  const sendP2PNotification = (payload) => {
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(payload));
        return true;
      } catch (e) {
        console.error('Data channel notification error:', e);
      }
    }
    return false;
  };

  // Send synchronized playback packet (P2P first, websocket fallback)
  const sendSyncMessage = useCallback((payload) => {
    const sent = sendP2PNotification(payload);
    if (!sent) {
      socket.emit('sync-playback', {
        roomCode,
        action: payload.type,
        currentTime: payload.time || 0,
        playing: payload.playing || false,
        speed: payload.speed || 1,
        additionalData: payload.additionalData || null
      });
    }
    return sent;
  }, [roomCode]);

  // Handle remote track IDs updating (for remote screen sync mapping)
  useEffect(() => {
    if (pcRef.current && peerScreenTrackId) {
      // If we already received track from peer, find it and assign it
      const receivers = pcRef.current.getReceivers();
      const screenReceiver = receivers.find(r => r.track && r.track.id === peerScreenTrackId);
      if (screenReceiver && screenReceiver.track) {
        const stream = new MediaStream([screenReceiver.track]);
        setRemoteScreenStream(stream);
        setIsPeerScreenSharing(true);
      }
    }
  }, [peerScreenTrackId]);

  // Main Socket Connection Flow
  useEffect(() => {
    if (!roomCode) return;

    let localMediaStream = null;

    const setupCall = async () => {
      localMediaStream = await initializeLocalMedia();

      // If Guest, we wait for Host's offer. If Host, we wait for Guest to join.
      if (role === 'guest') {
        // Immediately connect socket if not connected
        if (!socket.connected) socket.connect();
      }
    };

    setupCall();

    const handlePeerJoined = async ({ peerId: guestId }) => {
      console.log('Host detected guest joined:', guestId);
      setPeerId(guestId);
      
      // Initialize connection
      const pc = createPeerConnection(guestId, localMediaStream);
      
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('rtc-signal', {
          roomCode,
          targetId: guestId,
          signal: { sdp: pc.localDescription }
        });
      } catch (err) {
        console.error('Failed to create offer:', err);
      }
    };

    const handleRtcSignal = async ({ senderId, signal }) => {
      setPeerId(senderId);
      let pc = pcRef.current;
      if (!pc) {
        pc = createPeerConnection(senderId, localStream || localMediaStream);
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('rtc-signal', {
              roomCode,
              targetId: senderId,
              signal: { sdp: pc.localDescription }
            });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('Error handling signaling packet:', err);
      }
    };

    const handlePeerLeft = () => {
      setIsP2PConnected(false);
      setPeerId(null);
      setRemoteCameraStream(null);
      setRemoteScreenStream(null);
      setIsPeerScreenSharing(false);
      setPeerScreenTrackId(null);
      
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      dataChannelRef.current = null;
    };

    const handleRoomLockChanged = ({ isLocked }) => {
      setIsRoomLocked(isLocked);
    };

    const handleScreenShareStarted = ({ sharerId }) => {
      if (sharerId !== socket.id) {
        setIsPeerScreenSharing(true);
      }
    };

    const handleScreenShareStopped = ({ sharerId }) => {
      if (sharerId !== socket.id) {
        setIsPeerScreenSharing(false);
        setRemoteScreenStream(null);
        setPeerScreenTrackId(null);
      }
    };

    const handleSyncPlaybackFallback = (data) => {
      const actionType = data.action || data.type;
      if (actionType === 'media-mute-status') {
        const addData = data.additionalData;
        setIsPeerAudioMuted(addData.audioMuted);
        setIsPeerVideoDisabled(addData.videoDisabled);
      } else if (actionType === 'peer-screen-share') {
        const addData = data.additionalData;
        setIsPeerScreenSharing(addData.isSharing);
        setPeerScreenTrackId(addData.trackId || null);
        if (!addData.isSharing) {
          setRemoteScreenStream(null);
        }
      }
    };

    socket.on('peer-joined', handlePeerJoined);
    socket.on('rtc-signal', handleRtcSignal);
    socket.on('peer-left', handlePeerLeft);
    socket.on('room-lock-changed', handleRoomLockChanged);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);
    socket.on('sync-playback', handleSyncPlaybackFallback);

    return () => {
      socket.off('peer-joined', handlePeerJoined);
      socket.off('rtc-signal', handleRtcSignal);
      socket.off('peer-left', handlePeerLeft);
      socket.off('room-lock-changed', handleRoomLockChanged);
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
      socket.off('sync-playback', handleSyncPlaybackFallback);

      // Close and clear streams
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(t => t.stop());
      }
      if (localScreenStream) {
        localScreenStream.getTracks().forEach(t => t.stop());
      }
      dataChannelRef.current = null;
    };
  }, [roomCode, role, createPeerConnection]);

  return {
    isP2PConnected,
    peerId,
    connectionQuality,
    isRoomLocked,
    toggleRoomLock,

    // Local stream states & triggers
    localStream,
    isAudioMuted,
    isVideoDisabled,
    toggleMic,
    toggleCamera,
    switchCamera,
    
    // Screen share states & triggers
    localScreenStream,
    isScreenSharing,
    toggleScreenShare,

    // Remote stream states
    remoteCameraStream,
    remoteScreenStream,
    isPeerAudioMuted,
    isPeerVideoDisabled,
    isPeerScreenSharing,

    sendSyncMessage,
    registerOnMessage
  };
}
