// src/Context/Subscription/SubscriptionContext.js
import React, { createContext, useContext, useState } from 'react';
import apiRequest from '../../utils/apiRequest';  // Adjust path if needed

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [showSubscription, setShowSubscription] = useState(false);

  const openSubscription = () => setShowSubscription(true);
  const closeSubscription = () => setShowSubscription(false);

  const fetchSubscriptionDetails = async () => {
    try {
      const res = await apiRequest.get('/api/subscription/details');
      console.log("✅ Subscription details:", res.data);
      // You can set subscription state here if needed
    } catch (err) {
      // Errors already handled by interceptor
    }
  };

  return (
    <SubscriptionContext.Provider value={{
      showSubscription,
      openSubscription,
      closeSubscription,
      fetchSubscriptionDetails,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
