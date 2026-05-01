/**
 * views/AdSetDetailView.js
 *
 * Fourth-level view: shows all Ads (creatives) inside the selected AdSet.
 * Supports status display, deletion, and triggering the CreateAdModal.
 */

import { useAds } from "../../../Context/Ads/AdsContext";

const FORMAT_ICONS = {
  single_image: "🖼️",
  carousel:     "🎠",
  video:        "🎬",
  text_only:    "📝",
};

const STATUS_COLORS = {
  active:   "text-success",
  paused:   "text-muted",
  rejected: "text-danger",
  pending:  "text-warning",
};

const AdSetDetailView = ({ onCreateAd }) => {
  const {
    selectedAdSet,
    selectedCampaign,
    selectedAccount,
    ads,
    loadingAds,
    adsError,
    clearSelectedAdSet,
    deleteAd,
    isDeletingAd,
    trackClick,
    trackImpression,
  } = useAds();

  if (!selectedAdSet) return null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingAds) {
    return (
      <div className="p-5">
        <Breadcrumb
          accountName={selectedAccount?.accountName}
          campaignName={selectedCampaign?.campaignName}
          onBack={clearSelectedAdSet}
        />
        <div className="grid grid-cols-2 gap-4 mt-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-4 animate-pulse">
              <div className="h-32 bg-hover rounded mb-3" />
              <div className="h-4 bg-hover rounded w-2/3 mb-2" />
              <div className="h-3 bg-hover rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (adsError) {
    return (
      <div className="p-5">
        <Breadcrumb
          accountName={selectedAccount?.accountName}
          campaignName={selectedCampaign?.campaignName}
          onBack={clearSelectedAdSet}
        />
        <p className="text-danger mt-4">Failed to load ads. {adsError?.message}</p>
      </div>
    );
  }

  const isEmpty = ads.length === 0;

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* Breadcrumb */}
      <Breadcrumb
        accountName={selectedAccount?.accountName}
        campaignName={selectedCampaign?.campaignName}
        onBack={clearSelectedAdSet}
      />

      {/* Ad Set Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="flex items-center gap-2">
            {selectedAdSet.name}
            <span className={`text-xs capitalize ${STATUS_COLORS[selectedAdSet.status] || "text-muted"}`}>
              {selectedAdSet.status || "active"}
            </span>
          </h3>

          <div className="flex gap-4 mt-1 text-sm text-muted">
            {selectedAdSet.dailyBudgetCap > 0 && (
              <span>💰 Daily Cap: ₹{selectedAdSet.dailyBudgetCap}</span>
            )}
            {selectedAdSet.placements?.length > 0 && (
              <span>📍 {selectedAdSet.placements.join(", ")}</span>
            )}
            {selectedAdSet.startDate && (
              <span>📅 {fmt(selectedAdSet.startDate)} → {fmt(selectedAdSet.endDate)}</span>
            )}
          </div>
        </div>

        <button
          onClick={onCreateAd}
          className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift text-sm shrink-0"
        >
          + New Ad
        </button>
      </div>

      {/* Ad Set Stats */}
      <AdSetStats ads={ads} />

      {/* Ads Grid */}
      <div>
        <h4 className="mb-3">
          Ads <span className="text-muted text-sm">({ads.length})</span>
        </h4>

        {isEmpty ? (
          <div className="bg-card border rounded-lg p-10 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h4>No Ads Yet</h4>
            <p className="text-sm text-muted mb-4">
              Create your first ad creative to start displaying in this ad set.
            </p>
            <button
              onClick={onCreateAd}
              className="px-4 py-2 bg-gradient text-white rounded shadow-md text-sm"
            >
              + Create Ad
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {ads.map((ad) => (
              <AdCard
                key={ad._id}
                ad={ad}
                onDelete={() => {
                  if (window.confirm("Delete this ad?")) deleteAd(ad._id);
                }}
                isDeletingAd={isDeletingAd}
                onTrackClick={() => trackClick(ad._id)}
                onTrackImpression={() => trackImpression(ad._id)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const Breadcrumb = ({ accountName, campaignName, onBack }) => (
  <button onClick={onBack} className="text-sm text-muted hover:underline text-left">
    ← {campaignName
      ? `Back to ${campaignName}`
      : accountName
      ? `Back to ${accountName}`
      : "Back"}
  </button>
);

const AdSetStats = ({ ads }) => {
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const totalImpr   = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const ctr         = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : "—";
  const active      = ads.filter((a) => a.status === "active").length;

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: "Total Ads",   value: ads.length },
        { label: "Active Ads",  value: active },
        { label: "Impressions", value: totalImpr },
        { label: "CTR",         value: ctr === "—" ? "—" : `${ctr}%` },
      ].map((s) => (
        <div key={s.label} className="bg-card border rounded-lg p-3 shadow-sm">
          <p className="text-xs text-muted">{s.label}</p>
          <p className="text-base mt-0.5">{s.value}</p>
        </div>
      ))}
    </div>
  );
};

const AdCard = ({ ad, onDelete, isDeletingAd }) => {
  const formatIcon  = FORMAT_ICONS[ad.format] || "🎯";
  const statusClass = STATUS_COLORS[ad.status] || "text-muted";
  const hasMedia    = ad.mediaUrl && ad.mediaType !== "text";

  return (
    <div className="bg-card border rounded-lg overflow-hidden shadow-card hover-lift group">

      {/* Media preview */}
      {hasMedia ? (
        <div className="h-36 bg-hover overflow-hidden">
          {ad.mediaType === "video" ? (
            <video
              src={ad.mediaUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <img
              src={ad.mediaUrl}
              alt={ad.headline || "Ad creative"}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
        </div>
      ) : (
        <div className="h-36 bg-hover flex items-center justify-center text-4xl">
          {formatIcon}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex justify-between items-start gap-2 mb-1">
          <p className="font-medium text-sm leading-snug line-clamp-2">
            {ad.headline || "Untitled Ad"}
          </p>
          <span className={`text-xs capitalize shrink-0 ${statusClass}`}>
            {ad.status || "pending"}
          </span>
        </div>

        {ad.body && (
          <p className="text-xs text-muted mb-2 line-clamp-2">{ad.body}</p>
        )}

        <div className="flex gap-3 text-xs text-muted mb-3">
          {ad.format && (
            <span className="capitalize">{formatIcon} {ad.format.replace("_", " ")}</span>
          )}
          {ad.clicks !== undefined && <span>👆 {ad.clicks} clicks</span>}
          {ad.impressions !== undefined && <span>👁 {ad.impressions}</span>}
        </div>

        {ad.link && (
          <a
            href={ad.link}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-accent hover:underline block mb-3 truncate"
          >
            {ad.link}
          </a>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <button
            onClick={onDelete}
            disabled={isDeletingAd}
            className="flex-1 px-3 py-1.5 text-xs border border-border rounded text-danger hover:bg-hover disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
};

export default AdSetDetailView;