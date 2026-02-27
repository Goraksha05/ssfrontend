// src/components/ModalContent.js
import React from "react";
import TodayOfferModal from "./TodayOfferModal";

const ModalContent = ({ show, onClose }) => {
    return (
        <TodayOfferModal
            show={show}
            onClose={onClose}
            onConfirm={() => {
                alert("Offer claimed! 🎉"); // replace with real logic
                onClose();
            }}
            title="🎁 Today’s Offer"
            confirmText="Claim Offer"
        >
            <h3>🔥 Earn without Investing your "Money"</h3>
            <span>
                Invite only <strong>10 friends</strong> and instantly earn{" "}
                <strong className="text-primary">Verified Badge</strong>. </span>
            <span>
                And then just help <strong>3 friends</strong> to earn{" "}
                <strong>Verified Badge</strong>, and earn cash
            </span>
            <h1 className="text-primary"><strong>₹ 2500</strong></h1>
            <span>directly into your bank account.</span>
            <p
                style={{ color: "red", fontWeight: "bold" }}
            >
                <>
                    Don’t miss this limited-time offer! Start inviting your friends or family
                    members, and unlock amazing rewards
                </>
                🎉
            </p>

        </TodayOfferModal>
    );
};

export default ModalContent;
