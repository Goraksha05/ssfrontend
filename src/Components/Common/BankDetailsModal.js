import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import BaseModal from "./BaseModal";
import { BANK_LOGO_MAP, defaultBank } from "../../utils/bankLogos";

/* ─── Bank Data ────────────────────────────────────────────────────────────── */
const BANKS = [
  { name: "State Bank of India",          ifscPrefix: "SBIN", color: "#1a3c8f", bg: "#e8eef8", abbr: "SBI"  },
  { name: "Bank of Maharashtra",          ifscPrefix: "MAHB", color: "#004d2c", bg: "#e6f4ed", abbr: "BoM"  },
  { name: "Union Bank of India",          ifscPrefix: "UBIN", color: "#c8102e", bg: "#fceaed", abbr: "UBI"  },
  { name: "HDFC Bank",                    ifscPrefix: "HDFC", color: "#004c97", bg: "#e6eef8", abbr: "HDFC" },
  { name: "Bank of India",                ifscPrefix: "BKID", color: "#e31837", bg: "#fceaed", abbr: "BoI"  },
  { name: "ICICI Bank",                   ifscPrefix: "ICIC", color: "#f96b2b", bg: "#fff0e8", abbr: "ICICI"},
  { name: "Axis Bank",                    ifscPrefix: "UTIB", color: "#800000", bg: "#f8e8e8", abbr: "AXIS" },
  { name: "Punjab National Bank",         ifscPrefix: "PUNB", color: "#e87722", bg: "#fef3e8", abbr: "PNB"  },
  { name: "Canara Bank",                  ifscPrefix: "CNRB", color: "#006d4e", bg: "#e6f4f0", abbr: "CNB"  },
  { name: "Bank of Baroda",               ifscPrefix: "BARB", color: "#f97316", bg: "#fff3e8", abbr: "BoB"  },
  { name: "Indian Bank",                  ifscPrefix: "IDIB", color: "#1d4ed8", bg: "#eff6ff", abbr: "IB"   },
  { name: "Central Bank of India",        ifscPrefix: "CBIN", color: "#dc2626", bg: "#fef2f2", abbr: "CBI"  },
  { name: "Indian Overseas Bank",         ifscPrefix: "IOBA", color: "#7c3aed", bg: "#f5f3ff", abbr: "IOB"  },
  { name: "UCO Bank",                     ifscPrefix: "UCBA", color: "#0f766e", bg: "#f0fdfa", abbr: "UCO"  },
  { name: "Kotak Mahindra Bank",          ifscPrefix: "KKBK", color: "#e31837", bg: "#fceaed", abbr: "KMB"  },
  { name: "Yes Bank",                     ifscPrefix: "YESB", color: "#0055a5", bg: "#e6eef8", abbr: "YES"  },
  { name: "IDBI Bank",                    ifscPrefix: "IBKL", color: "#003087", bg: "#e8eef8", abbr: "IDBI" },
  { name: "Federal Bank",                 ifscPrefix: "FDRL", color: "#007bff", bg: "#e8f4ff", abbr: "FB"   },
  { name: "South Indian Bank",            ifscPrefix: "SIBL", color: "#b45309", bg: "#fef3c7", abbr: "SIB"  },
  { name: "Karnataka Bank",               ifscPrefix: "KARB", color: "#15803d", bg: "#f0fdf4", abbr: "KBL"  },
  { name: "Bandhan Bank",                 ifscPrefix: "BDBL", color: "#d97706", bg: "#fffbeb", abbr: "BDB"  },
  { name: "AU Small Finance Bank",        ifscPrefix: "AUBL", color: "#6d28d9", bg: "#f5f3ff", abbr: "AU"   },
  { name: "IndusInd Bank",                ifscPrefix: "INDB", color: "#1e40af", bg: "#eff6ff", abbr: "IIB"  },
  { name: "RBL Bank",                     ifscPrefix: "RATN", color: "#b91c1c", bg: "#fef2f2", abbr: "RBL"  },
  { name: "IDFC First Bank",              ifscPrefix: "IDFB", color: "#0369a1", bg: "#f0f9ff", abbr: "IDFC" },
  { name: "Nainital Bank",                ifscPrefix: "NTBL", color: "#065f46", bg: "#ecfdf5", abbr: "NTB"  },
];

/* ─── BankLogo ─────────────────────────────────────────────────────────────── */
/**
 * Renders the bank's SVG logo if available, otherwise shows the default bank image.
 */
