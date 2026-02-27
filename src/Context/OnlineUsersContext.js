// src/Context/OnlineUsersContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSocket } from '../WebSocket/WebSocketClient';

const OnlineUsersContext = createContext();

export const OnlineUsersProvider = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const socket = getSocket();

    if (!socket) return;

    const handleOnlineUsers = (userIds) => {
      console.log("👥 Online users updated:", userIds);
      setOnlineUsers(userIds);
    };

    socket.on("online-users", handleOnlineUsers);

    return () => {
      socket.off("online-users", handleOnlineUsers);
    };
  }, []);

  return (
    <OnlineUsersContext.Provider value={{ onlineUsers }}>
      {children}
    </OnlineUsersContext.Provider>
  );
};

export const useOnlineUsers = () => useContext(OnlineUsersContext);
