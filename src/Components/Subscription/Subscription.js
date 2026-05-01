// src/components/Subscription/Subscription.js
//
// UPGRADE: Users can now apply approved Special Offer rewards as a
// discount/credit toward any yearly subscription plan.
//
// New UX additions:
//   • CreditPanel — displayed at the top when the user has approved SO rewards,
//     showing available credit and a live breakdown for each plan.
//   • Per-plan card shows "After Credit" price when credit is applicable.
//   • Two payment paths:
//       a) Partial credit  → standard Razorpay order for the discounted amount
//       b) Full credit     → direct activation, no Razorpay needed
//   • Invoice popup still works after either payment path.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSubscription } from '../../Context/Subscription/SubscriptionContext';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import InvoicePopup from './InvoicePopup';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL;

const PLANS = [
  {
    name: 'Basic',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    glow: 'rgba(59, 130, 246, 0.45)',
    actualPackage: 2999,
    discountedAmount: 2500,
    monthlyDisplay: '₹ 208',
    save: 499,
    badge: null,
    referral: [
      { label: '3 Referrals', reward: '₹ 2,500' },
      { label: '6 Referrals', reward: '₹ 2,500' },
      { label: '10 Referrals', reward: '₹ 3,000' },
    ],
    post: [
      { label: '30–150 Posts', reward: '₹ 500/Slab' },
      { label: '300 Posts', reward: '₹ 1,000' },
      { label: '600 Posts', reward: '₹ 1,200' },
      { label: '1000 Posts', reward: '₹ 1,500' },
    ],
    streak: [
      { label: '30–210 Days', reward: '₹ 500/Slab' },
      { label: '240–360 Days', reward: '₹ 1,000/Slab' },
    ],
  },
  {
    name: 'Standard',
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    glow: 'rgba(139, 92, 246, 0.45)',
    actualPackage: 4199,
    discountedAmount: 3500,
    monthlyDisplay: '₹ 292',
    save: 699,
    badge: 'Most Popular',
    referral: [
      { label: '3 Referrals', reward: '₹ 3,500' },
      { label: '6 Referrals', reward: '₹ 3,500' },
      { label: '10 Referrals', reward: '₹ 4,000' },
    ],
    post: [
      { label: '30–150 Posts', reward: '₹ 1,000/Slab' },
      { label: '300 Posts', reward: '₹ 1,500' },
      { label: '600 Posts', reward: '₹ 1,800' },
      { label: '1000 Posts', reward: '₹ 2,200' },
    ],
    streak: [
      { label: '30–210 Days', reward: '₹ 1,000/Slab' },
      { label: '240–360 Days', reward: '₹ 1,500/Slab' },
    ],
  },
  {
    name: 'Premium',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    glow: 'rgba(245, 158, 11, 0.45)',
    actualPackage: 5499,
    discountedAmount: 4500,
    monthlyDisplay: '₹ 375',
    save: 999,
    badge: 'Best Value',
    referral: [
      { label: '3 Referrals', reward: '₹ 4,500' },
      { label: '6 Referrals', reward: '₹ 4,500' },
      { label: '10 Referrals', reward: '₹ 5,500' },
    ],
    post: [
      { label: '30–150 Posts', reward: '₹ 2,000/Slab' },
      { label: '300 Posts', reward: '₹ 5,500' },
      { label: '600 Posts', reward: '₹ 3,000' },
      { label: '1000 Posts', reward: '₹ 3,500' },
    ],
    streak: [
      { label: '30–210 Days', reward: '₹ 1,500/Slab' },
      { label: '240–360 Days', reward: '₹ 2,000/Slab' },
    ],
  },
];

// ── Credit Panel ──────────────────────────────────────────────────────────────

