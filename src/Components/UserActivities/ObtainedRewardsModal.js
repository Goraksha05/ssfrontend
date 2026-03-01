// ObtainedRewardsModal.jsx
// Uses GET /api/auth/earned-rewards as the single source of truth.
// Reward breakdowns are resolved server-side; no client-side slab lookup needed.
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../Context/Authorisation/AuthContext";

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
   Styles (unchanged look and feel)
───────────────────────────────────────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  .orm-overlay {
    position: fixed; inset: 0;
    background: rgba(4, 7, 18, 0.88);
    backdrop-filter: blur(8px);
    z-index: 1055;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: orm-fadeIn 0.22s ease;
  }
  @keyframes orm-fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes orm-slideUp {
    from { opacity: 0; transform: translateY(28px) scale(0.975); }
    to   { opacity: 1; transform: translateY(0)   scale(1);     }
  }
  @keyframes orm-shimmer {
    0%   { background-position: -500px 0; }
    100% { background-position:  500px 0; }
  }
  @keyframes orm-popIn {
    0%   { opacity: 0; transform: scale(0.82); }
    65%  { transform: scale(1.06); }
    100% { opacity: 1; transform: scale(1); }
  }

  .orm-modal {
    font-family: 'DM Sans', sans-serif;
    background: linear-gradient(155deg, #0d1122 0%, #141826 55%, #0d1122 100%);
    border: 1px solid rgba(255,255,255,0.075);
    border-radius: 22px;
    width: 100%; max-width: 660px; max-height: 92vh;
    overflow: hidden; display: flex; flex-direction: column;
    box-shadow: 0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.06) inset;
    animation: orm-slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .orm-header {
    padding: 26px 26px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    flex-shrink: 0;
  }
  .orm-header-left { display: flex; align-items: center; gap: 14px; }
  .orm-icon-wrap {
    width: 50px; height: 50px; border-radius: 15px;
    background: linear-gradient(135deg, #f0c040, #e07720);
    display: flex; align-items: center; justify-content: center;
    font-size: 23px; flex-shrink: 0;
    box-shadow: 0 4px 18px rgba(240,180,50,0.38);
  }
  .orm-title {
    font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: #f0f2ff;
    margin: 0 0 4px; letter-spacing: -0.3px;
  }
  .orm-header-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .orm-subtitle  { font-size: 12.5px; color: rgba(255,255,255,0.36); margin: 0; }
  .orm-plan-badge {
    font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .orm-close {
    background: rgba(255,255,255,0.06); border: none; color: rgba(255,255,255,0.45);
    width: 36px; height: 36px; border-radius: 10px; cursor: pointer;
    font-size: 19px; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s; flex-shrink: 0;
  }
  .orm-close:hover { background: rgba(255,255,255,0.11); color: #f0f2ff; }

  .orm-totals {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
  }
  .orm-total-cell {
    background: #0d1122; padding: 15px 10px; text-align: center;
    position: relative; overflow: hidden;
  }
  .orm-total-cell::after {
    content: attr(data-icon); position: absolute; right: 8px; top: 8px;
    font-size: 18px; opacity: 0.12;
  }
  .orm-total-val {
    font-family: 'Syne', sans-serif; font-size: 21px; font-weight: 800;
    color: #f0f2ff; display: block; line-height: 1; margin-bottom: 5px;
  }
  .orm-total-lbl {
    font-size: 10px; color: rgba(255,255,255,0.36);
    text-transform: uppercase; letter-spacing: 0.7px; font-weight: 500;
  }

  .orm-tabs {
    display: flex; padding: 14px 18px 0; gap: 4px;
    flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .orm-tab {
    flex: 1; padding: 9px 8px 11px; border: none; border-radius: 0; background: transparent;
    color: rgba(255,255,255,0.36); font-family: 'DM Sans', sans-serif;
    font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.17s;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    border-bottom: 2.5px solid transparent; margin-bottom: -1px;
  }
  .orm-tab:hover { color: rgba(255,255,255,0.62); }
  .orm-tab.active { color: #f0f2ff; }
  .orm-tab.active.tab-streak   { color: #ff6b35; border-bottom-color: #ff6b35; }
  .orm-tab.active.tab-referral { color: #4ade80; border-bottom-color: #4ade80; }
  .orm-tab.active.tab-post     { color: #60a5fa; border-bottom-color: #60a5fa; }
  .orm-tab.active.tab-all      { color: #c084fc; border-bottom-color: #c084fc; }
  .orm-tab-count {
    font-size: 10px; font-weight: 700; padding: 1px 6px;
    border-radius: 20px; background: rgba(255,255,255,0.1); line-height: 16px;
    animation: orm-popIn 0.28s ease;
  }

  .orm-body {
    overflow-y: auto; flex: 1;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .orm-body::-webkit-scrollbar { width: 4px; }
  .orm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  .orm-section { padding: 16px 18px 20px; }

  .orm-card {
    border-radius: 14px; border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.028); margin-bottom: 10px;
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
    cursor: default; position: relative; overflow: hidden;
  }
  .orm-card:hover {
    background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.11);
    transform: translateY(-1px);
  }
  .orm-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px; border-radius: 0 2px 2px 0;
  }
  .orm-card.streak::before   { background: linear-gradient(180deg, #ff6b35, #ff3200); }
  .orm-card.referral::before { background: linear-gradient(180deg, #4ade80, #16a34a); }
  .orm-card.post::before     { background: linear-gradient(180deg, #60a5fa, #2563eb); }

  .orm-card-top { display: flex; align-items: center; gap: 13px; padding: 14px 15px 10px; }
  .orm-card-emoji { font-size: 26px; line-height: 1; flex-shrink: 0; }
  .orm-card-info  { flex: 1; min-width: 0; }
  .orm-card-title {
    font-family: 'Syne', sans-serif; font-size: 13.5px; font-weight: 700;
    color: #e8ecff; margin: 0 0 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .orm-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .orm-card-date { font-size: 11.5px; color: rgba(255,255,255,0.28); margin: 0; }
  .orm-card-plan-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; display: inline-block;
  }
  .orm-claimed-badge {
    flex-shrink: 0; align-self: flex-start; font-size: 10.5px; font-weight: 700;
    padding: 3px 10px; border-radius: 20px;
    background: rgba(74,222,128,0.12); color: #4ade80;
    border: 1px solid rgba(74,222,128,0.2); white-space: nowrap;
  }
  .orm-card-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 0 15px; }

  .orm-reward-row {
    display: flex; gap: 6px; flex-wrap: wrap; padding: 9px 14px 13px 54px;
  }
  .orm-chip {
    font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
    white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;
  }
  .orm-chip.grocery { background: rgba(251,191,36,0.13); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
  .orm-chip.shares  { background: rgba(96,165,250,0.13);  color: #60a5fa; border: 1px solid rgba(96,165,250,0.2);  }
  .orm-chip.token   { background: rgba(167,139,250,0.13); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }
  .orm-chip.none    { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.28); border: 1px solid rgba(255,255,255,0.08); font-style: italic; }

  .orm-empty { text-align: center; padding: 44px 20px; }
  .orm-empty-icon { font-size: 44px; margin-bottom: 12px; display: block; opacity: 0.35; }
  .orm-empty-title {
    font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
    color: rgba(255,255,255,0.28); margin: 0 0 6px;
  }
  .orm-empty-sub { font-size: 12.5px; color: rgba(255,255,255,0.18); margin: 0; line-height: 1.6; }

  .orm-skeleton {
    height: 88px; border-radius: 14px; margin-bottom: 10px;
    background: linear-gradient(90deg,
      rgba(255,255,255,0.035) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.035) 75%
    );
    background-size: 500px 100%;
    animation: orm-shimmer 1.5s infinite linear;
  }

  .orm-error {
    margin: 0 0 14px; padding: 13px 15px; border-radius: 12px;
    background: rgba(239,68,68,0.09); border: 1px solid rgba(239,68,68,0.2);
    color: #fca5a5; font-size: 12.5px; display: flex; align-items: center; gap: 8px;
  }

  .orm-footer {
    padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0; display: flex; gap: 8px;
  }
  .orm-close-btn {
    flex: 1; padding: 12px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55);
    font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 500;
    cursor: pointer; transition: all 0.16s;
  }
  .orm-close-btn:hover { background: rgba(255,255,255,0.085); color: #f0f2ff; border-color: rgba(255,255,255,0.16); }
  .orm-refresh-btn {
    padding: 12px 18px; border-radius: 12px;
    background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.2);
    color: #60a5fa; font-family: 'DM Sans', sans-serif;
    font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.16s; line-height: 1;
  }
  .orm-refresh-btn:hover    { background: rgba(96,165,250,0.18); }
  .orm-refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  @media (max-width: 500px) {
    .orm-header    { padding: 18px 16px 14px; }
    .orm-title     { font-size: 17px; }
    .orm-icon-wrap { width: 44px; height: 44px; font-size: 20px; }
    .orm-total-val { font-size: 17px; }
    .orm-total-lbl { font-size: 9px; }
    .orm-tabs      { padding: 10px 10px 0; }
    .orm-tab       { font-size: 11.5px; padding: 8px 4px 10px; }
    .orm-section   { padding: 12px 12px 16px; }
    .orm-card-top  { padding: 12px 12px 8px; }
    .orm-card-emoji { font-size: 22px; }
    .orm-card-title { font-size: 12.5px; }
    .orm-reward-row { padding: 8px 12px 11px 46px; }
    .orm-chip       { font-size: 10.5px; padding: 2px 8px; }
    .orm-footer     { padding: 12px 12px; }
  }
`;

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
// Big referral milestones (3, 6, 10) — have grocery coupons or shares
// Token-only milestones (11–30) — referralToken only
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
    <>
      <style>{styles}</style>
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
    </>
  );
};

export default ObtainedRewardsModal;