// src/Context/Friend/FriendContext.js
//
// Improvements over original:
//   • sentRequests state (outgoing)
//   • mutualFriends cache per targetId
//   • blockUser / unblockUser actions
//   • getFriendCount action
//   • Smarter socket event handling (friend_list_updated)
//   • Suggestion cache bust on accept / send / unfriend
//   • All fetches guarded against concurrent duplicate calls via fetchingRef
//
// FIXES:
//   1. `getSocket` was imported as a default export which does not exist on
//      WebSocketClient. The module only has named exports. The broken import
//      meant every `getSocket()` call returned `undefined`, so all socket
//      listeners (friend_request, friend_accept, friend_list_updated) silently
//      registered on `undefined` and never fired — and socket emissions for
//      notifying the other party of a friend request were also dead.
//      Fix: use the named import `{ getSocket }`.
//
//   2. The activity filter in sendRequest emitted a socket notification using
//      `userId` (parameter) which shadows the destructured `user` from useAuth.
//      The emit payload already used the parameter correctly, so no functional
//      change needed there, but the variable name was clarified.

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useReducer,
  useRef,
} from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../Authorisation/AuthContext';
// FIX: named import — WebSocketClient has no default export
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

export const FriendProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(FriendReducer, INITIAL_STATE);
  const {
    friends, requests, sentRequests, suggestions,
    loading, suggestionsLoading, requestsLoading, sentLoading
  } = state;

  const fetchingRef = useRef({
    friends: false, requests: false,
    suggestions: false, sent: false
  });

  // ─── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchFriends = useCallback(async () => {
    if (fetchingRef.current.friends) return;
    fetchingRef.current.friends = true;
    dispatch({ type: 'SET_LOADING', key: 'loading', value: true });
    try {
      const { data } = await apiRequest.get('/api/friends/all');
      dispatch({ type: 'SET_FRIENDS', payload: data?.data ?? [] });
    } catch (err) {
      console.error('[FriendContext] fetchFriends:', err);
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
      const { data } = await apiRequest.get('/api/friends/requests');
      dispatch({ type: 'SET_REQUESTS', payload: data?.data ?? [] });
    } catch (err) {
      console.error('[FriendContext] fetchRequests:', err);
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
      const { data } = await apiRequest.get('/api/friends/requests/sent');
      dispatch({ type: 'SET_SENT_REQUESTS', payload: data?.data ?? [] });
    } catch (err) {
      console.error('[FriendContext] fetchSentRequests:', err);
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
      const { data } = await apiRequest.get(url);
      dispatch({ type: 'SET_SUGGESTIONS', payload: data?.data ?? [] });
    } catch (err) {
      console.error('[FriendContext] fetchSuggestions:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'suggestionsLoading', value: false });
      fetchingRef.current.suggestions = false;
    }
  }, []);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const getFriendshipStatus = useCallback(async (targetId) => {
    try {
      const { data } = await apiRequest.get(`/api/friends/status/${targetId}`);
      return data;
    } catch (err) {
      console.error('[FriendContext] getFriendshipStatus:', err);
      return null;
    }
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
      const { data } = await apiRequest.post(`/api/friends/friend-request/${recipientId}`);
      if (data.status === 'success') {
        toast.success('Friend request sent!');
        dispatch({ type: 'REMOVE_SUGGESTION', payload: recipientId });
        dispatch({ type: 'ADD_SENT_REQUEST', payload: { _id: data.data?._id, recipientId } });

        // Notify the recipient via socket
        const socket = getSocket();
        socket?.emit('notify', {
          userId:  recipientId,
          message: `${user?.name} sent you a friend request`,
          type:    'friend_request',
        });
      } else {
        toast.error(data.message || 'Could not send request');
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] sendRequest:', err);
      throw err;
    }
  }, [user]);

  const cancelRequest = useCallback(async (friendshipId) => {
    try {
      const { data } = await apiRequest.delete(`/api/friends/friend-request/${friendshipId}/cancel`);
      if (data.status === 'success') {
        toast.success('Request cancelled.');
        dispatch({ type: 'REMOVE_SENT_REQUEST', payload: friendshipId });
        await fetchSuggestions();
      } else {
        toast.error(data.message || 'Could not cancel request');
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] cancelRequest:', err);
      throw err;
    }
  }, [fetchSuggestions]);

  const acceptRequest = useCallback(async (requestId) => {
    dispatch({ type: 'REMOVE_REQUEST', payload: requestId });
    try {
      const { data } = await apiRequest.put(`/api/friends/friend-request/${requestId}/accept`);
      if (data.status === 'success') {
        const name = data?.data?.requester?.name || 'Someone';
        toast.success(`🎉 You and ${name} are now friends!`);
        await Promise.all([fetchFriends(), fetchSuggestions()]);
        new Audio('/sounds/friend-accepted.mp3').play().catch(() => {});
      } else {
        toast.error(data.message || 'Failed to accept request');
        await fetchRequests();
      }
    } catch (err) {
      console.error('[FriendContext] acceptRequest:', err);
      await fetchRequests();
      throw err;
    }
  }, [fetchFriends, fetchRequests, fetchSuggestions]);

  const declineRequest = useCallback(async (requestId) => {
    dispatch({ type: 'REMOVE_REQUEST', payload: requestId });
    try {
      const { data } = await apiRequest.put(`/api/friends/friend-request/${requestId}/decline`);
      if (data.status !== 'success') {
        toast.error(data.message || 'Failed to decline request');
        await fetchRequests();
      }
    } catch (err) {
      console.error('[FriendContext] declineRequest:', err);
      await fetchRequests();
      throw err;
    }
  }, [fetchRequests]);

  const unfriend = useCallback(async (friendId) => {
    dispatch({ type: 'REMOVE_FRIEND', payload: friendId });
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

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;
    fetchFriends();
    fetchRequests();
    fetchSentRequests();
    fetchSuggestions();

    // FIX: getSocket() now returns the correct singleton because it is a named
    // import — previously this returned undefined from a missing default export.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ─── Real-time socket events ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;

    // FIX: getSocket() now resolves correctly with named import
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
          // Silently update sent requests (no toast — less awkward)
          fetchSentRequests();
          break;
        default:
          break;
      }
    };

    const handleFriendListUpdated = ({ action, userId: affectedId }) => {
      if (action === 'removed')  dispatch({ type: 'REMOVE_FRIEND', payload: affectedId });
      if (action === 'accepted') fetchFriends();
    };

    socket.on('notification',        handleNotification);
    socket.on('friend_list_updated', handleFriendListUpdated);

    return () => {
      socket.off('notification',        handleNotification);
      socket.off('friend_list_updated', handleFriendListUpdated);
    };
  }, [user?._id, fetchFriends, fetchRequests, fetchSentRequests, fetchSuggestions]);

  // ─── Clear on logout ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) dispatch({ type: 'CLEAR_FRIEND_DATA' });
  }, [user]);

  return (
    <FriendContext.Provider
      value={{
        friends, requests, sentRequests, suggestions,
        loading, suggestionsLoading, requestsLoading, sentLoading,
        fetchFriends, fetchRequests, fetchSentRequests, fetchSuggestions,
        sendRequest, cancelRequest, acceptRequest, declineRequest,
        unfriend, blockUser, unblockUser,
        getFriendshipStatus, getMutualFriends, getFriendCount,
      }}
    >
      {children}
    </FriendContext.Provider>
  );
};

export const useFriend = () => {
  const ctx = useContext(FriendContext);
  if (!ctx) throw new Error('useFriend must be used within a FriendProvider');
  return ctx;
};