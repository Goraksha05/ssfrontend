/**
 * components/SpecialOffer/SpecialOfferWithdrawModal.jsx
 *
 * Withdrawal modal for approved Special Offer rewards.
 *
 * FLOW:
 *   1. Guard — checks that at least one reward is admin-approved before
 *      allowing the modal to proceed past the gate screen.
 *   2. Bank picker (Step 1) — reuses the same BankCard + bank list from
 *      BankDetailsModal so the UI is consistent.
 *   3. Account details (Step 2) — account number, confirm, IFSC, PAN.
 *   4. Confirm screen (Step 3) — summary of approved amount before submit.
 *   5. Success screen — animated confirmation.
 *
 * Props:
 *   isOpen          boolean
 *   onClose         () => void
 *   approvedCount   number   — rewards with status === 'approved'
 *   approvedAmountINR number — total INR to be withdrawn
 *   rewardPer       number   — ₹ per reward unit (default 100)
 *   onSubmit        (bankDetails, successCb) => void
 *   loading         boolean
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import BaseModal from '../Common/BaseModal';
import { BANK_LOGO_MAP, defaultBank } from '../../utils/bankLogos';

/* ─────────────────────────────────────────────────────────────────────────────
   Bank list (same source of truth as BankDetailsModal)
───────────────────────────────────────────────────────────────────────────── */
const BANKS = [
  { name: 'State Bank of India',   ifscPrefix: 'SBIN', color: '#1a3c8f', bg: '#e8eef8', abbr: 'SBI'  },
  { name: 'Bank of Maharashtra',   ifscPrefix: 'MAHB', color: '#004d2c', bg: '#e6f4ed', abbr: 'BoM'  },
  { name: 'Union Bank of India',   ifscPrefix: 'UBIN', color: '#c8102e', bg: '#fceaed', abbr: 'UBI'  },
  { name: 'HDFC Bank',             ifscPrefix: 'HDFC', color: '#004c97', bg: '#e6eef8', abbr: 'HDFC' },
  { name: 'Bank of India',         ifscPrefix: 'BKID', color: '#e31837', bg: '#fceaed', abbr: 'BoI'  },
  { name: 'ICICI Bank',            ifscPrefix: 'ICIC', color: '#f96b2b', bg: '#fff0e8', abbr: 'ICICI'},
  { name: 'Axis Bank',             ifscPrefix: 'UTIB', color: '#800000', bg: '#f8e8e8', abbr: 'AXIS' },
  { name: 'Punjab National Bank',  ifscPrefix: 'PUNB', color: '#e87722', bg: '#fef3e8', abbr: 'PNB'  },
  { name: 'Canara Bank',           ifscPrefix: 'CNRB', color: '#006d4e', bg: '#e6f4f0', abbr: 'CNB'  },
  { name: 'Bank of Baroda',        ifscPrefix: 'BARB', color: '#f97316', bg: '#fff3e8', abbr: 'BoB'  },
  { name: 'Indian Bank',           ifscPrefix: 'IDIB', color: '#1d4ed8', bg: '#eff6ff', abbr: 'IB'   },
  { name: 'Central Bank of India', ifscPrefix: 'CBIN', color: '#dc2626', bg: '#fef2f2', abbr: 'CBI'  },
  { name: 'Indian Overseas Bank',  ifscPrefix: 'IOBA', color: '#7c3aed', bg: '#f5f3ff', abbr: 'IOB'  },
  { name: 'UCO Bank',              ifscPrefix: 'UCBA', color: '#0f766e', bg: '#f0fdfa', abbr: 'UCO'  },
  { name: 'Kotak Mahindra Bank',   ifscPrefix: 'KKBK', color: '#e31837', bg: '#fceaed', abbr: 'KMB'  },
  { name: 'Yes Bank',              ifscPrefix: 'YESB', color: '#0055a5', bg: '#e6eef8', abbr: 'YES'  },
  { name: 'IDBI Bank',             ifscPrefix: 'IBKL', color: '#003087', bg: '#e8eef8', abbr: 'IDBI' },
  { name: 'Federal Bank',          ifscPrefix: 'FDRL', color: '#007bff', bg: '#e8f4ff', abbr: 'FB'   },
  { name: 'South Indian Bank',     ifscPrefix: 'SIBL', color: '#b45309', bg: '#fef3c7', abbr: 'SIB'  },
  { name: 'Karnataka Bank',        ifscPrefix: 'KARB', color: '#15803d', bg: '#f0fdf4', abbr: 'KBL'  },
  { name: 'Bandhan Bank',          ifscPrefix: 'BDBL', color: '#d97706', bg: '#fffbeb', abbr: 'BDB'  },
  { name: 'IndusInd Bank',         ifscPrefix: 'INDB', color: '#1e40af', bg: '#eff6ff', abbr: 'IIB'  },
  { name: 'RBL Bank',              ifscPrefix: 'RATN', color: '#b91c1c', bg: '#fef2f2', abbr: 'RBL'  },
  { name: 'IDFC First Bank',       ifscPrefix: 'IDFB', color: '#0369a1', bg: '#f0f9ff', abbr: 'IDFC' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */

const BankLogo = ({ ifscPrefix, abbr, size = 48 }) => {
  const logo = BANK_LOGO_MAP[ifscPrefix] || defaultBank;
  return (
    <img
      src={logo}
      alt={abbr}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }}
    />
  );
};

