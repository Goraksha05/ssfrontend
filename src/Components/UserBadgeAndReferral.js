// src/components/UserBadgeAndReferral.js
import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '../Context/Authorisation/AuthContext';
import { useSubscription } from '../Context/Subscription/SubscriptionContext';
import { toast } from 'react-toastify';

const UserBadgeAndReferral = () => {
  const { user } = useAuth();
  const { subscriptionPlan } = useSubscription();

  const isVerified = subscriptionPlan === 'annual'; // Adjust based on your data model

  const handleReferral = () => {
    if (!isVerified) {
      toast.error('Only verified users can refer others.');
      return;
    }

    navigator.clipboard.writeText(user.referralId);
    toast.success('Referral ID copied to clipboard!');
  };

  return (
    <div className="relative w-full max-w-md mx-auto p-4 bg-white shadow-md rounded-xl mt-6">
      <div className="flex items-center space-x-3">
        <div className="relative">
          <img
            src={user.profileImage || '/default-avatar.png'}
            alt="User Avatar"
            className="w-14 h-14 rounded-full border-2 border-gray-300"
          />
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow">
              <BadgeCheck className="h-5 w-5 text-blue-500" />
            </div>
          )}
        </div>
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-gray-500">
            {isVerified ? 'Verified User' : 'Unverified User'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleReferral}
          disabled={!isVerified}
          className={`w-full px-4 py-2 rounded font-medium transition ${
            isVerified
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {isVerified ? 'Share My Referral ID' : 'Referral Disabled for Unverified'}
        </button>
      </div>
    </div>
  );
};

export default UserBadgeAndReferral;
