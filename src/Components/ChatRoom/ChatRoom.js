// src/Components/ChatRoom/ChatRoom.js
//
// Changes for status feature:
//   • Added a "Status" tab button in the sidebar header alongside "Chats"
//   • Renders <StatusTab> when activeTab === 'status'
//   • StatusProvider is expected to be mounted higher up (in index.js / App.js).
//     ChatRoom just consumes it via useStatus() inside StatusTab.
//   • Tab switching resets mobile chat open state so the UX doesn't get confused.

import React, { useState, useEffect } from 'react';
import { useNavigate }   from 'react-router-dom';
import { X, MessageCircle, Circle } from 'lucide-react';
import ChatList     from './Chat/ChatList';
import ChatWindow   from './Chat/ChatWindow';
import MessageInput from './Chat/MessageInput';
import StatusTab    from '../Status/StatusTab';
import { useAuth }  from '../../Context/Authorisation/AuthContext';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';
import './ChatRoom.css';

const ChatRoom = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [replyTo,          setReplyTo]          = useState(null);
  // 'chats' | 'status'
  const [activeTab,        setActiveTab]        = useState('chats');

  // Keep the messenger's data-theme attribute in sync with the global theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    // Switching away from a chat clears mobile panel so layout is clean
    if (tab !== 'chats') setIsMobileChatOpen(false);
    setReplyTo(null);
  };

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
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
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
        <div className="chat-wallpaper-vignette" />
        {/* Sidebar */}
        <div className="messenger-sidebar">
          {/* ── Tab bar ────────────────────────────────────────────── */}
          <div className="messenger-tab-bar">
            <button
              className={`messenger-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('chats')}
              aria-pressed={activeTab === 'chats'}
            >
              <MessageCircle size={16} />
              <span>Chats</span>
            </button>
            <button
              className={`messenger-tab-btn ${activeTab === 'status' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('status')}
              aria-pressed={activeTab === 'status'}
            >
              <Circle size={16} />
              <span>Status</span>
            </button>
          </div>

          {/* ── Tab content ─────────────────────────────────────────── */}
          {activeTab === 'chats' && (
            <ChatList
              onChatSelect={() => {
                if (window.innerWidth <= 768) setIsMobileChatOpen(true);
                setReplyTo(null);
              }}
            />
          )}

          {activeTab === 'status' && user && (
            <StatusTab currentUser={user} />
          )}
        </div>

        {/* Chat panel — only shown when chats tab is active */}
        {activeTab === 'chats' && (
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
        )}
      </div>
    </div>
  );
};

export default ChatRoom;