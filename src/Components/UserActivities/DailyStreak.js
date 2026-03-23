// DailyStreak.jsx — Redesigned with KYC + subscription eligibility enforcement
import React, { useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { Tooltip } from "react-tooltip";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import { useStreak } from "../../Context/Activity/StreakContext";
import { useRewardEligibility } from "../../hooks/useRewardEligibility";
import BankDetailsModal from "../Common/BankDetailsModal";
import "./Rewards.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const toISO = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
};

/* ── Eligibility gate banner ─────────────────────────────────────────────────── */
function EligibilityBanner({ kycGate, subscriptionGate, blockerCode }) {
  const navigate = useNavigate();

  if (blockerCode === "KYC_AND_SUBSCRIPTION") {
    return (
      <div className="eligibility-banner eligibility-banner--dual">
        <div className="eligibility-banner__icon">🔒</div>
        <div className="eligibility-banner__body">
          <p className="eligibility-banner__title">Two steps to unlock streak rewards</p>
          <div className="eligibility-banner__steps">
            <div className="eligibility-banner__step eligibility-banner__step--error">
              <span className="eligibility-banner__step-dot" />
              <span>KYC verification required</span>
              <button className="eligibility-banner__cta" onClick={() => navigate("/profile?tab=kyc")}>
                Start KYC →
              </button>
            </div>
            <div className="eligibility-banner__step eligibility-banner__step--warn">
              <span className="eligibility-banner__step-dot" />
              <span>Active subscription required</span>
              <button className="eligibility-banner__cta eligibility-banner__cta--warn" onClick={() => navigate("/subscription")}>
                View Plans →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blockerCode === "KYC_NOT_VERIFIED") {
    const isSubmitted = kycGate.status === "submitted";
    return (
      <div className={`eligibility-banner ${isSubmitted ? "eligibility-banner--info" : "eligibility-banner--error"}`}>
        <div className="eligibility-banner__icon">{isSubmitted ? "⏳" : "🔒"}</div>
        <div className="eligibility-banner__body">
          <p className="eligibility-banner__title">
            {isSubmitted ? "KYC under review" : "KYC verification required"}
          </p>
          <p className="eligibility-banner__sub">{kycGate.message}</p>
          {!isSubmitted && (
            <button className="eligibility-banner__cta" onClick={() => navigate(kycGate.ctaPath)}>
              {kycGate.ctaLabel} →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (blockerCode === "SUBSCRIPTION_REQUIRED") {
    return (
      <div className="eligibility-banner eligibility-banner--warn">
        <div className="eligibility-banner__icon">💳</div>
        <div className="eligibility-banner__body">
          <p className="eligibility-banner__title">{subscriptionGate.label}</p>
          <p className="eligibility-banner__sub">{subscriptionGate.message}</p>
          <button className="eligibility-banner__cta eligibility-banner__cta--warn" onClick={() => navigate(subscriptionGate.ctaPath)}>
            {subscriptionGate.ctaLabel} →
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* ── Locked claim button ─────────────────────────────────────────────────────── */
function LockedClaimButton({ blockerCode, kycGate, subscriptionGate }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const primaryPath = blockerCode === "SUBSCRIPTION_REQUIRED"
    ? subscriptionGate.ctaPath
    : kycGate.ctaPath;
  const primaryLabel = blockerCode === "SUBSCRIPTION_REQUIRED"
    ? subscriptionGate.ctaLabel
    : kycGate.ctaLabel;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="rewards-claim-btn streak rewards-claim-btn--locked"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        🔒 Claim Reward
      </button>
      {open && (
        <div className="reward-lock-popover">
          <p className="reward-lock-popover__title">Rewards locked</p>
          {blockerCode === "KYC_AND_SUBSCRIPTION" ? (
            <>
              <p className="reward-lock-popover__item">• Complete KYC verification</p>
              <p className="reward-lock-popover__item">• Activate a subscription</p>
              <button className="reward-lock-popover__btn" onClick={() => navigate("/profile?tab=kyc")}>Start KYC →</button>
              <button className="reward-lock-popover__btn reward-lock-popover__btn--sub" onClick={() => navigate("/subscription")}>View Plans →</button>
            </>
          ) : (
            <>
              <p className="reward-lock-popover__item">{kycGate.status === "submitted" ? "KYC is under review" : blockerCode === "SUBSCRIPTION_REQUIRED" ? subscriptionGate.message : kycGate.message}</p>
              {primaryPath && kycGate.status !== "submitted" && (
                <button className="reward-lock-popover__btn" onClick={() => navigate(primaryPath)}>{primaryLabel} →</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
const DailyStreak = ({ onActivityRecorded }) => {
  const {
    streakCount,
    streakDates,
    totalUniqueDays,
    fetchStreakHistory,
    fetchStreakData,
    claimedDays,
  } = useStreak();

  const {
    eligible,
    checking,
    kycGate,
    subscriptionGate,
    blockerCode,
    parseClaimError,
  } = useRewardEligibility();

  const accurateStreak = totalUniqueDays ?? streakCount;

  const { slabs: rawSlabs } = usePlanSlabs("streak");
  const milestones = rawSlabs
    .map((s) => s.dailystreak)
    .filter((d) => typeof d === "number")
    .sort((a, b) => a - b);

  const [showHeatmap,  setShowHeatmap]  = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDay,  setSelectedDay]  = useState("");
  const [loading,      setLoading]      = useState(false);

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

  const toggleHeatmap = () => {
    if (!showHeatmap) fetchStreakHistory();
    setShowHeatmap((v) => !v);
  };

  const handleClaim = async (bankDetails, closeModal) => {
    // Client-side eligibility pre-check
    if (!eligible) {
      toast.warn("Complete KYC and subscribe to claim rewards.");
      return;
    }
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
      if (!res.ok) {
        // Use parseClaimError to handle structured gate errors from middleware
        throw Object.assign(new Error(data.message || "Claim failed"), { response: { data } });
      }
      toast.success(data.message || "🎉 Streak reward claimed!");
      fetchStreakData?.();
      onActivityRecorded?.();
      setSelectedDay("");
      closeModal();
    } catch (err) {
      toast.error(parseClaimError(err) || "Error claiming reward");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rewards-container">

      {/* ── Eligibility banner (shown when not eligible) ── */}
      {!checking && !eligible && (
        <EligibilityBanner
          kycGate={kycGate}
          subscriptionGate={subscriptionGate}
          blockerCode={blockerCode}
        />
      )}

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
            <div className="rewards-progress-bar streak" style={{ width: `${progress}%` }} />
          </div>
          <span className="rewards-progress-hint">
            {nextMilestone - accurateStreak} more day{nextMilestone - accurateStreak !== 1 ? "s" : ""} to reach your next {nextMilestone}-day reward
          </span>
        </div>
      )}

      {/* ── Milestone chips ── */}
      <div className="streak-milestones-grid">
        {milestones.map((day) => {
          const slabKey   = `${day}days`;
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
          disabled={!eligible && !checking}
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

        {/* Eligibility-aware claim button */}
        {checking ? (
          <button className="rewards-claim-btn streak" disabled>Checking…</button>
        ) : !eligible ? (
          <LockedClaimButton
            blockerCode={blockerCode}
            kycGate={kycGate}
            subscriptionGate={subscriptionGate}
          />
        ) : (
          <button
            type="button"
            className="rewards-claim-btn streak"
            disabled={loading || !selectedDay}
            data-bs-toggle="modal"
            data-bs-target="#streakBankModal"
          >
            {loading ? "⏳ Claiming…" : "Claim Reward"}
          </button>
        )}
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
                    "data-tooltip-id":      "heatmap-tip",
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
              <button className="streak-date-close-btn" onClick={() => setSelectedDate(null)}>Close</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyStreak;