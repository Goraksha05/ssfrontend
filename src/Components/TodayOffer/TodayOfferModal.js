import React, { useEffect, useState } from "react";
import BaseModal from "../Common/BaseModal";

/* ─────────────────────────────────────────────
   Countdown helpers
───────────────────────────────────────────── */
const INITIAL_SECONDS = 11 * 3600 + 47 * 60 + 23;

function useCountdown(initial) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
const AVATARS = [
  { initials: "R", cls: "tom2-av-purple" },
  { initials: "P", cls: "tom2-av-cyan" },
  { initials: "S", cls: "tom2-av-amber" },
  { initials: "A", cls: "tom2-av-red" },
];

const SPARKLE_POSITIONS = [
  { top: "18%", left: "8%",   animationDelay: "0s"   },
  { top: "35%", right: "6%",  animationDelay: "1.2s" },
  { bottom: "30%", left: "14%", animationDelay: "2.4s" },
  { bottom: "18%", right: "12%", animationDelay: "0.7s" },
  { top: "55%", left: "5%",   animationDelay: "3.5s" },
];

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const TodayOfferModal = ({ onClose, onConfirm, title, children, confirmText }) => {
  const countdown = useCountdown(INITIAL_SECONDS);
  const [claimed, setClaimed] = useState(false);

  const handleConfirm = () => {
    setClaimed(true);
    onConfirm?.();
    setTimeout(onClose, 1800);
  };

  return (
    <BaseModal onClose={onClose}>
      {/* Floating sparkle dots */}
      <div className="tom2-sparkles" aria-hidden="true">
        {SPARKLE_POSITIONS.map((style, i) => (
          <div key={i} className="tom2-sp" style={style} />
        ))}
      </div>

      {/* ── HERO ── */}
      <div className="tom2-hero">
        <div className="tom2-hero-rings" aria-hidden="true">
          <div className="tom2-ring tom2-ring-1" />
          <div className="tom2-ring tom2-ring-2" />
          <div className="tom2-ring tom2-ring-3" />
        </div>

        <button className="tom2-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="tom2-badge">🎁 Today's Exclusive Offer</div>
        <div className="tom2-reward-icon" aria-hidden="true">💰</div>
        <div className="tom2-hero-amount">₹2,500</div>
        <div className="tom2-hero-label">Direct bank transfer · No investment needed</div>
      </div>

      {/* ── COUNTDOWN ── */}
      <div className="tom2-timer" role="timer" aria-live="polite" aria-label={`Offer expires in ${countdown}`}>
        <div className="tom2-timer-dot" aria-hidden="true" />
        <span className="tom2-timer-label">Offer expires in</span>
        <span className="tom2-timer-value">{countdown}</span>
      </div>

      {/* ── BODY ── */}
      <div className="tom2-body">

        {/* Steps */}
        <div className="tom2-steps">
          <div className="tom2-step">
            <div className="tom2-step-num tom2-step-num-gold">1</div>
            <div className="tom2-step-text">
              <div className="tom2-step-title">Invite 10 friends</div>
              <div className="tom2-step-desc">
                Share your link — each friend who joins counts toward your Verified Badge
              </div>
            </div>
            <div className="tom2-step-tag tom2-tag-gold">Free</div>
          </div>

          <div className="tom2-step">
            <div className="tom2-step-num tom2-step-num-blue">2</div>
            <div className="tom2-step-text">
              <div className="tom2-step-title">Help 3 friends get Verified</div>
              <div className="tom2-step-desc">
                Unlock ₹2,500 cash the moment 3 of your referrals earn their badge
              </div>
            </div>
            <div className="tom2-step-tag tom2-tag-blue">₹2,500</div>
          </div>
        </div>

        {/* Optional custom children / ModalContent */}
        {children && <div className="tom2-custom-content">{children}</div>}

        {/* Social proof */}
        <div className="tom2-social" aria-label="2341 members already earning this week">
          <div className="tom2-avatars" aria-hidden="true">
            {AVATARS.map((a) => (
              <div key={a.initials} className={`tom2-avatar ${a.cls}`}>{a.initials}</div>
            ))}
          </div>
          <div className="tom2-social-text">
            <strong>2,341 members</strong> already earning this week
          </div>
        </div>

        {/* Urgency bar */}
        <div className="tom2-urgency">
          <div className="tom2-urgency-labels">
            <span>Spots claimed today</span>
            <span className="tom2-urgency-pct">73% full — 27% left</span>
          </div>
          <div className="tom2-bar-track" role="progressbar" aria-valuenow={73} aria-valuemin={0} aria-valuemax={100}>
            <div className="tom2-bar-fill" />
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="tom2-footer">
        <button
          className={`tom2-btn-confirm ${claimed ? "tom2-btn-claimed" : ""}`}
          onClick={handleConfirm}
          disabled={claimed}
        >
          <span className="tom2-shimmer" aria-hidden="true" />
          <span className="tom2-btn-label">
            {claimed ? "🎉 Offer Claimed!" : `${confirmText || "🚀 Claim ₹2,500 Now"} →`}
          </span>
        </button>

        <button className="tom2-btn-cancel" onClick={onClose}>
          Maybe later — I don't want free money
        </button>
      </div>
    </BaseModal>
  );
};

export default TodayOfferModal;