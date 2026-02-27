import { createContext, useContext, useState, useEffect } from "react";
import getSocket from '../WebSocket/WebSocketClient';
import apiRequest from '../utils/apiRequest';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const socket = getSocket();
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);

    const sendMessage = ({ toUserId, content, type = 'text' }) => {
        if (!toUserId || !content) return;
        socket.emit('send_message', { toUserId, message: { content, type, timestamp: new Date() } });
    };

    useEffect(() => {
        if (!socket) return;

        socket.on('receive_message', ({ fromUserId, message }) => {
            setMessages(prev => [...prev, { ...message, from: fromUserId }]);
        });

        return () => socket.off('receive_message');
    }, [socket]);

    const uploadFile = async (formData) => {
        try {
            const res = await apiRequest.post('/api/upload/chat', formData);
            return res.data?.url;
        } catch (err) {
            console.error('Upload failed:', err);
        }
    };
    return (
        <ChatContext.Provider
            value={{
                selectedChat,
                setSelectedChat,
                messages,
                setMessages,
                isTyping,
                setIsTyping,
                sendMessage,
                uploadFile
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);