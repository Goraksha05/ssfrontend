/**
 * Context/Ads/AdsState.updated.js
**/

import { useState, useCallback, useContext } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'react-toastify';
import AdsContext, { adsKeys } from './AdsContext';
import apiRequest from '../../utils/apiRequest';
import { AuthContext } from '../Authorisation/AuthContext';

// ─── API layer ────────────────────────────────────────────────────────────────

const api = {
  // Ad Account
  getAccounts:   ()             => apiRequest.get('/api/ads/account/my').then(r => r.data.accounts ?? []),
  getAccount:    (id)           => apiRequest.get(`/api/ads/account/${id}`).then(r => r.data.account),
  createAccount: (data)         => apiRequest.post('/api/ads/account/create', data).then(r => r.data),
  updateAccount: ({ id, data }) => apiRequest.patch(`/api/ads/account/${id}`, data).then(r => r.data),
  deleteAccount: (id)           => apiRequest.delete(`/api/ads/account/${id}`).then(r => r.data),
  listAllAccounts:     (params) => apiRequest.get('/api/ads/admin/accounts', { params }).then(r => r.data),
  updateAccountStatus: ({ id, data }) => apiRequest.patch(`/api/ads/admin/accounts/${id}/status`, data).then(r => r.data),

  // Ad Pages — existing per-account
  getPages:   (accountId)                   => apiRequest.get(`/api/ads/account/${accountId}/pages`).then(r => r.data.pages ?? []),
  createPage: ({ accountId, data })         => apiRequest.post(`/api/ads/account/${accountId}/pages`, data).then(r => r.data),
  updatePage: ({ accountId, pageId, data }) => apiRequest.patch(`/api/ads/account/${accountId}/pages/${pageId}`, data).then(r => r.data),
  deletePage: ({ accountId, pageId })       => apiRequest.delete(`/api/ads/account/${accountId}/pages/${pageId}`).then(r => r.data),

  // ── NEW: flat list of all pages across all user accounts ─────────────────
  getAllMyPages: () => apiRequest.get('/api/ads/pages/my').then(r => r.data.pages ?? []),

  // ── NEW: campaigns scoped to a specific page ──────────────────────────────
  getPageCampaigns: (pageId) =>
    apiRequest.get(`/api/ads/page/${pageId}/campaigns`).then(r => r.data.campaigns ?? []),

  // ── NEW: page-level post feed ─────────────────────────────────────────────
  getPageFeed:    (pageId)          => apiRequest.get(`/api/ads/page/${pageId}/feed`).then(r => r.data.posts ?? []),
  createPagePost: ({ pageId, data }) => apiRequest.post(`/api/ads/page/${pageId}/posts`, data).then(r => r.data),
  deletePagePost: ({ pageId, postId }) => apiRequest.delete(`/api/ads/page/${pageId}/posts/${postId}`).then(r => r.data),

  // Campaigns
  getMyCampaigns: (params) =>
    apiRequest.get('/api/ads/my-campaigns', { params }).then(r => r.data.campaigns ?? []),
  getAccountCampaigns: ({ accountId, pageId, search = '', status = 'all' }) =>
    apiRequest.get('/api/ads/my-campaigns', {
      params: {
        adAccountId: accountId,
        ...(pageId && { adPageId: pageId }),
        ...(status !== 'all' && { status }),
        search,
      },
    }).then(r => r.data.campaigns ?? []),
  getCampaignAnalytics: (id)   => apiRequest.get(`/api/ads/campaign/${id}/analytics`).then(r => r.data),
  createCampaign:       (data) => apiRequest.post('/api/ads/campaign', data).then(r => r.data),

  // Ad Sets
  getAdSets:    (campaignId)      => apiRequest.get(`/api/ads/campaign/${campaignId}/adsets`).then(r => r.data.adSets ?? []),
  getAdSet:     (id)              => apiRequest.get(`/api/ads/adset/${id}`).then(r => r.data.adSet),
  getHierarchy: (campaignId)      => apiRequest.get(`/api/ads/campaign/${campaignId}/hierarchy`).then(r => r.data),
  createAdSet:  (data)            => apiRequest.post('/api/ads/adset', data).then(r => r.data),
  updateAdSet:  ({ id, data })    => apiRequest.patch(`/api/ads/adset/${id}`, data).then(r => r.data),
  deleteAdSet:  (id)              => apiRequest.delete(`/api/ads/adset/${id}`).then(r => r.data),

  // Ads (Creatives)
  getAds:     (adSetId)             => apiRequest.get(`/api/ads/adset/${adSetId}/ads`).then(r => r.data.ads ?? []),
  getAd:      (id)                  => apiRequest.get(`/api/ads/ad/${id}`).then(r => r.data.ad),
  createAd:   ({ adSetId, data })   => apiRequest.post(`/api/ads/adset/${adSetId}/ad`, data).then(r => r.data),
  updateAd:   ({ id, data })        => apiRequest.patch(`/api/ads/ad/${id}`, data).then(r => r.data),
  deleteAd:   (id)                  => apiRequest.delete(`/api/ads/ad/${id}`).then(r => r.data),
  addCreative:(data)                => apiRequest.post('/api/ads/creative', data).then(r => r.data),
  setTargeting:(data)               => apiRequest.post('/api/ads/targeting', data).then(r => r.data),

  // Feed & Tracking
  getAdFeed:       (params) => apiRequest.get('/api/ads/feed', { params }).then(r => r.data.ads ?? []),
  trackImpression: (ad_id)  => apiRequest.post('/api/ads/impression', { ad_id }).then(r => r.data),
  trackClick:      (ad_id)  => apiRequest.post('/api/ads/click', { ad_id }).then(r => r.data),

  // Admin campaigns
  listAllCampaigns:     (params) => apiRequest.get('/api/ads/admin/all', { params }).then(r => r.data),
  updateCampaignStatus: ({ id, data }) => apiRequest.patch(`/api/ads/admin/campaign/${id}/status`, data).then(r => r.data),
};

