import React, { useEffect, useRef, useCallback } from 'react';
import { useFriend } from '../../../Context/Friend/FriendContext';
import { useChat } from '../../../Context/ChatContext';
import { useAuth } from '../../../Context/Authorisation/AuthContext';
import apiRequest from '../../../utils/apiRequest';
import { getInitials } from '../../../utils/getInitials';

const COLORS = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];

const getColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
};

const ChatList = ({ selectedChat }) => {
    const { friends, loading, fetchFriends } = useFriend();
    const { setSelectedChat, setMessages } = useChat();
    const { user } = useAuth();
    const selectedRef = useRef(null);

    // Determine selected friend ID (excluding self)
    const getSelectedFriendId = useCallback(() => {
        if (!selectedChat?.users || !user?._id) return null;
        return selectedChat.users.find((u) => u._id !== user._id)?._id;
    }, [selectedChat, user]);

    // Fetch friends on mount if list is empty
    useEffect(() => {
        if (!friends.length) fetchFriends();
    }, [friends, fetchFriends]);

    // Scroll selected friend into view (smoothly)
    useEffect(() => {
        if (selectedRef.current) {
            selectedRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
        }
    }, [selectedChat]);

    const handleSelect = async (friend) => {
        try {
            const { data } = await apiRequest.post('/api/chat', { receiverId: friend._id });
            setSelectedChat(data);
            const res = await apiRequest.get(`/api/message/${data._id}`);
            setMessages(res.data);
        } catch (err) {
            console.error('❌ Failed to open chat:', err.message);
        }
    };

    const selectedFriendId = getSelectedFriendId();

    return (

        <div className="chatlist mt-3">
            {/* Header */}
            <div className="bg-transparent px-3 border-bottom sticky-top">
                <h6 className="mb-0 fw-semibold">Friends</h6>
            </div>

            {/* Friend List */}
            {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="placeholder-glow mb-3">
                        <div className="placeholder col-12 py-3 rounded bg-secondary"></div>
                    </div>
                ))
            ) : friends.length === 0 ? (
                <div className="text-muted text-center py-4">No friends yet</div>
            ) : (
                <ul className="list-group list-group-flush">
                    {friends.map((friend) => {
                        const isSelected = friend._id === selectedFriendId;

                        return (
                            <li
                                key={friend._id}
                                ref={isSelected ? selectedRef : null}
                                className={`list-group-item list-group-item-action d-flex align-items-center gap-3 rounded mb-1 ${isSelected ? 'active text-white' : ''
                                    }`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleSelect(friend)}
                            >
                                {friend.profileImage ? (
                                    <img
                                        src={friend.profileImage}
                                        alt={friend.name}
                                        className="rounded-circle"
                                        width="40"
                                        height="40"
                                    />
                                ) : (
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white"
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            backgroundColor: getColor(friend.name),
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {getInitials(friend.name)}
                                    </div>
                                )}
                                <div>
                                    <div className="fw-medium">{friend.name}</div>
                                    {friend.currentcity && (
                                        <div className="text-muted small">{friend.currentcity}</div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>

    );
};

export default ChatList;