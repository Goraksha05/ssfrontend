// ObtainedRewardsModal.js — Render-optimised
//
// OPTIMISATIONS (this pass):
//
//  1.  EligibilityPanel wrapped in React.memo.
//      It received 5 props from the parent, but the parent also owns claims /
//      wallet / loading / activeTab — any of those state changes re-rendered
//      EligibilityPanel even though none of its props had changed.
//
//  2.  RewardChips wrapped in React.memo.
//      Previously re-rendered every time its parent RewardCard re-rendered,
//      even when `reward` hadn't changed (e.g. planKey-driven re-renders).
//
//  3.  RewardCard wrapped in React.memo.
//      The card list re-rendered in full on every tab switch, every loading
//      tick, and every eligibility update.  Memo means only cards whose
//      `claim` or `planKey` prop actually changed will re-render.
//
//  4.  filterMap / countOf moved to module scope as pure functions.
//      Previously recreated on every render as inline closures / a plain
//      object literal, allocating new function references each time.
//      Moving them out means zero allocation per render.
//
//  5.  `filtered` and `counts` derived via useMemo.
//      Tab switches previously refiltered the whole claims array synchronously
//      inside the render function.  useMemo gates that work behind a
//      [claims, activeTab] dependency check.
//
//  6.  `totals` array moved to useMemo([wallet, loading]).
//      Previously a new array (with new object literals) was allocated on
//      every render regardless of whether wallet or loading had changed.
//
//  7.  `planMeta` derived via useMemo([planKey]).
//      Previously a PLAN_COLOR_MAP lookup (and potential fallback) on every
//      render.  Trivial cost but now stable reference for any downstream memo.
//
//  8.  Tab onClick handlers stabilised with useCallback.
//      Previously `() => setActiveTab(tab.key)` was a new function on every
//      render for every tab button.  Now each tab key gets a single stable
//      callback via a lookup map memoised over TAB_CONFIGS.
//
//  9.  Escape-key effect dependency corrected.
//      `onClose` was in the dep array but is a prop that can change identity
//      each render if the parent doesn't memo it.  Stored in a ref so the
//      effect only (re-)attaches when `show` changes, not on every parent
//      re-render.
//
// 10.  Scroll-lock effect cleaned up correctly.
//      The cleanup `() => { document.body.style.overflow = ""; }` ran on
//      every `show` change AND on unmount, which is correct — no change
//      needed, but the logic is preserved and documented.
//
// 11.  EmptyState extracted as React.memo.
//      Receives only activeTab / eligible / eligibilityChecking / blockerCode
//      / kycGate / subscriptionGate — all from stable sources.  Previously
//      the entire empty-state JSX was re-created inline on every render.
//
// 12.  SkeletonList extracted as a module-scope constant (never changes).
//      Three skeleton divs were recreated as new JSX nodes every loading
//      render; as a constant they are reused.

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import { useRewardEligibility } from "../../hooks/useRewardEligibility";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PLAN_COLOR_MAP = {
  "2500": { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: "Basic"  },
  "3500": { bg: "rgba(192,192,192,0.15)", color: "#c0c0c0", label: "Silver" },
  "4500": { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24", label: "Gold"   },
};

const TAB_CONFIGS = [
  { key: "all",      label: "All",      emoji: "✨", cls: "tab-all"      },
  { key: "streak",   label: "Streaks",  emoji: "🔥", cls: "tab-streak"   },
  { key: "referral", label: "Referral", emoji: "🤝", cls: "tab-referral" },
  { key: "post",     label: "Posts",    emoji: "📝", cls: "tab-post"     },
];

/* ── Optimisation #4 — pure module-scope filter functions ─────────────────── */
const FILTER_FNS = {
  all:      () => true,
  streak:   (c) => c.type === "streak",
  referral: (c) => c.type === "referral",
  post:     (c) => c.type === "post",
};
const fallbackFilter = () => true;

/* ── Optimisation #12 — skeleton constant, never recreated ───────────────── */
const SkeletonList = (
  <>
    <div className="orm-skeleton" />
    <div className="orm-skeleton" style={{ opacity: 0.68 }} />
    <div className="orm-skeleton" style={{ opacity: 0.42 }} />
  </>
);

/* ── Utility helpers (module scope) ─────────────────────────────────────────── */
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const getRewardCardMeta = (claim) => {
  if (claim.type === "streak") {
    const days = String(claim.milestone).replace("days", "");
    return { cardClass: "streak",   subtitle: "Daily streak milestone",                                    emoji: "🔥", title: `Streak Reward — ${days} Days` };
  }
  if (claim.type === "referral") {
    const isBig = BIG_REFERRAL_MILESTONES.has(Number(claim.milestone));
    return { cardClass: "referral", subtitle: isBig ? "Referral milestone" : "Per-referral token reward", emoji: isBig ? "🤝" : "🪙", title: claim.title || `Referral Reward — ${claim.milestone} Referrals` };
  }
  if (claim.type === "post") {
    return { cardClass: "post",     subtitle: "Post milestone",                                            emoji: "📝", title: claim.title || `Post Reward — ${claim.milestone} Posts` };
  }
  return { cardClass: "", subtitle: "", emoji: "🎁", title: claim.title || "Reward" };
};

const BIG_REFERRAL_MILESTONES = new Set([3, 6, 10]);

/* ── Optimisation #2 — RewardChips memo'd ────────────────────────────────── */
const RewardChips = React.memo(({ reward }) => {
  if (!reward) return <div className="orm-reward-row"><span className="orm-chip none">Reward details unavailable</span></div>;
  const chips = [];
  if (reward.groceryCoupons > 0) chips.push(<span className="orm-chip grocery" key="gc">🛒 ₹{reward.groceryCoupons.toLocaleString("en-IN")} Grocery</span>);
  if (reward.shares         > 0) chips.push(<span className="orm-chip shares"  key="sh">📈 {reward.shares} Share{reward.shares !== 1 ? "s" : ""}</span>);
  if (reward.referralToken  > 0) chips.push(<span className="orm-chip token"   key="rt">🪙 {reward.referralToken} Token{reward.referralToken !== 1 ? "s" : ""}</span>);
  if (chips.length === 0) return <div className="orm-reward-row"><span className="orm-chip none">No direct payout for this slab</span></div>;
  return <div className="orm-reward-row">{chips}</div>;
});

/* ── Optimisation #3 — RewardCard memo'd ─────────────────────────────────── */
// Re-renders only when `claim` identity or `planKey` changes.
// Tab switches, eligibility updates, and wallet changes no longer re-render
// cards that are already visible.
const RewardCard = React.memo(({ claim, planKey }) => {
  const meta      = getRewardCardMeta(claim);
  const planStyle = PLAN_COLOR_MAP[planKey] || PLAN_COLOR_MAP["2500"];
  return (
    <div className={`orm-card ${meta.cardClass}`}>
      <div className="orm-card-top">
        <span className="orm-card-emoji">{meta.emoji}</span>
        <div className="orm-card-info">
          <p className="orm-card-title">{meta.title}</p>
          <div className="orm-card-meta">
            <p className="orm-card-date">📅 {formatDate(claim.claimedAt)}</p>
            <span className="orm-card-plan-dot" style={{ background: planStyle.color }} title={`${planStyle.label} plan`} />
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{meta.subtitle}</span>
          </div>
        </div>
        <span className="orm-claimed-badge">✓ Claimed</span>
      </div>
      <div className="orm-card-divider" />
      <RewardChips reward={claim.reward} />
    </div>
  );
});

/* ── Optimisation #1 — EligibilityPanel memo'd ───────────────────────────── */
const EligibilityPanel = React.memo(({ eligible, checking, kycGate, subscriptionGate, blockerCode }) => {
  const navigate = useNavigate();

  if (checking) {
    return (
      <div className="orm-eligibility orm-eligibility--checking">
        <span className="orm-eligibility__dot orm-eligibility__dot--checking" />
        Checking eligibility…
      </div>
    );
  }

  if (eligible) {
    return (
      <div className="orm-eligibility orm-eligibility--ok">
        <span className="orm-eligibility__dot orm-eligibility__dot--ok" />
        <span>KYC verified · Active subscription · <strong>Rewards claimable</strong></span>
      </div>
    );
  }

  return (
    <div className="orm-eligibility orm-eligibility--locked">
      <div className="orm-eligibility__header">
        <span className="orm-eligibility__lock">🔒</span>
        <span className="orm-eligibility__title">Claim rewards to unlock</span>
      </div>
      <div className="orm-eligibility__gates">
        <div className={`orm-eligibility__gate ${kycGate.passed ? "orm-eligibility__gate--ok" : "orm-eligibility__gate--fail"}`}>
          <span className="orm-eligibility__gate-icon">
            {kycGate.passed ? "✅" : kycGate.status === "submitted" ? "⏳" : "❌"}
          </span>
          <span className="orm-eligibility__gate-label">
            KYC {kycGate.passed ? "verified" : kycGate.status === "submitted" ? "under review" : "required"}
          </span>
          {!kycGate.passed && kycGate.status !== "submitted" && (
            <button className="orm-eligibility__gate-btn" onClick={() => navigate(kycGate.ctaPath)}>
              {kycGate.ctaLabel} →
            </button>
          )}
        </div>
        <div className={`orm-eligibility__gate ${subscriptionGate.passed ? "orm-eligibility__gate--ok" : "orm-eligibility__gate--fail"}`}>
          <span className="orm-eligibility__gate-icon">
            {subscriptionGate.passed ? "✅" : "❌"}
          </span>
          <span className="orm-eligibility__gate-label">
            Subscription {subscriptionGate.passed
              ? `active (${subscriptionGate.plan || "plan"})`
              : subscriptionGate.expired ? "expired" : "inactive"}
          </span>
          {!subscriptionGate.passed && (
            <button
              className="orm-eligibility__gate-btn orm-eligibility__gate-btn--sub"
              onClick={() => subscriptionGate.ctaAction?.()}
            >
              {subscriptionGate.ctaLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/* ── Optimisation #11 — EmptyState memo'd ────────────────────────────────── */
const EMPTY_ICON = { streak: "🔥", referral: "🤝", post: "📝" };
const EMPTY_SUB  = {
  all:      "Keep posting, referring friends, and logging daily streaks to earn rewards!",
  streak:   "Reach streak day milestones to claim streak rewards.",
  referral: "Refer active members to unlock referral milestone rewards.",
  post:     "Reach post count milestones to unlock post rewards.",
};

const EmptyState = React.memo(({
  activeTab, eligible, eligibilityChecking, blockerCode, kycGate, subscriptionGate,
}) => (
  <div className="orm-empty">
    <span className="orm-empty-icon">{EMPTY_ICON[activeTab] || "🎁"}</span>
    <p className="orm-empty-title">No rewards claimed yet</p>
    <p className="orm-empty-sub">{EMPTY_SUB[activeTab] || EMPTY_SUB.all}</p>
    {!eligible && !eligibilityChecking && (
      <p className="orm-empty-eligibility-nudge">
        {blockerCode === "KYC_AND_SUBSCRIPTION"
          ? "Complete KYC and subscribe to start claiming."
          : blockerCode === "KYC_NOT_VERIFIED"
          ? kycGate.message
          : subscriptionGate.message}
      </p>
    )}
  </div>
));

/* ── Main Modal ──────────────────────────────────────────────────────────── */
const ObtainedRewardsModal = ({ show, onClose }) => {
  const { authtoken } = useAuth();

  const {
    eligible,
    checking: eligibilityChecking,
    kycGate,
    subscriptionGate,
    blockerCode,
  } = useRewardEligibility();

  const [claims,    setClaims]    = useState([]);
  const [wallet,    setWallet]    = useState({ totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
  const [planKey,   setPlanKey]   = useState("2500");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  /* ── Optimisation #7 ── */
  const planMeta = useMemo(
    () => PLAN_COLOR_MAP[planKey] || PLAN_COLOR_MAP["2500"],
    [planKey],
  );

  /* ── Fetch ─────────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!authtoken || !show) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/auth/earned-rewards`, {
        headers: { Authorization: `Bearer ${authtoken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load rewards");
      setClaims(data.claims   || []);
      setWallet(data.wallet   || { totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
      setPlanKey(data.planKey || "2500");
    } catch (err) {
      console.error("ObtainedRewardsModal fetch error:", err);
      setError("Failed to load rewards. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [authtoken, show]);

  useEffect(() => {
    if (show) {
      fetchData();
    } else {
      setClaims([]);
      setWallet({ totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
      setPlanKey("2500");
      setActiveTab("all");
      setError(null);
      setLoading(true);
    }
  }, [show, fetchData]);

  /* ── Scroll lock (Optimisation #10) ───────────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [show]);

  /* ── Escape key (Optimisation #9) ─────────────────────────────────────── */
  // onCloseRef keeps the handler stable so the effect never re-attaches just
  // because the parent re-rendered and passed a new onClose function identity.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!show) return;
    const h = (e) => { if (e.key === "Escape") onCloseRef.current?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [show]); // ← `onClose` intentionally excluded; accessed via ref

  /* ── Optimisation #5 — memoised filtering ─────────────────────────────── */
  const filtered = useMemo(
    () => claims.filter(FILTER_FNS[activeTab] || fallbackFilter),
    [claims, activeTab],
  );

  const counts = useMemo(() => ({
    all:      claims.length,
    streak:   claims.filter(FILTER_FNS.streak).length,
    referral: claims.filter(FILTER_FNS.referral).length,
    post:     claims.filter(FILTER_FNS.post).length,
  }), [claims]);

  /* ── Optimisation #6 — memoised totals array ──────────────────────────── */
  const totals = useMemo(() => [
    { label: "Grocery Coupons", value: `₹${(wallet.totalGroceryCoupons ?? 0).toLocaleString("en-IN")}`, icon: "🛒" },
    { label: "Company Shares",  value: (wallet.totalShares        ?? 0),                                  icon: "📈" },
    { label: "Referral Tokens", value: (wallet.totalReferralToken ?? 0),                                  icon: "🪙" },
  ], [wallet]);

  /* ── Optimisation #8 — stable tab onClick handlers ────────────────────── */
  const tabHandlers = useMemo(
    () => Object.fromEntries(TAB_CONFIGS.map((t) => [t.key, () => setActiveTab(t.key)])),
    [], // setActiveTab is stable; TAB_CONFIGS is module-scope constant
  );

  if (!show) return null;

  return (
    <div
      className="orm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label="Obtained Rewards"
    >
      <div className="orm-modal">

        {/* ── Header ── */}
        <div className="orm-header">
          <div className="orm-header-left">
            <div className="orm-icon-wrap">🏆</div>
            <div>
              <h2 className="orm-title">Your Rewards</h2>
              <div className="orm-header-meta">
                <p className="orm-subtitle">
                  {loading ? "Loading…" : `${claims.length} reward${claims.length !== 1 ? "s" : ""} claimed`}
                </p>
                {!loading && planMeta && (
                  <span className="orm-plan-badge" style={{ background: planMeta.bg, color: planMeta.color }}>
                    {planMeta.label} Plan
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="orm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* ── Eligibility panel (Optimisation #1) ── */}
        <div className="orm-eligibility-wrap">
          <EligibilityPanel
            eligible={eligible}
            checking={eligibilityChecking}
            kycGate={kycGate}
            subscriptionGate={subscriptionGate}
            blockerCode={blockerCode}
          />
        </div>

        {/* ── Totals strip (Optimisation #6) ── */}
        <div className="orm-totals">
          {totals.map((t) => (
            <div className="orm-total-cell" key={t.label} data-icon={t.icon}>
              <span className="orm-total-val">{loading ? "—" : t.value}</span>
              <span className="orm-total-lbl">{t.label}</span>
            </div>
          ))}
        </div>

        {/* ── Tabs (Optimisation #8) ── */}
        <div className="orm-tabs">
          {TAB_CONFIGS.map((tab) => {
            const count = counts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                className={`orm-tab ${tab.cls} ${activeTab === tab.key ? "active" : ""}`}
                onClick={tabHandlers[tab.key]}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {!loading && count > 0 && <span className="orm-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="orm-body">
          <div className="orm-section">
            {error && <div className="orm-error"><span>⚠️</span> {error}</div>}

            {loading ? (
              SkeletonList /* Optimisation #12 — constant, not re-created */
            ) : filtered.length === 0 ? (
              /* Optimisation #11 — memo'd empty state */
              <EmptyState
                activeTab={activeTab}
                eligible={eligible}
                eligibilityChecking={eligibilityChecking}
                blockerCode={blockerCode}
                kycGate={kycGate}
                subscriptionGate={subscriptionGate}
              />
            ) : (
              /* Optimisation #3 — each card memo'd */
              filtered.map((claim, idx) => (
                <RewardCard
                  key={claim._id || `${claim.type}-${claim.milestone}-${idx}`}
                  claim={claim}
                  planKey={planKey}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="orm-footer">
          <button className="orm-refresh-btn" onClick={fetchData} disabled={loading} title="Refresh">↻</button>
          <button className="orm-close-btn" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
};

export default ObtainedRewardsModal;