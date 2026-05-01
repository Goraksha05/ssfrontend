import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import apiRequest from '../utils/apiRequest';
import { adsKeys } from '../Context/Ads/AdsContext';
import { AuthContext } from '../Context/Authorisation/AuthContext';

// ── Fetchers ─────────────────────────────────────────────────────

const fetchAdSet = (id) =>
  apiRequest.get(`/api/ads/adset/${id}`).then((r) => r.data.adSet);

const fetchAd = (id) =>
  apiRequest.get(`/api/ads/ad/${id}`).then((r) => r.data.ad);

const fetchHierarchy = (campaignId) =>
  apiRequest.get(`/api/ads/campaign/${campaignId}/hierarchy`).then((r) => r.data);

const fetchAnalytics = (campaignId) =>
  apiRequest.get(`/api/ads/campaign/${campaignId}/analytics`).then((r) => r.data);

const fetchAdFeed = () =>
  apiRequest.get('/api/ads/feed').then((r) => r.data.ads ?? []);

// ── Shared config (IMPORTANT) ───────────────────────────────────

const baseQueryOptions = {
  retry: (failureCount, error) => {
    // ❌ Do not retry auth errors
    if (error?.response?.status === 401) return false;
    return failureCount < 2;
  },
};

// ── Hooks ───────────────────────────────────────────────────────

export const useAdSet = (adSetId, options = {}) => {
  const { isAuthenticated } = useContext(AuthContext);

  return useQuery({
    queryKey: adsKeys.adSet(adSetId),
    queryFn: () => fetchAdSet(adSetId),
    enabled: isAuthenticated && !!adSetId, // ✅ FIX
    ...baseQueryOptions,
    ...options,
  });
};

export const useAd = (adId, options = {}) => {
  const { isAuthenticated } = useContext(AuthContext);

  return useQuery({
    queryKey: adsKeys.ad(adId),
    queryFn: () => fetchAd(adId),
    enabled: isAuthenticated && !!adId, // ✅ FIX
    ...baseQueryOptions,
    ...options,
  });
};

export const useCampaignHierarchy = (campaignId, options = {}) => {
  const { isAuthenticated } = useContext(AuthContext);

  return useQuery({
    queryKey: adsKeys.hierarchy(campaignId),
    queryFn: () => fetchHierarchy(campaignId),
    enabled: isAuthenticated && !!campaignId, // ✅ FIX
    staleTime: 60_000,
    ...baseQueryOptions,
    ...options,
  });
};

export const useCampaignAnalytics = (campaignId, options = {}) => {
  const { isAuthenticated } = useContext(AuthContext);

  return useQuery({
    queryKey: adsKeys.analytics(campaignId),
    queryFn: () => fetchAnalytics(campaignId),
    enabled: isAuthenticated && !!campaignId, // ✅ FIX

    // ❌ Stop polling if logged out
    refetchInterval: isAuthenticated ? 2 * 60_000 : false,

    refetchIntervalInBackground: false,
    ...baseQueryOptions,
    ...options,
  });
};

export const useAdFeed = (options = {}) => {
  const { isAuthenticated } = useContext(AuthContext);

  return useQuery({
    queryKey: adsKeys.feed(),
    queryFn: fetchAdFeed,

    // ⚠️ If feed is public, change this to true
    enabled: isAuthenticated, // ✅ FIX

    refetchInterval: isAuthenticated ? 5 * 60_000 : false,
    refetchIntervalInBackground: false,
    ...baseQueryOptions,
    ...options,
  });
};