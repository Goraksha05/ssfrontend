import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

const GAP = 10;

function getPosition(buttonRect, popoverRect) {
  const spaceAbove = buttonRect.top;
  const spaceBelow = window.innerHeight - buttonRect.bottom;

  const showAbove = spaceBelow < popoverRect.height + 20 && spaceAbove > popoverRect.height;

  const top = showAbove
    ? buttonRect.top - popoverRect.height - GAP
    : buttonRect.bottom + GAP;

  const left = buttonRect.left + buttonRect.width / 2 - popoverRect.width / 2;

  return {
    top: Math.max(8, top),
    left: Math.max(8, Math.min(left, window.innerWidth - popoverRect.width - 8)),
  };
}

export default function FloatingEligibilityPopover({
  anchorRef,
  kycGate,
  subscriptionGate,
  blockerCode,
  onClose,
}) {
  const navigate = useNavigate();
  const [style, setStyle] = useState({ top: 0, left: 0, opacity: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (!anchorRef.current) return;

      const buttonRect = anchorRef.current.getBoundingClientRect();

      const temp = document.createElement("div");
      temp.style.visibility = "hidden";
      temp.style.position = "absolute";
      temp.style.width = "260px";
      document.body.appendChild(temp);

      const popoverRect = temp.getBoundingClientRect();
      document.body.removeChild(temp);

      const pos = getPosition(buttonRect, popoverRect);

      setStyle({
        top: pos.top,
        left: pos.left,
        opacity: 1,
      });
    };

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef]);

  // Build items — subscription uses ctaAction (modal), KYC uses navigate (route)
  const items = [];

  if (!kycGate.passed) {
    items.push({
      key: "kyc",
      message: kycGate.message,
      ctaLabel: kycGate.ctaLabel,
      // KYC has a real route — navigate to it
      onCta: () => { navigate(kycGate.ctaPath); onClose(); },
      color: kycGate.status === "submitted" ? "#2563eb" : "#dc2626",
    });
  }

  if (!subscriptionGate.passed) {
    items.push({
      key: "sub",
      message: subscriptionGate.message,
      ctaLabel: subscriptionGate.ctaLabel,
      // Subscription is a modal — call ctaAction, never navigate
      onCta: () => { subscriptionGate.ctaAction?.(); onClose(); },
      color: "#f59e0b",
    });
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: style.top,
        left: style.left,
        width: "260px",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        zIndex: 9999,
        padding: "14px",
        opacity: style.opacity,
        transform: "translateY(0px)",
        transition: "all 0.2s ease",
      }}
    >
      <p style={{ margin: "0 0 10px", fontWeight: 700 }}>
        🔒 Rewards locked
      </p>

      {items.map((item) => (
        <div key={item.key} style={{ marginBottom: "10px" }}>
          <p style={{ fontSize: "12px", marginBottom: "6px" }}>
            {item.message}
          </p>

          <button
            onClick={item.onCta}
            style={{
              padding: "6px 10px",
              background: item.color,
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {item.ctaLabel} →
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}