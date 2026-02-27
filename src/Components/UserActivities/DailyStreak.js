// DailyStreak.jsx — Improved, mobile-responsive streak UI
import React, { useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { Tooltip } from "react-tooltip";
import { toast } from "react-toastify";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import { useStreak } from "../../Context/Activity/StreakContext";
import BankDetailsModal from "../Common/BankDetailsModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/** Safe ISO date formatter */
const toISO = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
};

const DailyStreak = ({ onActivityRecorded }) => {
  const {
    streakCount,
    streakDates,
    fetchStreakHistory,
    fetchStreakData,
    claimedDays,
  } = useStreak();

  const milestones = usePlanSlabs("streak").map((s) => s.dailystreak);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-clear toast messages handled by react-toastify

  // ── Derived ─────────────────────────────────────────────────────────────────
  const nextMilestone = milestones.find((m) => streakCount < m) ?? null;
  const prevMilestone = [...milestones].reverse().find((m) => streakCount >= m) ?? 0;
  const progress = nextMilestone
    ? Math.round(((streakCount - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  const heatmapValues = streakDates
    .map((d) => {
      const date = toISO(d.date);
      return date ? { date, count: d.count || 1 } : null;
    })
    .filter(Boolean);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const toggleHeatmap = () => {
    if (!showHeatmap) fetchStreakHistory();
    setShowHeatmap((v) => !v);
  };

  const handleClaim = async (bankDetails, closeModal) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const slabKey = `${selectedDay}days`;
      const res = await fetch(`${BACKEND_URL}/api/activity/streak-reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ streakslab: slabKey, bankDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Claim failed");
      toast.success(data.message || "🎉 Reward claimed!");
      fetchStreakData();
      onActivityRecorded?.();
      setSelectedDay("");
      closeModal();
    } catch (err) {
      toast.error(err.message || "Error claiming reward");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* ── Streak Counter ── */}
      <div style={styles.heroCard}>
        <span style={styles.flameBig}>🔥</span>
        <div>
          <div style={styles.heroCount}>{streakCount}</div>
          <div style={styles.heroLabel}>Day Streak</div>
        </div>
        {nextMilestone && (
          <div style={styles.heroNext}>
            <span style={styles.nextLabel}>Next milestone</span>
            <span style={styles.nextVal}>{nextMilestone} days</span>
          </div>
        )}
      </div>

      {/* ── Progress to next milestone ── */}
      {nextMilestone && (
        <div style={styles.progressWrap}>
          <div style={styles.progressRow}>
            <span style={styles.progressText}>{streakCount} / {nextMilestone} days</span>
            <span style={styles.progressPct}>{progress}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div
              style={{ ...styles.progressBar, width: `${progress}%` }}
            />
          </div>
          <span style={styles.progressHint}>
            {nextMilestone - streakCount} more days to unlock your next reward
          </span>
        </div>
      )}

      {/* ── Milestones grid ── */}
      <div style={styles.milestonesGrid}>
        {milestones.map((day) => {
          const slabKey = `${day}days`;
          const isClaimed = Array.isArray(claimedDays) && claimedDays.includes(slabKey);
          const isActive = streakCount >= day;
          return (
            <div
              key={day}
              style={{
                ...styles.milestoneChip,
                ...(isClaimed ? styles.chipClaimed : {}),
                ...(isActive && !isClaimed ? styles.chipActive : {}),
                ...(!isActive ? styles.chipLocked : {}),
              }}
            >
              <span style={styles.chipIcon}>
                {isClaimed ? "✅" : isActive ? "🏆" : "🔒"}
              </span>
              <span style={styles.chipLabel}>{day}d</span>
              {isClaimed && <span style={styles.chipBadge}>Claimed</span>}
            </div>
          );
        })}
      </div>

      {/* ── Claim selector ── */}
      <div style={styles.claimSection}>
        <label style={styles.claimLabel}>🎁 Claim a streak reward</label>
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          style={styles.select}
        >
          <option value="">Select a milestone…</option>
          {milestones.map((day) => {
            const slabKey = `${day}days`;
            const isClaimed = Array.isArray(claimedDays) && claimedDays.includes(slabKey);
            const isActive = streakCount >= day;
            return (
              <option
                key={day}
                value={day}
                disabled={!isActive || isClaimed}
              >
                {day} Days {isClaimed ? "✅ Claimed" : !isActive ? "🔒 Locked" : "— Available"}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          style={{
            ...styles.claimBtn,
            ...(loading || !selectedDay ? styles.claimBtnDisabled : {}),
          }}
          disabled={loading || !selectedDay}
          data-bs-toggle="modal"
          data-bs-target="#streakBankModal"
        >
          {loading ? "⏳ Claiming…" : "Claim Reward"}
        </button>
      </div>

      {/* ── Bank Details Modal ── */}
      <BankDetailsModal
        modalId="streakBankModal"
        loading={loading}
        onSubmit={handleClaim}
      />

      {/* ── Heatmap toggle ── */}
      <button onClick={toggleHeatmap} style={styles.heatmapToggle}>
        {showHeatmap ? "▲ Hide Calendar" : "▼ Show Streak Calendar"}
      </button>

      {showHeatmap && (
        <div style={styles.heatmapBox}>
          <CalendarHeatmap
            startDate={new Date(new Date().setMonth(new Date().getMonth() - 3))}
            endDate={new Date()}
            values={heatmapValues}
            classForValue={(v) =>
              !v?.count ? "color-empty" : `color-scale-${Math.min(v.count, 4)}`
            }
            tooltipDataAttrs={(v) => {
              const d = v?.date ? new Date(v.date) : null;
              return d
                ? {
                  "data-tooltip-id": "heatmap-tip",
                  "data-tooltip-content": `${d.toDateString()}: 🔥 ${v.count || 1} streak`,
                }
                : {};
            }}
            showWeekdayLabels
            onClick={(v) => {
              if (v?.date) setSelectedDate(new Date(v.date));
            }}
          />
          <Tooltip id="heatmap-tip" />

          {selectedDate && (
            <div style={styles.dateCard}>
              <p>📅 <strong>{selectedDate.toDateString()}</strong></p>
              <p>🔥 Streak recorded on this day</p>
              <button
                style={styles.closeBtn}
                onClick={() => setSelectedDate(null)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: { display: "flex", flexDirection: "column", gap: 20 },

  heroCard: {
    display: "flex", alignItems: "center", gap: 20,
    background: "linear-gradient(135deg, #431407 0%, #7c2d12 100%)",
    borderRadius: 14, padding: "20px 24px",
    flexWrap: "wrap",
  },
  flameBig: { fontSize: 48, lineHeight: 1 },
  heroCount: { fontSize: 48, fontWeight: 900, color: "#ff6b35", lineHeight: 1 },
  heroLabel: { color: "#fed7aa", fontSize: 14, fontWeight: 600, marginTop: 2 },
  heroNext: { marginLeft: "auto", textAlign: "right" },
  nextLabel: { display: "block", color: "#94a3b8", fontSize: 12 },
  nextVal: { display: "block", color: "#fb923c", fontWeight: 700, fontSize: 16 },

  progressWrap: { display: "flex", flexDirection: "column", gap: 6 },
  progressRow: { display: "flex", justifyContent: "space-between" },
  progressText: { color: "#94a3b8", fontSize: 13 },
  progressPct: { color: "#ff6b35", fontWeight: 700, fontSize: 13 },
  progressTrack: {
    height: 8, borderRadius: 99,
    background: "#334155", overflow: "hidden",
  },
  progressBar: {
    height: "100%", borderRadius: 99,
    background: "linear-gradient(90deg, #ff6b35, #fb923c)",
    transition: "width 0.6s ease",
  },
  progressHint: { color: "#64748b", fontSize: 12 },

  milestonesGrid: {
    display: "flex", flexWrap: "wrap", gap: 8,
  },
  milestoneChip: {
    display: "flex", alignItems: "center", gap: 5,
    padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
    border: "1px solid #334155", position: "relative",
  },
  chipActive: { background: "#292524", border: "1px solid #ff6b35", color: "#ff6b35" },
  chipClaimed: { background: "#14532d", border: "1px solid #16a34a", color: "#86efac" },
  chipLocked: { background: "#1e293b", color: "#475569" },
  chipIcon: { fontSize: 14 },
  chipLabel: {},
  chipBadge: {
    fontSize: 10, background: "#16a34a", color: "#fff",
    borderRadius: 99, padding: "1px 6px", marginLeft: 2,
  },

  claimSection: { display: "flex", flexDirection: "column", gap: 10 },
  claimLabel: { color: "#94a3b8", fontWeight: 600, fontSize: 14 },
  select: {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 10,
    color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%",
    appearance: "auto",
  },
  claimBtn: {
    background: "linear-gradient(135deg, #ff6b35, #fb923c)",
    border: "none", borderRadius: 10, color: "#fff",
    padding: "12px 0", fontWeight: 700, fontSize: 15,
    cursor: "pointer", width: "100%",
    boxShadow: "0 4px 15px rgba(255,107,53,0.4)",
    transition: "opacity 0.2s",
  },
  claimBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },

  heatmapToggle: {
    background: "none", border: "1px solid #334155", borderRadius: 8,
    color: "#94a3b8", padding: "8px 14px", fontSize: 13,
    cursor: "pointer", alignSelf: "flex-start",
    transition: "border-color 0.2s, color 0.2s",
  },
  heatmapBox: {
    background: "#0f172a", borderRadius: 12, padding: 16,
    border: "1px solid #1e293b",
  },
  dateCard: {
    marginTop: 14, background: "#1e293b", borderRadius: 10,
    padding: 14, fontSize: 14, color: "#e2e8f0",
  },
  closeBtn: {
    background: "none", border: "1px solid #334155", borderRadius: 6,
    color: "#94a3b8", padding: "4px 12px", cursor: "pointer",
    marginTop: 8, fontSize: 13,
  },
};

export default DailyStreak;