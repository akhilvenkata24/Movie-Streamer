import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : `${window.location.protocol}//${window.location.hostname}:3001`;

// Create a single shared socket instance
export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false, // Connect manually on mount
});

export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Trigger connection if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return isConnected;
}
