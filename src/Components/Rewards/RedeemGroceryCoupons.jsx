/**
 * RedeemGroceryCoupons.jsx
**/

import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import BankDetailsModal from '../Common/BankDetailsModal';

// ─── Asset ────────────────────────────────────────────────────────────────────
import RectaBtn from '../../Assets/RectaAcceptBtn.png';

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const MIN_REDEEM  = 499.99;   // minimum ₹ balance required to redeem

// localStorage key helpers — namespaced per user so multi-account devices work
const lsKey = (userId, suffix) => `rdcRedeem_${userId}_${suffix}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtINR = (n) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function getToken() {
  return localStorage.getItem('token');
}

// ─── localStorage persistence helpers ────────────────────────────────────────

/**
 * Read persisted redemption lock for a given user.
 * Returns { locked: boolean, redeemedAmount: number } or null if no lock exists.
 */
function readLock(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(lsKey(userId, 'lock'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Write a redemption lock for a given user.
 * @param {string} userId
 * @param {number} redeemedAmount  The balance that was just redeemed (₹)
 */

// ─── Gate-info modal (shown when user is ineligible) ─────────────────────────

function GateModal({ reason, onClose }) {
  return (
    <ModalShell onClose={onClose} title="Cannot Redeem">
      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: '#fef3c7', border: '1px solid #fde68a',
        marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          {reason}
        </p>
      </div>
      <ModalFooter>
        <BlueBtn onClick={onClose} style={{ minWidth: 80 }}>OK</BlueBtn>
      </ModalFooter>
    </ModalShell>
  );
}

// ─── Confirm-redeem modal ─────────────────────────────────────────────────────

function ConfirmModal({
  totalGroceryCoupons,
  hasBankDetails,
  onClose,
  onConfirm,
  onAddBank,
  submitting,
}) {
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!hasBankDetails) {
      toast.info('Please add your bank details before redeeming.');
      return;
    }
    onConfirm({ notes: notes.trim() });
  };

  return (
    <ModalShell onClose={!submitting ? onClose : undefined} title="Redeem Grocery Coupons">

      {/* ── What you're redeeming ── */}
      <div style={{
        padding: '18px 20px', borderRadius: 12,
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: '1px solid #bfdbfe', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 38, fontWeight: 700,
            color: '#1d4ed8', letterSpacing: -1, lineHeight: 1,
          }}>
            {fmtINR(totalGroceryCoupons)}
          </span>
          <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 500 }}>
            grocery coupons
          </span>
        </div>
        <p style={{
          margin: '8px 0 0', fontSize: 12,
          color: '#2563eb', lineHeight: 1.5,
        }}>
          This is a cash-equivalent reward. Once redeemed, our finance team
          will initiate the transfer to your bank account within 3–5 working days.
        </p>
      </div>

      {/* ── Non-cash assets clarification ── */}
      <div style={{
        display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10,
        background: 'var(--color-background-secondary, #f9fafb)',
        border: '1px solid var(--color-border-tertiary, #e5e7eb)',
        marginBottom: 16, fontSize: 12,
        color: 'var(--color-text-secondary, #6b7280)',
      }}>
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <span style={{ lineHeight: 1.6 }}>
          <strong>Shares</strong> and <strong>Referral Tokens</strong> are
          non-cash assets and are <em>not</em> included in this redemption.
          Only your grocery coupon balance ({fmtINR(totalGroceryCoupons)}) will be processed.
        </span>
      </div>

      {/* ── Bank details ── */}
      {!hasBankDetails && (
        <div style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 10,
          background: 'var(--color-background-secondary, #f9fafb)',
          border: '1px solid #fde68a',
        }}>
          <p style={{
            margin: '0 0 10px', fontSize: 12, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: '#92400e',
          }}>
            Bank details required for payment
          </p>
          <button
            type="button"
            onClick={onAddBank}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: '1.5px solid #6366f1',
              background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
              color: '#4338ca', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Add Bank Details
          </button>
        </div>
      )}

      {hasBankDetails && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 14px', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #86efac',
          marginBottom: 4, fontSize: 12, color: '#166534',
        }}>
          <span style={{ fontSize: 14 }}>✓</span>
          <span>Bank details are already on file — no re-entry needed.</span>
        </div>
      )}

      {/* ── Optional note ── */}
      <div style={{ marginTop: 14 }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--color-text-secondary, #6b7280)', marginBottom: 5,
        }}>
          Note (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional information for the finance team…"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 12px', fontSize: 12,
            border: '1px solid var(--color-border-secondary, #d1d5db)',
            borderRadius: 8, resize: 'vertical',
            background: 'var(--color-background-primary, #fff)',
            color: 'var(--color-text-primary, #111)',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      <ModalFooter>
        <button
          onClick={!submitting ? onClose : undefined}
          disabled={submitting}
          style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 500,
            border: '1px solid var(--color-border-secondary, #d1d5db)',
            borderRadius: 8, background: 'none',
            color: 'var(--color-text-secondary, #6b7280)',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: submitting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>

        {/* The glossy blue button for final confirm */}
        <BlueBtn
          onClick={handleSubmit}
          disabled={submitting}
          style={{ minWidth: 180 }}
        >
          {submitting ? 'Processing…' : `Redeem ${fmtINR(totalGroceryCoupons)}`}
        </BlueBtn>
      </ModalFooter>
    </ModalShell>
  );
}

// ─── Success modal ────────────────────────────────────────────────────────────

function SuccessModal({ amount, onClose }) {
  return (
    <ModalShell onClose={onClose} title="Redemption Requested 🎉">
      <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>

        {/* Animated checkmark */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 8px 24px rgba(34,197,94,0.35)',
          animation: 'rdc-pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <p style={{
          margin: '0 0 6px', fontFamily: '"Courier New", monospace',
          fontSize: 32, fontWeight: 700, color: '#16a34a', letterSpacing: -0.5,
        }}>
          {fmtINR(amount)}
        </p>
        <p style={{
          margin: '0 0 16px', fontSize: 13,
          color: 'var(--color-text-secondary, #6b7280)', lineHeight: 1.6,
        }}>
          Your grocery coupon redemption has been submitted.<br />
          Our finance team has been notified and will process<br />
          the bank transfer within <strong>3–5 working days</strong>.
        </p>

        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: '#eff6ff', border: '1px solid #bfdbfe',
          fontSize: 12, color: '#1d4ed8', lineHeight: 1.5, textAlign: 'left',
        }}>
          ℹ️ You'll receive an in-app notification once your payment has been
          dispatched. Check <strong>Activity → Payouts</strong> for status updates.
        </div>
      </div>

      <ModalFooter style={{ justifyContent: 'center' }}>
        <BlueBtn onClick={onClose} style={{ minWidth: 120 }}>Done</BlueBtn>
      </ModalFooter>

      <style>{`
        @keyframes rdc-pop {
          0%   { transform: scale(0);   opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </ModalShell>
  );
}