const BankLogo = ({ ifscPrefix, abbr, size = 53 }) => {
  const logo = BANK_LOGO_MAP[ifscPrefix] || defaultBank;
  return (
    <img
      src={logo}
      alt={abbr}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        borderRadius: 6,
        display: "block",
        flexShrink: 0,
      }}
    />
  );
};

/* ─── Validators ───────────────────────────────────────────────────────────── */
const validate = {
  accountNumber: (v) => /^\d{9,18}$/.test(v),
  confirmAccountNumber: (v, form) => v === form.accountNumber && v !== "",
  ifscCode: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()),
  panNumber: (v) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase()),
};

const FIELD_META = {
  accountNumber:        { label: "Account Number",         placeholder: "Enter 9–18 digit account number", type: "text",     hint: "Numbers only" },
  confirmAccountNumber: { label: "Confirm Account Number", placeholder: "Re-enter account number",         type: "text",     hint: "Must match above" },
  ifscCode:             { label: "IFSC Code",              placeholder: "e.g. SBIN0001234",                type: "text",     hint: "11-char bank code" },
  panNumber:            { label: "PAN Number",             placeholder: "e.g. ABCDE1234F",                 type: "text",     hint: "10-char tax ID" },
};

const FIELD_ORDER = ["accountNumber", "confirmAccountNumber", "ifscCode", "panNumber"];

/* ─── BankCard ─────────────────────────────────────────────────────────────── */
const BankCard = ({ bank, selected, onClick }) => (
  <motion.button
    type="button"
    whileHover={{ y: -2, boxShadow: `0 6px 20px ${bank.color}22` }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "10px 8px",
      borderRadius: 14,
      border: `2px solid ${selected ? bank.color : "transparent"}`,
      background: selected ? bank.bg : "#f9fafb",
      cursor: "pointer",
      transition: "all 0.18s ease",
      outline: "none",
      position: "relative",
      minWidth: 0,
    }}
    aria-pressed={selected}
    title={bank.name}
  >
    {selected && (
      <motion.div
        layoutId="bank-selected-ring"
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: 14,
          border: `2px solid ${bank.color}`,
          pointerEvents: "none",
        }}
      />
    )}
    <BankLogo
      ifscPrefix={bank.ifscPrefix}
      abbr={bank.abbr}
      size={53}
    />
    <span style={{
      fontSize: 9,
      fontWeight: 800,
      color: selected ? bank.color : "#6b7280",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      textAlign: "center",
      lineHeight: 1.2,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {bank.abbr}
    </span>
    {selected && (
      <span style={{
        position: "absolute",
        top: -6,
        right: -6,
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: bank.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        color: "#fff",
        fontWeight: 700,
      }}>✓</span>
    )}
  </motion.button>
);

/* ─── FieldRow ─────────────────────────────────────────────────────────────── */
const FieldRow = ({ fieldKey, value, form, touched, onChange, onBlur }) => {
  const meta    = FIELD_META[fieldKey];
  const isValid = touched && validate[fieldKey]?.(value, form);
  const isError = touched && !validate[fieldKey]?.(value, form);

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block",
        fontSize: 11,
        fontWeight: 700,
        color: "#374151",
        marginBottom: 5,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {meta.label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={meta.type}
          value={value}
          placeholder={meta.placeholder}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          onBlur={() => onBlur(fieldKey)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 36px 10px 12px",
            borderRadius: 10,
            border: `1.5px solid ${isError ? "#ef4444" : isValid ? "#22c55e" : "#e5e7eb"}`,
            fontSize: 13.5,
            fontFamily: "'DM Mono', monospace",
            color: "#111827",
            background: isError ? "#fef2f2" : isValid ? "#f0fdf4" : "#fff",
            outline: "none",
            transition: "border-color 0.15s, background 0.15s",
          }}
        />
        {isValid && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#22c55e", fontSize: 15 }}>✓</span>
        )}
        {isError && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#ef4444", fontSize: 15 }}>✕</span>
        )}
      </div>
      {isError && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#ef4444", fontFamily: "'DM Sans', sans-serif" }}>
          {fieldKey === "confirmAccountNumber" ? "Account numbers don't match"
            : fieldKey === "ifscCode" ? "Invalid IFSC (e.g. SBIN0001234)"
            : fieldKey === "panNumber" ? "Invalid PAN (e.g. ABCDE1234F)"
            : "Invalid account number (9–18 digits)"}
        </p>
      )}
      {!isError && (
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>
          {meta.hint}
        </p>
      )}
    </div>
  );
};

