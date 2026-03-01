// src/components/UserBadgeAndReferral.js
import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '../Context/Authorisation/AuthContext';
import { useSubscription } from '../Context/Subscription/SubscriptionContext';
import { toast } from 'react-toastify';

const UserBadgeAndReferral = () => {
  const { user } = useAuth();
  const { openSubscription } = useSubscription();

  const isVerified = !!user?.subscription?.active;

  const handleReferral = () => {
    if (!isVerified) {
      openSubscription(); // Nudge unverified users to subscribe
      return;
    }
    if (!user?.referralId) {
      toast.error('Referral ID not available. Please contact support.');
      return;
    }
    navigator.clipboard.writeText(user.referralId)
      .then(() => toast.success('Referral ID copied to clipboard!'))
      .catch(() => toast.error('Failed to copy. Please copy manually: ' + user.referralId));
  };

  if (!user) return null;

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: '380px',
        padding: '20px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.07)',
        margin: '0 auto',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* User Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={user.profileImage || '/default-avatar.png'}
            alt={user.name}
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: isVerified ? '2.5px solid #3B82F6' : '2.5px solid #E2E8F0',
            }}
          />
          {isVerified && (
            <div
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                background: 'white',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            >
              <BadgeCheck size={18} color="#3B82F6" />
            </div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </p>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: isVerified ? '#3B82F6' : '#94A3B8', fontWeight: 600 }}>
            {isVerified ? `✓ Verified · ${user.subscription?.plan}` : 'Unverified'}
          </p>
        </div>
      </div>

      {/* Referral CTA */}
      <button
        onClick={handleReferral}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          border: 'none',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: '0.2s ease',
          background: isVerified
            ? 'linear-gradient(135deg, #3B82F6, #2563EB)'
            : 'linear-gradient(135deg, #EEF2FF, #F0F9FF)',
          color: isVerified ? 'white' : '#4338CA',
          border: isVerified ? 'none' : '1.5px solid #C7D2FE',
          boxShadow: isVerified ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
        }}
        onMouseEnter={e => { if (isVerified) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(59,130,246,0.4)'; } }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isVerified ? '0 4px 12px rgba(59,130,246,0.3)' : 'none'; }}
      >
        {isVerified
          ? `📋 Share My Referral ID: ${user.referralId}`
          : '🚀 Upgrade to Share Referrals'}
      </button>
    </div>
  );
};

export default UserBadgeAndReferral;