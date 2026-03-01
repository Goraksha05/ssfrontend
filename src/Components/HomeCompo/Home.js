import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Link } from "react-router-dom";
import postContext from '../../Context/Posts/PostContext';
import HomePosts from './HomePosts';
import { jwtDecode } from 'jwt-decode';
import { ToastContainer, toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import AllFriends from '../Friendship/AllFriends';
import FriendRequest from '../Friendship/FriendRequest';
import Suggestion from '../Friendship/Suggestion';
import MessageScroller from '../TodayOffer/MessageScroller';
import { useTranslation } from 'react-i18next';
import EnhancedMediaUpload from './EnhancedMediaUpload';
import ObtainedRewardsModal from '../UserActivities/ObtainedRewardsModal';
import AddFileIcon from '../../Assets/AddMedia.png';

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

/* ─── Design tokens ───────────────────────────────────────────────────────── */
const T = {
  bg: '#0b0f1a',
  surface: '#141929',
  card: '#1a2035',
  border: '#252d45',
  accent: '#f59e0b',
  accentSoft: 'rgba(245,158,11,0.12)',
  blue: '#3b82f6',
  blueSoft: 'rgba(59,130,246,0.12)',
  green: '#22c55e',
  red: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b',
  radius: 16,
  shadow: '0 4px 24px rgba(0,0,0,0.4)',
};

/* ─── Stat card ───────────────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, accent, loading: cardLoading }) => (
  <div style={{
    minWidth: 80,
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    margin: '5px',
    padding: '1px 8px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 22 }}>{icon}</div>
    {cardLoading ? (
      <div style={{
        height: 36,
        borderRadius: 8,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
        backgroundSize: '200px 100%',
        animation: 'hshimmer 1.4s infinite linear',
        margin: '4px auto',
        width: '60%',
      }} />
    ) : (
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || T.accent, lineHeight: 1.2 }}>
        {value}
      </div>
    )}
    <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{label}</div>
  </div>
);

/* ─── Skeleton shimmer keyframes (injected once) ──────────────────────────── */
const ShimmerStyle = () => (
  <style>{`
    @keyframes hshimmer {
      0%   { background-position: -200px 0; }
      100% { background-position:  200px 0; }
    }
  `}</style>
);

function Home() {
  const { addPost, loading } = useContext(postContext);
  const [postContent, setPostContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const mediaUploadRef = useRef();
  const [communityCount, setCommunityCount] = useState(0);
  const [postSuccess, setPostSuccess] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [hasPostedOnce, setHasPostedOnce] = useState(false); // guard for postSuccess

  const token = localStorage.getItem('token');
  const userId = token ? jwtDecode(token)?.user?.id : '';
  const { t } = useTranslation();

  // ── Earned rewards — sourced exclusively from /api/auth/earned-rewards ─────
  // This is the single source of truth (mirrors User document wallet totals).
  // It also returns redeemed slab lists + slab configs for the modal.
  const [wallet, setWallet] = useState(null);   // { totalGroceryCoupons, totalShares, totalReferralToken }
  const [rewardsLoading, setRewardsLoading] = useState(false);

  // ── Basic user info (name, referralId, subscription) ─────────────────────
  const [userData, setUserData] = useState(null);
  const [inviteLink, setInviteLink] = useState(''); // eslint-disable-line no-unused-vars

  // ── Fetch user profile (name, referralId, subscription) ──────────────────
  useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;

    apiRequest
      .get(`${SERVER_URL}/api/auth/getuser/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => {
        if (cancelled) return;
        setUserData(res.data);
        setInviteLink(
          res.data?.referralId
            ? `${window.location.origin}/invite/${res.data.referralId}`
            : ''
        );
      })
      .catch(err => console.error('[Home] getuser failed:', err));

    return () => { cancelled = true; };
  }, [token, userId]);

  // ── Fetch earned-rewards wallet from the dedicated endpoint ───────────────
  // GET /api/auth/earned-rewards returns:
  //   wallet:  { totalGroceryCoupons, totalShares, totalReferralToken }
  //            — sourced directly from the User document, always accurate
  //   redeemed, slabs, claims — used by ObtainedRewardsModal (fetches its own)
  //
  // We only use `wallet` here for the StatCards. The modal fetches its own
  // copy when it opens, so there is no shared state needed.
  const fetchWallet = useCallback(async () => {
    if (!token) return;
    setRewardsLoading(true);
    try {
      const res = await apiRequest.get(`${SERVER_URL}/api/auth/earned-rewards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWallet(res.data?.wallet || null);
    } catch (err) {
      console.error('[Home] earned-rewards fetch failed:', err);
      // Non-fatal: wallet stays null, display falls back to userData totals
    } finally {
      setRewardsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // ── Community count ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !userId) return;
    apiRequest
      .get(`${SERVER_URL}/api/activity/community/${userId}`)
      .then(res => setCommunityCount(res.data?.communityCount || 0))
      .catch(err => console.error('[Home] community count failed:', err));
  }, [token, userId]);

  // ── Display values ─────────────────────────────────────────────────────────
  // Priority:
  //   1. wallet from /api/auth/earned-rewards  (User doc — canonical)
  //   2. userData.total* fields                (same doc, older fetch — good fallback)
  //   3. 0                                     (not yet loaded)
  const displayGroceryCoupons = wallet?.totalGroceryCoupons ?? userData?.totalGroceryCoupons ?? 0;
  const displayShares = wallet?.totalShares ?? userData?.totalShares ?? 0;
  const displayReferralToken = wallet?.totalReferralToken ?? userData?.totalReferralToken ?? 0;

  const statsLoading = rewardsLoading && wallet === null;

  // ── Post handlers ──────────────────────────────────────────────────────────
  const handleFilesPrepared = (files) => {
    if (!postContent.trim() && files.length === 0) {
      toast.error('Please write something or upload media!');
      return;
    }
    addPost(postContent.trim(), visibility, files);
    setPostContent('');
    setVisibility('public');
  };

  const resetForm = () => {
    setPostContent('');
    setVisibility('public');
  };

  const handleAddPost = useCallback(() => {
    if (mediaUploadRef.current?.hasMedia()) {
      toast.info('⏳ Uploading media…', {
        toastId: 'post-loading', autoClose: false, closeOnClick: false, draggable: false,
      });
      mediaUploadRef.current.submitMediaPost();
    } else {
      if (!postContent.trim()) {
        toast.error('Please write something or upload media!');
        return;
      }
      toast.info('⏳ Posting… Please wait.', {
        toastId: 'post-loading', autoClose: false, closeOnClick: false, draggable: false,
      });
      setHasPostedOnce(true);
      addPost(postContent.trim(), visibility);
      resetForm();
    }
  }, [addPost, postContent, visibility]);

  const handleCancelPost = () => resetForm();

  // Show ✅ Posted! only after an actual post action, not on mount
  useEffect(() => {
    if (!hasPostedOnce) return;
    if (!loading) {
      toast.dismiss('post-loading');
      setPostSuccess(true);
      const timer = setTimeout(() => {
        setPostSuccess(false);
        setHasPostedOnce(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, hasPostedOnce]);

  // Refresh wallet totals after the rewards modal closes
  // so StatCards show updated numbers without a full page reload
  const handleRewardsModalClose = useCallback(() => {
    setShowRewardsModal(false);
    fetchWallet();
  }, [fetchWallet]);

  return (
    <div className='header'>
      <ShimmerStyle />
      <main className="container-fluid px-0" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
        <MessageScroller />

        <div className="row gx-2 gy-4">
          {/* ── Main content ── */}
          <div className="col-12 col-lg-8">

            <div className="row">
              {/* ── Earned Rewards strip ── */}
              <div className="col-12 col-md-6">
                <h5 className="text-light text-center w-100 fw-bold">
                  Earned Rewards
                </h5>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <StatCard
                    icon="🛒"
                    label="Grocery Coupons"
                    value={`₹${displayGroceryCoupons.toLocaleString('en-IN')}`}
                    loading={statsLoading}
                  />
                  <StatCard
                    icon="📈"
                    label="Shares"
                    value={displayShares}
                    accent={T.blue}
                    loading={statsLoading}
                  />
                  <StatCard
                    icon="🎟️"
                    label="Ref. Tokens"
                    value={displayReferralToken}
                    loading={statsLoading}
                  />
                  <StatCard
                    icon="👥"
                    label="Community"
                    value={communityCount}
                    accent={T.green}
                    loading={false}
                  />
                </div>
                <div className="row">
                  <h5 className="text-light text-center w-100 mt-4 fw-bold">
                    Personal Interest
                  </h5>
                  <div style={{display: "flex", width: "100%",}}>
                    <Link
                      to="/reels/fullscreen"
                      style={{
                        flex: 1,
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <StatCard
                          icon="🎬"
                          label="Launch Reels"
                          value="Reels"
                          accent="#ff4d4f"
                        />
                      </div>
                    </Link>

                    <Link
                      to="/chat"
                      style={{
                        flex: 1,
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <StatCard
                          icon="💬"
                          label="Chat Room"
                          value="Chat"
                          accent="#ff4d4f"
                        />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
              {/* ── Social circle quick links ── */}
              <div className="col-12 col-md-6">
                <h5 className="text-light text-center w-100 fw-bold">
                  Your Social Circle
                </h5>
                <Link to="/allfriends" style={{ textDecoration: 'none' }}>
                  <StatCard icon="👥" label="All Friends" value="Your Friends" accent="#1677ff" />
                </Link>
                <Link to="/friendrequest" style={{ textDecoration: 'none' }}>
                  <StatCard icon="📩" label="Friend Requests" value="Friends Request" accent="#1677ff" />
                </Link>
                <Link to="/suggestions" style={{ textDecoration: 'none' }}>
                  <StatCard icon="✨" label="Suggestions" value="View" accent="#1677ff" />
                </Link>
              </div>
            </div>

            {/* ── Invite + Obtained Rewards buttons ── */}
            <div className="invitation m-2">
              <div className="d-flex justify-content-center">
                <Link
                  to="/invitaion"
                  className="btn btn-success btn-sm mx-1 rounded-pill btn-lg fw-semibold glow-btn w-50"
                  style={{ fontSize: 16 }}
                >
                  Invite Link
                </Link>
                <button
                  className="btn btn-warning btn-sm mx-1 rounded-pill btn-lg fw-semibold glow-btn w-50"
                  onClick={() => setShowRewardsModal(true)}
                >
                  🏆 Obtained Rewards
                </button>
              </div>
            </div>

            {/* ── Post creation ── */}
            <section className="mb-2" data-aos="fade-up">
              <div className="rounded shadow-sm">
                <select
                  className="form-select form-select-lg text-secondary fw-semibold bg-transparent"
                  style={{ fontSize: '0.8rem' }}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="public">🌍 Public</option>
                  <option value="private">🔒 Private</option>
                  <option value="friends">👥 Friends</option>
                </select>

                <div style={{ position: 'relative' }}>
                  <textarea
                    className="form-control border-0"
                    rows="5"
                    placeholder={t("What's on your mind?")}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    style={{
                      background: '#ffe0ceff',
                      resize: 'none',
                      fontSize: 21,
                      lineHeight: '1.6',
                      minHeight: '200px',
                      fontFamily: "'Merriweather', serif",
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Add media or file"
                    title="Add media or file"
                    onClick={() => mediaUploadRef.current?.openFilePicker()}
                    className="p-0 border-0 bg-transparent"
                    style={{ position: 'absolute', right: '12px', bottom: '12px', cursor: 'pointer' }}
                  >
                    <img
                      src={AddFileIcon}
                      alt="Add media"
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        transition: 'transform 0.18s ease, opacity 0.18s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.13)'; e.currentTarget.style.opacity = '0.85'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; }}
                    />
                  </button>
                </div>

                <div className="d-flex justify-content-between mt-2 text-secondary small">
                  <span>💡 Tip: Enter for paragraphs.</span>
                  <span>{postContent.length}/5000</span>
                </div>

                <div className="mb-3">
                  <EnhancedMediaUpload
                    ref={mediaUploadRef}
                    postContent={postContent}
                    onFilesPrepared={handleFilesPrepared}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    className="btn btn-outline-secondary btn-lg rounded-pill fw-semibold mb-2"
                    onClick={handleCancelPost}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`btn btn-lg rounded-pill mb-2 fw-semibold d-flex align-items-center justify-content-center ${postSuccess ? 'btn-success' : 'btn-primary'}`}
                    onClick={handleAddPost}
                    disabled={loading || postSuccess}
                    style={{ minWidth: '160px' }}
                  >
                    {loading ? (
                      <><span className="animated-spinner me-2" />Posting...</>
                    ) : postSuccess ? (
                      <><span className="text-white fs-5 me-2">✅</span>Posted!</>
                    ) : (
                      'Post'
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Feed ── */}
            <section>
              {loading ? (
                <p className="text-center text-muted">Loading posts...</p>
              ) : (
                <HomePosts />
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="col-12 col-lg-4" data-aos="fade-left">
            <div className="sticky-top" style={{ top: '80px' }}>
              <div className="card p-3 bg-dark shadow-sm mb-4 h-100">
                <h6 className="mb-3 text-white">Your Social Circle</h6>
                <div className="d-flex flex-column gap-3">
                  <AllFriends />
                  <FriendRequest />
                  <Suggestion />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ObtainedRewardsModal — fetches its own data on open */}
        <ObtainedRewardsModal
          show={showRewardsModal}
          onClose={handleRewardsModalClose}
        />

        <ToastContainer position="top-right" autoClose={3000} />
      </main>
    </div>
  );
}

export default Home;