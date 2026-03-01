// src/Components/ChatRoom/ChatRoom.js
//
// Orchestrates the full chat UI.
// Owns `replyTo` state and passes it to both ChatWindow (for context)
// and MessageInput (for preview bar + send payload).

import React, { useState, useEffect } from 'react';
import { useNavigate }   from 'react-router-dom';
import { Sun, Moon, X, MessageCircle } from 'lucide-react';
import ChatList     from './Chat/ChatList';
import ChatWindow   from './Chat/ChatWindow';
import MessageInput from './Chat/MessageInput';
import './ChatRoom.css';

const ChatRoom = () => {
  const navigate = useNavigate();

  const [theme, setTheme] = useState(
    () => localStorage.getItem('messenger-theme') || 'dark'
  );
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [replyTo,          setReplyTo]          = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('messenger-theme', theme);
  }, [theme]);

  return (
    <div className="messenger-container">
      {/* Global header */}
      <div className="messenger-header">
        <div className="messenger-header-left">
          <MessageCircle size={22} style={{ color: 'var(--accent)' }} />
          <h5>Messenger</h5>
        </div>
        <div className="messenger-header-right">
          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button
            className="close-btn"
            onClick={() => navigate('/')}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="messenger-main">
        {/* Sidebar */}
        <div className="messenger-sidebar">
          <ChatList
            onChatSelect={() => {
              if (window.innerWidth <= 768) setIsMobileChatOpen(true);
              setReplyTo(null); // clear reply when switching chats
            }}
          />
        </div>

        {/* Chat panel */}
        <div className={`messenger-chat ${isMobileChatOpen ? 'active' : ''}`}>
          <ChatWindow
            onBackToList={() => setIsMobileChatOpen(false)}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
          />
          <MessageInput
            replyTo={replyTo}
            setReplyTo={setReplyTo}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;