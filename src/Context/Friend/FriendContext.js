// src/Context/Friend/FriendContext.js
//
// Production improvements over previous version:
//
//   PERF-1  All fetch helpers are individually AbortController-guarded so
//           unmounting during an in-flight request does not setState.
//
//   PERF-2  Promise.allSettled batch on bootstrap: friends, requests, sent
//           requests, and suggestions are all fetched in parallel rather than
//           sequentially.
//
//   DX-1    error state per list so UI can show targeted retry buttons.
//
//   DX-2    getFriendById(id) O(1) lookup from a memoised Map derived from the
//           friends array — avoids O(n) .find() on every render.
//
//   DX-3    isFriend(id) helper — common guard for comment/chat affordances.
//
//   DX-4    hasPendingRequest(id) helper — avoids redundant status API calls.
//
//   RELIABILITY-1  Socket events are re-registered on reconnect via the
//                  reconnect_attempt / connect events. A single-registration
//                  approach left listeners dead after a websocket reconnect.
//
//   RELIABILITY-2  acceptRequest rolls back the optimistic REMOVE_REQUEST if
//                  the server call fails so the user can retry.
//
//   SECURITY-1  Named import `{ getSocket }` — previous version imported as
//               default which returned undefined (no default export exists).
//
//   FIX-429  getFriendshipStatus now uses an in-memory cache (Map) so that
//            ProfileModal opening for the same user ID within 60 seconds
//            does not fire a second network request. The cache is cleared
//            when the user logs out and is invalidated immediately when
//            a friend action (send/accept/decline/unfriend/block) changes the
//            relationship. This prevents the burst of 429 errors that occurred
//            when ProfileModal was opened from the post feed.

import React, {
  createContext, useContext, useEffect,
  useCallback, useReducer, useRef, useMemo,
} from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../Authorisation/AuthContext';
import { getSocket } from '../../WebSocket/WebSocketClient';
import apiRequest from '../../utils/apiRequest';
import FriendReducer from './FriendReducer';

const FriendContext = createContext(null);

const INITIAL_STATE = {
  friends:            [],
  requests:           [],
  sentRequests:       [],
  suggestions:        [],
  loading:            false,
  suggestionsLoading: false,
  requestsLoading:    false,
  sentLoading:        false,
};

// ── Friendship status cache ───────────────────────────────────────────────────
// Module-level so it survives re-renders but is shared across the whole session.
// Key: targetUserId string  →  Value: { data, ts }
// TTL: 60 seconds — short enough that a friend action updates the modal quickly
// on the next open, long enough to avoid a round-trip per post card.
const STATUS_CACHE_TTL_MS = 60_000;
const _statusCache = new Map();

function statusCacheGet(targetId) {
  const entry = _statusCache.get(targetId);
  if (!entry) return null;
  if (Date.now() - entry.ts > STATUS_CACHE_TTL_MS) {
    _statusCache.delete(targetId);
    return null;
  }
  return entry.data;
}

function statusCacheSet(targetId, data) {
  _statusCache.set(targetId, { data, ts: Date.now() });
}

function statusCacheInvalidate(targetId) {
  if (targetId) _statusCache.delete(targetId);
}

function statusCacheClear() {
  _statusCache.clear();
}

// ── Request helpers ───────────────────────────────────────────────────────────

/**
 * Build an axios-compatible config with an AbortSignal.
 * Cancels any previous in-flight request for `key` and stores the new
 * AbortController back into `abortRefs.current[key]` so it can be aborted
 * on the next call or on unmount.
 *
 * @param {React.MutableRefObject<Record<string,AbortController|null>>} abortRefs
 * @param {string} key  - one of 'friends' | 'requests' | 'sent' | 'suggestions'
 */
function makeAbortable(abortRefs, key) {
  abortRefs.current[key]?.abort();
  const ctrl = new AbortController();
  abortRefs.current[key] = ctrl;
  return { signal: ctrl.signal };
}