// ─── Shared modal shell ────────────────────────────────────────────────────────

function ModalShell({ children, onClose, title }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(2px)',
        animation: 'rdc-fade 0.18s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        style={{
          background: 'var(--color-background-primary, #fff)',
          borderRadius: 16, width: '100%', maxWidth: 480,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          maxHeight: '90vh', overflowY: 'auto',
          outline: 'none',
          animation: 'rdc-slide 0.22s cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <h2 style={{
            margin: 0, fontSize: 16, fontWeight: 600,
            color: 'var(--color-text-primary, #111)',
            fontFamily: 'inherit',
          }}>
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, color: 'var(--color-text-tertiary, #9ca3af)',
                lineHeight: 1, padding: 4, borderRadius: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes rdc-fade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rdc-slide { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
      `}</style>
    </div>
  );
}

function ModalFooter({ children, style = {} }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end',
      gap: 10, paddingTop: 14,
      borderTop: '1px solid var(--color-border-tertiary, #e5e7eb)',
      marginTop: 4,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── The glossy blue button (uses RectaAcceptBtn.png as background) ───────────

function BlueBtn({ children, onClick, disabled, style = {}, ...rest }) {
  const [hover, setHover]     = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      title='Redeem Your Grocery Cash'
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-disabled={disabled}
      style={{
        position: 'relative',
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed && !disabled
          ? 'scale(0.96)'
          : hover && !disabled
            ? 'scale(1.03)'
            : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.23,1,0.32,1)',
        opacity: disabled ? 0.55 : 1,
        filter: hover && !disabled && !pressed
          ? 'brightness(1.08)'
          : 'brightness(1)',
        ...style,
      }}
      {...rest}
    >
      {/* Label sits on top of the image */}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: '"Courier New", monospace',
        letterSpacing: 0.2,
        textShadow: '0 1px 3px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        padding: '0 22px',
        height: 46,
        whiteSpace: 'nowrap',
        backgroundImage: `url(${RectaBtn})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        borderRadius: 8,
        minWidth: 120,
      }}>
        {children}
      </span>
    </button>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

/**
 * @param {{
 *   totalGroceryCoupons : number,   // from wallet object
 *   eligible            : boolean,  // from useRewardEligibility
 *   user                : object,   // from useAuth
 *   onRedeemed          : Function, // optional – called after successful redemption
 * }} props
 */
