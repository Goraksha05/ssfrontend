// src/components/Subscription/Subscription.js
import React, { useEffect, useState, useCallback } from 'react';
import { useSubscription } from '../../Context/Subscription/SubscriptionContext';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import InvoicePopup from './InvoicePopup';
import { toast } from 'react-toastify';

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

// ── Sub-components ──────────────────────────────────────────────────────────

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

function IncomeRow({ icon, label, reward }) {
  return (
    <div className="sub-income-row">
      <span className="sub-income-row__label">{icon} {label}</span>
      <span className="sub-income-row__reward">{reward}</span>
    </div>
  );
}

function PlanCard({ plan, isActive, onSubscribe, onViewInvoice, loading }) {
  const [expanded, setExpanded] = useState(false);

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
          <span className="sub-plan-card__price">₹ {plan.discountedAmount.toLocaleString()}</span>
          <span className="sub-plan-card__period">/ year</span>
        </div>
        <div className="sub-plan-card__monthly">{plan.monthlyDisplay} / month</div>
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

        {/* Expandable post income */}
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
        <button
          className="sub-btn sub-btn--subscribe"
          style={{ '--plan-gradient': plan.gradient, '--plan-glow': plan.glow }}
          onClick={() => onSubscribe(plan)}
          disabled={loading === plan.name}
          aria-label={`Subscribe to ${plan.name} plan`}
        >
          {loading === plan.name ? (
            <span className="sub-btn__spinner" />
          ) : isActive ? 'Renew Plan' : 'Subscribe via UPI / Card'}
        </button>

        {isActive && (
          <button className="sub-btn sub-btn--invoice" onClick={onViewInvoice}>
            📄 View Invoice
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Subscription() {
  const { showSubscription, closeSubscription } = useSubscription();
  const { user, authtoken } = useAuth();
  const [showInvoice, setShowInvoice] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [progress, setProgress] = useState({
    loading: true,
    referredCount: 0,
    target: 10,
    eligible: false,
    active: false,
    activationMethod: null,
  });

  // Fetch referral progress when modal opens
  const fetchProgress = useCallback(async () => {
    if (!authtoken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/progress`, {
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

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = showSubscription ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSubscription]);

  const handleActivateByReferrals = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/activate-by-referrals`, {
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

  const handleSubscribe = async (plan) => {
    if (!user || !user.name || !user.email || !authtoken) {
      toast.error('Please log in before subscribing.');
      return;
    }

    setLoadingPlan(plan.name);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authtoken}`,
        },
        body: JSON.stringify({
          amount: Math.round(plan.discountedAmount * 100), // paise
          planName: plan.name,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Order creation failed');

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY || 'rzp_test_dRxYFu51QjtKuF',
        amount: data.order.amount,
        currency: 'INR',
        name: 'SoShoLife',
        description: `${plan.name} Annual Subscription`,
        order_id: data.order.id,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || '',
        },
        method: { upi: true, card: true, netbanking: true, wallet: true },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${BACKEND_URL}/api/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authtoken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planName: plan.name,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              toast.success(`🎉 ${plan.name} plan activated! Enjoy your benefits.`);
              closeSubscription();
            } else {
              toast.error('Payment verification failed. Contact support.');
            }
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
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
  );
}