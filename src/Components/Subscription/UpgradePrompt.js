// src/components/Subscription/UpgradePrompt.js
import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "../../Context/Subscription/SubscriptionContext";

const UpgradePrompt = () => {
  const { subscriptionPlan } = useSubscription();
  const isVerified = subscriptionPlan === "annual";
  const navigate = useNavigate();

  if (isVerified) return null;          // already verified → nothing to show

  return (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow flex items-center justify-between my-4">
      <div className="flex items-center gap-2">
        <Rocket className="text-blue-500" />
        <span className="text-blue-800 font-medium">
          Become a verified member to unlock referrals and the blue badge!
        </span>
      </div>

      <button
        onClick={() => navigate("/subscription")}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-dark rounded"
      >
        Upgrade Now
      </button>
    </div>
  );
};

export default UpgradePrompt;
