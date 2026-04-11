// src/Context/Profile/ProfileState.js

import React, {
  useReducer, useCallback, useEffect, useRef, useMemo,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import ProfileContext from './ProfileContext';
import ProfileReducer, { initialProfileState } from './ProfileReducer';
import {
  GET_PROFILE,
  PROFILE_ERROR,
  HANDLE_CHANGE,
  SET_FORMDATA,
  SET_LOADING,
  UPDATE_PROFILE,
  CLEAR_PROFILE,
} from './types';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../Authorisation/AuthContext';
import handleAuthError from '../../utils/handleAuthError';

const BACKEND_URL =
  process.env.REACT_APP_SERVER_URL  ||
  process.env.REACT_APP_BACKEND_URL ||
  '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAuthHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function formDataFromProfile(profile) {
  return {
    dob:          profile.dob ? profile.dob.substring(0, 10) : '',
    currentcity:  profile.currentcity  || '',
    hometown:     profile.hometown     || '',
    sex:          profile.sex          || '',
    relationship: profile.relationship || '',
  };
}

// ── ProfileState ──────────────────────────────────────────────────────────────

const ProfileState = ({ children }) => {
  const { user, token } = useAuth();
  const [state, dispatch] = useReducer(ProfileReducer, initialProfileState);
  const queryClient = useQueryClient();

  const abortRef    = useRef(null);
  const fetchingRef = useRef(false);

  // ── Reset on logout ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) dispatch({ type: CLEAR_PROFILE });
  }, [user]);

  // ── Friend suggestions (React Query) ──────────────────────────────────────
  const {
    data:    suggestions = [],
    refetch: fetchSuggestions,
    isLoading: suggestionsLoading,
  } = useQuery({
    queryKey: ['friends-suggestions'],
    queryFn: async () => {
      if (!token) return [];
      try {
        const res = await apiRequest.get('/api/friends/suggestions', {
          headers: buildAuthHeaders(token),
        });
        return res.data?.data || [];
      } catch (err) {
        console.error('[ProfileState] Suggestion fetch error:', err);
        return [];
      }
    },
    enabled:   !!user && !!token,
    staleTime: 2 * 60 * 1000,
    retry:     1,
  });

  // ── fetchProfile ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      dispatch({ type: PROFILE_ERROR, payload: new Error('No auth token') });
      return;
    }
    if (fetchingRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = true;
    dispatch({ type: SET_LOADING, payload: true });

    try {
      const res = await apiRequest.get('/api/profile', {
        headers:       buildAuthHeaders(authToken),
        signal:        controller.signal,
        _silenceToast: true,
      });

      const profileData = res.data;
      dispatch({ type: GET_PROFILE, payload: profileData });
      dispatch({ type: SET_FORMDATA, payload: formDataFromProfile(profileData) });
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;

      const status = error?.response?.status;

      if (status === 401) {
        handleAuthError(error);
        return;
      }

      dispatch({ type: PROFILE_ERROR, payload: error });

      // 404 = no profile yet for new users — expected, no toast needed
      if (status === 404) return;

      toast.error('Failed to load profile. Please try again.');
    } finally {
      fetchingRef.current = false;
      dispatch({ type: SET_LOADING, payload: false });
    }
  }, [token]);

  // Fetch on mount / token change
  useEffect(() => {
    if (token) {
      fetchProfile();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line
  }, [token]); // fetchProfile intentionally omitted — stable via token dep

  // ── updateProfile (optimistic) ────────────────────────────────────────────
  const updateProfile = useCallback(async (data, callback) => {
    const authToken = token || localStorage.getItem('token');

    // Optimistic: apply the patch immediately
    const snapshot = state.profile;
    dispatch({ type: UPDATE_PROFILE, payload: data });

    try {
      await apiRequest.put('/api/profile/updateprofile', data, {
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(authToken),
        },
      });

      // Refetch to get server-populated fields
      await fetchProfile();
      callback?.();
      queryClient.invalidateQueries(['friends-suggestions']);
    } catch (error) {
      // Rollback optimistic change
      if (snapshot) dispatch({ type: GET_PROFILE, payload: snapshot });
      handleAuthError(error);
      toast.error(error.response?.data?.message || 'Failed to save profile.');
      dispatch({ type: PROFILE_ERROR, payload: error });
      throw error;
    }
  }, [token, state.profile, fetchProfile, queryClient]);

  // ── uploadAvatar ──────────────────────────────────────────────────────────
  /**
   * Upload a profile avatar and optimistically update state.
   * @param {File} file
   * @returns {Promise<string|null>} The new avatar URL, or null on failure.
   */
  const uploadAvatar = useCallback(async (file) => {
    const authToken = token || localStorage.getItem('token');
    if (!file || !authToken) return null;

    const formData = new FormData();
    formData.append('media', file);

    try {
      const res = await apiRequest.post(`${BACKEND_URL}/api/upload/profile`, formData, {
        headers: buildAuthHeaders(authToken),
      });

      const url = res.data?.url ?? res.data?.profileavatar?.URL ?? null;
      if (url) {
        dispatch({
          type:    UPDATE_PROFILE,
          payload: { profileavatar: { URL: url, type: 'image' } },
        });
      }
      return url;
    } catch (err) {
      toast.error('Failed to upload avatar. Please try again.');
      console.error('[ProfileState] uploadAvatar:', err);
      return null;
    }
  }, [token]);

  // ── updateCoverImage ──────────────────────────────────────────────────────
  const updateCoverImage = useCallback(async (file) => {
    const authToken = token || localStorage.getItem('token');
    if (!file || !authToken) return null;

    const formData = new FormData();
    formData.append('media', file);

    try {
      const res = await apiRequest.post(`${BACKEND_URL}/api/upload/cover`, formData, {
        headers: buildAuthHeaders(authToken),
      });
      const url = res.data?.url ?? null;
      if (url) {
        dispatch({ type: UPDATE_PROFILE, payload: { coverImage: url } });
      }
      return url;
    } catch (err) {
      toast.error('Failed to upload cover image. Please try again.');
      console.error('[ProfileState] updateCoverImage:', err);
      return null;
    }
  }, [token]);

  // ── followUser ────────────────────────────────────────────────────────────
  const followUser = useCallback(async (targetUserId) => {
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await apiRequest.put(
        `/api/profile/follow/${targetUserId}`,
        {},
        { headers: buildAuthHeaders(authToken) }
      );
      await fetchProfile();
      queryClient.invalidateQueries(['friends-suggestions']);
      return res.data;
    } catch (err) {
      console.error('[ProfileState] followUser:', err);
      toast.error('Failed to update follow status.');
      dispatch({ type: PROFILE_ERROR, payload: err });
      throw err;
    }
  }, [token, fetchProfile, queryClient]);

  // ── handleChange ─────────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    dispatch({ type: HANDLE_CHANGE, payload: { name, value } });
  }, []);

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    profile:           state.profile,
    loading:           state.loading,
    error:             state.error,
    formData:          state.formData,
    fetchProfile,
    handleChange,
    handleEdit:        updateProfile,
    updateProfile,
    uploadAvatar,
    updateCoverImage,
    followUser,
    suggestions,
    fetchSuggestions,
    suggestionsLoading,
  }), [
    state.profile, state.loading, state.error, state.formData,
    fetchProfile, handleChange, updateProfile,
    uploadAvatar, updateCoverImage, followUser,
    suggestions, fetchSuggestions, suggestionsLoading,
  ]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export default ProfileState;