// src/Components/Common/BankDetailsModal.js
import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";

const BankDetailsModal = ({ modalId, loading, onSubmit }) => {
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    panNumber: "",
  });

  const [mismatch, setMismatch] = useState(false);
  const triggerRef = useRef(null);

  // 🔹 Capture the button (or element) that opened the modal
  useEffect(() => {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const handleShow = (e) => {
      // Save the element that triggered modal
      triggerRef.current = e.relatedTarget;
    };

    const handleHidden = () => {
      // Restore focus when modal closes
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
      // Reset state
      setBankDetails({
        accountNumber: "",
        confirmAccountNumber: "",
        ifscCode: "",
        panNumber: "",
      });
      setMismatch(false);
    };

    modalEl.addEventListener("show.bs.modal", handleShow);
    modalEl.addEventListener("hidden.bs.modal", handleHidden);

    return () => {
      modalEl.removeEventListener("show.bs.modal", handleShow);
      modalEl.removeEventListener("hidden.bs.modal", handleHidden);
    };
  }, [modalId]);

  const handleSubmit = () => {
    if (bankDetails.accountNumber !== bankDetails.confirmAccountNumber) {
      setMismatch(true);
      toast.error("Account numbers do not match.");
      return;
    }
    onSubmit(bankDetails, () => {
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
        const bsModal = window.bootstrap.Modal.getInstance(modalEl);
        bsModal?.hide();
      }
    });
  };

  return (
    <div
      className="modal fade"
      id={modalId}
      tabIndex="-1"
      aria-labelledby={`${modalId}Label`}
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id={`${modalId}Label`}>
              Submit Your Bank Details
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              id={`close-${modalId}`}
            />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">Bank Account No.</label>
              <input
                type="text"
                className="form-control"
                value={bankDetails.accountNumber}
                onChange={(e) =>
                  setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                }
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm Bank Account No.</label>
              <input
                type="text"
                className={`form-control ${
                  mismatch ? "is-invalid" : ""
                }`}
                value={bankDetails.confirmAccountNumber}
                onChange={(e) => {
                  setMismatch(false);
                  setBankDetails({
                    ...bankDetails,
                    confirmAccountNumber: e.target.value,
                  });
                }}
              />
              {mismatch && (
                <div className="invalid-feedback">
                  Account numbers do not match.
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">Bank IFSC Code</label>
              <input
                type="text"
                className="form-control"
                value={bankDetails.ifscCode}
                onChange={(e) =>
                  setBankDetails({ ...bankDetails, ifscCode: e.target.value })
                }
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Your PAN No.</label>
              <input
                type="text"
                className="form-control"
                value={bankDetails.panNumber}
                onChange={(e) =>
                  setBankDetails({ ...bankDetails, panNumber: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              data-bs-dismiss="modal"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankDetailsModal;
