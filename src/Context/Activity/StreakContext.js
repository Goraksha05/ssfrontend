// src/Context/Activity/StreakContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// import axios from '../../utils/axiosInstance';
// import { jwtDecode } from 'jwt-decode';

const StreakContext = createContext();
export { StreakContext };

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const StreakProvider = ({ children }) => {
  const [streakCount, setStreakCount] = useState(0);
  const [streakDates, setStreakDates] = useState([]);
  const [claimedDays, setClaimedDays] = useState([]);
  const [rewardMilestones] = useState([30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]);
  const [message, setMessage] = useState('');

  // Read token inside each callback to avoid stale closure when token changes
  const getToken = () => localStorage.getItem('token');

  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch (e) {
      const text = await res.text();
      console.error("❌ JSON parse failed:", text);
      return {};
    }
  };

  const apiRequest = useCallback(async (method, path, options = {}) => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    };

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      ...options
    });
    return res;
  }, []); // no token dep — reads fresh from localStorage each call

  // Fetch streak history
  const fetchStreakHistory = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await apiRequest('GET', '/api/activity/streak-history');
      const data = await safeJson(res);
      const formatted = Array.isArray(data.streakDates)
        ? data.streakDates.map(date => ({ date: new Date(date), count: 1 }))
        : [];
      setStreakDates(formatted);
      setStreakCount(formatted.length);
    } catch (err) {
      console.error('Failed to fetch streak history:', err);
    }
  }, [apiRequest]);

  // Fetch claimed streak slabs
  const fetchClaimedStreakSlabs = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await apiRequest('GET', '/api/activity/user');
      const data = await safeJson(res);
      const claimed = Array.isArray(data.activities)
        ? data.activities
          .filter(act => act.type === 'streak' && act.streakslab)
          .map(act => act.streakslab)
        : [];
      setClaimedDays(claimed);
    } catch (err) {
      console.error('Failed to fetch claimed streaks:', err);
    }
  }, [apiRequest]);

  // Claim streak reward
  const claimStreakReward = async (streakDay) => {
    if (!getToken() || !streakDay) return;
    try {
      const res = await apiRequest('POST', '/api/activity/streak-reward', {
        body: JSON.stringify({ streakslab: `${streakDay}days` })
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message);

      setMessage(data.message || '✅ Reward claimed!');
      await fetchClaimedStreakSlabs();
    } catch (err) {
      console.error('Error claiming streak reward:', err);
      setMessage('❌ Failed to claim streak reward');
    }
  };

  useEffect(() => {
    fetchStreakHistory();
    fetchClaimedStreakSlabs();
  }, [fetchStreakHistory, fetchClaimedStreakSlabs]);

  return (
    <StreakContext.Provider value={{
      streakCount,
      streakDates,
      claimedDays,
      fetchStreakHistory,
      claimStreakReward,
      message,
      rewardMilestones
    }}>
      {children}
    </StreakContext.Provider>
  );
};

export const useStreak = () => useContext(StreakContext);