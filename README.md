# CineSync - Ultra-Low Latency Movie Watch Party 🍿

CineSync is a modern, mobile-optimized, ultra-low latency watch-party web application. It enables friends to watch movies in perfect sync while talking over real-time video/audio calls, sharing screens, and typing in a live chat. Built with a sleek, Netflix-inspired dark UI.

---

## 🚀 Key Features

1. **Perfect Playback Synchronization**: High-speed syncing of play, pause, seek, and playback rate actions. Programmatically locked to eliminate lag-inducing sync loops.
2. **WebRTC Video & Audio Calling**: Direct peer-to-peer audio and video streams. Supports front/rear camera swapping and toggling controls (mic mute, camera off).
3. **Coordinated Screen Sharing**: Allows users to share their screens. Enforces a rule that only one user can share at a time, disabling the button for the other user with active tooltips.
4. **Draggable & Snapping Floating Feeds**: In landscape mode, camera streams hover in a picture-in-picture widget that can be dragged and snapped to the nearest viewport corner on release. Can be minimized to fit small mobile screens.
5. **Transient Chat Notifications**: YouTube-style temporary chat notifications slide in and fade out after 4 seconds when the main chat panel is closed.
6. **Local Offline File Sync**: Users can choose their own local copies of a video file. CineSync aligns their playback timestamps locally, bypassing large video upload times and saving cellular bandwidth.
7. **Premium Mobile-First Styling**: Fully responsive landscape/portrait adaptation, custom scrolling bars, and height configurations that adapt smoothly to mobile browser search bars.
8. **Security & Utilities**: Clickable room locks (to block joins) and network quality state indicators.

---

## 🛠️ Tech Stack

- **Frontend**: React, Socket.io-client, Vanilla CSS Modules
- **Backend**: Node.js, Express, Socket.io (WebSocket Signaling)
- **Real-Time Communication**: WebRTC (RTCPeerConnection, RTCDataChannel)

---

## 💻 Local Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run in Development**:
   ```bash
   npm run dev
   ```
   - Vite Client starts on: [http://localhost:5173/](http://localhost:5173/)
   - Backend Server starts on: [http://localhost:3001/](http://localhost:3001/)

3. **Verify Production Build**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to Render

To host CineSync on Render as a single web service:

1. **Create a New Web Service** on Render and connect it to your GitHub repository: `https://github.com/akhilvenkata24/Movie-Streamer`.
2. **Configure Settings**:
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Start Command**: 
     ```bash
     node server.js
     ```
3. **Advanced Settings (Optional)**:
   - Render automatically exposes `PORT`, which Node will listen to.
   - Set `NODE_ENV` to `production` (the server will serve the frontend client folder automatically).
