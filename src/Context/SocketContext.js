// context/SocketContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { jwtDecode } from 'jwt-decode'; // FIX: use named import
import {
  initializeSocket,
  reconnectSocket,
  getSocket,
} from '../WebSocket/WebSocketClient';
import { useRef } from 'react';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const socketRef = useRef(null);

  const emitPresence = useCallback((sock, user) => {
    if (!sock || !sock.connected || !user) return;
    sock.emit('user-online', {
      userId: user.id,
      name: user.name,
      email: user.email,
    });
    console.log('📡 user-online emitted:', user.name);
  }, []);

  useEffect(() => {
    const setupSocket = async () => {
      // Decode user info from token
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      let decodedUser = null;

      if (token) {
        try {
          const decoded = jwtDecode(token);
          decodedUser = {
            id: decoded.user.id,
            name: decoded.user.name,
            email: decoded.user.email,
          };
          setUserInfo(decodedUser);
        } catch (err) {
          console.warn('⚠️ Failed to decode user from token');
        }
      }

      const sock = await initializeSocket();
      if (!sock) return;

      setSocket(sock);
      socketRef.current = sock; // ✅ store in ref
      setConnected(sock.connected);


      sock.on('connect', () => {
        setConnected(true);
        emitPresence(sock, decodedUser);
      });

      sock.on('disconnect', () => {
        setConnected(false);
      });
    };

    setupSocket();

    return () => {
      const activeSocket = socketRef.current;
      if (activeSocket?.connected) {
        activeSocket.disconnect();
      }
    };
  }, [emitPresence]);

  const reconnect = async () => {
    await reconnectSocket();
    const current = getSocket();
    setSocket(current);
    setConnected(current?.connected);
    emitPresence(current, userInfo); // <-- now valid
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        userInfo,
        reconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
