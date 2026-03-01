// UserReferrals.jsx — Full referral reward UI with two-tier milestone structure
//
// Referral JSON structure (plan-aware):
//   Big milestones  (3, 6, 10): groceryCoupons + shares + referralToken
//   Token milestones (11–30):   referralToken only (200/280/360 per plan)
//
// Progress bar tracks toward the next BIG milestone (3→6→10) first,
// then surfaces token milestones individually after 10.

import React, { useContext, useEffect, useState, useMemo } from "react";
import { StreakContext } from "../../Context/Activity/StreakContext";
import { useReferral } from "../../Context/Activity/ReferralContext";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import ShareModal from "./ShareModal";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";
import BankDetailsModal from "../Common/BankDetailsModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/* ── Milestone classifier ── */
const isBigMilestone   = (s) => s.groceryCoupons > 0 || s.shares > 0;
const isTokenMilestone = (s) => s.groceryCoupons === 0 && s.shares === 0 && s.referralToken > 0;

const UserReferrals = ({ onActivityRecorded }) => {
  const { user } = useAuth();
  const { activities } = useContext(StreakContext);
  const { referralCount = 0, fetchReferralData, referredUsers = [] } = useReferral();

  const { slabs: rawSlabs } = usePlanSlabs("referral");

  // Sort and classify slabs from the JSON
  const sortedSlabs = useMemo(() =>
    [...rawSlabs]
      .filter(s => typeof s.referralCount === "number")
      .sort((a, b) => a.referralCount - b.referralCount),
    [rawSlabs]
  );
  const bigSlabs   = useMemo(() => sortedSlabs.filter(isBigMilestone),   [sortedSlabs]);
  const tokenSlabs = useMemo(() => sortedSlabs.filter(isTokenMilestone), [sortedSlabs]);

  const [selectedSlab,     setSelectedSlab]     = useState(null);
  const [claimedSlabs,     setClaimedSlabs]     = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [showShareModal,   setShowShareModal]   = useState(false);
  const [showReferredList, setShowReferredList] = useState(false);
  const [showTokenSlabs,   setShowTokenSlabs]   = useState(false);

  const token = localStorage.getItem("token");

  const referralId = user?.referralId;
  const inviteLink = referralId
    ? `${window.location.origin}/invite/${referralId}`
    : `${window.location.origin}/invite`;

  const isUserSubscribed   = !!user?.subscription?.active;
  const activeReferrals    = referredUsers.filter(u => u.subscription?.active);
  const inactiveReferrals  = referredUsers.filter(u => !u.subscription?.active);
  const activeCount        = activeReferrals.length;

  // ── Claimed slabs (source of truth: user.redeemedReferralSlabs) ─────────────
  useEffect(() => {
    const fromUser = (user?.redeemedReferralSlabs ?? []).map(Number).filter(Boolean);
    // Backward compat: also check activity log
    const fromActivity = Array.isArray(activities)
      ? activities
          .filter(a => a?.type === "referral_reward" && a.slabAwarded != null)
          .map(a => Number(a.slabAwarded))
      : [];
    setClaimedSlabs([...new Set([...fromUser, ...fromActivity])]);
  }, [activities, user]);

  // ── Progress toward next BIG milestone ────────────────────────────────────
  const nextBig   = bigSlabs.find(s => activeCount < s.referralCount);
  const prevBig   = [...bigSlabs].reverse().find(s => activeCount >= s.referralCount);
  const bigProgress = nextBig
    ? Math.min(100, Math.round(((activeCount - (prevBig?.referralCount ?? 0)) / (nextBig.referralCount - (prevBig?.referralCount ?? 0))) * 100))
    : 100;

  // How many token milestones are available to claim (active refs ≥ milestone, unclaimed)
  const claimableTokens = tokenSlabs.filter(
    s => activeCount >= s.referralCount && !claimedSlabs.includes(s.referralCount)
  );

  // ── Claim handler ─────────────────────────────────────────────────────────
  const handleClaim = async (bankDetails, closeModal) => {
    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/referral`,
        { referralCount: selectedSlab, bankDetails },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || `✅ Reward for ${selectedSlab} referrals claimed!`);
      onActivityRecorded?.();
      fetchReferralData();
      setSelectedSlab(null);
      closeModal();
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Failed to claim reward.");
    } finally {
      setLoading(false);
    }
  };

  // ── Claim gate ──────────────────────────────────────────────────────────
  const canClaim = isUserSubscribed &&
    selectedSlab != null &&
    !claimedSlabs.includes(selectedSlab) &&
    activeCount >= selectedSlab;

  let disabledReason = "";
  if (!isUserSubscribed)                        disabledReason = "Active subscription required";
  else if (!selectedSlab)                       disabledReason = "Select a milestone first";
  else if (claimedSlabs.includes(selectedSlab)) disabledReason = "Already claimed";
  else if (activeCount < selectedSlab)          disabledReason = `Need ${selectedSlab} active referrals (you have ${activeCount})`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("🔗 Referral link copied!");
  };

  return (
    <div style={styles.container}>

      {/* ── Stats hero ── */}
      <div style={styles.heroRow}>
        <div style={styles.heroCard}>
          <span style={styles.heroNum}>{referralCount}</span>
          <span style={styles.heroLabel}>Total Referrals</span>
        </div>
        <div style={{ ...styles.heroCard, background: "linear-gradient(135deg,#064e3b,#065f46)" }}>
          <span style={styles.heroNum}>{activeCount}</span>
          <span style={styles.heroLabel}>Active Members</span>
        </div>
        <div style={{ ...styles.heroCard, background: "linear-gradient(135deg,#450a0a,#7f1d1d)" }}>
          <span style={styles.heroNum}>{inactiveReferrals.length}</span>
          <span style={styles.heroLabel}>Inactive</span>
        </div>
      </div>

      {/* Inactive warning */}
      {inactiveReferrals.length > 0 && (
        <div style={styles.infoBox}>
          ⚠️ {inactiveReferrals.length} referred member{inactiveReferrals.length !== 1 ? "s" : ""} do not have an active
          subscription. Reward eligibility is based on <strong>active referrals only</strong>.
        </div>
      )}

      {/* ── BIG milestones (3 / 6 / 10) — progress + chips ── */}
      <div style={styles.sectionHeader}>🏆 Big Milestones</div>

      {nextBig && (
        <div style={styles.progressWrap}>
          <div style={styles.progressRow}>
            <span style={styles.progressText}>{activeCount} / {nextBig.referralCount} active referrals</span>
            <span style={styles.progressPct}>{bigProgress}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressBar, width: `${bigProgress}%` }} />
          </div>
          <span style={styles.progressHint}>
            {nextBig.referralCount - activeCount} more active referral{nextBig.referralCount - activeCount !== 1 ? "s" : ""} to unlock next big reward
          </span>
        </div>
      )}

      <div style={styles.chipsRow}>
        {bigSlabs.map(s => {
          const isClaimed = claimedSlabs.includes(s.referralCount);
          const isActive  = activeCount >= s.referralCount;
          return (
            <div
              key={s.referralCount}
              style={{
                ...styles.bigChip,
                ...(isClaimed ? styles.chipClaimed : isActive ? styles.chipActive : styles.chipLocked),
              }}
            >
              <span>{isClaimed ? "✅" : isActive ? "🏆" : "🔒"}</span>
              <span style={styles.chipCount}>{s.referralCount}</span>
              <span style={styles.chipSub}>referrals</span>
              <div style={styles.chipRewards}>
                {s.groceryCoupons > 0 && <span style={styles.rewardPill}>🛒 ₹{s.groceryCoupons.toLocaleString("en-IN")}</span>}
                {s.shares         > 0 && <span style={styles.rewardPill}>📈 {s.shares} shares</span>}
                {s.referralToken  > 0 && <span style={styles.rewardPill}>🪙 {s.referralToken} tokens</span>}
              </div>
              {isClaimed && <span style={styles.claimedBadge}>Claimed</span>}
            </div>
          );
        })}
      </div>

      {/* ── Token milestones (11–30) — collapsed by default ── */}
      {tokenSlabs.length > 0 && (
        <div>
          <button style={styles.toggleBtn} onClick={() => setShowTokenSlabs(v => !v)}>
            {showTokenSlabs ? "▲ Hide" : "▼ Show"} Per-Referral Token Rewards (11–{tokenSlabs[tokenSlabs.length - 1]?.referralCount})
            {claimableTokens.length > 0 && (
              <span style={styles.claimableBadge}>{claimableTokens.length} claimable</span>
            )}
          </button>

          {showTokenSlabs && (
            <div style={styles.tokenGrid}>
              {tokenSlabs.map(s => {
                const isClaimed = claimedSlabs.includes(s.referralCount);
                const isActive  = activeCount >= s.referralCount;
                return (
                  <div
                    key={s.referralCount}
                    style={{
                      ...styles.tokenChip,
                      ...(isClaimed ? styles.chipClaimed : isActive ? styles.tokenChipActive : styles.chipLocked),
                    }}
                  >
                    {isClaimed ? "✅" : isActive ? "🪙" : "🔒"}
                    <span> {s.referralCount}r</span>
                    <span style={{ opacity: 0.7, fontSize: 10 }}> +{s.referralToken}t</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Referral link ── */}
      <div style={styles.linkBox}>
        <code style={styles.linkCode}>{inviteLink}</code>
        <div style={styles.linkActions}>
          <button style={styles.copyBtn}  onClick={copyLink}>📋 Copy</button>
          <button style={styles.shareBtn} onClick={() => setShowShareModal(true)}>🔗 Share</button>
        </div>
      </div>

      {/* ── Referred users list ── */}
      {referredUsers.length > 0 && (
        <div>
          <button style={styles.toggleBtn} onClick={() => setShowReferredList(v => !v)}>
            {showReferredList ? "▲ Hide" : "▼ Show"} referred users ({referredUsers.length})
          </button>
          {showReferredList && (
            <div style={styles.userList}>
              {referredUsers.map((u, i) => (
                <div key={u._id || i} style={styles.userRow}>
                  <div style={styles.userAvatar}>{(u.name || "?")[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.userName}>{u.name || "Unknown"}</div>
                    <div style={styles.userEmail}>{u.email || ""}</div>
                  </div>
                  <span style={{ ...styles.userBadge, ...(u.subscription?.active ? styles.badgeActive : styles.badgeInactive) }}>
                    {u.subscription?.active ? "✅ Active" : "⏳ Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Claim selector — shows ALL milestones ── */}
      <div style={styles.claimSection}>
        <label style={styles.claimLabel}>🎁 Claim a Referral Reward:</label>
        <select
          value={selectedSlab ?? ""}
          onChange={(e) => setSelectedSlab(Number(e.target.value))}
          style={styles.select}
        >
          <option value="">Select a milestone…</option>
          {bigSlabs.length > 0 && (
            <optgroup label="── Big Milestones (Coupons + Shares + Tokens) ──">
              {bigSlabs.map(s => {
                const isClaimed = claimedSlabs.includes(s.referralCount);
                const hasEnough = activeCount >= s.referralCount;
                return (
                  <option key={s.referralCount} value={s.referralCount} disabled={!hasEnough || isClaimed}>
                    {s.referralCount} Referrals — ₹{s.groceryCoupons.toLocaleString("en-IN")} coupons, {s.shares} shares, {s.referralToken} tokens
                    {isClaimed ? " ✅ Claimed" : !hasEnough ? " 🔒 Locked" : " — Available"}
                  </option>
                );
              })}
            </optgroup>
          )}
          {tokenSlabs.length > 0 && (
            <optgroup label="── Per-Referral Token Rewards ──">
              {tokenSlabs.map(s => {
                const isClaimed = claimedSlabs.includes(s.referralCount);
                const hasEnough = activeCount >= s.referralCount;
                return (
                  <option key={s.referralCount} value={s.referralCount} disabled={!hasEnough || isClaimed}>
                    {s.referralCount} Referrals — {s.referralToken} tokens
                    {isClaimed ? " ✅ Claimed" : !hasEnough ? " 🔒 Locked" : " — Available"}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>

        {disabledReason && <div style={styles.warningBanner}>⚠️ {disabledReason}</div>}

        <button
          type="button"
          style={{ ...styles.claimBtn, ...(!canClaim ? styles.claimBtnDisabled : {}) }}
          disabled={!canClaim || loading}
          data-bs-toggle="modal"
          data-bs-target="#referralBankModal"
        >
          {loading ? "⏳ Claiming…" : "Claim Reward"}
        </button>
      </div>

      <BankDetailsModal
        modalId="referralBankModal"
        loading={loading}
        onSubmit={handleClaim}
      />

      {showShareModal && (
        <ShareModal inviteLink={inviteLink} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: { display: "flex", flexDirection: "column", gap: 18 },

  heroRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 },
  heroCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "linear-gradient(135deg, #1e3a5f, #1e40af)",
    borderRadius: 12, padding: "16px 8px",
  },
  heroNum:   { fontSize: 30, fontWeight: 900, color: "#38bdf8" },
  heroLabel: { color: "#bae6fd", fontSize: 11, fontWeight: 600, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },

  infoBox: {
    background: "#1e1a05", border: "1px solid #ca8a04", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, color: "#fcd34d", lineHeight: 1.5,
  },

  sectionHeader: { color: "#94a3b8", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 },

  progressWrap:  { display: "flex", flexDirection: "column", gap: 6 },
  progressRow:   { display: "flex", justifyContent: "space-between" },
  progressText:  { color: "#94a3b8", fontSize: 13 },
  progressPct:   { color: "#10b981", fontWeight: 700, fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 99, background: "#334155", overflow: "hidden" },
  progressBar:   { height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #10b981, #34d399)", transition: "width 0.6s ease" },
  progressHint:  { color: "#64748b", fontSize: 12 },

  chipsRow: { display: "flex", flexWrap: "wrap", gap: 10 },
  bigChip: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
    padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700,
    border: "1px solid #334155", minWidth: 100, position: "relative",
  },
  chipActive:  { background: "#0f2d1f", border: "1px solid #10b981", color: "#34d399" },
  chipClaimed: { background: "#14532d", border: "1px solid #16a34a", color: "#86efac" },
  chipLocked:  { background: "#1e293b", color: "#475569" },
  chipCount:   { fontSize: 22, fontWeight: 900, lineHeight: 1 },
  chipSub:     { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 },
  chipRewards: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 },
  rewardPill:  { fontSize: 10, background: "rgba(255,255,255,0.08)", borderRadius: 99, padding: "2px 7px" },
  claimedBadge: { position: "absolute", top: 6, right: 8, fontSize: 9, background: "#16a34a", color: "#fff", borderRadius: 99, padding: "1px 6px" },

  tokenGrid:      { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tokenChip:      { padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, border: "1px solid #334155" },
  tokenChipActive:{ background: "#1a1040", border: "1px solid #a78bfa", color: "#a78bfa" },

  claimableBadge: { marginLeft: 8, fontSize: 10, background: "#4ade80", color: "#052e16", borderRadius: 99, padding: "1px 7px", fontWeight: 800 },

  toggleBtn: { background: "none", border: "1px solid #334155", borderRadius: 8, color: "#64748b", padding: "8px 14px", cursor: "pointer", fontSize: 13, marginBottom: 4 },

  linkBox:     { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 },
  linkCode:    { color: "#38bdf8", fontSize: 13, wordBreak: "break-all" },
  linkActions: { display: "flex", gap: 8 },
  copyBtn:     { flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", padding: "8px 0", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  shareBtn:    { flex: 1, background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 8, color: "#fff", padding: "8px 0", cursor: "pointer", fontWeight: 700, fontSize: 13 },

  userList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxHeight: 220, overflowY: "auto" },
  userRow:  { display: "flex", alignItems: "center", gap: 12, background: "#0f172a", borderRadius: 10, padding: "10px 14px" },
  userAvatar: { width: 36, height: 36, borderRadius: "50%", background: "#1e40af", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 },
  userName:  { color: "#e2e8f0", fontWeight: 600, fontSize: 14 },
  userEmail: { color: "#64748b", fontSize: 12 },
  userBadge: { marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 },
  badgeActive:   { background: "#14532d", color: "#86efac" },
  badgeInactive: { background: "#450a0a", color: "#fca5a5" },

  claimSection: { display: "flex", flexDirection: "column", gap: 10 },
  claimLabel:   { color: "#94a3b8", fontWeight: 600, fontSize: 14 },
  select:       { background: "#0f172a", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%" },
  warningBanner:{ background: "#451a03", border: "1px solid #92400e", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#fbbf24" },
  claimBtn:     { background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 10, color: "#fff", padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%", boxShadow: "0 4px 15px rgba(16,185,129,0.4)" },
  claimBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
};

export default UserReferrals;