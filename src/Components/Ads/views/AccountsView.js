/**
 * views/AccountsView.js
 *
 * Top-level view: lists all AdAccounts for the authenticated user.
 * Clicking an account card calls selectAccount(id) which drives
 * AdsDashboard into AccountDetailView.
 */

import { useAds } from "../../../Context/Ads/AdsContext";

const STATUS_COLORS = {
  active:    "text-success",
  suspended: "text-danger",
  rejected:  "text-danger",
  pending:   "text-muted",
};

const AccountsView = ({ onCreateAccount }) => {
  const {
    accounts,
    loadingAccounts,
    accountsError,
    selectAccount,
    deleteAccount,
    isDeletingAccount,
  } = useAds();

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingAccounts) {
    return (
      <div className="grid grid-cols-3 gap-4 p-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border rounded-lg p-5 animate-pulse">
            <div className="h-4 bg-hover rounded w-2/3 mb-3" />
            <div className="h-3 bg-hover rounded w-1/3 mb-2" />
            <div className="h-3 bg-hover rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (accountsError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <p className="text-danger mb-2">Failed to load ad accounts.</p>
        <p className="text-sm text-muted">{accountsError?.message}</p>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!accounts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="text-5xl mb-4">📢</div>
        <h3 className="mb-2">No Ad Accounts Yet</h3>
        <p className="text-sm text-muted mb-5 max-w-xs">
          Create your first ad account to start running campaigns and growing your audience.
        </p>
        <button
          onClick={onCreateAccount}
          className="px-5 py-2.5 bg-gradient text-white rounded shadow-md hover-lift"
        >
          + Create Ad Account
        </button>
      </div>
    );
  }

  // ── Accounts Grid ────────────────────────────────────────────────────────
  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3>Ad Accounts</h3>
          <p className="text-sm text-muted">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={onCreateAccount}
          className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift text-sm"
        >
          + New Account
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {accounts.map((account) => (
          <AccountCard
            key={account._id}
            account={account}
            onSelect={() => selectAccount(account._id)}
            onDelete={() => deleteAccount(account._id)}
            isDeletingAccount={isDeletingAccount}
          />
        ))}
      </div>
    </div>
  );
};

// ── AccountCard ──────────────────────────────────────────────────────────────

const AccountCard = ({ account, onSelect, onDelete, isDeletingAccount }) => {
  const statusClass = STATUS_COLORS[account.status] || "text-muted";

  return (
    <div className="bg-card border rounded-lg p-5 shadow-card hover-lift flex flex-col gap-3 group">

      {/* Account info (clickable) */}
      <button
        onClick={onSelect}
        className="text-left flex-1"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="leading-tight">{account.accountName}</h4>
          <span className={`text-xs capitalize ${statusClass} shrink-0`}>
            {account.status || "active"}
          </span>
        </div>

        {account.businessName && (
          <p className="text-sm text-muted mt-1">{account.businessName}</p>
        )}

        <div className="mt-3 flex gap-4 text-xs text-muted">
          {account.currency && (
            <span>💱 {account.currency}</span>
          )}
          {account.timezone && (
            <span>🕐 {account.timezone}</span>
          )}
        </div>
      </button>

      {/* Action row */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          onClick={onSelect}
          className="flex-1 px-3 py-1.5 text-xs bg-gradient text-white rounded hover-lift"
        >
          Manage →
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${account.accountName}"?`)) onDelete();
          }}
          disabled={isDeletingAccount}
          className="px-3 py-1.5 text-xs border border-border rounded text-danger hover:bg-hover disabled:opacity-50"
        >
          Delete
        </button>
      </div>

    </div>
  );
};

export default AccountsView;