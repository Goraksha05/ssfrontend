// Activity.jsx — Improved main Activity page
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import UserActivityDashboard from './UserActivityDashboard';
import postContext from '../../Context/Posts/PostContext';
import { StreakProvider } from '../../Context/Activity/StreakContext';
import apiRequest from '../../utils/apiRequest';
import ObtainedRewardsModal from './ObtainedRewardsModal';

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

const Activity = () => {
  const { user: currentUser, isAuthenticated, token } = useAuth();
  const [
    // userData, 
    setUserData
  ]     = useState(null);
  const [activeTab, setActiveTab]   = useState('streak');
  const [showRewards, setShowRewards] = useState(false);
  const [
    // fetching, 
    setFetching
  ]     = useState(false);
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
      <div style={styles.authWall}>
        <span style={styles.lockIcon}>🔒</span>
        <p style={styles.authMsg}>Please log in to view your activity.</p>
      </div>
    );
  }

  const tabs = [
    { key: 'streak',   label: '🔥 Streaks',   color: '#ff6b35' },
    { key: 'referral', label: '🤝 Referrals',  color: '#10b981' },
    { key: 'post',     label: '📝 Posts',      color: '#f59e0b' },
  ];

  // const rewardItems = [
  //   { icon: '🛒', label: 'Grocery Coupons', value: `₹${userData?.totalGroceryCoupons || 0}`,  color: '#10b981' },
  //   { icon: '📈', label: 'Company Shares',  value: userData?.totalShares || 0,                 color: '#6366f1' },
  //   { icon: '🎟️', label: 'Referral Tokens', value: userData?.totalReferralToken || 0,           color: '#f59e0b' },
  // ];

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <span style={styles.titleAccent}>Activity</span> Dashboard
        </h1>
        <button style={styles.rewardsBtn} onClick={() => setShowRewards(true)}>
          🏆 My Rewards
        </button>
      </div>

      {/* ── Reward Summary Cards ── */}
      {/* {fetching ? (
        <div style={styles.skeletonRow}>
          {[0,1,2].map(i => <div key={i} style={styles.skeleton} />)}
        </div>
      ) : (
        <div style={styles.summaryGrid}>
          {rewardItems.map(({ icon, label, value, color }) => (
            <div key={label} style={{ ...styles.summaryCard, borderTop: `3px solid ${color}` }}>
              <span style={styles.summaryIcon}>{icon}</span>
              <span style={{ ...styles.summaryValue, color }}>{value}</span>
              <span style={styles.summaryLabel}>{label}</span>
            </div>
          ))}
        </div>
      )} */}

      {/* ── Tab Navigation ── */}
      <div style={styles.tabBar}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key
                ? { ...styles.tabActive, borderBottom: `3px solid ${tab.color}`, color: tab.color }
                : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content Panel ── */}
      <StreakProvider userId={currentUser._id} onActivityRecorded={fetchUser}>
        <div style={styles.panel}>
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

      <style>{`
        @media (max-width: 600px) {
          .summary-grid { grid-template-columns: 1fr !important; }
          .tab-bar { flex-direction: column !important; gap: 4px !important; }
        }
      `}</style>
    </div>
  );
};

// ── Inline styles (no Bootstrap dependency, fully responsive) ──────────────
const styles = {
  page: {
    maxWidth: 880,
    margin: '0 auto',
    padding: '24px 16px 48px',
    fontFamily: "'DM Sans', sans-serif",
    color: '#e2e8f0',
    minHeight: '100vh',
  },
  authWall: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '60vh', gap: 12,
  },
  lockIcon:   { fontSize: 48 },
  authMsg:    { color: '#94a3b8', fontSize: 16 },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 28, flexWrap: 'wrap', gap: 12,
  },
  title:        { fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, margin: 0 },
  titleAccent:  { color: '#6366f1' },
  rewardsBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 18px', fontWeight: 700, cursor: 'pointer',
    fontSize: 14, whiteSpace: 'nowrap',
    boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14, marginBottom: 28,
  },
  skeletonRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14, marginBottom: 28,
  },
  skeleton: {
    height: 100, borderRadius: 14,
    background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  summaryCard: {
    background: '#1e293b',
    borderRadius: 14, padding: '20px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    transition: 'transform 0.2s',
    cursor: 'default',
  },
  summaryIcon:  { fontSize: 28 },
  summaryValue: { fontSize: 26, fontWeight: 800 },
  summaryLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 },
  tabBar: {
    display: 'flex', gap: 4, marginBottom: 20,
    borderBottom: '1px solid #334155',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  },
  tab: {
    background: 'none', border: 'none', borderBottom: '3px solid transparent',
    color: '#64748b', padding: '10px 20px', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.2s, border-color 0.2s',
  },
  tabActive:    { background: 'none' },
  panel: {
    background: '#1e293b', borderRadius: 16,
    padding: 'clamp(16px, 4vw, 28px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
  },
};

export default Activity;