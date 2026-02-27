// src/components/CustomModal.js
import React from "react";
import { Modal, Button } from "react-bootstrap";

const TodayOfferModal = ({ show, onClose, onConfirm, title, children, confirmText }) => {
    return (
        <Modal show={show} onHide={onClose} centered>
            <Modal.Header
                closeButton
                className="justify-content-center border-0"
                style={{ position: "relative" }}
            >
                <Modal.Title className="w-100 text-center mb-0">{title}</Modal.Title>
            </Modal.Header>

            <Modal.Body className="text-center"
                style={{ backgroundColor: '#AAD4FF' }}
            >
                {children}
            </Modal.Body>

            <Modal.Footer className="d-flex justify-content-center">
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
                {onConfirm && (
                    <Button variant="success" onClick={onConfirm}>
                        {confirmText || "Confirm"}
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default TodayOfferModal;
