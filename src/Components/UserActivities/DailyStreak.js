// DailyStreak.jsx — Accurate streak UI with deduplicated day count
import React, { useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { Tooltip } from "react-tooltip";
import { toast } from "react-toastify";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import { useStreak } from "../../Context/Activity/StreakContext";
import BankDetailsModal from "../Common/BankDetailsModal";
import "./Rewards.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/** Safe ISO date string from any date value */
const toISO = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
};

const DailyStreak = ({ onActivityRecorded }) => {
  const {
    streakCount,
    streakDates,
    totalUniqueDays,
    fetchStreakHistory,
    fetchStreakData,
    claimedDays,
  } = useStreak();

  const accurateStreak = totalUniqueDays ?? streakCount;

  const { slabs: rawSlabs } = usePlanSlabs("streak");
  const milestones = rawSlabs
    .map((s) => s.dailystreak)
    .filter((d) => typeof d === "number")
    .sort((a, b) => a - b);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Derived progress ─────────────────────────────────────────────────────
  const nextMilestone = milestones.find((m) => accurateStreak < m) ?? null;
  const prevMilestone = [...milestones].reverse().find((m) => accurateStreak >= m) ?? 0;
  const progress = nextMilestone
    ? Math.min(100, Math.round(((accurateStreak - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
    : 100;

  const heatmapValues = streakDates
    .map((d) => {
      const date = toISO(d.date);
      return date ? { date, count: d.count || 1 } : null;
    })
    .filter(Boolean);

  // ── Handlers ─────────────────────────────────────────────────────────────
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
      toast.success(data.message || "🎉 Streak reward claimed!");
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="rewards-container">

      {/* ── Hero Counter ── */}
      <div className="streak-hero-card">
        <span className="streak-flame-big">🔥</span>
        <div>
          <div className="streak-hero-count">{accurateStreak}</div>
          <div className="streak-hero-label">Day Streak</div>
        </div>
        {nextMilestone && (
          <div className="streak-hero-next">
            <span className="streak-next-label">Next milestone</span>
            <span className="streak-next-val">{nextMilestone} days</span>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      {nextMilestone && (
        <div className="rewards-progress-wrap">
          <div className="rewards-progress-row">
            <span className="rewards-progress-text">{accurateStreak} / {nextMilestone} days</span>
            <span className="rewards-progress-pct streak">{progress}%</span>
          </div>
          <div className="rewards-progress-track">
            <div
              className="rewards-progress-bar streak"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="rewards-progress-hint">
            {nextMilestone - accurateStreak} more day{nextMilestone - accurateStreak !== 1 ? "s" : ""} to reach your next {nextMilestone}-day reward
          </span>
        </div>
      )}

      {/* ── Milestone chips ── */}
      <div className="streak-milestones-grid">
        {milestones.map((day) => {
          const slabKey = `${day}days`;
          const isClaimed = Array.isArray(claimedDays) && claimedDays.includes(slabKey);
          const isActive  = accurateStreak >= day;
          const stateClass = isClaimed ? "claimed" : isActive ? "active" : "locked";

          return (
            <div key={day} className={`streak-milestone-chip ${stateClass}`}>
              <span className="streak-chip-icon">
                {isClaimed ? "✅" : isActive ? "🏆" : "🔒"}
              </span>
              <span>{day}d</span>
              {isClaimed && <span className="streak-chip-badge">Claimed</span>}
            </div>
          );
        })}
      </div>

      {/* ── Claim selector ── */}
      <div className="rewards-claim-section">
        <label className="rewards-claim-label">🎁 Claim a streak reward</label>
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          className="rewards-select"
        >
          <option value="">Select a milestone…</option>
          {milestones.map((day) => {
            const slabKey   = `${day}days`;
            const isClaimed = Array.isArray(claimedDays) && claimedDays.includes(slabKey);
            const isActive  = accurateStreak >= day;
            return (
              <option key={day} value={day} disabled={!isActive || isClaimed}>
                {day} Days {isClaimed ? "✅ Claimed" : !isActive ? "🔒 Locked" : "— Available"}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          className="rewards-claim-btn streak"
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
      <button onClick={toggleHeatmap} className="rewards-toggle-btn">
        {showHeatmap ? "▲ Hide Calendar" : "▼ Show Streak Calendar"}
      </button>

      {showHeatmap && (
        <div className="streak-heatmap-box">
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
                    "data-tooltip-content": `${d.toDateString()}: 🔥 ${v.count || 1} log${v.count !== 1 ? "s" : ""}`,
                  }
                : {};
            }}
            showWeekdayLabels
            onClick={(v) => { if (v?.date) setSelectedDate(new Date(v.date)); }}
          />
          <Tooltip id="heatmap-tip" />

          {selectedDate && (
            <div className="streak-date-card">
              <p>📅 <strong>{selectedDate.toDateString()}</strong></p>
              <p>🔥 Streak recorded on this day</p>
              <button
                className="streak-date-close-btn"
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

export default DailyStreak;