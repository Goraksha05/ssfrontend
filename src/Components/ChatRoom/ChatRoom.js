// src/Components/ChatRoom/ChatRoom.js
import React from "react";
import { useNavigate } from 'react-router-dom';
import ChatList from "./Chat/ChatList";
import ChatWindow from "./Chat/ChatWindow";
import MessageInput from "./Chat/MessageInput";

const ChatRoom = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/'); // Redirect to Home
  };

  return (
    <div className="chatroom-container fixed-top bg-transparent">
      <div className="chatroom-header">
        <h5 className="mb-0">Chat Room</h5>
        <button onClick={handleClose} className="btn btn-sm btn-outline-danger">×</button>
      </div>

      <div className="chatroom-main bg-transparent">
        <div className="chatroom-container mt-5">
          <ChatList />
        </div>
        <div className="chatroom-chat">
          <ChatWindow />
          <MessageInput />
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