function CreditPanel({ approvedCredit, useCredit, setUseCredit }) {
  if (approvedCredit <= 0) return null;

  return (
    <div className="sub-credit-panel">
      <div className="sub-credit-panel__inner">
        <div className="sub-credit-panel__icon">🎁</div>
        <div className="sub-credit-panel__body">
          <p className="sub-credit-panel__title">
            Special Offer Credit Available
          </p>
          <p className="sub-credit-panel__amount">
            ₹{approvedCredit.toLocaleString('en-IN')} approved rewards
          </p>
          <p className="sub-credit-panel__desc">
            Apply your Special Offer earnings as a discount on any yearly plan.
          </p>
        </div>
        <label className="sub-credit-toggle" aria-label="Apply Special Offer credit">
          <input
            type="checkbox"
            checked={useCredit}
            onChange={e => setUseCredit(e.target.checked)}
            className="sub-credit-toggle__input"
          />
          <span className="sub-credit-toggle__knob" />
        </label>
      </div>

      {useCredit && (
        <div className="sub-credit-breakdown">
          {PLANS.map(p => {
            const credit  = Math.min(approvedCredit, p.discountedAmount - 1);
            const payable = p.discountedAmount - credit;
            const isFree  = credit >= p.discountedAmount - 1;
            return (
              <div key={p.name} className="sub-credit-breakdown__row">
                <span className="sub-credit-breakdown__plan">{p.name}</span>
                <span className="sub-credit-breakdown__calc">
                  <s>₹{p.discountedAmount.toLocaleString('en-IN')}</s>
                  <span className="sub-credit-breakdown__arrow">→</span>
                  {isFree
                    ? <span className="sub-credit-breakdown__free">FREE 🎉</span>
                    : <span className="sub-credit-breakdown__payable">₹{payable.toLocaleString('en-IN')}</span>}
                </span>
                <span className="sub-credit-breakdown__saved">
                  −₹{credit.toLocaleString('en-IN')} saved
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Referral Progress Card (unchanged) ───────────────────────────────────────

function ReferralProgressCard({ progress, user, onActivate }) {
  const pct = Math.min(100, Math.round((progress.referredCount / progress.target) * 100));

  return (
    <div className="sub-referral-card">
      <div className="sub-referral-card__header">
        <div className="sub-referral-card__icon">🎁</div>
        <div>
          <h3 className="sub-referral-card__title">Activate Free via Referrals</h3>
          <p className="sub-referral-card__subtitle">
            Invite <strong>{progress.target} friends</strong> and unlock your subscription — no payment needed
          </p>
        </div>
      </div>

      <div className="sub-progress-track">
        <div
          className="sub-progress-fill"
          style={{ width: `${pct}%` }}
          aria-valuenow={progress.referredCount}
          aria-valuemin={0}
          aria-valuemax={progress.target}
          role="progressbar"
        />
      </div>
      <div className="sub-progress-meta">
        <span>{progress.referredCount} of {progress.target} friends invited</span>
        <span className={progress.active ? 'sub-status--active' : 'sub-status--inactive'}>
          {progress.active
            ? `✓ Active · ${progress.activationMethod}`
            : `${Math.max(0, progress.target - progress.referredCount)} more to go`}
        </span>
      </div>

      <div className="sub-referral-card__actions">
        {!progress.active && (
          <button
            className={`sub-btn sub-btn--referral ${!progress.eligible ? 'sub-btn--disabled' : ''}`}
            disabled={!progress.eligible}
            onClick={onActivate}
          >
            {progress.eligible ? '🚀 Activate Now (Free)' : `Need ${Math.max(0, progress.target - progress.referredCount)} more referrals`}
          </button>
        )}
        {user?.referralId && (
          <button
            className="sub-btn sub-btn--copy"
            onClick={() => {
              navigator.clipboard.writeText(user.referralId);
              toast.success('Referral ID copied!');
            }}
          >
            📋 My ID: <strong>{user.referralId}</strong>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Income row ────────────────────────────────────────────────────────────────

function IncomeRow({ icon, label, reward }) {
  return (
    <div className="sub-income-row">
      <span className="sub-income-row__label">{icon} {label}</span>
      <span className="sub-income-row__reward">{reward}</span>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, isActive, onSubscribe, onViewInvoice, loading, creditApplied, useCredit }) {
  const [expanded, setExpanded] = useState(false);

  const payableINR = useCredit
    ? plan.discountedAmount - Math.min(creditApplied, plan.discountedAmount - 1)
    : plan.discountedAmount;
  const isFreeWithCredit = useCredit && creditApplied >= plan.discountedAmount;
  const savedWithCredit  = useCredit ? Math.min(creditApplied, plan.discountedAmount - 1) : 0;

  return (
    <div className={`sub-plan-card ${plan.badge === 'Most Popular' ? 'sub-plan-card--featured' : ''} ${isActive ? 'sub-plan-card--active' : ''}`}>
      {plan.badge && (
        <div className="sub-plan-badge" style={{ background: plan.gradient }}>
          {plan.badge}
        </div>
      )}

      {isActive && (
        <div className="sub-plan-active-ribbon">✓ Current Plan</div>
      )}

      {/* Header */}
      <div className="sub-plan-card__header" style={{ background: plan.gradient }}>
        <h3 className="sub-plan-card__name">{plan.name}</h3>
        <div className="sub-plan-card__pricing">
          <span className="sub-plan-card__original">₹ {plan.actualPackage.toLocaleString()}</span>
          {useCredit && savedWithCredit > 0 ? (
            <>
              <span className="sub-plan-card__original-crossed">₹ {plan.discountedAmount.toLocaleString()}</span>
              {isFreeWithCredit
                ? <span className="sub-plan-card__free-badge">FREE</span>
                : <span className="sub-plan-card__price">₹ {payableINR.toLocaleString()}</span>
              }
            </>
          ) : (
            <span className="sub-plan-card__price">₹ {plan.discountedAmount.toLocaleString()}</span>
          )}
          {!isFreeWithCredit && <span className="sub-plan-card__period">/ year</span>}
        </div>

        {useCredit && savedWithCredit > 0 && (
          <div className="sub-plan-card__credit-tag">
            🎁 −₹{savedWithCredit.toLocaleString('en-IN')} Special Offer credit applied
          </div>
        )}

        {!useCredit && (
          <div className="sub-plan-card__monthly">{plan.monthlyDisplay} / month</div>
        )}
        <div className="sub-plan-card__save">🏷️ Save ₹ {plan.save}</div>
      </div>

      {/* Income Sections */}
      <div className="sub-plan-card__body">
        <div className="sub-income-section">
          <div className="sub-income-section__title">
            <span>🤝 Referral Income</span>
            <span className="sub-income-section__tag">One-Time</span>
          </div>
          {plan.referral.map((r, i) => (
            <IncomeRow key={i} icon="›" label={r.label} reward={r.reward} />
          ))}
        </div>

        <div className="sub-income-section">
          <div className="sub-income-section__title">
            <span>🔥 Streak Income</span>
            <span className="sub-income-section__tag">One-Time</span>
          </div>
          {plan.streak.map((s, i) => (
            <IncomeRow key={i} icon="›" label={s.label} reward={s.reward} />
          ))}
        </div>

        <div className="sub-income-section">
          <div
            className="sub-income-section__title sub-income-section__title--toggle"
            onClick={() => setExpanded(e => !e)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            <span>📝 Post Income</span>
            <span className="sub-income-section__tag sub-income-section__tag--monthly">Monthly</span>
            <span className="sub-income-section__toggle">{expanded ? '▲' : '▼'}</span>
          </div>
          {expanded && plan.post.map((p, i) => (
            <IncomeRow key={i} icon="›" label={p.label} reward={p.reward} />
          ))}
          {!expanded && (
            <p className="sub-income-section__hint">Tap to view post income tiers ▼</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="sub-plan-card__footer">
        {isFreeWithCredit ? (
          <button
            className="sub-btn sub-btn--free-activate"
            style={{ '--plan-gradient': 'linear-gradient(135deg,#059669,#047857)', '--plan-glow': 'rgba(5,150,105,0.4)' }}
            onClick={() => onSubscribe(plan, true)}
            disabled={loading === plan.name}
            aria-label={`Activate ${plan.name} free with credit`}
          >
            {loading === plan.name
              ? <span className="sub-btn__spinner" />
              : '🎁 Activate Free with Credit'}
          </button>
        ) : (
          <button
            className="sub-btn sub-btn--subscribe"
            style={{ '--plan-gradient': plan.gradient, '--plan-glow': plan.glow }}
            onClick={() => onSubscribe(plan, false)}
            disabled={loading === plan.name}
            aria-label={`Subscribe to ${plan.name} plan`}
          >
            {loading === plan.name
              ? <span className="sub-btn__spinner" />
              : isActive
              ? 'Renew Plan'
              : useCredit && savedWithCredit > 0
              ? `Pay ₹${payableINR.toLocaleString('en-IN')} via UPI / Card`
              : 'Subscribe via UPI / Card'}
          </button>
        )}

        {isActive && (
          <button className="sub-btn sub-btn--invoice" onClick={onViewInvoice}>
            📄 View Invoice
          </button>
        )}
      </div>
    </div>
  );
}

// ── Receipt / Confirmation Modal ──────────────────────────────────────────────

function PaymentReceiptModal({ show, onClose, receipt }) {
  if (!show || !receipt) return null;

  const {
    planName, planAmountINR, creditApplied, paidAmount, expiresAt,
  } = receipt;

  const isFree = paidAmount === 0;

  return (
    <div
      className="sub-receipt-overlay"
      role="dialog"
      aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="sub-receipt-modal">
        <div className="sub-receipt-modal__top">
          <span className="sub-receipt-modal__emoji">{isFree ? '🎉' : '✅'}</span>
          <h2 className="sub-receipt-modal__title">
            {isFree ? 'Activated Free!' : 'Payment Successful!'}
          </h2>
          <p className="sub-receipt-modal__subtitle">
            {planName} plan is now active
          </p>
        </div>

        <div className="sub-receipt-modal__rows">
          <div className="sub-receipt-modal__row">
            <span>Plan</span>
            <strong>{planName}</strong>
          </div>
          <div className="sub-receipt-modal__row">
            <span>Plan Price</span>
            <span>₹{planAmountINR?.toLocaleString('en-IN')}</span>
          </div>
          {creditApplied > 0 && (
            <div className="sub-receipt-modal__row sub-receipt-modal__row--credit">
              <span>🎁 Special Offer Credit</span>
              <span>−₹{creditApplied.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="sub-receipt-modal__row sub-receipt-modal__row--total">
            <span>You Paid</span>
            <strong>{paidAmount === 0 ? 'FREE' : `₹${paidAmount.toLocaleString('en-IN')}`}</strong>
          </div>
          <div className="sub-receipt-modal__row">
            <span>Valid Until</span>
            <span>
              {expiresAt
                ? new Date(expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '1 year'}
            </span>
          </div>
        </div>

        <button className="sub-btn sub-btn--subscribe sub-receipt-modal__close" onClick={onClose}
          style={{ '--plan-gradient': 'linear-gradient(135deg,#059669,#047857)', '--plan-glow': 'rgba(5,150,105,0.4)', width: '100%', marginTop: 0 }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Subscription() {
  const { showSubscription, closeSubscription } = useSubscription();
  const { user, authtoken } = useAuth();
  const [showInvoice, setShowInvoice]   = useState(false);
  const [loadingPlan, setLoadingPlan]   = useState(null);
  const [useCredit,   setUseCredit]     = useState(false);
  const [receipt,     setReceipt]       = useState(null);
  const [showReceipt, setShowReceipt]   = useState(false);
  const [progress, setProgress] = useState({
    loading: true,
    referredCount: 0,
    target: 10,
    eligible: false,
    active: false,
    activationMethod: null,
  });

  // Fetch approved Special Offer credit from user's lockedRewards
  const approvedCredit = useMemo(() => {
    if (!user?.lockedRewards?.length) return 0;
    return user.lockedRewards
      .filter(r => r.type === 'special_offer' && r.status === 'approved')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [user]);

  // Fetch referral progress when modal opens
  const fetchProgress = useCallback(async () => {
    if (!authtoken) return;
    try {
      const res = await apiRequest.get(`${BACKEND_URL}/api/payment/progress`, {
        headers: { Authorization: `Bearer ${authtoken}` },
      });
      const data = await res.json();
      if (data.success) {
        setProgress({
          loading: false,
          referredCount: data.referredCount,
          target: data.target,
          eligible: data.eligible,
          active: data.active,
          activationMethod: data.activationMethod,
        });
      } else {
        setProgress(p => ({ ...p, loading: false }));
      }
    } catch {
      setProgress(p => ({ ...p, loading: false }));
    }
  }, [authtoken]);

  useEffect(() => {
    if (showSubscription) fetchProgress();
  }, [showSubscription, fetchProgress]);

  useEffect(() => {
    document.body.style.overflow = showSubscription ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSubscription]);

  const handleActivateByReferrals = async () => {
    try {
      const res = await apiRequest.post(`${BACKEND_URL}/api/payment/activate-by-referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authtoken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.warn(data.message || 'Not eligible yet');
        return;
      }
      toast.success('🎉 Subscription activated via referrals!');
      fetchProgress();
    } catch {
      toast.error('Server error. Please try again.');
    }
  };

  // ── Subscribe handler (handles credit + non-credit paths) ────────────────
  const handleSubscribe = async (plan, activateFreeWithCredit = false) => {
    if (!user || !user.name || !user.email || !authtoken) {
      toast.error('Please log in before subscribing.');
      return;
    }

    setLoadingPlan(plan.name);

    try {
      // PATH A: Fully free with credit — no Razorpay needed
      if (activateFreeWithCredit || (useCredit && approvedCredit >= plan.discountedAmount)) {
        const res = await apiRequest.post(`${BACKEND_URL}/api/payment/activate-free-with-credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authtoken}` },
          body: JSON.stringify({ planName: plan.name }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          toast.error(data.error || 'Activation failed. Please try again.');
          return;
        }

        setReceipt({
          planName: plan.name,
          planAmountINR: plan.discountedAmount,
          creditApplied: data.creditApplied ?? 0,
          paidAmount: 0,
          expiresAt: data.expiresAt,
        });
        setShowReceipt(true);
        toast.success(`🎉 ${plan.name} plan activated with Special Offer credit!`);
        closeSubscription();
        return;
      }

      // PATH B: Partial credit or no credit → Razorpay order
      let orderData;
      if (useCredit && approvedCredit > 0) {
        // Create discounted order
        const orderRes = await apiRequest.post(`${BACKEND_URL}/api/payment/create-order-with-credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authtoken}` },
          body: JSON.stringify({ planName: plan.name }),
        });
        orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.error || 'Order creation failed');
      } else {
        // Standard order (no credit)
        const orderRes = await apiRequest.post(`${BACKEND_URL}/api/payment/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authtoken}` },
          body: JSON.stringify({ planName: plan.name }),
        });
        orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.error || 'Order creation failed');
      }

      const creditSummary = orderData.creditSummary ?? {
        creditAppliedINR: 0,
        payableINR: plan.discountedAmount,
      };

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY || 'rzp_test_dRxYFu51QjtKuF',
        amount: orderData.order.amount,
        currency: 'INR',
        name: 'SoShoLife',
        description: useCredit && creditSummary.creditAppliedINR > 0
          ? `${plan.name} Plan · ₹${creditSummary.creditAppliedINR} credit applied`
          : `${plan.name} Annual Subscription`,
        order_id: orderData.order.id,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || '',
        },
        method: { upi: true, card: true, netbanking: true, wallet: true },
        handler: async (response) => {
          try {
            const verifyEndpoint = useCredit && creditSummary.creditAppliedINR > 0
              ? '/api/payment/verify-with-credit'
              : '/api/payment/verify';

            const verifyRes = await fetch(`${BACKEND_URL}${verifyEndpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authtoken}` },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                planName:            plan.name,
                creditAppliedINR:    creditSummary.creditAppliedINR ?? 0,
              }),
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              setReceipt({
                planName:       plan.name,
                planAmountINR:  plan.discountedAmount,
                creditApplied:  verifyData.creditApplied ?? creditSummary.creditAppliedINR ?? 0,
                paidAmount:     creditSummary.payableINR ?? plan.discountedAmount,
                expiresAt:      verifyData.expiresAt,
              });
              setShowReceipt(true);
              toast.success(`🎉 ${plan.name} plan activated!`);
              closeSubscription();
            } else {
              toast.error('Payment verification failed. Contact support.');
            }
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: { ondismiss: () => setLoadingPlan(null) },
        theme: { color: plan.color },
      };

      const razor = new window.Razorpay(options);
      razor.on('payment.failed', (res) => {
        toast.error(`Payment failed: ${res.error?.description || 'Try again.'}`);
        setLoadingPlan(null);
      });
      razor.open();
    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Could not initiate payment. Try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  if (!showSubscription) return null;

  return (
    <>
      <div
        className="sub-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Subscription Plans"
        onClick={e => e.target === e.currentTarget && closeSubscription()}
      >
        <div className="sub-modal">
          {/* Close button */}
          <button
            className="sub-close"
            onClick={closeSubscription}
            aria-label="Close subscription modal"
          >
            ✕
          </button>

          {/* Hero */}
          <div className="sub-hero">
            <div className="sub-hero__eyebrow">💰 Earn While You Post</div>
            <h1 className="sub-hero__title">Pick Your Income Plan</h1>
            <p className="sub-hero__sub">
              Billed annually · Cancel anytime · 1-year subscription
            </p>
          </div>

          {/* Special Offer Credit Panel */}
          <div className="sub-section">
            <CreditPanel
              approvedCredit={approvedCredit}
              useCredit={useCredit}
              setUseCredit={setUseCredit}
            />
          </div>

          {/* Referral Card */}
          {!progress.loading && (
            <div className="sub-section">
              <ReferralProgressCard
                progress={progress}
                user={user}
                onActivate={handleActivateByReferrals}
              />
            </div>
          )}

          {/* Plan Cards */}
          <div className="sub-plans-grid">
            {PLANS.map(plan => (
              <PlanCard
                key={plan.name}
                plan={plan}
                isActive={!!(user?.subscription?.active && user?.subscription?.plan === plan.name)}
                onSubscribe={handleSubscribe}
                onViewInvoice={() => setShowInvoice(true)}
                loading={loadingPlan}
                creditApplied={approvedCredit}
                useCredit={useCredit}
              />
            ))}
          </div>

          {/* Trust footer */}
          <div className="sub-trust">
            <span>🔒 Secured by Razorpay</span>
            <span>·</span>
            <span>💳 UPI, Card, Net Banking</span>
            <span>·</span>
            <span>📧 Invoice sent to your email</span>
          </div>
        </div>

        {/* Invoice popup */}
        <InvoicePopup show={showInvoice} onClose={() => setShowInvoice(false)} />
      </div>

      {/* Payment Receipt Modal (shown after modal close) */}
      <PaymentReceiptModal
        show={showReceipt}
        onClose={() => setShowReceipt(false)}
        receipt={receipt}
      />

      {/* CSS for new elements */}
      <style>{CREDIT_CSS}</style>
    </>
  );
}

// ── Scoped CSS for new credit UI ─────────────────────────────────────────────

const CREDIT_CSS = `
/* ── Credit Panel ── */
.sub-credit-panel {
  border-radius: 14px;
  border: 1.5px solid #6ee7b7;
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
  overflow: hidden;
  margin-bottom: 4px;
}
.sub-credit-panel__inner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}
.sub-credit-panel__icon {
  font-size: 28px;
  flex-shrink: 0;
}
.sub-credit-panel__body {
  flex: 1;
  min-width: 0;
}
.sub-credit-panel__title {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 700;
  color: #065f46;
  font-family: 'DM Sans', sans-serif;
}
.sub-credit-panel__amount {
  margin: 0 0 2px;
  font-size: 20px;
  font-weight: 800;
  color: #059669;
  font-family: 'DM Mono', 'Courier New', monospace;
  letter-spacing: -0.5px;
}
.sub-credit-panel__desc {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  font-family: 'DM Sans', sans-serif;
}

/* Toggle */
.sub-credit-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}
.sub-credit-toggle__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.sub-credit-toggle__knob {
  display: block;
  width: 44px;
  height: 24px;
  background: #d1d5db;
  border-radius: 12px;
  position: relative;
  transition: background 0.2s ease;
}
.sub-credit-toggle__knob::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  transition: transform 0.2s ease;
}
.sub-credit-toggle__input:checked + .sub-credit-toggle__knob {
  background: #059669;
}
.sub-credit-toggle__input:checked + .sub-credit-toggle__knob::after {
  transform: translateX(20px);
}

/* Breakdown table */
.sub-credit-breakdown {
  border-top: 1.5px solid #a7f3d0;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sub-credit-breakdown__row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
}
.sub-credit-breakdown__plan {
  font-weight: 700;
  color: #374151;
  min-width: 70px;
}
.sub-credit-breakdown__calc {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  color: #6b7280;
}
.sub-credit-breakdown__arrow {
  color: #9ca3af;
}
.sub-credit-breakdown__free {
  font-weight: 800;
  color: #059669;
  font-family: 'DM Mono', 'Courier New', monospace;
}
.sub-credit-breakdown__payable {
  font-weight: 700;
  color: #0f172a;
  font-family: 'DM Mono', 'Courier New', monospace;
}
.sub-credit-breakdown__saved {
  font-size: 11px;
  color: #059669;
  font-weight: 600;
  background: #d1fae5;
  padding: 2px 7px;
  border-radius: 20px;
}

/* Plan card credit additions */
.sub-plan-card__original-crossed {
  font-size: 13px;
  color: rgba(255,255,255,0.55);
  text-decoration: line-through;
  margin-right: 4px;
}
.sub-plan-card__free-badge {
  font-size: 22px;
  font-weight: 900;
  color: #fff;
  background: rgba(255,255,255,0.2);
  padding: 2px 12px;
  border-radius: 8px;
  letter-spacing: 1px;
}
.sub-plan-card__credit-tag {
  font-size: 11px;
  color: rgba(255,255,255,0.85);
  background: rgba(0,0,0,0.15);
  border-radius: 20px;
  padding: 3px 10px;
  margin-top: 4px;
  display: inline-block;
}

/* Free activate button */
.sub-btn--free-activate {
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  border: none;
  background: var(--plan-gradient, linear-gradient(135deg,#059669,#047857));
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 15px var(--plan-glow, rgba(5,150,105,0.4));
  transition: transform 0.15s, box-shadow 0.15s;
}
.sub-btn--free-activate:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--plan-glow, rgba(5,150,105,0.4));
}

/* ── Receipt Modal ── */
.sub-receipt-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: rgba(10,15,40,0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: receipt-fade 0.2s ease;
}
@keyframes receipt-fade { from { opacity: 0 } to { opacity: 1 } }

.sub-receipt-modal {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 380px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,0.22);
  animation: receipt-slide 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes receipt-slide {
  from { opacity: 0; transform: translateY(20px) scale(0.96) }
  to   { opacity: 1; transform: none }
}
.sub-receipt-modal__top {
  padding: 32px 28px 20px;
  text-align: center;
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border-bottom: 1.5px solid #bbf7d0;
}
.sub-receipt-modal__emoji {
  font-size: 48px;
  display: block;
  margin-bottom: 10px;
}
.sub-receipt-modal__title {
  font-size: 22px;
  font-weight: 800;
  color: #065f46;
  margin: 0 0 4px;
  font-family: 'DM Sans', sans-serif;
}
.sub-receipt-modal__subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  font-family: 'DM Sans', sans-serif;
}
.sub-receipt-modal__rows {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.sub-receipt-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  font-size: 14px;
  color: #374151;
  font-family: 'DM Sans', sans-serif;
  border-bottom: 1px solid #f3f4f6;
}
.sub-receipt-modal__row:last-child {
  border-bottom: none;
}
.sub-receipt-modal__row--credit {
  color: #059669;
}
.sub-receipt-modal__row--total {
  font-size: 16px;
  padding-top: 14px;
  color: #0f172a;
}
.sub-receipt-modal__row--total strong {
  font-size: 20px;
  font-family: 'DM Mono', 'Courier New', monospace;
  color: #059669;
}
.sub-receipt-modal__close {
  margin: 0 24px 24px;
  width: calc(100% - 48px) !important;
}
`;