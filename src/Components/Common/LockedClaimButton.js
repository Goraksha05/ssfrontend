import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const LockedClaimButton = ({
  blockerCode,
  kycGate,
  subscriptionGate,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const primaryPath =
    blockerCode === "SUBSCRIPTION_REQUIRED"
      ? subscriptionGate.ctaPath
      : kycGate.ctaPath;

  const primaryLabel =
    blockerCode === "SUBSCRIPTION_REQUIRED"
      ? subscriptionGate.ctaLabel
      : kycGate.ctaLabel;

  return (
    <div style={{ position: "relative" }}>
      <button
        className={`rewards-claim-btn rewards-claim-btn--locked ${className}`}
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
              <p className="reward-lock-popover__item">
                • Complete KYC verification
              </p>
              <p className="reward-lock-popover__item">
                • Activate a subscription
              </p>

              <button
                className="reward-lock-popover__btn"
                onClick={() => navigate("/profile?tab=kyc")}
              >
                Start KYC →
              </button>

              <button
                className="reward-lock-popover__btn reward-lock-popover__btn--sub"
                onClick={() => navigate("/subscription")}
              >
                View Plans →
              </button>
            </>
          ) : (
            <>
              <p className="reward-lock-popover__item">
                {kycGate.status === "submitted"
                  ? "KYC is under review"
                  : blockerCode === "SUBSCRIPTION_REQUIRED"
                  ? subscriptionGate.message
                  : kycGate.message}
              </p>

              {primaryPath && kycGate.status !== "submitted" && (
                <button
                  className="reward-lock-popover__btn"
                  onClick={() => navigate(primaryPath)}
                >
                  {primaryLabel} →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LockedClaimButton;