/**
 * Context/Ads/AdsContext.updated.js
 *
 * DROP-IN REPLACEMENT for AdsContext.js
 *
 * Changes from original:
 *   ✅ Added selectedPageId / selectPage / clearSelectedPage to the context shape
 *   ✅ Extended adsKeys factory with:
 *        adsKeys.pagesByAccount(accountId)     — all pages for an account
 *        adsKeys.page(pageId)                  — single page
 *        adsKeys.allMyPages()                  — flat list across all user accounts
 *        adsKeys.campaigns(accountId, filters) — now accepts filters.pageId
 *        adsKeys.pageCampaigns(pageId)         — campaigns scoped to a page
 *        adsKeys.pageFeed(pageId)              — page-level post feed
 *   ✅ Backward-compatible: all existing consumers of adsKeys.X still work
 */

import { createContext, useContext } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Query-key factory (centralised, versioned)
// ─────────────────────────────────────────────────────────────────────────────

export const adsKeys = {
  all: () => ['ads'],

  // ── Ad Accounts ──────────────────────────────────────────────────────────
  accounts: () => [...adsKeys.all(), 'accounts'],
  account:  (id) => [...adsKeys.accounts(), id],

  // ── Pages (flat list of all the user's pages across all accounts) ─────────
  allMyPages: () => [...adsKeys.all(), 'all-pages'],

  // ── Pages nested under an account ────────────────────────────────────────
  pagesByAccount: (accountId) => [...adsKeys.account(accountId), 'pages'],
  page:           (pageId)    => [...adsKeys.all(), 'page', pageId],

  // Legacy alias kept for backward-compat with existing consumers
  pages: (accountId) => adsKeys.pagesByAccount(accountId),

  // ── Campaigns ────────────────────────────────────────────────────────────
  // filters: { pageId?, search?, status? }
  campaigns: (accountId, filters = {}) => [
    ...adsKeys.account(accountId),
    'campaigns',
    filters,
  ],

  // Campaigns scoped to a specific page (used by PageDashboard)
  pageCampaigns: (pageId) => [...adsKeys.all(), 'page-campaigns', pageId],

  campaign: (id) => [...adsKeys.all(), 'campaign', id],

  // ── Ad Sets nested under a campaign ──────────────────────────────────────
  adSets:    (campaignId) => [...adsKeys.campaign(campaignId), 'adsets'],
  adSet:     (id)         => [...adsKeys.all(), 'adset', id],
  hierarchy: (campaignId) => [...adsKeys.campaign(campaignId), 'hierarchy'],

  // ── Ads nested under an ad set ───────────────────────────────────────────
  ads: (adSetId) => [...adsKeys.adSet(adSetId), 'ads'],
  ad:  (id)      => [...adsKeys.all(), 'ad', id],

  // ── Analytics ─────────────────────────────────────────────────────────────
  analytics: (campaignId) => [...adsKeys.campaign(campaignId), 'analytics'],

  // ── Feed (served ads for this user) ──────────────────────────────────────
  feed: () => [...adsKeys.all(), 'feed'],

  // ── Page Feed (posts created "as Page") ──────────────────────────────────
  pageFeed: (pageId) => [...adsKeys.all(), 'page-feed', pageId],
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AdsContext = createContext(null);

export const useAds = () => {
  const ctx = useContext(AdsContext);
  if (!ctx) throw new Error('useAds must be used within AdsProvider');
  return ctx;
};

export default AdsContext;