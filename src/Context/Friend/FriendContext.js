// src/Context/Friend/FriendContext.js
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
import getSocket from '../../WebSocket/WebSocketClient';
import apiRequest from '../../utils/apiRequest';
import FriendReducer from './FriendReducer';

// ─── Context ──────────────────────────────────────────────────────────────────
const FriendContext = createContext(null);

// ─── Initial state ────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  friends: [],
  requests: [],
  suggestions: [],
  loading: false,
  suggestionsLoading: false,
  requestsLoading: false,
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const FriendProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(FriendReducer, INITIAL_STATE);
  const { friends, requests, suggestions, loading, suggestionsLoading, requestsLoading } = state;

  // Track ongoing fetch calls so we never have two in flight simultaneously
  const fetchingRef = useRef({ friends: false, requests: false, suggestions: false });

  // ─── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchFriends = useCallback(async () => {
    if (fetchingRef.current.friends) return;
    fetchingRef.current.friends = true;
    dispatch({ type: 'SET_LOADING', key: 'loading', value: true });
    try {
      const { data } = await apiRequest.get('/api/friends/all');
      dispatch({ type: 'SET_FRIENDS', payload: data?.data ?? [] });
    } catch (err) {
      console.error('[FriendContext] fetchFriends:', err);
      // Don't toast — apiRequest interceptor already does it
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

  // ─── Check friendship status for a specific user ─────────────────────────────
  const getFriendshipStatus = useCallback(async (targetId) => {
    try {
      const { data } = await apiRequest.get(`/api/friends/status/${targetId}`);
      return data; // { status, relationship, friendshipId }
    } catch (err) {
      console.error('[FriendContext] getFriendshipStatus:', err);
      return null;
    }
  }, []);

  // ─── Send a friend request ───────────────────────────────────────────────────
  const sendRequest = useCallback(async (userId) => {
    try {
      const { data } = await apiRequest.post(`/api/friends/friend-request/${userId}`);
      if (data.status === 'success') {
        toast.success('Friend request sent!');
        // Optimistically remove from suggestions
        dispatch({ type: 'REMOVE_SUGGESTION', payload: userId });
        // Emit socket notification so the recipient sees it live
        const socket = getSocket();
        socket?.emit('notify', {
          userId,
          message: `${user?.name} sent you a friend request`,
          type: 'friend_request',
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

  // ─── Cancel an outgoing friend request ──────────────────────────────────────
  const cancelRequest = useCallback(async (friendshipId) => {
    try {
      const { data } = await apiRequest.delete(`/api/friends/friend-request/${friendshipId}/cancel`);
      if (data.status === 'success') {
        toast.success('Friend request cancelled.');
        await fetchRequests();
        await fetchSuggestions();
      } else {
        toast.error(data.message || 'Could not cancel request');
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] cancelRequest:', err);
      throw err;
    }
  }, [fetchRequests, fetchSuggestions]);

  // ─── Accept a friend request ─────────────────────────────────────────────────
  const acceptRequest = useCallback(async (requestId) => {
    // Optimistic: remove from requests immediately for snappy UI
    dispatch({ type: 'REMOVE_REQUEST', payload: requestId });
    try {
      const { data } = await apiRequest.put(`/api/friends/friend-request/${requestId}/accept`);
      if (data.status === 'success') {
        const requesterName = data?.data?.requester?.name || 'Someone';
        toast.success(`🎉 ${requesterName} is now your friend!`);
        // Refresh friends & suggestions; requests already updated optimistically
        await Promise.all([fetchFriends(), fetchSuggestions()]);
        // Play audio if available
        new Audio('/sounds/friend-accepted.mp3').play().catch(() => {});
      } else {
        // Roll back the optimistic update
        toast.error(data.message || 'Failed to accept request');
        await fetchRequests();
      }
    } catch (err) {
      console.error('[FriendContext] acceptRequest:', err);
      await fetchRequests(); // roll back
      throw err;
    }
  }, [fetchFriends, fetchRequests, fetchSuggestions]);

  // ─── Decline a friend request ────────────────────────────────────────────────
  const declineRequest = useCallback(async (requestId) => {
    // Optimistic removal
    dispatch({ type: 'REMOVE_REQUEST', payload: requestId });
    try {
      const { data } = await apiRequest.put(`/api/friends/friend-request/${requestId}/decline`);
      if (data.status === 'success') {
        const name = data?.data?.requester?.name || 'Someone';
        toast('❌ Declined request from ' + name, { icon: false });
        new Audio('/sounds/friend-declined.mp3').play().catch(() => {});
      } else {
        toast.error(data.message || 'Failed to decline request');
        await fetchRequests(); // roll back
      }
    } catch (err) {
      console.error('[FriendContext] declineRequest:', err);
      await fetchRequests();
      throw err;
    }
  }, [fetchRequests]);

  // ─── Unfriend ────────────────────────────────────────────────────────────────
  const unfriend = useCallback(async (userId) => {
    // Optimistic removal from friends list
    dispatch({ type: 'REMOVE_FRIEND', payload: userId });
    try {
      const { data } = await apiRequest.delete(`/api/friends/unfriend/${userId}`);
      if (data.status === 'success') {
        toast.success('Unfriended.');
      } else {
        toast.error(data.message || 'Failed to unfriend');
        await fetchFriends(); // roll back
      }
      return data;
    } catch (err) {
      console.error('[FriendContext] unfriend:', err);
      await fetchFriends();
      throw err;
    }
  }, [fetchFriends]);

  // ─── Bootstrap: load data & join socket room on login ────────────────────────
  useEffect(() => {
    if (!user?._id) return;

    fetchFriends();
    fetchRequests();
    fetchSuggestions();

    const socket = getSocket();
    if (socket) {
      socket.emit('join-room', user._id);
      socket.emit('user-online', {
        userId: user._id,
        name: user.name,
        hometown: user.hometown,
        currentcity: user.currentcity,
        timestamp: new Date().toISOString(),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]); // Only re-run when user ID changes (login/logout)

  // ─── Real-time socket notifications ──────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNotification = (payload) => {
      if (!payload?.type) return;
      switch (payload.type) {
        case 'friend_request':
          toast(payload.message || 'New friend request', { icon: '👤' });
          fetchRequests();
          break;
        case 'friend_accept':
          toast.success(payload.message || 'Friend request accepted!');
          fetchFriends();
          fetchSuggestions();
          break;
        case 'friend_decline':
          toast(payload.message || 'Friend request declined', { icon: '❌' });
          break;
        default:
          break; // Other notification types handled elsewhere
      }
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user?._id, fetchFriends, fetchRequests, fetchSuggestions]);

  // ─── Clear state on logout ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'CLEAR_FRIEND_DATA' });
    }
  }, [user]);

  return (
    <FriendContext.Provider
      value={{
        friends,
        requests,
        suggestions,
        loading,
        suggestionsLoading,
        requestsLoading,
        fetchFriends,
        fetchRequests,
        fetchSuggestions,
        sendRequest,
        cancelRequest,
        acceptRequest,
        declineRequest,
        unfriend,
        getFriendshipStatus,
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