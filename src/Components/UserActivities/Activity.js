// Activity.jsx — Improved main Activity page
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import UserActivityDashboard from './UserActivityDashboard';
import postContext from '../../Context/Posts/PostContext';
import { StreakProvider } from '../../Context/Activity/StreakContext';
import apiRequest from '../../utils/apiRequest';
import ObtainedRewardsModal from './ObtainedRewardsModal';
import RewardsHub from '../Rewards/RewardsHub';

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

const Activity = () => {
  const { user: currentUser, isAuthenticated, token } = useAuth();

  const [
    // userData,
    setUserData
  ] = useState(null);
  const [activeTab, setActiveTab] = useState('streak');
  const [showRewards, setShowRewards] = useState(false);
  const [
    // fetching,
    setFetching
  ] = useState(false);
  const { statePosts } = useContext(postContext);

  const fetchUser = useCallback(async () => {
    if (!currentUser?._id || !token) return;
    setFetching(true);
    try {
      const res = await apiRequest.get(
        `${SERVER_URL}/api/auth/getuser/${currentUser._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserData(res.data);
    } catch (err) {
      console.error('[Activity] fetchUser error:', err);
    } finally {
      setFetching(false);
    }
  }, [currentUser, token, setFetching, setUserData]);

  useEffect(() => {
    if (isAuthenticated && currentUser) fetchUser();
  }, [isAuthenticated, currentUser, fetchUser]);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="activity-auth-wall">
        <span className="activity-lock-icon">🔒</span>
        <p className="activity-auth-msg">Please log in to view your activity.</p>
      </div>
    );
  }

  const tabs = [
    { key: 'streak', label: '🔥 Streaks', color: '#ff6b35' },
    { key: 'referral', label: '🤝 Referrals', color: '#10b981' },
    { key: 'post', label: '📝 Posts', color: '#f59e0b' },
  ];

  // const rewardItems = [
  //   { icon: '🛒', label: 'Grocery Coupons', value: `₹${userData?.totalGroceryCoupons || 0}`,  color: '#10b981' },
  //   { icon: '📈', label: 'Company Shares',  value: userData?.totalShares || 0,                 color: '#6366f1' },
  //   { icon: '🎟️', label: 'Referral Tokens', value: userData?.totalReferralToken || 0,           color: '#f59e0b' },
  // ];

  return (
    <div className="activity-page">
      {/* ── Header ── */}
      <div className="activity-header">
        <h1 className="activity-title">
          <span className="activity-title-accent">Activity</span> Dashboard
        </h1>
        <button className="activity-rewards-btn" onClick={() => setShowRewards(true)}>
          🏆 My Rewards
        </button>
      </div>

      {/* ── Reward Summary Cards ── */}
      {/* {fetching ? (
        <div className="activity-skeleton-row">
          {[0, 1, 2].map(i => <div key={i} className="activity-skeleton" />)}
        </div>
      ) : (
        <div className="activity-summary-grid">
          {rewardItems.map(({ icon, label, value, color }) => (
            <div key={label} className="activity-summary-card" style={{ borderTop: `3px solid ${color}` }}>
              <span className="activity-summary-icon">{icon}</span>
              <span className="activity-summary-value" style={{ color }}>{value}</span>
              <span className="activity-summary-label">{label}</span>
            </div>
          ))}
        </div>
      )} */}

      <RewardsHub/>

      {/* ── Tab Navigation ── */}
      <div className="activity-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`activity-tab${activeTab === tab.key ? ' active' : ''}`}
            style={{ '--tab-color': tab.color }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content Panel ── */}
      <StreakProvider userId={currentUser._id} onActivityRecorded={fetchUser}>
        <div className="activity-panel">
          <UserActivityDashboard
            currentUserId={currentUser._id}
            posts={statePosts}
            showSection={activeTab}
            onActivityRecorded={fetchUser}
          />
        </div>
      </StreakProvider>

      {/* ── Obtained Rewards Modal ── */}
      {showRewards && (
        <ObtainedRewardsModal
          show={showRewards}
          onClose={() => setShowRewards(false)}
          token={token}
          userId={currentUser._id}
        />
      )}
    </div>
  );
};

export default Activity;