// ─── Provider ─────────────────────────────────────────────────────────────────

const AdsState = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const qc = useQueryClient();

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedAccountId,  setSelectedAccountId]  = useState(null);
  const [selectedPageId,     setSelectedPageId]     = useState(null); // ← NEW
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedAdSetId,    setSelectedAdSetId]    = useState(null);

  const [campaignFilters, setCampaignFilters] = useState({ search: '', status: 'all' });

  // ── Queries ───────────────────────────────────────────────────────────────

  const accountsQuery = useQuery({
    queryKey: adsKeys.accounts(),
    queryFn:  api.getAccounts,
    enabled:  isAuthenticated,
    staleTime: 60_000,
  });

  const selectedAccountQuery = useQuery({
    queryKey: adsKeys.account(selectedAccountId),
    queryFn:  () => api.getAccount(selectedAccountId),
    enabled:  isAuthenticated && !!selectedAccountId,
  });

  const pagesQuery = useQuery({
    queryKey: adsKeys.pagesByAccount(selectedAccountId),
    queryFn:  () => api.getPages(selectedAccountId),
    enabled:  isAuthenticated && !!selectedAccountId,
  });

  // ── NEW: flat list of ALL pages across all accounts ───────────────────────
  const allMyPagesQuery = useQuery({
    queryKey: adsKeys.allMyPages(),
    queryFn:  api.getAllMyPages,
    enabled:  isAuthenticated,
    staleTime: 60_000,
  });

  // ── NEW: campaigns filtered by page when selectedPageId is set ────────────
  const campaignsQuery = useQuery({
    queryKey: adsKeys.campaigns(selectedAccountId, {
      ...campaignFilters,
      pageId: selectedPageId ?? undefined,
    }),
    queryFn:  () => api.getAccountCampaigns({
      accountId: selectedAccountId,
      pageId:    selectedPageId ?? undefined,
      search:    campaignFilters.search,
      status:    campaignFilters.status,
    }),
    enabled:  isAuthenticated && !!selectedAccountId,
  });

  // ── NEW: campaigns scoped to a specific page (used by PageDashboard) ──────
  const pageCampaignsQuery = useQuery({
    queryKey: adsKeys.pageCampaigns(selectedPageId),
    queryFn:  () => api.getPageCampaigns(selectedPageId),
    enabled:  isAuthenticated && !!selectedPageId,
    staleTime: 30_000,
  });

  // ── NEW: page-level post feed ──────────────────────────────────────────────
  const pageFeedQuery = useQuery({
    queryKey: adsKeys.pageFeed(selectedPageId),
    queryFn:  () => api.getPageFeed(selectedPageId),
    enabled:  isAuthenticated && !!selectedPageId,
  });

  const adSetsQuery = useQuery({
    queryKey: adsKeys.adSets(selectedCampaignId),
    queryFn:  () => api.getAdSets(selectedCampaignId),
    enabled:  isAuthenticated && !!selectedCampaignId,
  });

  const hierarchyQuery = useQuery({
    queryKey: adsKeys.hierarchy(selectedCampaignId),
    queryFn:  () => api.getHierarchy(selectedCampaignId),
    enabled:  isAuthenticated && !!selectedCampaignId,
    staleTime: 60_000,
  });

  const adsQuery = useQuery({
    queryKey: adsKeys.ads(selectedAdSetId),
    queryFn:  () => api.getAds(selectedAdSetId),
    enabled:  isAuthenticated && !!selectedAdSetId,
  });

  const analyticsQuery = useQuery({
    queryKey: adsKeys.analytics(selectedCampaignId),
    queryFn:  () => api.getCampaignAnalytics(selectedCampaignId),
    enabled:  isAuthenticated && !!selectedCampaignId,
    refetchInterval: isAuthenticated ? 2 * 60_000 : false,
    refetchIntervalInBackground: false,
  });

  // ── Account mutations ─────────────────────────────────────────────────────

  const createAccountMutation = useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adsKeys.accounts() });
      toast.success('Ad Account created! It will be reviewed within 24 hours.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create account.'),
  });

  const updateAccountMutation = useMutation({
    mutationFn: api.updateAccount,
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: adsKeys.account(id) });
      const prev = qc.getQueryData(adsKeys.account(id));
      qc.setQueryData(adsKeys.account(id), (old) => ({ ...old, ...data }));
      return { prev, id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(adsKeys.account(ctx.id), ctx.prev);
      toast.error('Failed to update account.');
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: adsKeys.account(id) });
      qc.invalidateQueries({ queryKey: adsKeys.accounts() });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: adsKeys.accounts() });
      qc.invalidateQueries({ queryKey: adsKeys.allMyPages() });
      if (selectedAccountId === id) {
        setSelectedAccountId(null);
        setSelectedPageId(null);
        setSelectedCampaignId(null);
        setSelectedAdSetId(null);
      }
      toast.success('Ad Account deleted.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to delete account.'),
  });

  // ── Page mutations ────────────────────────────────────────────────────────

  const createPageMutation = useMutation({
    mutationFn: api.createPage,
    onSuccess: (_, { accountId }) => {
      qc.invalidateQueries({ queryKey: adsKeys.pagesByAccount(accountId) });
      qc.invalidateQueries({ queryKey: adsKeys.allMyPages() });
      toast.success('Business Page created successfully!');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create page.'),
  });

  const updatePageMutation = useMutation({
    mutationFn: api.updatePage,
    onSuccess: (data, { accountId, pageId }) => {
      qc.invalidateQueries({ queryKey: adsKeys.pagesByAccount(accountId) });
      qc.invalidateQueries({ queryKey: adsKeys.page(pageId) });
      qc.invalidateQueries({ queryKey: adsKeys.allMyPages() });
      toast.success('Page updated.');
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: api.deletePage,
    onSuccess: (_, { accountId, pageId }) => {
      qc.invalidateQueries({ queryKey: adsKeys.pagesByAccount(accountId) });
      qc.invalidateQueries({ queryKey: adsKeys.allMyPages() });
      if (selectedPageId === pageId) setSelectedPageId(null);
      toast.success('Page removed.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to delete page.'),
  });

  // ── NEW: page post mutations ───────────────────────────────────────────────

  const createPagePostMutation = useMutation({
    mutationFn: api.createPagePost,
    onSuccess: (_, { pageId }) => {
      qc.invalidateQueries({ queryKey: adsKeys.pageFeed(pageId) });
      toast.success('Post published on your Page!');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create post.'),
  });

  const deletePagePostMutation = useMutation({
    mutationFn: api.deletePagePost,
    onSuccess: (_, { pageId }) => {
      qc.invalidateQueries({ queryKey: adsKeys.pageFeed(pageId) });
      toast.success('Post deleted.');
    },
  });

  // ── Campaign mutations ────────────────────────────────────────────────────

  const createCampaignMutation = useMutation({
    mutationFn: api.createCampaign,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: adsKeys.campaigns(vars.adAccountId, {
          pageId: vars.adPageId,
        }),
      });
      if (vars.adPageId) {
        qc.invalidateQueries({ queryKey: adsKeys.pageCampaigns(vars.adPageId) });
      }
      toast.success('Campaign submitted for review!');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create campaign.'),
  });

  // ── Ad Set mutations ──────────────────────────────────────────────────────

  const createAdSetMutation = useMutation({
    mutationFn: api.createAdSet,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adsKeys.adSets(vars.campaignId) });
      qc.invalidateQueries({ queryKey: adsKeys.hierarchy(vars.campaignId) });
      toast.success('Ad Set created.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create ad set.'),
  });

  const updateAdSetMutation = useMutation({
    mutationFn: api.updateAdSet,
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: adsKeys.adSet(id) });
      const prev = qc.getQueryData(adsKeys.adSet(id));
      qc.setQueryData(adsKeys.adSet(id), (old) => ({ ...old, ...data }));
      return { prev, id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(adsKeys.adSet(ctx.id), ctx.prev);
      toast.error('Failed to update ad set.');
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: adsKeys.adSet(id) });
      if (selectedCampaignId) {
        qc.invalidateQueries({ queryKey: adsKeys.adSets(selectedCampaignId) });
        qc.invalidateQueries({ queryKey: adsKeys.hierarchy(selectedCampaignId) });
      }
    },
  });

  const deleteAdSetMutation = useMutation({
    mutationFn: api.deleteAdSet,
    onSuccess: (_, id) => {
      if (selectedCampaignId) {
        qc.invalidateQueries({ queryKey: adsKeys.adSets(selectedCampaignId) });
        qc.invalidateQueries({ queryKey: adsKeys.hierarchy(selectedCampaignId) });
      }
      if (selectedAdSetId === id) setSelectedAdSetId(null);
      toast.success('Ad Set deleted.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Cannot delete this ad set.'),
  });

  // ── Ad mutations ──────────────────────────────────────────────────────────

  const createAdMutation = useMutation({
    mutationFn: api.createAd,
    onSuccess: (_, { adSetId }) => {
      qc.invalidateQueries({ queryKey: adsKeys.ads(adSetId) });
      if (selectedCampaignId) {
        qc.invalidateQueries({ queryKey: adsKeys.hierarchy(selectedCampaignId) });
      }
      toast.success('Ad creative created.');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create ad.'),
  });

  const updateAdMutation = useMutation({
    mutationFn: api.updateAd,
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: adsKeys.ad(id) });
      const prev = qc.getQueryData(adsKeys.ad(id));
      qc.setQueryData(adsKeys.ad(id), (old) => ({ ...old, ...data }));
      return { prev, id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(adsKeys.ad(ctx.id), ctx.prev);
      toast.error('Failed to update ad.');
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: adsKeys.ad(id) });
    },
  });

  const deleteAdMutation = useMutation({
    mutationFn: api.deleteAd,
    onSuccess: () => {
      if (selectedAdSetId) {
        qc.invalidateQueries({ queryKey: adsKeys.ads(selectedAdSetId) });
      }
      toast.success('Ad deleted.');
    },
  });

  const setTargetingMutation = useMutation({
    mutationFn: api.setTargeting,
    onSuccess: () => toast.success('Targeting updated.'),
    onError:   (err) => toast.error(err?.response?.data?.message || 'Failed to update targeting.'),
  });

  const trackImpressionMutation = useMutation({ mutationFn: api.trackImpression });
  const trackClickMutation       = useMutation({ mutationFn: api.trackClick });

  // ── Selection helpers ─────────────────────────────────────────────────────

  const selectAccount = useCallback((accountId) => {
    setSelectedAccountId(accountId);
    setSelectedPageId(null);
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }, []);

  // ── NEW: Page selection ────────────────────────────────────────────────────
  const selectPage = useCallback((pageId, accountId) => {
    setSelectedPageId(pageId);
    if (accountId) setSelectedAccountId(accountId);
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }, []);

  const clearSelectedPage = useCallback(() => {
    setSelectedPageId(null);
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }, []);

  const clearSelectedAccount = useCallback(() => {
    setSelectedAccountId(null);
    setSelectedPageId(null);
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }, []);

  const selectCampaign = useCallback((campaignId) => {
    setSelectedCampaignId(campaignId);
    setSelectedAdSetId(null);
  }, []);

  const clearSelectedCampaign = useCallback(() => {
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }, []);

  const selectAdSet      = useCallback((adSetId) => setSelectedAdSetId(adSetId), []);
  const clearSelectedAdSet = useCallback(() => setSelectedAdSetId(null), []);

  const clearSelection = useCallback(() => {
    setSelectedAccountId(null);
    setSelectedPageId(null);
    setSelectedCampaignId(null);
    setSelectedAdSetId(null);
  }, []);

  // Refetch helpers
  const refetchAccounts  = useCallback(() => qc.invalidateQueries({ queryKey: adsKeys.accounts() }), [qc]);
  const refetchAllPages  = useCallback(() => qc.invalidateQueries({ queryKey: adsKeys.allMyPages() }), [qc]);
  const refetchCampaigns = useCallback(() => selectedAccountId && qc.invalidateQueries({ queryKey: adsKeys.campaigns(selectedAccountId) }), [qc, selectedAccountId]);
  const refetchAdSets    = useCallback(() => selectedCampaignId && qc.invalidateQueries({ queryKey: adsKeys.adSets(selectedCampaignId) }), [qc, selectedCampaignId]);
  const refetchHierarchy = useCallback(() => selectedCampaignId && qc.invalidateQueries({ queryKey: adsKeys.hierarchy(selectedCampaignId) }), [qc, selectedCampaignId]);
  const refetchPageFeed  = useCallback(() => selectedPageId && qc.invalidateQueries({ queryKey: adsKeys.pageFeed(selectedPageId) }), [qc, selectedPageId]);

  // Derived objects from cache
  const selectedAccount  = selectedAccountQuery.data ?? null;
  const selectedPage     = allMyPagesQuery.data?.find(p => p._id === selectedPageId) ?? null;
  const selectedCampaign = campaignsQuery.data?.find(c => c._id === selectedCampaignId) ?? null;
  const selectedAdSet    = adSetsQuery.data?.find(s => s._id === selectedAdSetId) ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AdsContext.Provider
      value={{
        // Data
        accounts:       accountsQuery.data  ?? [],
        allMyPages:     allMyPagesQuery.data ?? [],    // ← NEW
        pages:          pagesQuery.data     ?? [],
        pageCampaigns:  pageCampaignsQuery.data ?? [], // ← NEW
        pageFeed:       pageFeedQuery.data  ?? [],     // ← NEW
        campaigns:      campaignsQuery.data ?? [],
        adSets:         adSetsQuery.data    ?? [],
        ads:            adsQuery.data       ?? [],
        hierarchy:      hierarchyQuery.data ?? null,
        analytics:      analyticsQuery.data ?? null,

        // Selection
        selectedAccountId,
        selectedPageId,                                // ← NEW
        selectedCampaignId,
        selectedAdSetId,
        selectedAccount,
        selectedPage,                                  // ← NEW
        selectedCampaign,
        selectedAdSet,

        // Filter state
        campaignFilters,
        setCampaignFilters,

        // Loading states
        loadingAccounts:      accountsQuery.isLoading,
        loadingAllMyPages:    allMyPagesQuery.isLoading, // ← NEW
        loadingPages:         pagesQuery.isLoading,
        loadingPageCampaigns: pageCampaignsQuery.isLoading, // ← NEW
        loadingPageFeed:      pageFeedQuery.isLoading,  // ← NEW
        loadingCampaigns:     campaignsQuery.isLoading,
        loadingAdSets:        adSetsQuery.isLoading,
        loadingAds:           adsQuery.isLoading,
        loadingHierarchy:     hierarchyQuery.isLoading,
        loadingAnalytics:     analyticsQuery.isLoading,

        // Error states
        accountsError:  accountsQuery.error,
        campaignsError: campaignsQuery.error,
        adSetsError:    adSetsQuery.error,
        adsError:       adsQuery.error,

        // Selection actions (all original + new page actions)
        selectAccount,
        clearSelectedAccount,
        selectPage,         // ← NEW
        clearSelectedPage,  // ← NEW
        selectCampaign,
        clearSelectedCampaign,
        selectAdSet,
        clearSelectedAdSet,
        clearSelection,

        // Legacy compat
        fetchCampaigns: (accountId) => {
          if (accountId) qc.invalidateQueries({ queryKey: adsKeys.campaigns(accountId) });
        },

        // Account mutations
        createAccount: createAccountMutation.mutateAsync,
        updateAccount: updateAccountMutation.mutateAsync,
        deleteAccount: deleteAccountMutation.mutateAsync,

        // Page mutations
        createPage: createPageMutation.mutateAsync,
        updatePage: updatePageMutation.mutateAsync,
        deletePage: deletePageMutation.mutateAsync,

        // ── NEW: page post mutations ─────────────────────────────────────────
        createPagePost: createPagePostMutation.mutateAsync,
        deletePagePost: deletePagePostMutation.mutateAsync,

        // Campaign mutations
        createCampaign: createCampaignMutation.mutateAsync,

        // Ad Set mutations
        createAdSet: createAdSetMutation.mutateAsync,
        updateAdSet: updateAdSetMutation.mutateAsync,
        deleteAdSet: deleteAdSetMutation.mutateAsync,

        // Ad mutations
        createAd:    createAdMutation.mutateAsync,
        updateAd:    updateAdMutation.mutateAsync,
        deleteAd:    deleteAdMutation.mutateAsync,
        addCreative: ({ campaignId, data }) => api.addCreative({ campaign_id: campaignId, ...data }),

        // Targeting
        setTargeting: setTargetingMutation.mutateAsync,

        // Tracking
        trackImpression: (adId) => trackImpressionMutation.mutate(adId),
        trackClick:      (adId) => trackClickMutation.mutate(adId),

        // Mutation pending flags
        isCreatingAccount:  createAccountMutation.isPending,
        isUpdatingAccount:  updateAccountMutation.isPending,
        isDeletingAccount:  deleteAccountMutation.isPending,
        isCreatingPage:     createPageMutation.isPending,
        isUpdatingPage:     updatePageMutation.isPending,
        isDeletingPage:     deletePageMutation.isPending,
        isCreatingPagePost: createPagePostMutation.isPending, // ← NEW
        isCreatingCampaign: createCampaignMutation.isPending,
        isCreatingAdSet:    createAdSetMutation.isPending,
        isUpdatingAdSet:    updateAdSetMutation.isPending,
        isDeletingAdSet:    deleteAdSetMutation.isPending,
        isCreatingAd:       createAdMutation.isPending,
        isUpdatingAd:       updateAdMutation.isPending,
        isDeletingAd:       deleteAdMutation.isPending,

        // Refetch helpers
        refetchAccounts,
        refetchAllPages,  // ← NEW
        refetchCampaigns,
        refetchAdSets,
        refetchHierarchy,
        refetchPageFeed,  // ← NEW
      }}
    >
      {children}
    </AdsContext.Provider>
  );
};

export default AdsState;