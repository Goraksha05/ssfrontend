// ObtainedRewardsModal.jsx
// Uses GET /api/auth/earned-rewards as the single source of truth.
// Reward breakdowns are resolved server-side; no client-side slab lookup needed.
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import "./ObtainedRewardsModal.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/* ─────────────────────────────────────────────────────────────────────────────
   Plan colour map
───────────────────────────────────────────────────────────────────────────── */
const PLAN_COLOR_MAP = {
  "2500": { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: "Basic"  },
  "3500": { bg: "rgba(192,192,192,0.15)", color: "#c0c0c0", label: "Silver" },
  "4500": { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24", label: "Gold"   },
};

/* ─────────────────────────────────────────────────────────────────────────────
   RewardChips — renders reward breakdown chips
───────────────────────────────────────────────────────────────────────────── */
const RewardChips = ({ reward }) => {
  if (!reward) {
    return (
      <div className="orm-reward-row">
        <span className="orm-chip none">Reward details unavailable</span>
      </div>
    );
  }

  const chips = [];
  if (reward.groceryCoupons > 0)
    chips.push(<span className="orm-chip grocery" key="gc">🛒 ₹{reward.groceryCoupons.toLocaleString("en-IN")} Grocery</span>);
  if (reward.shares > 0)
    chips.push(<span className="orm-chip shares"  key="sh">📈 {reward.shares} Share{reward.shares !== 1 ? "s" : ""}</span>);
  if (reward.referralToken > 0)
    chips.push(<span className="orm-chip token"   key="rt">🪙 {reward.referralToken} Token{reward.referralToken !== 1 ? "s" : ""}</span>);

  if (chips.length === 0)
    return (
      <div className="orm-reward-row">
        <span className="orm-chip none">No direct payout for this slab</span>
      </div>
    );

  return <div className="orm-reward-row">{chips}</div>;
};

/* ─────────────────────────────────────────────────────────────────────────────
   RewardCard
───────────────────────────────────────────────────────────────────────────── */
const BIG_REFERRAL_MILESTONES = new Set([3, 6, 10]);

const getRewardCardMeta = (claim) => {
  if (claim.type === "streak") {
    const days = String(claim.milestone).replace("days", "");
    return { cardClass: "streak", subtitle: "Daily streak milestone", emoji: "🔥", title: `Streak Reward — ${days} Days` };
  }
  if (claim.type === "referral") {
    const isBig = BIG_REFERRAL_MILESTONES.has(Number(claim.milestone));
    return {
      cardClass: "referral",
      subtitle:  isBig ? "Referral milestone (coupons + shares + tokens)" : "Per-referral token reward",
      emoji:     isBig ? "🤝" : "🪙",
      title:     claim.title || `Referral Reward — ${claim.milestone} Referrals`,
    };
  }
  if (claim.type === "post") {
    return { cardClass: "post", subtitle: "Post milestone", emoji: "📝", title: claim.title || `Post Reward — ${claim.milestone} Posts` };
  }
  return { cardClass: "", subtitle: "", emoji: "🎁", title: claim.title || "Reward" };
};

const RewardCard = ({ claim, planKey }) => {
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
};

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const TAB_CONFIGS = [
  { key: "all",      label: "All",      emoji: "✨", cls: "tab-all"      },
  { key: "streak",   label: "Streaks",  emoji: "🔥", cls: "tab-streak"   },
  { key: "referral", label: "Referral", emoji: "🤝", cls: "tab-referral" },
  { key: "post",     label: "Posts",    emoji: "📝", cls: "tab-post"     },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Main Modal
───────────────────────────────────────────────────────────────────────────── */
const ObtainedRewardsModal = ({ show, onClose }) => {
  const {
    // user,
    authtoken
  } = useAuth();

  const [claims,    setClaims]    = useState([]);
  const [wallet,    setWallet]    = useState({ totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
  const [planKey,   setPlanKey]   = useState("2500");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const planMeta = PLAN_COLOR_MAP[planKey] || PLAN_COLOR_MAP["2500"];

  /* ── Single fetch from the earned-rewards endpoint ── */
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

  /* Lock body scroll */
  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [show]);

  /* Escape key */
  useEffect(() => {
    if (!show) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [show, onClose]);

  if (!show) return null;

  /* ── Tab filtering ── */
  const filterMap = {
    all:      () => true,
    streak:   (c) => c.type === "streak",
    referral: (c) => c.type === "referral",
    post:     (c) => c.type === "post",
  };
  const filtered = claims.filter(filterMap[activeTab] || (() => true));
  const countOf  = (key) => claims.filter(filterMap[key] || (() => false)).length;

  /* ── Totals ── */
  const totals = [
    { label: "Grocery Coupons", value: `₹${(wallet.totalGroceryCoupons ?? 0).toLocaleString("en-IN")}`, icon: "🛒" },
    { label: "Company Shares",  value: (wallet.totalShares        ?? 0),                                  icon: "📈" },
    { label: "Referral Tokens", value: (wallet.totalReferralToken ?? 0),                                  icon: "🪙" },
  ];

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

        {/* ── Totals strip ── */}
        <div className="orm-totals">
          {totals.map((t) => (
            <div className="orm-total-cell" key={t.label} data-icon={t.icon}>
              <span className="orm-total-val">{loading ? "—" : t.value}</span>
              <span className="orm-total-lbl">{t.label}</span>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="orm-tabs">
          {TAB_CONFIGS.map((tab) => {
            const count = tab.key === "all" ? claims.length : countOf(tab.key);
            return (
              <button
                key={tab.key}
                className={`orm-tab ${tab.cls} ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
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
              <>
                <div className="orm-skeleton" />
                <div className="orm-skeleton" style={{ opacity: 0.68 }} />
                <div className="orm-skeleton" style={{ opacity: 0.42 }} />
              </>
            ) : filtered.length === 0 ? (
              <div className="orm-empty">
                <span className="orm-empty-icon">
                  {activeTab === "streak" ? "🔥" : activeTab === "referral" ? "🤝" : activeTab === "post" ? "📝" : "🎁"}
                </span>
                <p className="orm-empty-title">No rewards claimed yet</p>
                <p className="orm-empty-sub">
                  {activeTab === "all"
                    ? "Keep posting, referring friends, and logging daily streaks to earn rewards!"
                    : activeTab === "streak"
                    ? "Reach streak day milestones to claim streak rewards."
                    : activeTab === "referral"
                    ? "Refer active members to unlock referral milestone rewards."
                    : "Reach post count milestones to unlock post rewards."}
                </p>
              </div>
            ) : (
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