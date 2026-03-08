// src/Context/StatusContext.js
//
// Provides status feed, own statuses, and mutation actions to the whole app.
// Designed to sit alongside AuthContext — wrap it in index.js after AuthProvider.

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import apiRequest from '../utils/apiRequest';

const StatusContext = createContext(null);

export const StatusProvider = ({ children }) => {
  const [feed,        setFeed]        = useState([]);   // contacts' statuses
  const [myStatuses,  setMyStatuses]  = useState([]);   // current user's statuses
  const [loading,     setLoading]     = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  // Prevent duplicate in-flight requests
  const feedFetchRef = useRef(false);
  const myFetchRef   = useRef(false);

  // ── Fetch feed ─────────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    if (feedFetchRef.current) return;
    feedFetchRef.current = true;
    setFeedLoading(true);
    try {
      const res = await apiRequest.get('/api/status/feed');
      setFeed(res.data.feed ?? []);
    } catch (err) {
      console.error('[StatusContext] fetchFeed:', err);
    } finally {
      setFeedLoading(false);
      feedFetchRef.current = false;
    }
  }, []);

  // ── Fetch own statuses ─────────────────────────────────────────────────────
  const fetchMyStatuses = useCallback(async () => {
    if (myFetchRef.current) return;
    myFetchRef.current = true;
    try {
      const res = await apiRequest.get('/api/status/my');
      setMyStatuses(res.data.statuses ?? []);
    } catch (err) {
      console.error('[StatusContext] fetchMyStatuses:', err);
    } finally {
      myFetchRef.current = false;
    }
  }, []);

  // ── Post text status ───────────────────────────────────────────────────────
  const postTextStatus = useCallback(async ({ text, backgroundColor, fontStyle, privacy }) => {
    setLoading(true);
    try {
      const res = await apiRequest.post('/api/status', {
        text, backgroundColor, fontStyle, privacy, type: 'text'
      });
      if (res.data.success) {
        setMyStatuses(prev => [res.data.status, ...prev]);
        return { success: true, status: res.data.status };
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      console.error('[StatusContext] postTextStatus:', err);
      return { success: false, error: 'Failed to post status.' };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Post media status ──────────────────────────────────────────────────────
  const postMediaStatus = useCallback(async (formData) => {
    setLoading(true);
    try {
      const res = await apiRequest.post('/api/status', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setMyStatuses(prev => [res.data.status, ...prev]);
        return { success: true, status: res.data.status };
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      console.error('[StatusContext] postMediaStatus:', err);
      return { success: false, error: 'Failed to post status.' };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Delete status ──────────────────────────────────────────────────────────
  const deleteStatus = useCallback(async (statusId) => {
    try {
      await apiRequest.delete(`/api/status/${statusId}`);
      setMyStatuses(prev => prev.filter(s => s._id !== statusId));
      return { success: true };
    } catch (err) {
      console.error('[StatusContext] deleteStatus:', err);
      return { success: false };
    }
  }, []);

  // ── Mark single status viewed (optimistic UI) ──────────────────────────────
  const markViewed = useCallback((ownerId, statusId, viewerId) => {
    setFeed(prev =>
      prev.map(entry => {
        if (entry.user._id !== ownerId) return entry;
        const updatedStatuses = entry.statuses.map(s => {
          if (s._id !== statusId) return s;
          // Add viewer if not already present
          const alreadySeen = s.views?.some(v =>
            (v.viewer?._id ?? v.viewer) === viewerId
          );
          if (alreadySeen) return s;
          return { ...s, views: [...(s.views ?? []), { viewer: viewerId }] };
        });
        const hasUnread = updatedStatuses.some(
          s => !s.views?.some(v => (v.viewer?._id ?? v.viewer) === viewerId)
        );
        return { ...entry, statuses: updatedStatuses, hasUnread };
      })
    );
  }, []);

  return (
    <StatusContext.Provider
      value={{
        feed,
        myStatuses,
        loading,
        feedLoading,
        fetchFeed,
        fetchMyStatuses,
        postTextStatus,
        postMediaStatus,
        deleteStatus,
        markViewed
      }}
    >
      {children}
    </StatusContext.Provider>
  );
};

export const useStatus = () => {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error('useStatus must be used within a StatusProvider');
  return ctx;
};