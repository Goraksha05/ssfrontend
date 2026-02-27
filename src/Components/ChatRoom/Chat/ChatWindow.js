import React, { useEffect, useRef } from "react";
import { useAuth } from "../../../Context/Authorisation/AuthContext";
import { useChat } from "../../../Context/ChatContext";
import apiRequest from "../../../utils/apiRequest";
// import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";

// Optional helper
const formatLastSeen = (timestamp) => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const ChatWindow = () => {
  const { user, socket } = useAuth();
  const {
    selectedChat,
    messages,
    setMessages,
    isTyping,
    setIsTyping,
  } = useChat();
  const bottomRef = useRef();

  const receiver =
    selectedChat?.members?.find((m) => m._id !== user?._id) || null;

  // Always call hooks
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedChat?._id) return;

      try {
        const res = await apiRequest.get(`/api/message/${selectedChat._id}`);
        setMessages(res.data);
      } catch (err) {
        console.error("❌ Failed to load messages:", err.message);
      }
    };

    loadMessages();
  }, [selectedChat?._id, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socket || !selectedChat?._id || !user?._id) return;

    const handleReceive = ({ message }) => {
      if (message.chatId === selectedChat._id) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleTyping = ({ fromUserId }) => {
      const partner = selectedChat?.members?.find((m) => m._id !== user._id);
      if (fromUserId === partner?._id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    };

    socket.on("receive_message", handleReceive);
    socket.on("user-typing", handleTyping);
    socket.on("user-stop-typing", () => setIsTyping(false));

    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("user-typing", handleTyping);
      socket.off("user-stop-typing");
    };
  }, [socket, selectedChat?._id, user?._id, selectedChat?.members, setMessages, setIsTyping]);

  if (!selectedChat || !user || !Array.isArray(selectedChat.members)) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 text-muted bg-light">
        <h6>Select a conversation to start chatting</h6>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100" style={{ maxHeight: 'calc(100% - 48px)' }}>
      {/* 🔹 Chat Header */}
      {receiver && (
        <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom bg-white sticky-top">
          <div
            className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center"
            style={{ width: "40px", height: "40px", fontWeight: "bold" }}
          >
            {receiver.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <h6 className="mb-0">{receiver.name || "Unknown User"}</h6>
            <small className="text-muted">
              Last seen:{" "}
              {receiver.lastActive
                ? formatLastSeen(receiver.lastActive)
                : "recently"}
            </small>
          </div>
        </div>
      )}

      {/* 🔹 Messages */}
      <div className="overflow-auto bg-transparent"
      style={{ maxHeight: '100%' }}>
        {Array.from(new Map(messages.map((m) => [m._id, m])).values()).map(
          (msg) => (
            <MessageBubble key={msg._id} msg={msg} />
          )
        )}

        {isTyping && (
          <div className="text-muted fst-italic small mt-2">Typing...</div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
