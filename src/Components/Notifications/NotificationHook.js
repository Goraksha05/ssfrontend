// ✅ Notification Hook (useMilestoneNotification.js)
import { useEffect } from 'react';
import { toast } from 'react-toastify';

const useMilestoneNotification = ({ referralCount, postCount, streakCount }) => {
  useEffect(() => {
    const milestones = {
      referral: [3, 6, 10],
      post: [10, 25, 50],
      streak: [30, 60, 90]
    };

    milestones.referral.forEach(m => {
      if (referralCount === m) toast.info(`🎉 Referral milestone of ${m} reached! Claim your reward.`);
    });
    milestones.post.forEach(m => {
      if (postCount === m) toast.info(`📝 Post milestone of ${m} reached! Claim your reward.`);
    });
    milestones.streak.forEach(m => {
      if (streakCount === m) toast.info(`🔥 Streak milestone of ${m} reached! Claim your reward.`);
    });
  }, [referralCount, postCount, streakCount]);
};

export default useMilestoneNotification;