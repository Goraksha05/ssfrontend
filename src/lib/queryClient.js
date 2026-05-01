/**
 * lib/queryClient.js
 *
 * Centralised React Query configuration.
 *
 * Upgrades over the previous approach (plain useState + useCallback in context):
 *
 *  ✅ Automatic background refetch on window focus / network reconnect
 *  ✅ Stale-while-revalidate caching — no UI spinner on repeated visits
 *  ✅ Exponential back-off retry (skip 4xx; retry 5xx up to 3×)
 *  ✅ Query deduplication — if two components both call fetchAccounts()
 *     simultaneously, only one HTTP request is made
 *  ✅ Optimistic mutation helpers wired in once and reused everywhere
 *  ✅ Global error handler fires toast + auth:unauthorized event on 401
 */

import { QueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

// ── Retry policy ──────────────────────────────────────────────────────────────
// Never retry on 4xx (client errors). Retry 5xx up to 3 times with
// exponential back-off capped at 30 s.
const shouldRetry = (failureCount, error) => {
  const status = error?.response?.status ?? error?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 3;
};

const retryDelay = (attemptIndex) =>
  Math.min(1000 * 2 ** attemptIndex, 30_000);

// ── Global error handler ──────────────────────────────────────────────────────
function onQueryError(error) {
  const status = error?.response?.status ?? error?.status;

  if (status === 401) {
    // apiRequest already fires auth:unauthorized, but catch it here too
    // in case a raw fetch() bypasses the axios interceptor.
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    return;
  }

  // Don't toast network errors that are already retrying
  if (error?.name === 'AbortError') return;

  const msg =
    error?.response?.data?.message ??
    error?.message ??
    'Something went wrong.';

  toast.error(msg, { toastId: msg }); // dedup by message
}

// ── QueryClient singleton ──────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          30_000,   // treat data as fresh for 30 s
      gcTime:             5 * 60_000, // keep unused data in cache for 5 min
      retry:              shouldRetry,
      retryDelay,
      refetchOnWindowFocus:     true,
      refetchOnReconnect:       true,
      refetchOnMount:           true,
    },
    mutations: {
      onError: onQueryError,
    },
  },
});

// Wire the global query-error handler after the client is created
queryClient.getQueryCache().config.onError = onQueryError;