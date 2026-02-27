// hooks/usePresence.js
import { useEffect, useState } from 'react';
import { useSocket } from '../Context/SocketContext';

export const usePresence = () => {
  const { socket, connected } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!socket) return;

    const handleOnline = ({ userId }) => {
      setOnlineUsers(prev => new Set(prev).add(userId));
    };

    const handleOffline = ({ userId }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    const handleTyping = ({ fromUserId }) => {
      setTypingUsers(prev => new Set(prev).add(fromUserId));
    };

    const handleStopTyping = ({ fromUserId }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(fromUserId);
        return newSet;
      });
    };

    socket.on('user-online', handleOnline);
    socket.on('user-offline', handleOffline);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', handleStopTyping);

    return () => {
      socket.off('user-online', handleOnline);
      socket.off('user-offline', handleOffline);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing', handleStopTyping);
    };
  }, [socket]);

  return { onlineUsers, typingUsers, connected };
};
