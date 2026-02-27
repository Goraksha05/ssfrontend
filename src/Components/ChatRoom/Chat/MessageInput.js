// src/Components/ChatRoom/Chat/MessageInput.js
import React, { useState, useRef, useEffect } from "react";
import { SendHorizonal } from "lucide-react";
import { useAuth } from "../../../Context/Authorisation/AuthContext";
import { useChat } from "../../../Context/ChatContext";
import { safeEmit } from "../../../WebSocket/WebSocketClient";
import apiRequest from "../../../utils/apiRequest";
import UploadInput from "../UploadInput"; // ✅ Import upgraded UploadInput

const MessageInput = () => {
    const textareaRef = useRef(null);
    const { user } = useAuth();
    const { selectedChat, setMessages } = useChat();
    const [text, setText] = useState("");

    // Auto-grow typing lines logic
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 5 * 24; // ~24px line height × 5 lines = 120px
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    }, [text])

    const handleTyping = () => {
        if (!selectedChat || !Array.isArray(selectedChat.members)) return;
        const receiver = selectedChat.members.find((m) => m._id !== user._id);
        if (receiver?._id) {
            safeEmit("typing", { toUserId: receiver._id });
        }
    };

    const handleSend = async () => {
        if (!text.trim() || !selectedChat) return;

        try {
            const formData = new FormData();
            formData.append("chatId", selectedChat._id);
            formData.append("text", text.trim());

            const res = await apiRequest.post("/api/message", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const newMessage = res.data;
            setMessages((prev) => [...prev, newMessage]);

            const receiver = selectedChat.members.find((m) => m._id !== user._id);
            if (receiver?._id) {
                safeEmit("send_message", {
                    toUserId: receiver._id,
                    message: newMessage,
                });
            }

            setText("");
        } catch (err) {
            console.error("❌ Failed to send message:", err.message);
        }
    };

    const scrollToBottom = () => {
        const chatWindow = document.getElementById("chat-body");
        if (chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    };

    return (
        <div className="input-group p-2 border-top bg-white d-flex flex-column">
            {/* 🔽 UploadInput with multiple file support */}
            <UploadInput
                chatId={selectedChat?._id}
                onUpload={(newMsg) => {
                    setMessages((prev) => [...prev, newMsg]);
                    scrollToBottom();
                }}
            />

            {/* 🔽 Text input and Send button */}
            <div className="d-flex align-items-center gap-2 mt-2">
                {/* Message Input */}
                <textarea
                    ref={textareaRef}
                    value={text}
                    placeholder="Type a message..."
                    className="form-control fs-5"
                    style={{
                        resize: 'none',
                        overflow: 'auto',
                        maxHeight: "120px",
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6',
                    }}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleTyping}
                    aria-label="Message input"
                />

                {/* Send Button */}
                <button
                    onClick={() => {
                        handleSend(text);
                        setText(""); // Clear input after send
                    }}
                    className="btn btn-primary ms-2 d-flex align-items-center justify-content-center"
                    style={{ padding: "0.5rem 0.75rem" }}
                >
                    <SendHorizonal size={50} />
                </button>
            </div>
        </div>
    );
};

export default MessageInput;