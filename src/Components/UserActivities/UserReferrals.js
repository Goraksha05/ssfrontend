// UserReferrals.jsx — Improved, mobile-responsive referral UI
import React, { useContext, useEffect, useState } from "react";
import { StreakContext } from "../../Context/Activity/StreakContext";
import { useReferral } from "../../Context/Activity/ReferralContext";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import ShareModal from "./ShareModal";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";
import BankDetailsModal from "../Common/BankDetailsModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const UserReferrals = ({ onActivityRecorded }) => {
  const { activities } = useContext(StreakContext);
  const { referralCount = 0, fetchReferralData, referredUsers = [] } = useReferral();
  const rewardSlabs = usePlanSlabs("referral").map((s) => s.referralCount);

  const [selectedSlab,  setSelectedSlab]  = useState(null);
  const [claimedSlabs,  setClaimedSlabs]  = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReferredList, setShowReferredList] = useState(false);

  const token      = localStorage.getItem("token");
  const localUser  = (() => { try { return JSON.parse(localStorage.getItem("User")) || {}; } catch { return {}; } })();
  const referralId = localUser?.referralId;
  const inviteLink = referralId
    ? `${window.location.origin}/invite/${referralId}`
    : `${window.location.origin}/invite`;

  const isUserSubscribed    = !!localUser.subscription?.active;
  const inactiveReferrals   = referredUsers.filter((u) => !u.subscription?.active);
  const allReferralsActive  = inactiveReferrals.length === 0;

  // ── Derive claimed slabs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!Array.isArray(activities)) return;
    const redeemed = activities
      .filter((a) => a.type === "referral_reward")
      .map((a) => a.slabAwarded)
      .filter(Boolean);
    setClaimedSlabs(redeemed);
  }, [activities]);

  // ── Progress bar ──────────────────────────────────────────────────────────
  const nextSlab     = rewardSlabs.find((s) => referralCount < s) ?? null;
  const prevSlab     = [...rewardSlabs].reverse().find((s) => referralCount >= s) ?? 0;
  const progress     = nextSlab
    ? Math.round(((referralCount - prevSlab) / (nextSlab - prevSlab)) * 100)
    : 100;

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

  // ── Disable / tooltip logic ───────────────────────────────────────────────
  const canClaim = selectedSlab &&
    !claimedSlabs.includes(selectedSlab) &&
    isUserSubscribed &&
    referralCount >= selectedSlab &&
    (allReferralsActive || referralCount < selectedSlab);

  let disabledReason = "";
  if (!isUserSubscribed)                           disabledReason = "Subscription required";
  else if (!selectedSlab)                          disabledReason = "Select a milestone";
  else if (claimedSlabs.includes(selectedSlab))    disabledReason = "Already claimed";
  else if (!allReferralsActive && referralCount >= selectedSlab)
    disabledReason = "Referred members need active subscriptions";

  // ── Copy referral link ────────────────────────────────────────────────────
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
          <span style={styles.heroNum}>{referredUsers.length - inactiveReferrals.length}</span>
          <span style={styles.heroLabel}>Active Members</span>
        </div>
        <div style={{ ...styles.heroCard, background: "linear-gradient(135deg,#450a0a,#7f1d1d)" }}>
          <span style={styles.heroNum}>{inactiveReferrals.length}</span>
          <span style={styles.heroLabel}>Inactive</span>
        </div>
      </div>

      {/* ── Progress to next slab ── */}
      {nextSlab && (
        <div style={styles.progressWrap}>
          <div style={styles.progressRow}>
            <span style={styles.progressText}>{referralCount} / {nextSlab} referrals</span>
            <span style={styles.progressPct}>{progress}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
          </div>
          <span style={styles.progressHint}>
            {nextSlab - referralCount} more referrals to unlock your next reward
          </span>
        </div>
      )}

      {/* ── Referral link ── */}
      <div style={styles.linkBox}>
        <div style={styles.linkRow}>
          <code style={styles.linkCode}>{inviteLink}</code>
        </div>
        <div style={styles.linkActions}>
          <button style={styles.copyBtn} onClick={copyLink}>📋 Copy</button>
          <button style={styles.shareBtn} onClick={() => setShowShareModal(true)}>
            🔗 Share
          </button>
        </div>
      </div>

      {/* ── Referred users list ── */}
      {referredUsers.length > 0 && (
        <div>
          <button
            style={styles.toggleBtn}
            onClick={() => setShowReferredList((v) => !v)}
          >
            {showReferredList ? "▲ Hide" : "▼ Show"} referred users ({referredUsers.length})
          </button>
          {showReferredList && (
            <div style={styles.userList}>
              {referredUsers.map((u, i) => (
                <div key={u._id || i} style={styles.userRow}>
                  <div style={styles.userAvatar}>
                    {(u.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={styles.userName}>{u.name || "Unknown"}</div>
                    <div style={styles.userEmail}>{u.email || ""}</div>
                  </div>
                  <span
                    style={{
                      ...styles.userBadge,
                      ...(u.subscription?.active ? styles.badgeActive : styles.badgeInactive),
                    }}
                  >
                    {u.subscription?.active ? "✅ Active" : "⏳ Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Slab selector ── */}
      <div style={styles.claimSection}>
        <label style={styles.claimLabel}>🎁 Claim Referral Milestone:</label>
        <select
          value={selectedSlab ?? ""}
          onChange={(e) => setSelectedSlab(Number(e.target.value))}
          style={styles.select}
        >
          <option value="">Select a milestone…</option>
          {rewardSlabs.map((count) => (
            <option
              key={count}
              value={count}
              disabled={referralCount < count || claimedSlabs.includes(count)}
            >
              {count} Referrals {claimedSlabs.includes(count) ? "✅ Claimed" : ""}
            </option>
          ))}
        </select>

        {disabledReason && (
          <div style={styles.warningBanner}>⚠️ {disabledReason}</div>
        )}

        <button
          type="button"
          style={{
            ...styles.claimBtn,
            ...(!canClaim ? styles.claimBtnDisabled : {}),
          }}
          disabled={!canClaim || loading}
          data-bs-toggle="modal"
          data-bs-target="#referralBankModal"
        >
          {loading ? "⏳ Claiming…" : "Claim Reward"}
        </button>
      </div>

      {/* ── Bank Details Modal ── */}
      <BankDetailsModal
        modalId="referralBankModal"
        loading={loading}
        onSubmit={handleClaim}
      />

      {/* ── Share Modal ── */}
      {showShareModal && (
        <ShareModal
          inviteLink={inviteLink}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: { display: "flex", flexDirection: "column", gap: 18 },

  heroRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 10,
  },
  heroCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    background: "linear-gradient(135deg, #1e3a5f, #1e40af)",
    borderRadius: 12, padding: "16px 8px",
  },
  heroNum:   { fontSize: 30, fontWeight: 900, color: "#38bdf8" },
  heroLabel: { color: "#bae6fd", fontSize: 11, fontWeight: 600, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },

  progressWrap: { display: "flex", flexDirection: "column", gap: 6 },
  progressRow:  { display: "flex", justifyContent: "space-between" },
  progressText: { color: "#94a3b8", fontSize: 13 },
  progressPct:  { color: "#10b981", fontWeight: 700, fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 99, background: "#334155", overflow: "hidden" },
  progressBar: {
    height: "100%", borderRadius: 99,
    background: "linear-gradient(90deg, #10b981, #34d399)",
    transition: "width 0.6s ease",
  },
  progressHint: { color: "#64748b", fontSize: 12 },

  linkBox: {
    background: "#0f172a", border: "1px solid #334155",
    borderRadius: 12, padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  linkRow:    { overflow: "hidden" },
  linkCode:   { color: "#38bdf8", fontSize: 13, wordBreak: "break-all" },
  linkActions: { display: "flex", gap: 8 },
  copyBtn: {
    flex: 1, background: "#1e293b", border: "1px solid #334155",
    borderRadius: 8, color: "#94a3b8", padding: "8px 0",
    cursor: "pointer", fontWeight: 600, fontSize: 13,
    transition: "background 0.2s",
  },
  shareBtn: {
    flex: 1, background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none", borderRadius: 8, color: "#fff",
    padding: "8px 0", cursor: "pointer", fontWeight: 700, fontSize: 13,
  },

  toggleBtn: {
    background: "none", border: "1px solid #334155", borderRadius: 8,
    color: "#64748b", padding: "8px 14px", cursor: "pointer", fontSize: 13,
  },
  userList: {
    display: "flex", flexDirection: "column", gap: 8,
    marginTop: 10, maxHeight: 220, overflowY: "auto",
  },
  userRow: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#0f172a", borderRadius: 10, padding: "10px 14px",
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "#1e40af", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 15, flexShrink: 0,
  },
  userName:  { color: "#e2e8f0", fontWeight: 600, fontSize: 14 },
  userEmail: { color: "#64748b", fontSize: 12 },
  userBadge: {
    marginLeft: "auto", fontSize: 11, fontWeight: 700,
    padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap",
  },
  badgeActive:   { background: "#14532d", color: "#86efac" },
  badgeInactive: { background: "#450a0a", color: "#fca5a5" },

  claimSection: { display: "flex", flexDirection: "column", gap: 10 },
  claimLabel:   { color: "#94a3b8", fontWeight: 600, fontSize: 14 },
  select: {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 10,
    color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%",
  },
  warningBanner: {
    background: "#451a03", border: "1px solid #92400e",
    borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#fbbf24",
  },
  claimBtn: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none", borderRadius: 10, color: "#fff",
    padding: "12px 0", fontWeight: 700, fontSize: 15,
    cursor: "pointer", width: "100%",
    boxShadow: "0 4px 15px rgba(16,185,129,0.4)",
  },
  claimBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
};

export default UserReferrals;