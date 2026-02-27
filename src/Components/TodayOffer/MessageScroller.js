// src/components/TodayOffer/MessageScroller.js
import React, { useState, useEffect } from "react";
import { Button } from "react-bootstrap";
import ModalContent from "./ModalContent";

const MessageScroller = () => {
  const [showModal, setShowModal] = useState(false);

  const handleOpen = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

  // Auto-popup once daily
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastShown = localStorage.getItem("offerModalShown");

    if (lastShown !== today) {
      setShowModal(true);
      localStorage.setItem("offerModalShown", today);
    }
  }, []);

  const message1 =
    "🔔 Welcome to SOSHOLIFE! 🎉 Invite your friends and earn rewards. Don’t miss out!";
  const message2 =
    "🤑 Invite only 3 friends or family members and earn rupees ₹2500! 🏃‍♂️ Join the race!";

  const combinedMessage = (
    <>
      {message1} ———— {message2}
      <Button
        variant="warning"
        size="sm"
        className="ms-3 fw-semibold rounded-pill"
        style={{ 
          fontSize: "1rem",
          border: "1px solid rgba(255, 38, 0, 1)",
        }}
        onClick={handleOpen}
      >
        Special Offer for You
      </Button>
    </>
  );

  return (
    <>
      {/* Scroller */}
      <div className="container-fluid border-bottom mb-3 py-2 overflow-hidden position-relative">
        <div className="scroller-wrapper overflow-hidden">
          <div className="scroller-content text-nowrap d-inline-block">
            <span className="me-5">{combinedMessage}</span>
            <span className="me-5">{combinedMessage}</span>
          </div>
        </div>

        <style jsx="true">{`
          .scroller-wrapper {
            white-space: nowrap;
          }

          .scroller-content {
            animation: marquee 30s linear infinite;
          }

          @keyframes marquee {
            0% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(-50%);
            }
          }

          .scroller-content span {
            font-size: 1.5rem;
            font-weight: 500;
            color: #0fffff;
          }

          @media (max-width: 576px) {
            .scroller-content span {
              font-size: 1.2rem;
            }
          }
        `}</style>
      </div>

      {/* Offer Modal */}
      <ModalContent show={showModal} onClose={handleClose} />
    </>
  );
};

export default MessageScroller;