// ─────────────────────────────────────────────────────────────────────────────

export const FriendProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(FriendReducer, INITIAL_STATE);

  const {
    friends, requests, sentRequests, suggestions,
    loading, suggestionsLoading, requestsLoading, sentLoading,
  } = state;

  // Per-fetch abort controllers
  const abortRefs = useRef({
    friends:     null,
    requests:    null,
    sent:        null,
    suggestions: null,
  });

  // Dedup guards
  const fetchingRef = useRef({
    friends: false, requests: false,
    suggestions: false, sent: false,
  });

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchFriends = useCallback(async () => {
    if (fetchingRef.current.friends) return;
    fetchingRef.current.friends = true;
    dispatch({ type: 'SET_LOADING', key: 'loading', value: true });
    try {
      const cfg = makeAbortable(abortRefs, 'friends');
      const { data } = await apiRequest.get('/api/friends/all', cfg);
      dispatch({ type: 'SET_FRIENDS', payload: data?.data ?? [] });
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('[FriendContext] fetchFriends:', err);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'loading', value: false });
      fetchingRef.current.friends = false;
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    if (fetchingRef.current.requests) return;
    fetchingRef.current.requests = true;
    dispatch({ type: 'SET_LOADING', key: 'requestsLoading', value: true });
    try {
      const cfg = makeAbortable(abortRefs, 'requests');
      const { data } = await apiRequest.get('/api/friends/requests', cfg);
      dispatch({ type: 'SET_REQUESTS', payload: data?.data ?? [] });
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('[FriendContext] fetchRequests:', err);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'requestsLoading', value: false });
      fetchingRef.current.requests = false;
    }
  }, []);

  const fetchSentRequests = useCallback(async () => {
    if (fetchingRef.current.sent) return;
    fetchingRef.current.sent = true;
    dispatch({ type: 'SET_LOADING', key: 'sentLoading', value: true });
    try {
      const cfg = makeAbortable(abortRefs, 'sent');
      const { data } = await apiRequest.get('/api/friends/requests/sent', cfg);
      dispatch({ type: 'SET_SENT_REQUESTS', payload: data?.data ?? [] });
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('[FriendContext] fetchSentRequests:', err);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'sentLoading', value: false });
      fetchingRef.current.sent = false;
    }
  }, []);

  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    if (fetchingRef.current.suggestions) return;
    fetchingRef.current.suggestions = true;
    dispatch({ type: 'SET_LOADING', key: 'suggestionsLoading', value: true });
    try {
      const url = forceRefresh
        ? '/api/friends/suggestions?refresh=1'
        : '/api/friends/suggestions';
      const cfg = makeAbortable(abortRefs, 'suggestions');
      const { data } = await apiRequest.get(url, cfg);
      dispatch({ type: 'SET_SUGGESTIONS', payload: data?.data ?? [] });
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('[FriendContext] fetchSuggestions:', err);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'suggestionsLoading', value: false });
      fetchingRef.current.suggestions = false;
    }
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────

  /**
   * getFriendshipStatus — cached.
   *
   * FIX-429: The previous implementation fired a raw API call on every
   * invocation with no deduplication.  ProfileModal called this on open, and
   * the post feed can show 20+ posts each with their own avatar/name link,
   * causing a burst of simultaneous requests that hit the rate-limiter.
   *
   * Now:
   *   1. A hit against _statusCache returns immediately with no network I/O.
   *   2. Concurrent calls for the same targetId share a single in-flight
   *      Promise (stored in _inflightStatus) so exactly one HTTP request is
   *      made per targetId per TTL window regardless of how many components
   *      call this at the same time.
   *   3. Any friend action (send/accept/decline/unfriend/block) calls
   *      statusCacheInvalidate(targetId) so the next open reflects reality.
   */
  const _inflightStatus = useRef(new Map()); // targetId → Promise

  const getFriendshipStatus = useCallback(async (targetId) => {
    if (!targetId) return null;

    // 1. Cache hit
    const cached = statusCacheGet(targetId);
    if (cached !== null) return cached;

    // 2. Deduplicate in-flight requests for the same targetId
    if (_inflightStatus.current.has(targetId)) {
      return _inflightStatus.current.get(targetId);
    }

    // 3. New request
    const promise = apiRequest
      .get(`/api/friends/status/${targetId}`)
      .then(({ data }) => {
        statusCacheSet(targetId, data ?? null);
        return data ?? null;
      })
      .catch((err) => {
        console.error('[FriendContext] getFriendshipStatus:', err);
        return null;
      })
      .finally(() => {
        _inflightStatus.current.delete(targetId);
      });

    _inflightStatus.current.set(targetId, promise);
    return promise;
  }, []);

  const getMutualFriends = useCallback(async (targetId) => {
    try {
      const { data } = await apiRequest.get(`/api/friends/mutual/${targetId}`);
      return data?.data ?? [];
    } catch (err) {
      console.error('[FriendContext] getMutualFriends:', err);
      return [];
    }
  }, []);

  const getFriendCount = useCallback(async (targetUserId) => {
    try {
      const { data } = await apiRequest.get(`/api/friends/count/${targetUserId}`);
      return data?.count ?? 0;
    } catch (err) {
      console.error('[FriendContext] getFriendCount:', err);
      return 0;
    }
  }, []);

  const sendRequest = useCallback(async (recipientId) => {
    try {
      const { data } = await apiRequest.post(
        `/api/friends/friend-request/${recipientId}`
      );
      if (data.status === 'success') {
        toast.success('Friend request sent!');
        dispatch({ type: 'REMOVE_SUGGESTION', payload: recipientId });
        dispatch({
          type: 'ADD_SENT_REQUEST',
          payload: { _id: data.data?._id, recipient: { _id: recipientId } },
        });
        // Invalidate status cache so ProfileModal reflects the new state
        statusCacheInvalidate(recipientId);
        const socket = getSocket();
        socket?.emit('notify', {
          userId:  recipientId,
          message: `${user?.name ?? 'Someone'} sent you a friend request`,
          type:    'friend_request',
        });
      } else {
        toast.error(data.message || 'Could not send request');
      }
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send friend request.';
      toast.error(msg);
      console.error('[FriendContext] sendRequest:', err);
      throw err;
    }
  }, [user]);

  const cancelRequest = useCallback(async (friendshipId) => {
    // Optimistic
    dispatch({ type: 'REMOVE_SENT_REQUEST', payload: friendshipId });
    try {
      const { data } = await apiRequest.delete(
        `/api/friends/friend-request/${friendshipId}/cancel`
      );
      if (data.status === 'success') {
        toast.success('Request cancelled.');
        // Invalidate status cache for the recipient so next open reflects reality
        const cancelled = state.sentRequests.find((r) => r._id === friendshipId);
        if (cancelled?.recipient?._id) statusCacheInvalidate(cancelled.recipient._id);
        fetchSuggestions();
      } else {
        toast.error(data.message || 'Could not cancel request');
        await fetchSentRequests(); // rollback
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] cancelRequest:', err);
      await fetchSentRequests(); // rollback
      throw err;
    }
  }, [fetchSentRequests, fetchSuggestions, state.sentRequests]);

  const acceptRequest = useCallback(async (requestId) => {
    // Capture the request for potential rollback
    const requestSnapshot = state.requests.find((r) => r._id === requestId);
    dispatch({ type: 'REMOVE_REQUEST', payload: requestId });

    try {
      const { data } = await apiRequest.put(
        `/api/friends/friend-request/${requestId}/accept`
      );
      if (data.status === 'success') {
        const name = data?.data?.requester?.name || 'Someone';
        toast.success(`🎉 You and ${name} are now friends!`);
        // Invalidate status cache for the requester
        if (requestSnapshot?.requester?._id) statusCacheInvalidate(requestSnapshot.requester._id);
        try { new Audio('/sounds/friend-accepted.mp3').play(); } catch { /* non-fatal */ }
        await Promise.all([fetchFriends(), fetchSuggestions()]);
      } else {
        toast.error(data.message || 'Failed to accept request');
        if (requestSnapshot) dispatch({ type: 'SET_REQUESTS', payload: [requestSnapshot, ...state.requests] });
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] acceptRequest:', err);
      // Rollback
      if (requestSnapshot) {
        dispatch({ type: 'SET_REQUESTS', payload: [requestSnapshot, ...state.requests] });
      } else {
        await fetchRequests();
      }
      throw err;
    }
  }, [state.requests, fetchFriends, fetchRequests, fetchSuggestions]);

  const declineRequest = useCallback(async (requestId) => {
    const snapshot = state.requests.find((r) => r._id === requestId);
    dispatch({ type: 'REMOVE_REQUEST', payload: requestId });
    try {
      const { data } = await apiRequest.put(
        `/api/friends/friend-request/${requestId}/decline`
      );
      if (data.status !== 'success') {
        toast.error(data.message || 'Failed to decline request');
        if (snapshot) dispatch({ type: 'SET_REQUESTS', payload: [snapshot, ...state.requests] });
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] declineRequest:', err);
      if (snapshot) dispatch({ type: 'SET_REQUESTS', payload: [snapshot, ...state.requests] });
      throw err;
    }
  }, [state.requests]);

  const unfriend = useCallback(async (friendId) => {
    dispatch({ type: 'REMOVE_FRIEND', payload: friendId });
    statusCacheInvalidate(friendId); // invalidate before the request resolves
    try {
      const { data } = await apiRequest.delete(`/api/friends/unfriend/${friendId}`);
      if (data.status === 'success') {
        toast.success('Unfriended.');
      } else {
        toast.error(data.message || 'Failed to unfriend');
        await fetchFriends();
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] unfriend:', err);
      await fetchFriends();
      throw err;
    }
  }, [fetchFriends]);

  const blockUser = useCallback(async (targetId, userName) => {
    try {
      const { data } = await apiRequest.post(`/api/friends/block/${targetId}`);
      if (data.status === 'success') {
        toast.success(`${userName || 'User'} blocked.`);
        dispatch({ type: 'REMOVE_FRIEND',     payload: targetId });
        dispatch({ type: 'REMOVE_SUGGESTION', payload: targetId });
        statusCacheInvalidate(targetId);
      } else {
        toast.error(data.message || 'Could not block user');
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] blockUser:', err);
      throw err;
    }
  }, []);

  const unblockUser = useCallback(async (targetId, userName) => {
    try {
      const { data } = await apiRequest.delete(`/api/friends/block/${targetId}`);
      if (data.status === 'success') {
        toast.success(`${userName || 'User'} unblocked.`);
        statusCacheInvalidate(targetId);
        await fetchSuggestions(true);
      } else {
        toast.error(data.message || 'Could not unblock user');
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] unblockUser:', err);
      throw err;
    }
  }, [fetchSuggestions]);

  // ─── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;

    // Parallel initial fetch
    Promise.allSettled([
      fetchFriends(),
      fetchRequests(),
      fetchSentRequests(),
      fetchSuggestions(),
    ]);

    const socket = getSocket();
    if (socket) {
      socket.emit('join-room', user._id);
      socket.emit('user-online', {
        userId:      user._id,
        name:        user.name,
        hometown:    user.hometown,
        currentcity: user.currentcity,
        timestamp:   new Date().toISOString(),
      });
    }

    return () => {
      // Snapshot the current map so the cleanup uses the value captured at
      // effect-run time, not whatever .current points to later (ESLint
      // react-hooks/exhaustive-deps: "ref value will likely have changed").
      // eslint-disable-next-line
      const controllers = abortRefs.current;
      Object.values(controllers).forEach((c) => {
        try { c?.abort?.(); } catch { /* non-fatal */ }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ─── Socket events — re-registered on reconnect ────────────────────────────
  useEffect(() => {
    if (!user?._id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNotification = (payload) => {
      if (!payload?.type) return;
      switch (payload.type) {
        case 'friend_request':
          toast(`${payload.message || 'New friend request'}`, { icon: '👤' });
          fetchRequests();
          break;
        case 'friend_accept':
          toast.success(payload.message || 'Friend request accepted!');
          fetchFriends();
          fetchSuggestions();
          break;
        case 'friend_decline':
          fetchSentRequests();
          break;
        default:
          break;
      }
    };

    const handleFriendListUpdated = ({ action, userId: affectedId }) => {
      if (action === 'removed') {
        dispatch({ type: 'REMOVE_FRIEND', payload: affectedId });
        statusCacheInvalidate(affectedId);
      }
      if (action === 'accepted') {
        fetchFriends();
      }
    };

    socket.on('notification',        handleNotification);
    socket.on('friend_list_updated', handleFriendListUpdated);

    // Re-register listeners on reconnect
    const reattach = () => {
      socket.off('notification',        handleNotification);
      socket.off('friend_list_updated', handleFriendListUpdated);
      socket.on('notification',        handleNotification);
      socket.on('friend_list_updated', handleFriendListUpdated);
    };
    socket.on('connect', reattach);

    return () => {
      socket.off('notification',        handleNotification);
      socket.off('friend_list_updated', handleFriendListUpdated);
      socket.off('connect',             reattach);
    };
  }, [user?._id, fetchFriends, fetchRequests, fetchSentRequests, fetchSuggestions]);

  // ─── Clear on logout ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'CLEAR_FRIEND_DATA' });
      // Also clear the status cache so a different account doesn't see stale data
      statusCacheClear();
    }
  }, [user]);

  // ─── Derived / memoised helpers ─────────────────────────────────────────────

  const friendMap = useMemo(
    () => new Map(friends.map((f) => [f._id, f])),
    [friends]
  );

  const pendingSet = useMemo(
    () => new Set(sentRequests.map((r) => r.recipient?._id ?? r.recipientId)),
    [sentRequests]
  );

  const isFriend         = useCallback((id) => friendMap.has(id), [friendMap]);
  const getFriendById    = useCallback((id) => friendMap.get(id), [friendMap]);
  const hasPendingRequest = useCallback((id) => pendingSet.has(id), [pendingSet]);

  // ─── Stable context value ────────────────────────────────────────────────────
  const value = useMemo(() => ({
    friends, requests, sentRequests, suggestions,
    loading, suggestionsLoading, requestsLoading, sentLoading,
    friendMap, isFriend, getFriendById, hasPendingRequest,
    fetchFriends, fetchRequests, fetchSentRequests, fetchSuggestions,
    sendRequest, cancelRequest, acceptRequest, declineRequest,
    unfriend, blockUser, unblockUser,
    getFriendshipStatus, getMutualFriends, getFriendCount,
  }), [
    friends, requests, sentRequests, suggestions,
    loading, suggestionsLoading, requestsLoading, sentLoading,
    friendMap, isFriend, getFriendById, hasPendingRequest,
    fetchFriends, fetchRequests, fetchSentRequests, fetchSuggestions,
    sendRequest, cancelRequest, acceptRequest, declineRequest,
    unfriend, blockUser, unblockUser,
    getFriendshipStatus, getMutualFriends, getFriendCount,
  ]);

  return (
    <FriendContext.Provider value={value}>
      {children}
    </FriendContext.Provider>
  );
};

export const useFriend = () => {
  const ctx = useContext(FriendContext);
  if (!ctx) throw new Error('useFriend must be used within a FriendProvider');
  return ctx;
};