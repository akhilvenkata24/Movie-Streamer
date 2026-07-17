import React, { useRef, useState, useEffect } from 'react';

export function FloatingCamera({ remoteStream, isPeerVideoDisabled, nickname }) {
  const cardRef = useRef(null);
  
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [minimized, setMinimized] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const videoRef = useRef(null);

  const WIDTH = minimized ? 44 : 140;
  const HEIGHT = minimized ? 44 : 105; // 4:3 aspect ratio approx

  // Set default initial position to top-right corner once window sizes are available
  useEffect(() => {
    const handleInitialPos = () => {
      setPosition({
        x: window.innerWidth - WIDTH - 16,
        y: 16
      });
    };
    handleInitialPos();
    window.addEventListener('resize', handleInitialPos);
    return () => window.removeEventListener('resize', handleInitialPos);
  }, [minimized]);

  // Hook stream to video element
  useEffect(() => {
    if (videoRef.current && remoteStream && !isPeerVideoDisabled) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isPeerVideoDisabled]);

  // Handle Drag Start
  const handleDragStart = (clientX, clientY) => {
    setIsDragging(true);
    setIsTransitioning(false);
    dragStart.current = { x: clientX, y: clientY };
    offset.current = { ...position };
  };

  // Handle Drag Move
  const handleDragMove = (clientX, clientY) => {
    if (!isDragging) return;

    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;

    let newX = offset.current.x + dx;
    let newY = offset.current.y + dy;

    // Constrain within window borders
    const boundaryX = window.innerWidth - WIDTH - 8;
    const boundaryY = window.innerHeight - HEIGHT - 8;

    newX = Math.max(8, Math.min(newX, boundaryX));
    newY = Math.max(8, Math.min(newY, boundaryY));

    setPosition({ x: newX, y: newY });
  };

  // Handle Drag End and Snap to nearest corner
  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setIsTransitioning(true);

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Defined snap coordinates (corners with 16px margins)
    const corners = [
      { x: 16, y: 16, name: 'top-left' },
      { x: screenW - WIDTH - 16, y: 16, name: 'top-right' },
      { x: 16, y: screenH - HEIGHT - 16, name: 'bottom-left' },
      { x: screenW - WIDTH - 16, y: screenH - HEIGHT - 84, name: 'bottom-right' } // padding above play bar
    ];

    // Find closest corner using Euclidean distance
    let closestCorner = corners[1]; // default top-right
    let minDistance = Infinity;

    corners.forEach((corner) => {
      const dist = Math.pow(position.x - corner.x, 2) + Math.pow(position.y - corner.y, 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestCorner = corner;
      }
    });

    setPosition({ x: closestCorner.x, y: closestCorner.y });

    // Turn off snap transition classes after animation finishes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // Mouse event wrappers
  const onMouseDown = (e) => {
    if (e.target.closest('.floating-camera-btn')) return; // Avoid drag on button clicks
    handleDragStart(e.clientX, e.clientY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    handleDragEnd();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  // Touch event wrappers (for mobile support)
  const onTouchStart = (e) => {
    if (e.target.closest('.floating-camera-btn')) return;
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const onTouchEnd = () => {
    handleDragEnd();
  };

  if (!remoteStream) return null;

  return (
    <div
      ref={cardRef}
      className={`floating-camera ${isTransitioning ? 'transition-snap' : ''} ${minimized ? 'minimized' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Remote camera element */}
      {!isPeerVideoDisabled ? (
        <video
          ref={videoRef}
          className="floating-camera-video"
          autoPlay
          playsInline
          muted // Already playing audio globally via App.jsx
        />
      ) : (
        /* Video Offline placeholder */
        !minimized && (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            color: 'var(--text-secondary)',
            fontWeight: '700'
          }}>
            👤 CAM OFFLINE
          </div>
        )
      )}

      {/* Control overlay inside floating card */}
      {!minimized ? (
        <div className="floating-camera-controls">
          <span className="floating-camera-label">
            {isPeerVideoDisabled ? 'OFFLINE' : nickname}
          </span>
          <button
            className="floating-camera-btn"
            onClick={() => setMinimized(true)}
            title="Minimize feed"
          >
            ➖
          </button>
        </div>
      ) : (
        /* Restores minimized feed */
        <button
          className="floating-camera-btn"
          onClick={() => setMinimized(false)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer'
          }}
          title="Restore camera"
        >
          Restore
        </button>
      )}
    </div>
  );
}
