// MessageScroller.js — Special Offer countdown integration

import React, { useCallback, useEffect, useMemo } from "react";
import { Button } from "react-bootstrap";
import ModalContent from "./ModalContent";
import TodayOfferModal from "./TodayOfferModal";
import { useModal } from "../../Context/ModalContext";
import { useSpecialOffer } from "../../Context/SpecialOffer/SpecialOfferContext";  // ← NEW

/* ── Optimisation #3 — module-scope dispatch ref ────────────────────────── */
const openOfferRef = { current: null };

/* ── Module-scope message strings (unchanged) ────────────────────────────── */
const message1 =
  "🔔 Welcome to SOSHOLIFE! 🎉 Invite your friends and earn rewards. Don't miss out!";
const message2 =
  "🤑 Invite only 3 friends or family members and earn rupees ₹2500! 🏃‍♂️ Join the race!";

/* ── Module-scope CSS (unchanged) ─────────────────────────────────────────── */
const SCROLLER_CSS = `
  .scroller-wrapper { white-space: nowrap; }
  .scroller-content { animation: marquee 30s linear infinite; }
  @keyframes marquee {
    0%   { transform: translateX(0%);   }
    100% { transform: translateX(-50%); }
  }
  .scroller-content span {
    font-size: 1.5rem;
    font-weight: 500;
    color: #0fffff;
  }
  @media (max-width: 576px) {
    .scroller-content span { font-size: 1.2rem; }
  }

  /* ── Special Offer countdown pill ──────────────────────────────────────── */
  .so-countdown-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 14px;
    padding: 2px 10px;
    border-radius: 20px;
    border: 1px solid rgba(255, 200, 0, 0.6);
    background: rgba(255, 200, 0, 0.12);
    color: #ffd700;
    font-size: 0.85rem;
    font-family: "Courier New", monospace;
    font-weight: 600;
    letter-spacing: 0.03em;
    vertical-align: middle;
    animation: so-pill-glow 2s ease-in-out infinite alternate;
  }
  @keyframes so-pill-glow {
    from { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
    to   { box-shadow: 0 0 8px rgba(255, 215, 0, 0.4); }
  }
  @media (max-width: 576px) {
    .so-countdown-pill { font-size: 0.75rem; padding: 1px 7px; }
  }
`;

/* ── CountdownInline ──────────────────────────────────────────────────────── */
/**
 * Renders "⚡ 12-Hour Offer Live | Ends in: HH:MM" inside the scroller.
 * Hides itself when expiresIn reaches 0.
 * Pure display — ticking is owned by useSpecialOffer().
 */
function CountdownInline({ expiresIn, isActive }) {
  if (!isActive || expiresIn <= 0) return null;

  const h   = Math.floor(expiresIn / 3600);
  const m   = Math.floor((expiresIn % 3600) / 60);
  const s   = expiresIn % 60;
  const pad = (n) => String(n).padStart(2, "0");

  // Show HH:MM when > 1 hour remains; MM:SS when under an hour
  const display = h > 0
    ? `${pad(h)}:${pad(m)}`
    : `${pad(m)}:${pad(s)}`;

  return (
    <span className="so-countdown-pill">
      ⚡ 12-Hour Offer Live&nbsp;|&nbsp;Ends in: {display}
    </span>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */
const MessageScroller = () => {
  const { openModal } = useModal();

  // ── Special offer state ──────────────────────────────────────────────────
  // expiresIn ticks every second inside useSpecialOffer, so this component
  // re-renders at 1 Hz when the offer is active — acceptable for a marquee.
  const { isActive: isOfferActive, expiresIn } = useSpecialOffer();

  const openOfferModal = useCallback(() => {
    openModal(TodayOfferModal, {
      title: "🎁 Today's Offer",
      children: <ModalContent />,
      onConfirm: () => { alert("Offer claimed! 🎉"); },
    });
  }, [openModal]);

  // Keep ref current so the static Button always calls the latest version.
  openOfferRef.current = openOfferModal;

  // ── combinedMessage — memoised; rebuilds only when offer state changes ───
  // The Button itself is stable (calls openOfferRef.current); only the
  // CountdownInline portion changes on each tick.
  const combinedMessage = useMemo(() => (
    <>
      {message1} ———— {message2}
      <Button
        variant="warning"
        size="sm"
        className="ms-3 fw-semibold rounded-pill"
        style={{
          fontSize: "1rem",
          border: "1px solid rgba(255, 38, 0, 1)",
        }}
        onClick={() => openOfferRef.current?.()}
      >
        Special Offer for You
      </Button>
      {/* Countdown pill — only visible while offer is active */}
      <CountdownInline expiresIn={expiresIn} isActive={isOfferActive} />
    </>
  ), [expiresIn, isOfferActive]);
  // Note: expiresIn ticks every second when offer is active, so this memo
  // recalculates every second. That is correct — we want the time to update.
  // When the offer is inactive, expiresIn is 0 and this never re-runs.

  /* ── Optimisation #5 — stable auto-popup effect ──────────────────────── */
  useEffect(() => {
    const today      = new Date().toISOString().split("T")[0];
    const lastShown  = localStorage.getItem("offerModalShown");
    if (lastShown !== today) {
      openOfferRef.current?.();
      localStorage.setItem("offerModalShown", today);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{SCROLLER_CSS}</style>

      <div className="container-fluid border-bottom mb-3 py-2 overflow-hidden position-relative">
        <div className="scroller-wrapper overflow-hidden">
          <div className="scroller-content text-nowrap d-inline-block">
            <span className="me-5">{combinedMessage}</span>
            <span className="me-5">{combinedMessage}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessageScroller;