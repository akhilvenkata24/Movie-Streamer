import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Key: roomCode -> Value: { code, users: [{ id, role }], videoState, isLocked, screenSharer }
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

// Serve static files if frontend is built
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Production client folder found. Serving static files.');
  app.use(express.static(distPath));
  app.get('(.*)', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('Client folder not found. Serving development placeholder.');
  app.get('/', (req, res) => {
    res.send('Movie Streamer Backend Server is running in development mode. Build the client to serve static files.');
  });
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create room
  socket.on('create-room', (callback) => {
    const code = generateRoomCode();
    rooms.set(code, {
      code,
      users: [{ id: socket.id, role: 'host' }],
      isLocked: false,
      screenSharer: null,
      videoState: {
        url: '',
        currentTime: 0,
        playing: false,
        speed: 1,
        sourceType: 'preloaded',
        title: '',
        fileName: '',
        fileSize: 0
      }
    });

    socket.join(code);
    console.log(`Room created: ${code} by ${socket.id}`);
    callback({ success: true, code });
  });

  // Join room
  socket.on('join-room', ({ code }, callback) => {
    const uppercaseCode = code.trim().toUpperCase();
    const room = rooms.get(uppercaseCode);

    if (!room) {
      return callback({ success: false, error: 'Room not found.' });
    }

    if (room.isLocked) {
      return callback({ success: false, error: 'Room is locked by host.' });
    }

    if (room.users.length >= 2) {
      return callback({ success: false, error: 'Room is full (max 2 participants).' });
    }

    room.users.push({ id: socket.id, role: 'guest' });
    socket.join(uppercaseCode);

    console.log(`User ${socket.id} joined room ${uppercaseCode}`);

    // Notify other user in the room
    socket.to(uppercaseCode).emit('peer-joined', {
      peerId: socket.id,
      role: 'guest'
    });

    // Send success with existing room status
    callback({
      success: true,
      code: uppercaseCode,
      role: 'guest',
      isLocked: room.isLocked,
      screenSharer: room.screenSharer,
      peers: room.users.filter(u => u.id !== socket.id).map(u => u.id)
    });
  });

  // Toggle Room Lock
  socket.on('toggle-lock-room', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return callback({ success: false, error: 'Room not found.' });

    // Validate that the requester is in the room
    const userInRoom = room.users.some(u => u.id === socket.id);
    if (!userInRoom) return callback({ success: false, error: 'Access denied.' });

    room.isLocked = !room.isLocked;
    console.log(`Room ${roomCode} lock state toggled to: ${room.isLocked}`);
    
    // Broadcast to other users in the room
    socket.to(roomCode).emit('room-lock-changed', { isLocked: room.isLocked });
    callback({ success: true, isLocked: room.isLocked });
  });

  // Start Screen Sharing
  socket.on('start-screen-share', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return callback({ success: false, error: 'Room not found.' });

    if (room.screenSharer && room.screenSharer !== socket.id) {
      return callback({ success: false, error: 'Another participant is currently sharing.' });
    }

    room.screenSharer = socket.id;
    console.log(`User ${socket.id} started screen sharing in room ${roomCode}`);
    
    socket.to(roomCode).emit('screen-share-started', { sharerId: socket.id });
    callback({ success: true });
  });

  // Stop Screen Sharing
  socket.on('stop-screen-share', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return callback({ success: false, error: 'Room not found.' });

    if (room.screenSharer === socket.id) {
      room.screenSharer = null;
      console.log(`User ${socket.id} stopped screen sharing in room ${roomCode}`);
      
      socket.to(roomCode).emit('screen-share-stopped', { sharerId: socket.id });
      callback({ success: true });
    } else {
      callback({ success: false, error: 'You are not the active screen sharer.' });
    }
  });

  // Relay WebRTC signaling between peers
  socket.on('rtc-signal', ({ roomCode, targetId, signal }) => {
    socket.to(targetId).emit('rtc-signal', {
      senderId: socket.id,
      signal
    });
  });

  // Synchronized playback events (fallback when WebRTC channel is not ready)
  socket.on('sync-playback', ({ roomCode, action, currentTime, playing, speed, additionalData }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.videoState.currentTime = currentTime;
      room.videoState.playing = playing;
      room.videoState.speed = speed;
      if (additionalData) {
        if (additionalData.url !== undefined) room.videoState.url = additionalData.url;
        if (additionalData.sourceType !== undefined) room.videoState.sourceType = additionalData.sourceType;
        if (additionalData.title !== undefined) room.videoState.title = additionalData.title;
        if (additionalData.fileName !== undefined) room.videoState.fileName = additionalData.fileName;
      }
      
      socket.to(roomCode).emit('sync-playback', {
        action,
        currentTime,
        playing,
        speed,
        additionalData
      });
    }
  });

  // Relay chat messages
  socket.on('send-message', ({ roomCode, message, senderName }) => {
    socket.to(roomCode).emit('receive-message', {
      text: message,
      senderId: socket.id,
      senderName,
      timestamp: Date.now()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    for (const [code, room] of rooms.entries()) {
      const userIndex = room.users.findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        // Handle screen share reset if this user was sharing
        if (room.screenSharer === socket.id) {
          room.screenSharer = null;
          socket.to(code).emit('screen-share-stopped', { sharerId: socket.id });
        }

        room.users.splice(userIndex, 1);
        
        socket.to(code).emit('peer-left', {
          peerId: socket.id
        });

        console.log(`User ${socket.id} left room ${code}. Remaining users: ${room.users.length}`);

        if (room.users.length === 0) {
          rooms.delete(code);
          console.log(`Room ${code} is empty. Deleted.`);
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
