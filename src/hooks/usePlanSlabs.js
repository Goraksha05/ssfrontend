// src/hooks/usePlanSlabs.js
import { useEffect, useState, useRef } from 'react';
import apiRequest from '../utils/apiRequest';
import { useAuth } from '../Context/Authorisation/AuthContext';

/**
 * Fetch reward slabs for the logged-in user's current plan.
 *
 * @param {'referral'|'posts'|'streak'} type
 * @returns {{ slabs: Array, planKey: string, loading: boolean, error: string|null }}
 */
export default function usePlanSlabs(type) {
  const { user, authtoken } = useAuth();

  const [slabs,   setSlabs]   = useState([]);
  const [planKey, setPlanKey] = useState('2500');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Track the type that was last fetched to avoid stale updates
  const lastFetchedType = useRef(null);

  useEffect(() => {
    if (!user || !authtoken || !type) return;

    let cancelled = false;
    lastFetchedType.current = type;
    setLoading(true);
    setError(null);

    apiRequest
      .get(`/api/rewards/${type}`)
      .then(res => {
        if (cancelled || lastFetchedType.current !== type) return;
        setSlabs(Array.isArray(res.data.slabs) ? res.data.slabs : []);
        setPlanKey(res.data.planKey || '2500');
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`[usePlanSlabs] ${type} fetch error:`, err);
        setError(`Failed to load ${type} reward slabs.`);
        setSlabs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [type, user, authtoken]);

  return { slabs, planKey, loading, error };
}