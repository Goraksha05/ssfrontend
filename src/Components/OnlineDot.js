import React from 'react';
import { usePresence } from '../hooks/usePresence';

const UserCard = ({ user }) => {
  const { onlineUsers, typingUsers } = usePresence();

  const isOnline = onlineUsers.has(user._id);
  const isTyping = typingUsers.has(user._id);

  return (
    <div className="flex items-center space-x-2">
      <span
        className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
        title={isOnline ? 'Online' : 'Offline'}
      ></span>
      <span className="font-medium">{user.name}</span>
      {isTyping && <span className="text-xs text-blue-500 ml-2 animate-pulse">typing...</span>}
    </div>
  );
};
