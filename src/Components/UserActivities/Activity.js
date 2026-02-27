import React, { useState, useEffect, useContext, useCallback } from 'react';
// import axios from 'axios';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import UserActivityDashboard from './UserActivityDashboard';
import postContext from '../../Context/Posts/PostContext';
import { StreakProvider } from '../../Context/Activity/StreakContext';
import apiRequest from '../../utils/apiRequest';

const SERVER_URL = process.env.REACT_APP_SERVER_URL
const Activity = () => {
  const { user: currentUser, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState(null);
  const { statePosts } = useContext(postContext);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !currentUser) return;

    try {
      const res = await apiRequest.get(`${SERVER_URL}/api/auth/getuser/${currentUser._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUserData(res.data);
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchUser();
    }
  }, [isAuthenticated, currentUser, fetchUser]);

  const handleActivityUpdate = () => {
    fetchUser();
  };

  if (!currentUser && isAuthenticated) return <p>Loading...</p>;
  if (!isAuthenticated || !currentUser) {
    return <p className="text-center text-danger">Please log in to view your activity.</p>;
  }

  return (
    <div className='header mt-5 py-3 border-0 rounded' style={{ background: 'rgba(212, 246, 255, 0)' }}>
      {/* <div className="container-fluid py-4 rounded" style={{ background: '#d4f6ff10' }}>
        <div className="container bg-transparent"> */}
          <h1 className="text-center text-primary mb-4 fw-bold">📊 Your Activity Dashboard</h1>

          {/* Rewards Summary */}
          {userData && (
            <div className="card shadow-sm border-white mb-4">
              <div className="card-header bg-dark text-white fw-semibold">
                🏆 Your Rewards Summary
              </div>
              <div className="card-body" style={{ color: '#c0c0c0ff' }}>
                <p className="mb-1">🛒 Grocery Coupons: ₹{userData.totalGroceryCoupons || 0}</p>
                <p className="mb-1">📈 Company Shares: {userData.totalShares || 0}</p>
                <p className="mb-0">🎟️ Referral Tokens: {userData.totalReferralToken || 0}</p>
              </div>
            </div>
          )}

          <StreakProvider userId={currentUser._id} onActivityRecorded={handleActivityUpdate}>
            {/* Unified grid layout for three reward types */}
            <div>
              <div>
                <div className="card h-100 shadow-sm border-white">
                  <div className="card-header bg-danger text-white fw-semibold">🔥 Daily Streaks</div>
                  <div className="card-body">
                    <UserActivityDashboard currentUserId={currentUser._id} posts={statePosts} showSection="streak" />
                  </div>
                </div>
              </div>

              <div>
                <div className="card h-100 shadow-sm border-white">
                  <div className="card-header bg-success text-white fw-semibold">🤝 Referral Rewards</div>
                  <div className="card-body">
                    <UserActivityDashboard currentUserId={currentUser._id} posts={statePosts} showSection="referral" />
                  </div>
                </div>
              </div>

              <div>
                <div className="card h-100 shadow-sm border-white">
                  <div className="card-header bg-warning text-dark fw-semibold">📝 Post Rewards</div>
                  <div className="card-body">
                    <UserActivityDashboard currentUserId={currentUser._id} posts={statePosts} showSection="post" />
                  </div>
                </div>
              </div>
            </div>
          </StreakProvider>
        {/* </div>
      </div> */}
    </div>
  );
};

export default Activity;