export default function RedeemGroceryCoupons({
  totalGroceryCoupons = 0,
  eligible = false,
  user,
  onRedeemed,
}) {
  // ── Resolve stable user ID ─────────────────────────────────────────────────
  const userId = useMemo(
    () => (user?._id || user?.id)?.toString() ?? null,
    [user],
  );

  // ── Restore lock state from localStorage on first mount ───────────────────
  // lock = { locked: boolean, redeemedAmount: number } | null
  // eslint-disable-next-line
  const [lock, setLock] = useState(() => readLock(userId));

  // Optimistic flag — set immediately on API success so the button disables
  // and the balance shows ₹0 before the lock state / parent re-render settles.
  // eslint-disable-next-line
  const [justRedeemed, setJustRedeemed] = useState(false);

  const displayedCoupons = totalGroceryCoupons;

  const [phase, setPhase] = useState('idle');

  const [gateMsg,        setGateMsg]        = useState('');
  const [hasBankDetails, setHasBankDetails] = useState(null);
  const [successAmount,  setSuccessAmount]  = useState(0);


  const bankCheckedRef = useRef(false);

  // ── Whether the user is currently in a "redeemed" lock state ──────────────
  // const redeemed = justRedeemed || (!!lock && totalGroceryCoupons <= lock.redeemedAmount);

  const [redemptionStatus, setRedemptionStatus] = useState(null);

  useEffect(() => {
    if (!userId) return;
    apiRequest.get('/api/activity/redemption-status', { _silent: true })
      .then(r => setRedemptionStatus(r.data))
      .catch(() => {});
  }, [userId]);

  const hasPendingRedemption = redemptionStatus?.hasRedemption &&
    ['pending', 'processing', 'on_hold'].includes(redemptionStatus?.status);

  // ── Lazy bank-details check ────────────────────────────────────────────────
  const checkBankDetails = useCallback(async () => {
    if (bankCheckedRef.current) return hasBankDetails;
    try {
      const res = await apiRequest.get(
        `/api/auth/getloggeduser/${userId}`,
        { _silent: true },
      );
      const u = res.data?.user ?? res.data;
      const hasBD = !!(u?.bankDetails?.accountNumber && u?.bankDetails?.ifscCode);
      setHasBankDetails(hasBD);
      bankCheckedRef.current = true;
      return hasBD;
    } catch {
      setHasBankDetails(false);
      bankCheckedRef.current = true;
      return false;
    }
  }, [userId, hasBankDetails]);

  // ── Gate reason ────────────────────────────────────────────────────────────
  const getGateReason = useCallback(() => {
    if (!eligible) {
      return 'Complete KYC verification and activate a subscription before redeeming rewards.';
    }
    if (hasPendingRedemption) {
      return 'You have already submitted a redemption request. The button will re-enable once your current payout is processed and you earn new grocery coupons by reaching the next reward slab.';
    }
    if (totalGroceryCoupons < MIN_REDEEM) {
      return 'You have no grocery coupon balance to redeem. Earn grocery coupons by completing post, referral, or streak milestones.';
    }
    return null;
  }, [eligible, totalGroceryCoupons, hasPendingRedemption]);

  const handleButtonClick = useCallback(async () => {
    const gateReason = getGateReason();
    if (gateReason) {
      setGateMsg(gateReason);
      setPhase('gate');
      return;
    }

    setPhase('confirming_loading');
    await checkBankDetails();
    setPhase('confirm');
  }, [getGateReason, checkBankDetails]);

  // ── Redemption submit ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async ({ notes }) => {
    setPhase('submitting');
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/redeem-grocery-coupons`,
        { notes: notes || undefined },
      );

      // ── Backend now returns updated wallet in the response ──────────────
      // Use it immediately for optimistic update, then let refetch confirm it.
      // eslint-disable-next-line
      const newBalance = res.data?.wallet?.availableBalance ?? 0;

      setSuccessAmount(totalGroceryCoupons);
      setPhase('success');

      // Notify parent to refetch (this will update wallet.totalGroceryCoupons)
      onRedeemed?.();

    } catch (err) {
      if (err?.response?.status === 409) {
        toast.warn(err?.response?.data?.message || 'A redemption request is already pending.');
        setPhase('idle');
        return;
      }
      toast.error(err?.response?.data?.message || 'Redemption failed. Please try again.');
      setPhase('confirm');
    }
  }, [totalGroceryCoupons, onRedeemed]);

  const close = useCallback(() => setPhase('idle'), []);

  // ── BankDetailsModal state ─────────────────────────────────────────────────
  const [bankModalLoading, setBankModalLoading] = useState(false);
  const [bankModalOpen,    setBankModalOpen]    = useState(false);

  const handleBankDetailsSubmit = useCallback(async (formData, successCallback) => {
    setBankModalLoading(true);
    try {
      await apiRequest.post(
        `${BACKEND_URL}/api/auth/save-bank-details`,
        {
          accountNumber: formData.accountNumber,
          ifscCode:      formData.ifscCode,
          panNumber:     formData.panNumber,
          bankName:      formData.bankName,
        },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setHasBankDetails(true);
      bankCheckedRef.current = true;
      successCallback?.();
      setTimeout(() => {
        setBankModalOpen(false);
        setPhase((prev) =>
          prev === 'confirm' || prev === 'submitting' ? 'confirm' : prev,
        );
      }, 2500);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save bank details. Please try again.';
      toast.error(msg);
    } finally {
      setBankModalLoading(false);
    }
  }, []);

  // ── Derived button label ───────────────────────────────────────────────────
  const isReadyToRedeem = eligible && totalGroceryCoupons >= MIN_REDEEM && !hasPendingRedemption;

  const btnLabel = hasPendingRedemption
    ? '✓ Redemption Pending'
    : phase === 'confirming_loading'
      ? 'Loading…'
      : `Redeem ${fmtINR(displayedCoupons)}`;

  if (totalGroceryCoupons < MIN_REDEEM && !hasPendingRedemption) return null;

  return (
    <>
      {/* ── Divider + section heading ── */}
      <div style={{
        borderTop: '0.5px solid var(--color-border-tertiary, #e5e7eb)',
        margin: '20px 0 18px',
        paddingTop: 18,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>

          {/* ── Left: balance summary ── */}
          <div>
            <p style={{
              margin: '0 0 3px', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--color-text-tertiary, #9ca3af)',
              fontFamily: 'var(--font-sans, inherit)',
            }}>
              Cash Reward Available
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontFamily: '"Courier New", monospace',
                fontSize: 26, fontWeight: 700, letterSpacing: -0.5,
                color: displayedCoupons > 0
                  ? 'var(--color-text-primary, #111)'
                  : 'var(--color-text-tertiary, #9ca3af)',
              }}>
                {fmtINR(displayedCoupons)}
              </span>
              <span style={{
                fontSize: 12,
                color: 'var(--color-text-secondary, #6b7280)',
                fontFamily: 'var(--font-sans, inherit)',
              }}>
                grocery coupons
              </span>
            </div>

            {/* Non-cash notice */}
            <p style={{
              margin: '4px 0 0', fontSize: 11,
              color: 'var(--color-text-tertiary, #9ca3af)',
              fontFamily: 'var(--font-sans, inherit)',
            }}>
              Shares &amp; tokens are non-cash · not included
            </p>

            {/* ── Post-redeem "pending payout" notice ── */}
            {hasPendingRedemption && (
              <div style={{
                marginTop: 8,
                display: 'flex', alignItems: 'flex-start', gap: 6,
                padding: '8px 12px', borderRadius: 8,
                background: '#fffbeb', border: '1px solid #fde68a',
                maxWidth: 280,
              }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>⏳</span>
                <p style={{
                  margin: 0, fontSize: 11, lineHeight: 1.5,
                  color: '#92400e', fontFamily: 'var(--font-sans, inherit)',
                }}>
                  Payout pending. Balance will refresh once you reach your next reward slab.
                </p>
              </div>
            )}
          </div>

          {/* ── Right: the image button ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <BlueBtn
              onClick={handleButtonClick}
              disabled={
                phase === 'confirming_loading' ||
                phase === 'submitting'         ||
                hasPendingRedemption
              }
              style={{ opacity: isReadyToRedeem ? 1 : 0.6 }}
            >
              {btnLabel}
            </BlueBtn>

            {/* Lock hints */}
            {!isReadyToRedeem && !hasPendingRedemption && (
              <span style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary, #9ca3af)',
                fontFamily: 'var(--font-sans, inherit)',
              }}>
                {!eligible
                  ? '🔒 Complete KYC + subscription first'
                  : totalGroceryCoupons < MIN_REDEEM
                    ? '🛒 Earn grocery coupons to redeem'
                    : ''}
              </span>
            )}

            {hasPendingRedemption && (
              <span style={{
                fontSize: 11, color: '#b45309',
                fontFamily: 'var(--font-sans, inherit)',
              }}>
                🔒 Unlocks at next reward slab
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {phase === 'gate' && (
        <GateModal reason={gateMsg} onClose={close} />
      )}

      {(phase === 'confirm' || phase === 'submitting') && (
        <ConfirmModal
          totalGroceryCoupons={totalGroceryCoupons}
          hasBankDetails={hasBankDetails ?? false}
          onClose={phase !== 'submitting' ? close : undefined}
          onConfirm={handleConfirm}
          onAddBank={() => setBankModalOpen(true)}
          submitting={phase === 'submitting'}
        />
      )}

      {phase === 'success' && (
        <SuccessModal amount={successAmount} onClose={close} />
      )}

      {/* BankDetailsModal */}
      <BankDetailsModal
        isOpen={bankModalOpen}
        onClose={() => {
          setBankModalOpen(false);
        }}
        loading={bankModalLoading}
        onSubmit={handleBankDetailsSubmit}
      />
    </>
  );
}