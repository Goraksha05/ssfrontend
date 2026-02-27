import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../Context/Authorisation/AuthContext";
import { useChat } from "../../../Context/ChatContext";
import moment from "moment";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import apiRequest from "../../../utils/apiRequest";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

const MessageBubble = ({ msg }) => {
    const { user } = useAuth();
    const { setMessages } = useChat();

    const isMine = user && msg?.sender?._id === user._id;
    const isNotMine = !isMine;

    const [showImage, setShowImage] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [reaction, setReaction] = useState(msg.reaction || null);
    const [deleting, setDeleting] = useState(false);

    const longPressTimer = useRef(null);
    const bubbleRef = useRef(null);

    const handleDeleteForMe = async () => {
        try {
            setDeleting(true);
            await apiRequest.put(`/api/message/delete-for-me/${msg._id}`);
            setMessages((prev) => prev.filter((m) => m._id !== msg._id));
        } catch (err) {
            console.error("❌ Delete-for-me failed:", err.message);
        } finally {
            setDeleting(false);
            setShowOptions(false);
        }
    };

    const handleDeleteForEveryone = async () => {
        try {
            setDeleting(true);
            await apiRequest.put(`/api/message/delete-everyone/${msg._id}`);
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === msg._id
                        ? {
                            ...m,
                            text: null,
                            mediaUrl: null,
                            mediaType: null,
                            isDeleted: true,
                        }
                        : m
                )
            );
        } catch (err) {
            console.error("❌ Delete-for-everyone failed:", err.message);
        } finally {
            setDeleting(false);
            setShowOptions(false);
        }
    };

    const handleTouchStart = () => {
        longPressTimer.current = setTimeout(() => {
            setShowOptions(true);
            setShowReactions(true);
        }, 600);
    };

    const handleTouchEnd = () => {
        clearTimeout(longPressTimer.current);
    };

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
                setShowOptions(false);
                setShowReactions(false);
            }
        };

        document.addEventListener("touchstart", handleOutsideClick);
        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener("touchstart", handleOutsideClick);
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    if (msg.isDeleted) {
        return (
            <div className={`d-flex mb-2 px-2 ${isMine ? "justify-content-end" : "justify-content-start"}`}>
                <div
                    className={`p-2 px-3 rounded-pill small text-muted border ${isMine ? "bg-light" : "bg-white"
                        } fst-italic`}
                >
                    This message was deleted
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                className={`d-flex flex-column mb-2 px-2 ${isMine ? "align-items-end" : "align-items-start"
                    }`}
            >
                <div
                    ref={bubbleRef}
                    className={`message-bubble position-relative px-3 py-2 shadow-sm ${isMine ? "bg-primary text-white" : "bg-light text-dark"
                        }`}
                    style={{
                        maxWidth: "75%",
                        borderRadius: isMine
                            ? "1rem 1rem 0.25rem 1rem"
                            : "1rem 1rem 1rem 0.25rem",
                        wordBreak: "break-word",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                    onMouseEnter={() => window.innerWidth >= 768 && setShowReactions(true)}
                    onMouseLeave={() => window.innerWidth >= 768 && setShowReactions(false)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* 👤 Sender Name (for group) */}
                    {isNotMine && msg.sender?.name && (
                        <div className="fw-semibold mb-1" style={{ fontSize: "0.85rem" }}>
                            {msg.sender.name}
                        </div>
                    )}

                    {/* 📎 Reply Preview */}
                    {msg.replyTo && (
                        <div
                            className="mb-2 p-2 rounded bg-white border-start border-4"
                            style={{ borderColor: isMine ? "#90cdf4" : "#adb5bd" }}
                        >
                            <small className="fw-bold">{msg.replyTo.senderName}</small>
                            <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                                {msg.replyTo.text || "Media"}
                            </div>
                        </div>
                    )}

                    {/* 🗑️ Trash Icon */}
                    {showOptions && (
                        <div
                            className="position-absolute"
                            style={{
                                top: "6px",
                                right: isMine ? "6px" : "auto",
                                left: isNotMine ? "6px" : "auto",
                                zIndex: 10,
                                cursor: "pointer",
                            }}
                            title="Delete"
                        >
                            <FontAwesomeIcon icon={faTrash} size="sm" />
                        </div>
                    )}

                    {/* 🧾 Delete Menu */}
                    {showOptions && (
                        <div
                            className="position-absolute bg-white border rounded shadow-sm"
                            style={{
                                top: "30px",
                                right: isMine ? "0" : "auto",
                                left: isNotMine ? "0" : "auto",
                                width: "150px",
                                zIndex: 9999,
                            }}
                        >
                            <button
                                className="dropdown-item small"
                                onClick={handleDeleteForMe}
                                disabled={deleting}
                            >
                                Delete for Me
                            </button>
                            {isMine && (
                                <button
                                    className="dropdown-item small text-danger"
                                    onClick={handleDeleteForEveryone}
                                    disabled={deleting}
                                >
                                    Delete for Everyone
                                </button>
                            )}
                        </div>
                    )}

                    {/* ✉️ Text */}
                    {msg.text && (
                        <div className="mb-1" style={{ whiteSpace: "pre-wrap" }}>
                            {msg.text}
                        </div>
                    )}

                    {/* 🎥📸 Media */}
                    {msg.mediaUrl && (
                        <div className="mt-2">
                            {msg.mediaType?.startsWith("video") ? (
                                <video
                                    src={msg.mediaUrl}
                                    controls
                                    className="rounded"
                                    style={{
                                        width: "100%",
                                        maxHeight: "200px",
                                        objectFit: "cover",
                                    }}
                                />
                            ) : (
                                <img
                                    src={msg.mediaUrl}
                                    alt="media"
                                    onClick={() => setShowImage(true)}
                                    className="rounded"
                                    style={{
                                        width: "120px",
                                        height: "120px",
                                        objectFit: "cover",
                                        cursor: "pointer",
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {/* 😀 Emoji Reaction Preview */}
                    {reaction && (
                        <div className="mt-1" style={{ fontSize: "1.2rem" }}>
                            {reaction}
                        </div>
                    )}

                    {/* 😀 Emoji Reaction Bar */}
                    {showReactions && (
                        <div
                            className="position-absolute d-flex gap-2 px-2 py-1 bg-white rounded shadow-sm"
                            style={{
                                bottom: "100%",
                                right: isMine ? 0 : "auto",
                                left: isNotMine ? 0 : "auto",
                                transform: "translateY(-6px)",
                                zIndex: 1000,
                                fontSize: "1.25rem",
                            }}
                        >
                            {["👍", "❤️", "😂", "😮"].map((emo) => (
                                <span
                                    key={emo}
                                    onClick={() => {
                                        setReaction(emo);
                                        setShowReactions(false);
                                        // Optional: emit socket/update DB
                                    }}
                                    style={{ cursor: "pointer" }}
                                >
                                    {emo}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* 🕒 Time */}
                <div className={`small mt-1 ${isMine ? "text-white-50" : "text-muted"}`}>
                    {moment(msg.createdAt).format("hh:mm A")}
                </div>
            </div>

            {/* 🖼️ Image Modal */}
            {msg.mediaType === "image" && (
                <Modal
                    show={showImage}
                    onHide={() => setShowImage(false)}
                    centered
                    size="lg"
                    contentClassName="bg-dark text-white border-0"
                >
                    <Modal.Header className="border-0">
                        <Button
                            variant="light"
                            className="ms-auto btn-close"
                            onClick={() => setShowImage(false)}
                            aria-label="Close"
                        />
                    </Modal.Header>
                    <Modal.Body className="p-0 text-center">
                        <img
                            src={msg.mediaUrl}
                            alt="full"
                            className="img-fluid"
                            style={{ maxHeight: "90vh", objectFit: "contain" }}
                        />
                    </Modal.Body>
                </Modal>
            )}
        </>
    );
};

export default MessageBubble;