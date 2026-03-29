import React from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "../../Context/Subscription/SubscriptionContext";

const EligibilityBanner = ({ kycGate, subscriptionGate, blockerCode }) => {
  const navigate = useNavigate();
  const { openSubscription } = useSubscription();

  if (blockerCode === "KYC_AND_SUBSCRIPTION") {
    return (
      <div className="eligibility-banner eligibility-banner--dual">
        <div className="eligibility-banner__icon">🔒</div>
        <div className="eligibility-banner__body">
          <p className="eligibility-banner__title">
            Two steps to unlock rewards
          </p>

          <div className="eligibility-banner__steps">
            {/* KYC */}
            <div className="eligibility-banner__step eligibility-banner__step--error">
              <span className="eligibility-banner__step-dot" />
              <span>KYC verification required</span>
              <button
                className="eligibility-banner__cta"
                onClick={() => navigate("/profile?tab=kyc")}
              >
                Start KYC →
              </button>
            </div>

            {/* Subscription */}
            <div className="eligibility-banner__step eligibility-banner__step--warn">
              <span className="eligibility-banner__step-dot" />
              <span>Active subscription required</span>
              <button
                className="eligibility-banner__cta eligibility-banner__cta--warn"
                onClick={openSubscription}
              >
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
      <div
        className={`eligibility-banner ${
          isSubmitted
            ? "eligibility-banner--info"
            : "eligibility-banner--error"
        }`}
      >
        <div className="eligibility-banner__icon">
          {isSubmitted ? "⏳" : "🔒"}
        </div>

        <div className="eligibility-banner__body">
          <p className="eligibility-banner__title">
            {isSubmitted ? "KYC under review" : "KYC verification required"}
          </p>

          <p className="eligibility-banner__sub">{kycGate.message}</p>

          {!isSubmitted && (
            <button
              className="eligibility-banner__cta"
              onClick={() => navigate(kycGate.ctaPath)}
            >
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
          <p className="eligibility-banner__title">
            {subscriptionGate.label}
          </p>

          <p className="eligibility-banner__sub">
            {subscriptionGate.message}
          </p>

          <button
            className="eligibility-banner__cta eligibility-banner__cta--warn"
            onClick={() => subscriptionGate.ctaAction?.()}
          >
            {subscriptionGate.ctaLabel} →
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default EligibilityBanner;