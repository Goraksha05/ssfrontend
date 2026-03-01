// src/Context/Subscription/SubscriptionContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import apiRequest from '../../utils/apiRequest';

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState(null); // 'annual' | null

  const openSubscription = useCallback(() => setShowSubscription(true), []);
  const closeSubscription = useCallback(() => setShowSubscription(false), []);

  const fetchSubscriptionDetails = useCallback(async () => {
    try {
      const res = await apiRequest.get('/api/subscription/details');
      const plan = res.data?.plan ?? null;
      setSubscriptionPlan(plan);
      return res.data;
    } catch {
      // Errors handled by interceptor
      return null;
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        showSubscription,
        openSubscription,
        closeSubscription,
        fetchSubscriptionDetails,
        subscriptionPlan,
        setSubscriptionPlan,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return ctx;
};