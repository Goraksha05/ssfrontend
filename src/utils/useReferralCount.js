// utils/useReferralCount.js
import { useMemo } from 'react';

const useReferralCount = (activities, userId) => {
  return useMemo(() => {
    if (!activities || !userId) return 0;

    return activities.filter(activity => {
      const referrerId = activity.referral?._id || activity.referral;
      return referrerId?.toString() === userId.toString();
    }).length;
  }, [activities, userId]);
};

export default useReferralCount;
