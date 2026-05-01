/**
 * views/AccountDetailView.js
 *
 * Second-level view: shows the selected AdAccount's campaigns.
 * Wraps AdAccountDetail to supply the filtered campaign list.
 * "Create Campaign" button calls the onCreateCampaign prop so
 * AdsDashboard can open the correct modal.
 */

import { useAds } from "../../../Context/Ads/AdsContext";
import AdAccountDetail from "../AdAccountDetail";

const AccountDetailView = ({ onCreateCampaign }) => {
  const {
    selectedAccount,
    campaigns,
    loadingCampaigns,
    campaignsError,
    selectCampaign,
    clearSelectedAccount,
    // deleteAccount,
    // isDeletingAccount,
  } = useAds();

  if (!selectedAccount) return null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingCampaigns) {
    return (
      <div className="p-5">
        <button
          onClick={clearSelectedAccount}
          className="text-sm text-muted mb-4 hover:underline"
        >
          ← Back to Accounts
        </button>
        <div className="flex flex-col gap-4">
          <div className="bg-card border rounded-lg p-5 animate-pulse">
            <div className="h-5 bg-hover rounded w-1/3 mb-3" />
            <div className="h-3 bg-hover rounded w-1/4" />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-hover rounded w-2/3 mb-2" />
              <div className="h-3 bg-hover rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (campaignsError) {
    return (
      <div className="p-5">
        <button
          onClick={clearSelectedAccount}
          className="text-sm text-muted mb-4 hover:underline"
        >
          ← Back to Accounts
        </button>
        <p className="text-danger">Failed to load campaigns. {campaignsError?.message}</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/*
        AdAccountDetail already renders the back button, header, metrics,
        charts, table, and the "Create Campaign" modal trigger. We pass
        onCreateCampaign so it can open the dashboard-level modal instead
        of its own internal state.
      */}
      <AdAccountDetail
        campaigns={campaigns}
        onCreateCampaign={onCreateCampaign}
        onSelectCampaign={selectCampaign}
      />
    </div>
  );
};

export default AccountDetailView;