import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

const BankDetailsModal = ({ modalId, loading, onSubmit }) => {
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    panNumber: "",
  });

  const [mismatch, setMismatch] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const triggerRef = useRef(null);

  /* ── Modal lifecycle ── */
  useEffect(() => {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const handleShow = (e) => {
      triggerRef.current = e.relatedTarget;
      setSubmitted(false);
    };

    const handleHidden = () => {
      triggerRef.current?.focus();
      setBankDetails({
        accountNumber: "",
        confirmAccountNumber: "",
        ifscCode: "",
        panNumber: "",
      });
      setMismatch(false);
      setSubmitted(false);
    };

    modalEl.addEventListener("show.bs.modal", handleShow);
    modalEl.addEventListener("hidden.bs.modal", handleHidden);

    return () => {
      modalEl.removeEventListener("show.bs.modal", handleShow);
      modalEl.removeEventListener("hidden.bs.modal", handleHidden);
    };
  }, [modalId]);

  const isValid =
    bankDetails.accountNumber &&
    bankDetails.confirmAccountNumber &&
    bankDetails.ifscCode &&
    bankDetails.panNumber &&
    bankDetails.accountNumber === bankDetails.confirmAccountNumber;

  const handleSubmit = () => {
    if (!isValid) {
      setMismatch(true);
      toast.error("Fix errors first");
      return;
    }

    onSubmit(bankDetails, () => {
      setSubmitted(true);

      setTimeout(() => {
        const modalEl = document.getElementById(modalId);
        const bsModal = window.bootstrap.Modal.getInstance(modalEl);
        bsModal?.hide();
      }, 2200);
    });
  };

  return (
    <div className="modal fade" id={modalId}>
      <div className="modal-dialog modal-dialog-centered">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="modal-content"
          style={{ borderRadius: 18, overflow: "hidden" }}
        >
          {/* HEADER */}
          <div className="modal-header border-0">
            <h5 className="modal-title">
              {submitted ? "🎉 Success" : "Add Bank Details"}
            </h5>
          </div>

          {/* BODY */}
          <div className="modal-body">

            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {["accountNumber", "confirmAccountNumber", "ifscCode", "panNumber"].map((field, i) => (
                    <motion.input
                      key={field}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      placeholder={field.replace(/([A-Z])/g, " $1")}
                      className={`form-control mb-3 ${mismatch && field === "confirmAccountNumber" ? "is-invalid" : ""}`}
                      value={bankDetails[field]}
                      onChange={(e) => {
                        setMismatch(false);
                        setBankDetails({ ...bankDetails, [field]: e.target.value });
                      }}
                      style={{
                        transition: "all 0.2s",
                      }}
                      onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #111827")}
                      onBlur={(e) => (e.target.style.boxShadow = "none")}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ textAlign: "center", padding: 30 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.6 }}
                    style={{ fontSize: 50 }}
                  >
                    🎉
                  </motion.div>

                  <p style={{ fontWeight: 600, fontSize: 18 }}>
                    Reward Claimed!
                  </p>
                  <small style={{ color: "#6b7280" }}>
                    Processing your payout…
                  </small>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* FOOTER */}
          {!submitted && (
            <div className="modal-footer border-0">
              <button className="btn btn-light" data-bs-dismiss="modal">
                Cancel
              </button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                className="btn btn-dark"
                onClick={handleSubmit}
                disabled={!isValid || loading}
              >
                {loading ? "Processing..." : "Submit"}
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default BankDetailsModal;