/* ─── Main Component ───────────────────────────────────────────────────────── */
const BankDetailsModal = ({ isOpen, onClose, loading, onSubmit }) => {
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankSearch,   setBankSearch]   = useState("");
  const [form, setForm] = useState({
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    panNumber: "",
  });
  const [touched,   setTouched]   = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [step,      setStep]      = useState("bank"); // "bank" | "details"

  /* ── Reset all form state whenever the modal is opened ── */
  useEffect(() => {
    if (isOpen) {
      setForm({ accountNumber: "", confirmAccountNumber: "", ifscCode: "", panNumber: "" });
      setTouched({});
      setSubmitted(false);
      setSelectedBank(null);
      setBankSearch("");
      setStep("bank");
    }
  }, [isOpen]);

  /* ── Auto-fill IFSC prefix when bank is selected ── */
  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setForm((prev) => ({
      ...prev,
      ifscCode: prev.ifscCode.startsWith(bank.ifscPrefix) ? prev.ifscCode : bank.ifscPrefix,
    }));
  };

  const filteredBanks = useMemo(() => {
    const q = bankSearch.toLowerCase();
    return q ? BANKS.filter((b) => b.name.toLowerCase().includes(q) || b.abbr.toLowerCase().includes(q)) : BANKS;
  }, [bankSearch]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: key === "ifscCode" || key === "panNumber" ? value.toUpperCase() : value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const handleBlur = (key) => setTouched((prev) => ({ ...prev, [key]: true }));

  const isFormValid = useMemo(() =>
    FIELD_ORDER.every((k) => validate[k]?.(form[k], form)),
    [form]
  );

  const allTouched = () => {
    const t = {};
    FIELD_ORDER.forEach((k) => { t[k] = true; });
    setTouched(t);
  };

  const handleSubmit = () => {
    allTouched();
    if (!selectedBank) { toast.error("Please select a bank first."); setStep("bank"); return; }
    if (!isFormValid) { toast.error("Please fix the errors above."); return; }

    onSubmit({ ...form, bankName: selectedBank.name }, () => {
      setSubmitted(true);
      setTimeout(() => onClose(), 2400);
    });
  };

  const progress = FIELD_ORDER.filter((k) => validate[k]?.(form[k], form)).length;
  const progressPct = (progress / FIELD_ORDER.length) * 100;

  if (!isOpen) return null;

  return (
    <BaseModal onClose={!submitted ? onClose : undefined}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        .bdm-bank-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 480px) { .bdm-bank-grid { grid-template-columns: repeat(3, 1fr); } }
        .bdm-tab { background: none; border: none; cursor: pointer; padding: 8px 18px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; transition: all 0.15s; }
        .bdm-tab.active { background: #111827; color: #fff; }
        .bdm-tab:not(.active) { color: #6b7280; }
        .bdm-search { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1.5px solid #e5e7eb; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #374151; outline: none; }
        .bdm-search:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .bdm-scroll { max-height: 220px; overflow-y: auto; padding-right: 2px; }
        .bdm-scroll::-webkit-scrollbar { width: 4px; }
        .bdm-scroll::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 4px; }
        .bdm-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>

      <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", background: "#fff", width: "100%", maxWidth: 480 }}>
        <AnimatePresence mode="wait">
          {submitted ? (
            /* ── Success State ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: "48px 32px", textAlign: "center", background: "#fff" }}
            >
              <motion.div
                animate={{ scale: [0, 1.2, 1], rotate: [0, -10, 0] }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 60, marginBottom: 16 }}
              >
                🎉
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p style={{ fontWeight: 800, fontSize: 20, color: "#111827", margin: "0 0 8px" }}>Reward Claimed!</p>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Your payout is being processed to<br/><strong style={{ color: "#374151" }}>{selectedBank?.name}</strong></p>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* ── Header ── */}
              <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #f3f4f6", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: "#111827" }}>
                      {selectedBank ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <BankLogo
                            ifscPrefix={selectedBank.ifscPrefix}
                            abbr={selectedBank.abbr}
                            size={24}
                          />
                          <span>{selectedBank.name}</span>
                        </span>
                      ) : "Bank Details"}
                    </h5>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
                      {step === "bank" ? "Select your bank to continue" : "Enter your account details"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* ── Tabs ── */}
                <div style={{ display: "flex", gap: 4, background: "#f9fafb", borderRadius: 10, padding: 4 }}>
                  <button className={`bdm-tab ${step === "bank" ? "active" : ""}`} onClick={() => setStep("bank")} style={{ flex: 1 }}>
                    🏦 Choose Bank
                  </button>
                  <button
                    className={`bdm-tab ${step === "details" ? "active" : ""}`}
                    onClick={() => { if (!selectedBank) { toast.info("Select a bank first"); return; } setStep("details"); }}
                    style={{ flex: 1, opacity: selectedBank ? 1 : 0.5 }}
                  >
                    📋 Account Info
                  </button>
                </div>
              </div>

              {/* ── Progress Bar ── */}
              {step === "details" && (
                <div style={{ height: 3, background: "#f3f4f6" }}>
                  <motion.div
                    style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 2 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}

              {/* ── Body ── */}
              <div style={{ padding: "18px 22px", background: "#fff", maxHeight: "55vh", overflowY: "auto" }}>
                <AnimatePresence mode="wait">

                  {/* STEP 1: Bank Picker */}
                  {step === "bank" && (
                    <motion.div key="bank-step" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
                      <input
                        className="bdm-search"
                        placeholder="🔍  Search bank name…"
                        value={bankSearch}
                        onChange={(e) => setBankSearch(e.target.value)}
                        style={{ marginBottom: 12 }}
                      />
                      {selectedBank && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            borderRadius: 12,
                            background: selectedBank.bg,
                            border: `1.5px solid ${selectedBank.color}33`,
                            marginBottom: 12,
                          }}
                        >
                          <BankLogo
                            ifscPrefix={selectedBank.ifscPrefix}
                            abbr={selectedBank.abbr}
                            size={36}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: selectedBank.color }}>{selectedBank.name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>IFSC prefix: {selectedBank.ifscPrefix}…</p>
                          </div>
                          <span style={{ fontSize: 18 }}>✓</span>
                        </motion.div>
                      )}
                      <div className="bdm-scroll">
                        {filteredBanks.length === 0 ? (
                          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "24px 0" }}>No banks found</p>
                        ) : (
                          <div className="bdm-bank-grid">
                            {filteredBanks.map((bank) => (
                              <BankCard
                                key={bank.name}
                                bank={bank}
                                selected={selectedBank?.name === bank.name}
                                onClick={() => handleBankSelect(bank)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: Account Details */}
                  {step === "details" && (
                    <motion.div key="details-step" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                      {FIELD_ORDER.map((key) => (
                        <FieldRow
                          key={key}
                          fieldKey={key}
                          value={form[key]}
                          form={form}
                          touched={touched}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      ))}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        background: "#f0fdf4",
                        borderRadius: 10,
                        border: "1px solid #bbf7d0",
                        marginTop: 4,
                      }}>
                        <span style={{ fontSize: 16 }}>🔒</span>
                        <p style={{ margin: 0, fontSize: 11, color: "#166534", fontFamily: "'DM Sans', sans-serif" }}>
                          Your bank details are encrypted and used only for reward payouts.
                        </p>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* ── Footer ── */}
              <div style={{ padding: "14px 22px 20px", borderTop: "1px solid #f3f4f6", background: "#fff", display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "none", color: "#6b7280", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>

                {step === "bank" ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { if (!selectedBank) { toast.info("Please select a bank"); return; } setStep("details"); }}
                    style={{
                      flex: 1, padding: "10px 18px", borderRadius: 10,
                      background: selectedBank ? "linear-gradient(135deg, #1e40af, #4f46e5)" : "#e5e7eb",
                      color: selectedBank ? "#fff" : "#9ca3af",
                      border: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                      fontSize: 14, cursor: selectedBank ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                    disabled={!selectedBank}
                  >
                    Next: Account Details →
                  </motion.button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep("bank")}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "none", color: "#374151", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      ← Bank
                    </button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      whileHover={{ scale: isFormValid && !loading ? 1.02 : 1 }}
                      onClick={handleSubmit}
                      disabled={!isFormValid || loading}
                      style={{
                        flex: 1, padding: "10px 18px", borderRadius: 10,
                        background: isFormValid && !loading ? "linear-gradient(135deg, #059669, #047857)" : "#e5e7eb",
                        color: isFormValid && !loading ? "#fff" : "#9ca3af",
                        border: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                        fontSize: 14, cursor: isFormValid && !loading ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      {loading ? (
                        <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Processing…</>
                      ) : (
                        "✓ Submit Details"
                      )}
                    </motion.button>
                  </>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </BaseModal>
  );
};

export default BankDetailsModal;