import { useState } from "react";
import { useAds } from "../../Context/Ads/AdsContext";
import CreateAccountModal from "./CreateAccountModal";

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active:         { label: "Active",          cls: "bg-green-100 text-green-700 border-green-200" },
    pending_review: { label: "Under Review",    cls: "bg-amber-100 text-amber-700 border-amber-200" },
    suspended:      { label: "Suspended",       cls: "bg-red-100 text-red-600 border-red-200" },
    rejected:       { label: "Rejected",        cls: "bg-red-100 text-red-600 border-red-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};

// ── Single account card ───────────────────────────────────────────────────────
const AccountCard = ({ account, onSelect }) => {
  const initials = account.accountName
    ?.split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "AD";

  return (
    <div
      onClick={() => onSelect(account._id)}
      className="group relative bg-card border border-border rounded-xl p-5 cursor-pointer
                 transition-all duration-200 hover:border-accent hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* avatar */}
          <div className="w-10 h-10 rounded-lg bg-gradient flex items-center justify-center
                          text-white text-sm font-bold shadow-sm">
            {initials}
          </div>
          <div>
            <h5 className="font-semibold leading-tight">{account.accountName}</h5>
            <p className="text-xs text-muted mt-0.5">{account.email}</p>
          </div>
        </div>
        <StatusBadge status={account.status} />
      </div>

      {/* stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Campaigns" value={account.campaignCount ?? 0} />
        <Stat label="Pages"     value={account.pageCount     ?? 0} />
      </div>

      {/* hover arrow */}
      <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity text-accent text-lg">
        →
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-hover rounded-lg px-3 py-2">
    <p className="text-xs text-muted">{label}</p>
    <p className="text-base font-semibold mt-0.5">{value}</p>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ onCreateClick }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    {/* Illustration */}
    <div className="relative w-24 h-24 mb-6">
      <div className="absolute inset-0 rounded-2xl bg-gradient opacity-10 rotate-6" />
      <div className="absolute inset-0 rounded-2xl bg-gradient opacity-10 -rotate-3" />
      <div className="relative w-full h-full rounded-2xl bg-gradient flex items-center justify-center shadow-md">
        <span className="text-4xl">📣</span>
      </div>
    </div>

    <h3 className="text-xl font-bold mb-2">No Ad Accounts Yet</h3>
    <p className="text-muted max-w-xs mb-6 leading-relaxed">
      Create your first Ad Account to start building campaigns, reaching your audience,
      and growing your business on SoShoLife.
    </p>

    <button
      onClick={onCreateClick}
      className="px-6 py-3 bg-gradient text-white rounded-xl shadow-md hover-lift
                 font-medium flex items-center gap-2 transition-all duration-200"
    >
      <span className="text-lg">+</span>
      Create Ad Account
    </button>

    {/* Steps hint */}
    <div className="mt-10 grid grid-cols-3 gap-4 max-w-sm">
      {[
        { icon: "🏢", title: "Create Account",  desc: "Set up your business identity" },
        { icon: "📄", title: "Add a Page",       desc: "Define your brand's presence" },
        { icon: "🚀", title: "Launch Campaign",  desc: "Reach thousands of users" },
      ].map((step, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-hover flex items-center justify-center text-lg border border-border">
            {step.icon}
          </div>
          <p className="text-xs font-semibold">{step.title}</p>
          <p className="text-xs text-muted leading-tight">{step.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-lg bg-hover" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-hover rounded w-32" />
        <div className="h-2.5 bg-hover rounded w-20" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="h-12 bg-hover rounded-lg" />
      <div className="h-12 bg-hover rounded-lg" />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const AdAccounts = () => {
  const { accounts, loadingAccounts, selectAccount } = useAds();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div>
      {/* header — only show when there are accounts */}
      {!loadingAccounts && accounts.length > 0 && (
        <div className="flex justify-between items-center mb-5">
          <div>
            <h4 className="font-bold">Ad Accounts</h4>
            <p className="text-sm text-muted mt-0.5">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient text-white rounded-lg shadow-md hover-lift
                       text-sm font-medium flex items-center gap-1.5"
          >
            <span>+</span> New Account
          </button>
        </div>
      )}

      {/* loading */}
      {loadingAccounts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* empty */}
      {!loadingAccounts && accounts.length === 0 && (
        <EmptyState onCreateClick={() => setShowCreateModal(true)} />
      )}

      {/* grid */}
      {!loadingAccounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <AccountCard
              key={acc._id}
              account={acc}
              onSelect={selectAccount}
            />
          ))}
        </div>
      )}

      {/* modal */}
      <CreateAccountModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};

export default AdAccounts;