// src/components/Subscription/UpgradePrompt.js
import React from 'react';
import { Rocket } from 'lucide-react';
import { useSubscription } from '../../Context/Subscription/SubscriptionContext';
import { useAuth } from '../../Context/Authorisation/AuthContext';

const UpgradePrompt = () => {
  const { openSubscription } = useSubscription();
  const { user } = useAuth();

  const isVerified = !!user?.subscription?.active;

  if (isVerified) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 100%)',
        border: '1.5px solid #C7D2FE',
        margin: '12px 0',
        boxShadow: '0 2px 8px rgba(67,56,202,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Rocket size={20} color="#4338CA" />
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1E1B4B' }}>
          Become a verified member to unlock referral income & the blue badge!
        </span>
      </div>
      <button
        onClick={openSubscription}
        style={{
          padding: '9px 18px',
          background: 'linear-gradient(135deg, #4338CA, #6D28D9)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(67,56,202,0.3)',
          transition: '0.2s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(67,56,202,0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 12px rgba(67,56,202,0.3)'; }}
      >
        Upgrade Now →
      </button>
    </div>
  );
};

export default UpgradePrompt;