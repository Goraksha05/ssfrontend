// src/hooks/usePlanSlabs.js
import { useEffect, useState } from 'react';
import apiRequest from '../utils/apiRequest';
import { useAuth } from '../Context/Authorisation/AuthContext';

/**
 * @param {"referral"|"posts"|"streak"} type
 * @returns {Array} reward slabs for the logged‑in user’s current plan
 */
export default function usePlanSlabs(type) {
  const { user } = useAuth();
  const [slabs, setSlabs] = useState([]);

  useEffect(() => {
    if (!user) return;
    apiRequest
      .get(`/api/rewards/${type}`)
      .then(res => setSlabs(res.data.slabs || []))
      .catch(err => console.error(`[usePlanSlabs] ${type} fetch error`, err));
  }, [type, user]);

  return slabs;
}
