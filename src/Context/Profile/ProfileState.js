import React, { useReducer, useCallback } from 'react';
import ProfileContext from './ProfileContext';
import ProfileReducer from './ProfileReducer';
import {
  GET_PROFILE,
  PROFILE_ERROR,
  HANDLE_CHANGE,
} from './types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import handleAuthError from '../../utils/handleAuthError';
import { toast, ToastContainer } from "react-toastify";

const initialState = {
  profile: null,
  loading: true,
  error: null,
  formData: {
    dob: '',
    currentcity: '',
    hometown: '',
    sex: '',
    relationship: ''
  }
};

const ProfileState = ({ children }) => {
  const { user, token } = useAuth();
  const [state, dispatch] = useReducer(ProfileReducer, initialState);
  const queryClient = useQueryClient();

  const initializeFormData = useCallback((profile) => {
    const newFormData = {
      dob: profile.dob ? profile.dob.substring(0, 10) : '',
      currentcity: profile.currentcity || '',
      hometown: profile.hometown || '',
      sex: profile.sex || '',
      relationship: profile.relationship || '',
    };
    dispatch({ type: 'SET_FORMDATA', payload: newFormData });
  }, []);

  // ── Friend Suggestions ──────────────────────────────────────────────────────
  const {
    data: suggestions = [],
    refetch: fetchSuggestions,
    isLoading: suggestionsLoading,
  } = useQuery({
    queryKey: ['/api/friends/suggestions'],
    queryFn: async () => {
      if (!token) return [];
      try {
        const res = await apiRequest.get('/api/friends/suggestions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return res.data?.data || [];
      } catch (err) {
        console.error("Suggestion fetch error:", err);
        return [];
      }
    },
    enabled: !!user && !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    onError: () => toast.error('Failed to load friend suggestions'),
  });

  // ── Fetch Profile ──────────────────────────────────────────────────────────
  // FIX: The root cause of the "Failed to load profile" toast on new users:
  //  1. New users get a 404 (profile not created yet) — this is EXPECTED.
  //  2. apiRequest's global interceptor was toasting ALL non-2xx errors including 404.
  //  3. This function now sets `_silenceToast: true` so the interceptor skips the toast.
  //  4. We then only show a toast for genuinely unexpected errors (not 404, not 401).
  const fetchProfile = useCallback(async () => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      dispatch({ type: PROFILE_ERROR, payload: new Error('No auth token') });
      return;
    }

    try {
      const res = await apiRequest.get('/api/profile', {
        headers: { Authorization: `Bearer ${authToken}` },
        // Tell the global response interceptor not to auto-toast this request.
        // Profile fetch errors are fully handled below.
        _silenceToast: true,
      });

      const profileData = res.data;
      dispatch({ type: GET_PROFILE, payload: profileData });
      initializeFormData(profileData);
    } catch (error) {
      const status = error?.response?.status;

      // 401 → session expired; redirect to login
      if (status === 401) {
        handleAuthError(error);
        return;
      }

      dispatch({ type: PROFILE_ERROR, payload: error });

      // 404 → profile doesn't exist yet; Profile.js will call createDefaultProfile().
      // This is normal for brand-new users — do NOT show an error toast.
      if (status === 404) {
        return;
      }

      // Any other error (5xx, network timeout, etc.) → inform the user.
      toast.error("Failed to load profile. Please try again.");
    }
  }, [token, initializeFormData]);

  // ── Update Profile ──────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (data, callback) => {
    const authToken = token || localStorage.getItem('token');
    try {
      await apiRequest.put('/api/profile/updateprofile', data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });

      // Re-fetch to get server-populated data (e.g. populated user_id)
      await fetchProfile();

      if (callback) callback();

      queryClient.invalidateQueries(['/api/friends/suggestions']);
      fetchSuggestions();
    } catch (error) {
      handleAuthError(error);
      const msg = error.response?.data?.message || "Failed to save profile.";
      toast.error(msg);
      dispatch({ type: PROFILE_ERROR, payload: error });
      throw error;
    }
  }, [token, fetchProfile, queryClient, fetchSuggestions]);

  // ── Follow / Unfollow ──────────────────────────────────────────────────────
  const followUser = useCallback(async (targetUserId) => {
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await apiRequest.put(`/api/profile/follow/${targetUserId}`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      await fetchProfile();
      queryClient.invalidateQueries(['/api/friends/suggestions']);

      return res.data;
    } catch (err) {
      console.error('Follow error:', err);
      toast.error("Failed to update follow status.");
      dispatch({ type: PROFILE_ERROR, payload: err });
      throw err;
    }
  }, [token, fetchProfile, queryClient]);

  // ── Handle form field change ───────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    dispatch({ type: HANDLE_CHANGE, payload: { name, value } });
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile: state.profile,
        loading: state.loading,
        error: state.error,
        formData: state.formData,
        fetchProfile,
        handleChange,
        handleEdit: updateProfile,
        followUser,
        suggestions,
        fetchSuggestions,
        suggestionsLoading,
      }}
    >
      <ToastContainer position="top-left" autoClose={3000} />
      {children}
    </ProfileContext.Provider>
  );
};

export default ProfileState;