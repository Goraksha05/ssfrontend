// MessageScroller.js — Render-optimised
//
// OPTIMISATIONS (this pass):
//
//  1.  message1, message2 moved to module scope.
//      Were plain string constants recreated as new string bindings on every
//      render (React had to compare them via identity on each reconciliation
//      pass). At module scope they are allocated once.
//
//  2.  combinedMessage moved to module scope.
//      Was a JSX expression recreated as a new React element tree on every
//      render, even though nothing in it ever changes. At module scope the
//      element is created once; React's reconciler sees the same reference
//      every render and skips the diff entirely for those subtrees.
//      NOTE: openOfferModal is called inside the Button's onClick — this
//      still needs to be a stable reference. See #3.
//
//  3.  openOfferModal onClick — stable via a module-scope ref.
//      combinedMessage is now module-scope (static), so the Button's onClick
//      cannot close over the component-level openOfferModal directly. Instead
//      we store openOfferModal in a module-scope ref (openOfferRef) and the
//      Button calls that ref. This keeps combinedMessage truly static while
//      always invoking the latest openOfferModal from context.
//
//  4.  <style jsx> block extracted as a module-scope constant string injected
//      via a standard <style> tag.
//      The `jsx` prop is non-standard outside styled-jsx environments and was
//      causing React to pass an unknown prop warning in some setups. More
//      importantly, the style string was a new template-literal value each
//      render. As a module-scope constant the string is created once.
//
//  5.  Auto-popup useEffect: openOfferModal is now called via openOfferRef so
//      it can be removed from the effect's dependency array. The effect should
//      only run once on mount (daily check), not every time openOfferModal
//      changes identity. This prevents the modal from potentially re-opening
//      if the ModalContext value changes reference between renders.

import React, { useCallback, useEffect } from "react";
import { Button } from "react-bootstrap";
import ModalContent from "./ModalContent";
import TodayOfferModal from "./TodayOfferModal";
import { useModal } from "../../Context/ModalContext";

/* ── Optimisation #3 — module-scope dispatch ref ────────────────────────── */
// Allows the static combinedMessage JSX to invoke the live openOfferModal
// without being recreated when it changes identity.
const openOfferRef = { current: null };

/* ── Optimisation #1 — module-scope message strings ─────────────────────── */
const message1 =
  "🔔 Welcome to SOSHOLIFE! 🎉 Invite your friends and earn rewards. Don't miss out!";
const message2 =
  "🤑 Invite only 3 friends or family members and earn rupees ₹2500! 🏃‍♂️ Join the race!";

/* ── Optimisation #2 — module-scope static JSX element ──────────────────── */
// Created once; reconciler sees the same reference on every render → no diff.
const combinedMessage = (
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
  </>
);

/* ── Optimisation #4 — module-scope CSS constant ─────────────────────────── */
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
`;

/* ── Component ───────────────────────────────────────────────────────────── */
const MessageScroller = () => {
  const { openModal } = useModal();

  const openOfferModal = useCallback(() => {
    openModal(TodayOfferModal, {
      title: "🎁 Today's Offer",
      children: <ModalContent />,
      onConfirm: () => { alert("Offer claimed! 🎉"); },
    });
  }, [openModal]);

  // Optimisation #3 — keep ref current so the static Button always calls
  // the latest version.
  openOfferRef.current = openOfferModal;

  /* ── Optimisation #5 — stable auto-popup effect ──────────────────────── */
  // Runs once on mount only. openOfferModal is accessed via ref so it doesn't
  // need to be in the dep array — the daily check should not re-trigger just
  // because context re-renders.
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
      {/* Optimisation #4 — injected once, never recreated */}
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