// src/Components/ChatRoom/Chat/MessageInput.js
//
// Professional input with:
//   • Reply preview bar (cancel, sender name, quoted text)
//   • Optimistic send — message appears instantly with 'sending' status
//   • Emoji picker (native system emoji via input[type=text] trick — zero deps)
//   • Typing throttle — emits start/stop correctly
//   • Shift+Enter for newline, Enter to send
//   • Auto-grow textarea up to 6 lines
//   • File attachment via UploadInput panel

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Smile, Mic, X } from 'lucide-react';
import { useAuth }   from '../../../Context/Authorisation/AuthContext';
import { useChat }   from '../../../Context/ChatContext';
import { safeEmit }  from '../../../WebSocket/WebSocketClient';
import apiRequest    from '../../../utils/apiRequest';
import UploadInput   from '../UploadInput';

const LINE_HEIGHT = 24; // px per textarea line
const MAX_LINES   = 6;

const MessageInput = ({ replyTo, setReplyTo }) => {
  const textareaRef = useRef(null);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);

  const { user }                      = useAuth();
  const { selectedChat, setMessages } = useChat();

  const [text,       setText]       = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [sending,    setSending]    = useState(false);

  // ── Auto-grow textarea ────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES * LINE_HEIGHT)}px`;
  }, [text]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // ── Receiver helper ────────────────────────────────────────────────
  const getReceiver = useCallback(() => {
    if (!selectedChat?.members || !user?._id) return null;
    return selectedChat.members.find((m) => m._id !== user._id) ?? null;
  }, [selectedChat, user?._id]);

  // ── Typing signals ─────────────────────────────────────────────────
  const emitTypingStart = useCallback(() => {
    const r = getReceiver();
    if (!r?._id || isTypingRef.current) return;
    isTypingRef.current = true;
    safeEmit('typing', { toUserId: r._id, chatId: selectedChat._id });
  }, [getReceiver, selectedChat?._id]);

  const emitTypingStop = useCallback(() => {
    const r = getReceiver();
    isTypingRef.current = false;
    clearTimeout(typingTimer.current);
    if (!r?._id) return;
    safeEmit('stop-typing', { toUserId: r._id, chatId: selectedChat._id });
  }, [getReceiver, selectedChat?._id]);

  const handleChange = (e) => {
    setText(e.target.value);
      emitTypingStart();

      clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
          emitTypingStop();
        }, 1500);
  };

  // ── Send ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !selectedChat || sending) return;

    emitTypingStop();
    setText('');
    setSending(true);

    // Optimistic message (local only until server confirms)
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg = {
      _id:      optimisticId,
      chatId:   selectedChat._id,
      sender:   { _id: user._id, name: user.name },
      text:     trimmed,
      replyTo:  replyTo ?? null,
      createdAt: new Date().toISOString(),
      _sending: true,   // flag for Tick component
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyTo?.(null);

    try {
      const formData = new FormData();
      formData.append('chatId', selectedChat._id);
      formData.append('text', trimmed);
      if (replyTo?._id) formData.append('replyToId', replyTo._id);

      const { data: saved } = await apiRequest.post('/api/message', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m._id === optimisticId ? { ...saved, _sending: false } : m))
      );

      const receiver = getReceiver();
      if (receiver?._id) {
        safeEmit('send_message', { toUserId: receiver._id, message: saved });
      }
    } catch {
      // Mark failed
      setMessages((prev) =>
        prev.map((m) =>
          m._id === optimisticId ? { ...m, _sending: false, _failed: true } : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [text, selectedChat, sending, replyTo, user, emitTypingStop, setMessages, setReplyTo, getReceiver]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedChat) return null;

  return (
    <div className="chat-input-container">
      {/* Reply preview bar */}
      {replyTo && (
        <div className="reply-preview-bar">
          <div className="preview-content">
            <div className="preview-name">
              Replying to {replyTo.senderName}
            </div>
            <div className="preview-text">{replyTo.text}</div>
          </div>
          <button
            className="cancel-reply"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div style={{ padding: '0 12px 8px' }}>
          <UploadInput
            chatId={selectedChat._id}
            onUpload={(newMsg) => {
              setMessages((prev) => [...prev, newMsg]);
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* Input row */}
      <div className="chat-input-row">
        {/* Input wrapper */}
        <div className="chat-input-wrapper">
          <button
            className="input-action-btn"
            onClick={() => setShowUpload((v) => !v)}
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip size={20} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            placeholder="Type a message…"
            className="chat-input"
            rows={1}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={emitTypingStop}
            aria-label="Message input"
            autoComplete="off"
          />

          <button
            className="input-action-btn"
            title="Emoji"
            aria-label="Emoji"
            onClick={() => {
              // Focus textarea — on mobile this opens the emoji keyboard
              textareaRef.current?.focus();
            }}
          >
            <Smile size={20} />
          </button>
        </div>

        {/* Send / Mic */}
        {text.trim() ? (
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={sending}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            className="send-btn"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', boxShadow: 'none' }}
            aria-label="Voice message"
          >
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageInput;