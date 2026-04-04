// src/Components/ChatRoom/ChatRoom.js
//
// Changes:
//   • Voice recorder button rendered conditionally next to MessageInput:
//     when the user hasn't typed anything, a VoiceRecorder (hold-to-record)
//     is shown in place of the send button — exactly like WhatsApp.
//   • The `hasText` callback from MessageInput drives the visibility toggle.
//   • Mobile layout: messenger-main gets `mobile-open` class so the CSS
//     `.messenger-main.mobile-open .messenger-sidebar { display:flex }`
//     rule (already in ChatRoom.css) works correctly.
//   • Tab switching resets mobile state — unchanged.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate }   from 'react-router-dom';
import { X, MessageCircle, Circle } from 'lucide-react';
import ChatList      from './Chat/ChatList';
import ChatWindow    from './Chat/ChatWindow';
import MessageInput  from './Chat/MessageInput';
import StatusTab     from '../Status/StatusTab';
import { useAuth }   from '../../Context/Authorisation/AuthContext';
import { useTheme }  from '../../Context/ThemeUI/ThemeContext';
import { useChat }   from '../../Context/ChatContext';
import { safeEmit }  from '../../WebSocket/WebSocketClient';
import apiRequest    from '../../utils/apiRequest';
import './ChatRoom.css';

// ── Inline VoiceRecorder (hold-to-record, same as ChatWindow's) ──────────────
// Duplicated here so ChatRoom controls the show/hide without prop-drilling
// VoiceRecorder from ChatWindow into this file.
import { Mic, MicOff, Loader } from 'lucide-react';

const VoiceRecorderBtn = ({ selectedChat, setMessages }) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mrRef    = useRef(null);
  const chunks   = useRef([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append('chatId', selectedChat._id);
          fd.append('media', blob, `voice-${Date.now()}.webm`);
          const { data } = await apiRequest.post('/api/message', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setMessages((prev) => [...prev, data]);
          // Notify other side
          const receiver = selectedChat.members?.find((m) => m._id !== data.sender?._id);
          if (receiver?._id) safeEmit('send_message', { toUserId: receiver._id, message: data });
        } catch { /* silent */ }
        finally { setUploading(false); }
      };
      mr.start();
      mrRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.warn('[Voice] Mic access denied:', err.message);
    }
  };

  const stop = () => { mrRef.current?.stop(); setRecording(false); };

  if (uploading) return (
    <button className="send-btn" disabled style={{ background:'var(--bg-tertiary)',color:'var(--text-secondary)',boxShadow:'none' }}>
      <Loader size={18} style={{ animation:'spin 1s linear infinite' }} />
    </button>
  );

  return (
    <button
      className="send-btn"
      onMouseDown={start} onMouseUp={stop}
      onTouchStart={start} onTouchEnd={stop}
      style={recording
        ? { background:'var(--danger)', boxShadow:'0 0 0 4px rgba(239,68,68,0.25)' }
        : { background:'var(--bg-tertiary)', color:'var(--text-secondary)', boxShadow:'none' }
      }
      aria-label={recording ? 'Release to send voice message' : 'Hold to record voice message'}
      title={recording ? 'Release to send' : 'Hold to record'}
    >
      {recording ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
};


// ── ChatRoom ──────────────────────────────────────────────────────────────────
const ChatRoom = () => {
  const navigate = useNavigate();
  const { user }  = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { selectedChat, setMessages } = useChat();

  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [replyTo,          setReplyTo]          = useState(null);
  const [activeTab,        setActiveTab]        = useState('chats');
  const [hasText,          setHasText]          = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab !== 'chats') setIsMobileChatOpen(false);
    setReplyTo(null);
  };

  const handleBackToList = useCallback(() => {
    setIsMobileChatOpen(false);
  }, []);

  return (
    <div className="messenger-container">
      {/* Global header */}
      <div className="messenger-header">
        <div className="messenger-header-left">
          <MessageCircle size={22} style={{ color:'var(--accent)' }} />
          <h5>Messenger</h5>
        </div>
        <div className="messenger-header-right">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? '☀️' : '🌙'}
          </button>
          <button className="close-btn" onClick={() => navigate('/')} aria-label="Close">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className={`messenger-main${isMobileChatOpen ? ' mobile-open' : ''}`}>

        {/* Sidebar */}
        <div className="messenger-sidebar">
          {/* Tab bar */}
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

          {activeTab === 'chats' && (
            <ChatList
              onChatSelect={() => {
                if (window.innerWidth <= 768) setIsMobileChatOpen(true);
                setReplyTo(null);
                setHasText(false);
              }}
            />
          )}
          {activeTab === 'status' && user && (
            <StatusTab currentUser={user} />
          )}
        </div>

        {/* Chat panel */}
        {activeTab === 'chats' && (
          <div className={`messenger-chat${isMobileChatOpen ? ' active' : ''}`}>
            <div className="chat-wallpaper-vignette" />
            <ChatWindow
              onBackToList={handleBackToList}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
            />
            {/* Input + voice recorder row */}
            <div style={{ position:'relative', display:'flex', flexDirection:'column' }}>
              <MessageInput
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                onHasText={setHasText}
              />
              {/* Voice recorder floats beside the input when no text typed */}
              {!hasText && selectedChat && (
                <div style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 10,
                  zIndex: 5,
                }}>
                  <VoiceRecorderBtn
                    selectedChat={selectedChat}
                    setMessages={setMessages}
                  />
                </div>
              )}
            </div>
            {/* Spin keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;