const BankCard = ({ bank, selected, onClick }) => (
  <motion.button
    type="button"
    whileHover={{ y: -2, boxShadow: `0 6px 18px ${bank.color}30` }}
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    aria-pressed={selected}
    title={bank.name}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: '9px 7px', borderRadius: 12,
      border: `2px solid ${selected ? bank.color : 'transparent'}`,
      background: selected ? bank.bg : '#f8fafc',
      cursor: 'pointer', outline: 'none', position: 'relative', minWidth: 0,
      transition: 'all 0.15s ease',
    }}
  >
    {selected && (
      <span style={{
        position: 'absolute', top: -6, right: -6,
        width: 15, height: 15, borderRadius: '50%',
        background: bank.color, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 800,
      }}>✓</span>
    )}
    <BankLogo ifscPrefix={bank.ifscPrefix} abbr={bank.abbr} size={46} />
    <span style={{
      fontSize: 8.5, fontWeight: 800, letterSpacing: '0.04em',
      color: selected ? bank.color : '#94a3b8', textTransform: 'uppercase',
      textAlign: 'center', lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif",
    }}>{bank.abbr}</span>
  </motion.button>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Validation
───────────────────────────────────────────────────────────────────────────── */
const validators = {
  accountNumber:        (v) => /^\d{9,18}$/.test(v),
  confirmAccountNumber: (v, form) => v !== '' && v === form.accountNumber,
  ifscCode:             (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test((v || '').toUpperCase()),
  panNumber:            (v) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((v || '').toUpperCase()),
};

const FIELD_META = {
  accountNumber:        { label: 'Account Number',         placeholder: '9–18 digit account number', hint: 'Numbers only'        },
  confirmAccountNumber: { label: 'Confirm Account Number', placeholder: 'Re-enter account number',    hint: 'Must match above'    },
  ifscCode:             { label: 'IFSC Code',              placeholder: 'e.g. SBIN0001234',           hint: '11-char bank code'   },
  panNumber:            { label: 'PAN Number',             placeholder: 'e.g. ABCDE1234F',            hint: '10-char tax ID'      },
};

const FIELD_ORDER = ['accountNumber', 'confirmAccountNumber', 'ifscCode', 'panNumber'];

function FieldRow({ fieldKey, value, form, touched, onChange, onBlur }) {
  const meta    = FIELD_META[fieldKey];
  const isValid = touched[fieldKey] && validators[fieldKey]?.(value, form);
  const isError = touched[fieldKey] && !validators[fieldKey]?.(value, form);

  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{
        display: 'block', fontSize: 10.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: '#374151', marginBottom: 5, fontFamily: "'DM Sans', sans-serif",
      }}>
        {meta.label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          placeholder={meta.placeholder}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          onBlur={() => onBlur(fieldKey)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 34px 10px 12px', borderRadius: 9,
            border: `1.5px solid ${isError ? '#ef4444' : isValid ? '#22c55e' : '#e5e7eb'}`,
            fontSize: 13.5, fontFamily: "'DM Mono', 'Courier New', monospace",
            color: '#0f172a',
            background: isError ? '#fef2f2' : isValid ? '#f0fdf4' : '#fff',
            outline: 'none', transition: 'border-color 0.15s',
          }}
        />
        {isValid && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: 14 }}>✓</span>}
        {isError && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ef4444', fontSize: 14 }}>✕</span>}
      </div>
      {isError && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444', fontFamily: "'DM Sans', sans-serif" }}>
          {fieldKey === 'confirmAccountNumber' ? "Account numbers don't match"
            : fieldKey === 'ifscCode' ? 'Invalid IFSC (e.g. SBIN0001234)'
            : fieldKey === 'panNumber' ? 'Invalid PAN (e.g. ABCDE1234F)'
            : 'Invalid account number (9–18 digits)'}
        </p>
      )}
      {!isError && (
        <p style={{ margin: '3px 0 0', fontSize: 10, color: '#9ca3af', fontFamily: "'DM Sans', sans-serif" }}>
          {meta.hint}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step indicator
───────────────────────────────────────────────────────────────────────────── */
function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 20 : 6,
            background: i === current ? '#10b981' : '#e5e7eb',
          }}
          style={{ height: 6, borderRadius: 3, transition: 'all 0.25s ease' }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Amount display pill
───────────────────────────────────────────────────────────────────────────── */
function AmountPill({ amount, label }) {
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 20px', borderRadius: 12,
      background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
      border: '1.5px solid #6ee7b7',
    }}>
      <span style={{
        fontFamily: "'DM Mono', 'Courier New', monospace",
        fontSize: 28, fontWeight: 700, color: '#065f46', letterSpacing: -1,
      }}>
        ₹{amount.toLocaleString('en-IN')}
      </span>
      <span style={{ fontSize: 10.5, color: '#059669', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Gate screen — shown when no approved rewards exist
───────────────────────────────────────────────────────────────────────────── */
function GateScreen({ approvedCount, pendingCount, onClose }) {
  const hasPending = pendingCount > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '32px 28px', textAlign: 'center' }}
    >
      <motion.div
        animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
        transition={{ duration: 0.8, delay: 0.2 }}
        style={{ fontSize: 48, marginBottom: 16 }}
      >
        {hasPending ? '⏳' : '🔒'}
      </motion.div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 18, color: '#0f172a', margin: '0 0 8px' }}>
        {hasPending ? 'Rewards Pending Approval' : 'No Approved Rewards Yet'}
      </p>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#64748b', margin: '0 0 20px', lineHeight: 1.6 }}>
        {hasPending
          ? `You have ${pendingCount} reward${pendingCount > 1 ? 's' : ''} waiting for admin approval. Once approved, you can withdraw. This usually takes 24–48 hours.`
          : 'Start referring friends to earn Special Offer rewards. Each friend who completes KYC earns you ₹100.'}
      </p>
      {hasPending && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: '#fffbeb', borderRadius: 10, border: '1px solid #fcd34d',
          marginBottom: 16, textAlign: 'left',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            Your {pendingCount} pending reward{pendingCount > 1 ? 's' : ''} will be reviewed by our team. You'll receive a notification once approved.
          </p>
        </div>
      )}
      <button
        onClick={onClose}
        style={{
          padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e5e7eb',
          background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif",
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}
      >
        Got it
      </button>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Modal
───────────────────────────────────────────────────────────────────────────── */

const STEPS = ['bank', 'details', 'confirm'];

const SpecialOfferWithdrawModal = ({
  isOpen,
  onClose,
  approvedCount   = 0,
  approvedAmountINR = 0,
  pendingCount    = 0,
  rewardPer       = 100,
  onSubmit,
  loading         = false,
}) => {
  const [step,         setStep]         = useState('gate'); // 'gate' | 'bank' | 'details' | 'confirm' | 'success'
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankSearch,   setBankSearch]   = useState('');
  const [form,         setForm]         = useState({ accountNumber: '', confirmAccountNumber: '', ifscCode: '', panNumber: '' });
  const [touched,      setTouched]      = useState({});

  /* ── Reset when opened ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    setSelectedBank(null);
    setBankSearch('');
    setForm({ accountNumber: '', confirmAccountNumber: '', ifscCode: '', panNumber: '' });
    setTouched({});
    // Determine initial step based on approval state
    setStep(approvedCount > 0 ? 'bank' : 'gate');
  }, [isOpen, approvedCount]);

  /* ── Bank filter ────────────────────────────────────────────────────────── */
  const filteredBanks = useMemo(() => {
    const q = bankSearch.toLowerCase();
    return q ? BANKS.filter(b => b.name.toLowerCase().includes(q) || b.abbr.toLowerCase().includes(q)) : BANKS;
  }, [bankSearch]);

  /* ── Field change ───────────────────────────────────────────────────────── */
  const handleChange = useCallback((key, value) => {
    const formatted = (key === 'ifscCode' || key === 'panNumber') ? value.toUpperCase() : value;
    setForm(p => ({ ...p, [key]: formatted }));
    setTouched(p => ({ ...p, [key]: true }));
  }, []);

  const handleBlur = useCallback((key) => setTouched(p => ({ ...p, [key]: true })), []);

  const handleBankSelect = useCallback((bank) => {
    setSelectedBank(bank);
    setForm(p => ({
      ...p,
      ifscCode: p.ifscCode.startsWith(bank.ifscPrefix) ? p.ifscCode : bank.ifscPrefix,
    }));
  }, []);

  const isFormValid = useMemo(
    () => FIELD_ORDER.every(k => validators[k]?.(form[k], form)),
    [form]
  );

  const touchAll = useCallback(() => {
    const t = {};
    FIELD_ORDER.forEach(k => { t[k] = true; });
    setTouched(t);
  }, []);

  /* ── Navigation ─────────────────────────────────────────────────────────── */
  const gotoDetails = () => {
    if (!selectedBank) { toast.info('Please select a bank first'); return; }
    setStep('details');
  };

  const gotoConfirm = () => {
    touchAll();
    if (!isFormValid) { toast.error('Please fix the errors above'); return; }
    setStep('confirm');
  };

  /* ── Submit ─────────────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(() => {
    if (!isFormValid || loading) return;
    onSubmit(
      { ...form, bankName: selectedBank?.name },
      () => setStep('success'),
    );
  }, [form, isFormValid, loading, onSubmit, selectedBank]);

  /* ── Step index for dots ────────────────────────────────────────────────── */
  const stepIndex = STEPS.indexOf(step);

  if (!isOpen) return null;

  return (
    <BaseModal onClose={step !== 'success' ? onClose : undefined}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        .sow-banks { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }
        @media(max-width:460px) { .sow-banks { grid-template-columns: repeat(3,1fr); } }
        .sow-scroll { max-height: 210px; overflow-y: auto; padding-right: 2px; }
        .sow-scroll::-webkit-scrollbar { width: 3px; }
        .sow-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .sow-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .sow-search { width:100%; box-sizing:border-box; padding:9px 12px; border-radius:9px;
          border:1.5px solid #e5e7eb; font-family:'DM Sans',sans-serif; font-size:13px;
          color:#374151; outline:none; }
        .sow-search:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,0.1); }
        @keyframes sow-spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{
        borderRadius: 20, overflow: 'hidden', background: '#fff',
        width: '100%', maxWidth: 460,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        <AnimatePresence mode="wait">

          {/* ── GATE: no approved rewards ───────────────────────────────── */}
          {step === 'gate' && (
            <motion.div key="gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>Withdraw Rewards</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>Special Offer</p>
                </div>
                <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              <GateScreen approvedCount={approvedCount} pendingCount={pendingCount} onClose={onClose} />
            </motion.div>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────────── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: '44px 28px', textAlign: 'center' }}
            >
              <motion.div
                animate={{ scale: [0, 1.25, 1], rotate: [0, -15, 0] }}
                transition={{ duration: 0.65 }}
                style={{ fontSize: 56, marginBottom: 16 }}
              >
                🎉
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <p style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>
                  Withdrawal Requested!
                </p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                  ₹{approvedAmountINR.toLocaleString('en-IN')} will be processed<br />
                  to <strong style={{ color: '#374151' }}>{selectedBank?.name}</strong><br />
                  within 24–48 business hours.
                </p>
                <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Done
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── MAIN FORM STEPS ─────────────────────────────────────────── */}
          {(step === 'bank' || step === 'details' || step === 'confirm') && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Header */}
              <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>
                      Withdraw{' '}
                      <span style={{ color: '#10b981' }}>₹{approvedAmountINR.toLocaleString('en-IN')}</span>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>
                      {approvedCount} approved reward{approvedCount !== 1 ? 's' : ''} · Special Offer
                    </p>
                  </div>
                  <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                </div>
                <StepDots current={stepIndex} total={STEPS.length} />
              </div>

              {/* Progress bar (details step) */}
              {step === 'details' && (
                <div style={{ height: 3, background: '#f1f5f9' }}>
                  <motion.div
                    style={{ height: '100%', background: 'linear-gradient(90deg,#10b981,#34d399)', borderRadius: 2 }}
                    animate={{ width: `${(FIELD_ORDER.filter(k => validators[k]?.(form[k], form)).length / FIELD_ORDER.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}

              {/* Body */}
              <div style={{ padding: '16px 20px', maxHeight: '52vh', overflowY: 'auto', background: '#fff' }}>
                <AnimatePresence mode="wait">

                  {/* STEP 1: Bank Picker */}
                  {step === 'bank' && (
                    <motion.div key="bank" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                      <input
                        className="sow-search"
                        placeholder="🔍  Search bank…"
                        value={bankSearch}
                        onChange={e => setBankSearch(e.target.value)}
                        style={{ marginBottom: 10 }}
                      />
                      {selectedBank && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 10,
                            background: selectedBank.bg,
                            border: `1.5px solid ${selectedBank.color}44`, marginBottom: 10,
                          }}
                        >
                          <BankLogo ifscPrefix={selectedBank.ifscPrefix} abbr={selectedBank.abbr} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 12.5, color: selectedBank.color, fontFamily: "'DM Sans', sans-serif" }}>{selectedBank.name}</p>
                            <p style={{ margin: 0, fontSize: 10.5, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif" }}>Prefix: {selectedBank.ifscPrefix}…</p>
                          </div>
                          <span style={{ color: selectedBank.color, fontSize: 16 }}>✓</span>
                        </motion.div>
                      )}
                      <div className="sow-scroll">
                        {filteredBanks.length === 0
                          ? <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '20px 0', fontFamily: "'DM Sans', sans-serif" }}>No banks found</p>
                          : (
                            <div className="sow-banks">
                              {filteredBanks.map(bank => (
                                <BankCard
                                  key={bank.name}
                                  bank={bank}
                                  selected={selectedBank?.name === bank.name}
                                  onClick={() => handleBankSelect(bank)}
                                />
                              ))}
                            </div>
                          )
                        }
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: Account Details */}
                  {step === 'details' && (
                    <motion.div key="details" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      {FIELD_ORDER.map(key => (
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
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                        background: '#f0fdf4', borderRadius: 9, border: '1px solid #bbf7d0',
                      }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>🔒</span>
                        <p style={{ margin: 0, fontSize: 11, color: '#166534', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                          Bank details are encrypted and used solely for reward payouts.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: Confirm */}
                  {step === 'confirm' && (
                    <motion.div key="confirm" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      style={{ textAlign: 'center' }}
                    >
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                        Confirming withdrawal
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                        <AmountPill amount={approvedAmountINR} label={`${approvedCount} approved reward${approvedCount !== 1 ? 's' : ''}`} />
                      </div>
                      {/* Bank summary */}
                      {selectedBank && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                          borderRadius: 12, background: selectedBank.bg,
                          border: `1.5px solid ${selectedBank.color}44`, marginBottom: 14, textAlign: 'left',
                        }}>
                          <BankLogo ifscPrefix={selectedBank.ifscPrefix} abbr={selectedBank.abbr} size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: selectedBank.color, fontFamily: "'DM Sans', sans-serif" }}>{selectedBank.name}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 11.5, fontFamily: "'DM Mono', 'Courier New', monospace", color: '#475569' }}>
                              {form.accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                            </p>
                            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', 'Courier New', monospace" }}>
                              {form.ifscCode}
                            </p>
                          </div>
                        </div>
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                        background: '#fff7ed', borderRadius: 9, border: '1px solid #fed7aa',
                        textAlign: 'left',
                      }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>⏱️</span>
                        <p style={{ margin: 0, fontSize: 11.5, color: '#9a3412', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                          Processing takes <strong>24–48 business hours</strong>. Once submitted, this cannot be cancelled. Ensure your bank details are correct.
                        </p>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', gap: 8 }}>
                {/* Cancel / Back */}
                {step === 'bank' && (
                  <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: 'none', color: '#64748b', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
                {step === 'details' && (
                  <button onClick={() => setStep('bank')} style={{ padding: '10px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: 'none', color: '#374151', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    ← Bank
                  </button>
                )}
                {step === 'confirm' && (
                  <button onClick={() => setStep('details')} style={{ padding: '10px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: 'none', color: '#374151', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    ← Edit
                  </button>
                )}

                {/* Primary action */}
                {step === 'bank' && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={gotoDetails}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none',
                      background: selectedBank ? 'linear-gradient(135deg,#1e40af,#4f46e5)' : '#e5e7eb',
                      color: selectedBank ? '#fff' : '#9ca3af',
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
                      cursor: selectedBank ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                    disabled={!selectedBank}
                  >
                    Next: Account Details →
                  </motion.button>
                )}

                {step === 'details' && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={gotoConfirm}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none',
                      background: isFormValid ? 'linear-gradient(135deg,#1e40af,#4f46e5)' : '#e5e7eb',
                      color: isFormValid ? '#fff' : '#9ca3af',
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
                      cursor: isFormValid ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                    disabled={!isFormValid}
                  >
                    Review & Confirm →
                  </motion.button>
                )}

                {step === 'confirm' && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none',
                      background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#059669,#047857)',
                      color: loading ? '#9ca3af' : '#fff',
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                  >
                    {loading ? (
                      <>
                        <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'sow-spin 0.7s linear infinite', display: 'inline-block' }} />
                        Processing…
                      </>
                    ) : '✓ Confirm Withdrawal'}
                  </motion.button>
                )}
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </BaseModal>
  );
};

export default SpecialOfferWithdrawModal;