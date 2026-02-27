// context/ReferralContext.js
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
// import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const ReferralContext = createContext();
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const ReferralProvider = ({ children }) => {
  const [referralActivities, setReferralActivities] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  const [referredUsers, setReferredUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const userId = token ? jwtDecode(token)?.user?.id : '';

  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch (e) {
      const text = await res.text();
      console.error("❌ JSON parse failed:", text);
      return {};
    }
  };

  const apiRequest = useCallback(async (method, path) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers
    });
    return res;
  }, [token]);

  const fetchReferralData = useCallback(async () => {
    if (!token || !userId) return;
    try {
      const [activityRes, usersRes] = await Promise.all([
        apiRequest('GET', '/api/activity/user'),
        apiRequest('GET', '/api/auth/users/referred')
      ]);

      const activityData = await safeJson(activityRes);
      const usersData = await safeJson(usersRes);

      const activities = Array.isArray(activityData.activities) ? activityData.activities : [];

      const referrals = activities.filter(
        (act) => act.type === 'referral' && (act.referral === userId || act.referral?._id === userId)
      );
      setReferralActivities(referrals);

      const referred = Array.isArray(usersData.referredUsers)
        ? usersData.referredUsers
        : [];

      setReferredUsers(referred);
      setReferralCount(referred.length);
    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token, userId]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  return (
    <ReferralContext.Provider
      value={{ referralActivities, referralCount, referredUsers, fetchReferralData, loading }}
    >
      {children}
    </ReferralContext.Provider>
  );
};

export const useReferral = () => useContext(ReferralContext);