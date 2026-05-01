import { useState } from "react";
import { useAds } from "../../Context/Ads/AdsContext";

import AdsMetrics from "./AdsMetrics";
import AdsTable from "./AdsTable";
import AdsCharts from "./AdsCharts";
import CreateCampaignModal from "./modals/CreateCampaignModal";

const AdAccountDetail = ({ campaigns = [] }) => {
  const {
    selectedAccount,
    clearSelectedAccount,
  } = useAds();

  const [showCampaignModal, setShowCampaignModal] = useState(false);

  if (!selectedAccount) return null;

  // ─────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────
  const handleToggleStatus = (campaign) => {
    console.log("Toggle:", campaign._id);
    // TODO: connect API
  };

  // ─────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────
  const isEmpty = campaigns.length === 0;

  return (
    <div className="flex flex-col gap-5">

      {/* ───────── HEADER ───────── */}
      <div className="flex justify-between items-center">

        <div>
          <button
            onClick={clearSelectedAccount}
            className="text-sm text-muted mb-1 hover:underline"
          >
            ← Back to Accounts
          </button>

          <h3 className="flex items-center gap-2">
            {selectedAccount.accountName}
            <span className="text-xs text-muted">
              ({campaigns.length} campaigns)
            </span>
          </h3>

          <p className="text-sm text-muted">
            Status: {selectedAccount.status || "Active"}
          </p>
        </div>

        <button
          className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift"
          onClick={() => setShowCampaignModal(true)}
        >
          + Create Campaign
        </button>
      </div>

      {/* ───────── METRICS ───────── */}
      <AdsMetrics campaigns={campaigns} />

      {/* ───────── CHARTS ───────── */}
      {!isEmpty && <AdsCharts campaigns={campaigns} />}

      {/* ───────── TABLE / EMPTY ───────── */}
      <div className="bg-card border rounded-lg p-4 shadow-card">

        {isEmpty ? (
          <div className="text-center py-10">
            <h4>No Campaigns Yet</h4>
            <p className="text-muted mb-3">
              Create your first campaign to start advertising
            </p>

            <button
              className="px-4 py-2 bg-gradient text-white rounded shadow-md"
              onClick={() => setShowCampaignModal(true)}
            >
              + Create Campaign
            </button>
          </div>
        ) : (
          <AdsTable
            campaigns={campaigns}
            onToggleStatus={handleToggleStatus}
          />
        )}

      </div>

      {/* ───────── MODAL ───────── */}
      <CreateCampaignModal
        show={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        accountId={selectedAccount._id}
      />
    </div>
  );
};

export default AdAccountDetail;