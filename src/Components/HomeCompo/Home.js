// src/components/Posts/Home.js
import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import postContext from '../../Context/Posts/PostContext';
import HomePosts from './HomePosts';
import { jwtDecode } from 'jwt-decode';
import { ToastContainer, toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import AllFriends from '../Friendship/AllFriends';
import FriendRequest from '../Friendship/FriendRequest';
import Suggestion from '../Friendship/Suggestion';
import MessageScroller from '../TodayOffer/MessageScroller';
import { useI18n } from '../../i18n/i18nContext';
import EnhancedMediaUpload from './EnhancedMediaUpload';
import ObtainedRewardsModal from '../UserActivities/ObtainedRewardsModal';
import AddFileIcon from '../../Assets/AddMedia.png';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';
import './Home.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  StatCard                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
const StatCard = ({ icon, label, value, accent, loading: cardLoading }) => {
  const { tokens } = useTheme();
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>

      {cardLoading ? (
        <div className="stat-card-shimmer" />
      ) : (
        <div
          className="stat-card-value"
          style={{ color: accent || tokens.accent }}
        >
          {value}
        </div>
      )}

      <div className="stat-card-label">{label}</div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Home                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
function Home() {
  const { addPost, loading } = useContext(postContext);
  const { tokens } = useTheme();

  const [postContent,     setPostContent]     = useState('');
  const [visibility,      setVisibility]      = useState('public');
  const mediaUploadRef = useRef();
  const [communityCount,  setCommunityCount]  = useState(0);
  const [postSuccess,     setPostSuccess]     = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [hasPostedOnce,   setHasPostedOnce]   = useState(false);

  const token  = localStorage.getItem('token');
  const userId = token ? jwtDecode(token)?.user?.id : '';

  const { t } = useI18n();

  /* ── Earned rewards wallet ───────────────────────────────────────────────── */
  const [wallet,         setWallet]         = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  /* ── Basic user info ────────────────────────────────────────────────────── */
  const [userData,   setUserData]   = useState(null);
  const [inviteLink, setInviteLink] = useState(''); // eslint-disable-line no-unused-vars

  /* ── Fetch user profile ─────────────────────────────────────────────────── */
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

  /* ── Fetch earned-rewards wallet ────────────────────────────────────────── */
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
    } finally {
      setRewardsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  /* ── Community count ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!token || !userId) return;
    apiRequest
      .get(`${SERVER_URL}/api/activity/community/${userId}`)
      .then(res => setCommunityCount(res.data?.communityCount || 0))
      .catch(err => console.error('[Home] community count failed:', err));
  }, [token, userId]);

  /* ── Derived display values ─────────────────────────────────────────────── */
  const displayGroceryCoupons  = wallet?.totalGroceryCoupons  ?? userData?.totalGroceryCoupons  ?? 0;
  const displayShares          = wallet?.totalShares          ?? userData?.totalShares          ?? 0;
  const displayReferralToken   = wallet?.totalReferralToken   ?? userData?.totalReferralToken   ?? 0;

  const statsLoading = rewardsLoading && wallet === null;

  /* ── Post handlers ──────────────────────────────────────────────────────── */
  const handleFilesPrepared = (files) => {
    if (!postContent.trim() && files.length === 0) {
      toast.error(t['home.write_or_upload'] || 'Please write something or upload media!');
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
      toast.info(t['home.uploading_media'] || '⏳ Uploading media…', {
        toastId: 'post-loading', autoClose: false, closeOnClick: false, draggable: false,
      });
      mediaUploadRef.current.submitMediaPost();
    } else {
      if (!postContent.trim()) {
        toast.error(t['home.write_or_upload'] || 'Please write something or upload media!');
        return;
      }
      toast.info(t['home.posting_wait'] || '⏳ Posting… Please wait.', {
        toastId: 'post-loading', autoClose: false, closeOnClick: false, draggable: false,
      });
      setHasPostedOnce(true);
      addPost(postContent.trim(), visibility);
      resetForm();
    }
  }, [addPost, postContent, visibility, t]);

  const handleCancelPost = () => resetForm();

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

  const handleRewardsModalClose = useCallback(() => {
    setShowRewardsModal(false);
    fetchWallet();
  }, [fetchWallet]);

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="home-root header">
      <main className="home-main container-fluid px-0">
        <MessageScroller />

        <div className="row gx-2 gy-4">

          {/* ── Main content column ── */}
          <div className="col-12 col-lg-8 home-feed-col">

            <div className="row">

              {/* ── Earned Rewards strip ── */}
              <div className="col-12 col-md-6">
                <h5 className="home-section-heading">
                  {t['home.earned_rewards'] || 'Earned Rewards'}
                </h5>

                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <StatCard
                    icon="🛒"
                    label={t['home.grocery_coupons'] || 'Grocery Coupons'}
                    value={`₹${displayGroceryCoupons.toLocaleString('en-IN')}`}
                    loading={statsLoading}
                  />
                  <StatCard
                    icon="📈"
                    label={t['home.shares'] || 'Shares'}
                    value={displayShares}
                    accent={tokens.accent}
                    loading={statsLoading}
                  />
                  <StatCard
                    icon="🎟️"
                    label={t['home.ref_tokens'] || 'Ref. Tokens'}
                    value={displayReferralToken}
                    loading={statsLoading}
                  />
                  <StatCard
                    icon="👥"
                    label={t['home.community'] || 'Community'}
                    value={communityCount}
                    accent={tokens.success}
                    loading={false}
                  />
                </div>

                <div className="row">
                  <h5 className="home-section-heading mt-4">
                    {t['home.personal_interest'] || 'Personal Interest'}
                  </h5>

                  <div style={{ display: 'flex', width: '100%' }}>
                    <Link to="/reels/fullscreen" style={{ flex: 1, textDecoration: 'none' }}>
                      <div style={{ width: '100%' }}>
                        <StatCard
                          icon="🎬"
                          label={t['home.launch_reels'] || 'Launch Reels'}
                          value={t['home.reels'] || 'Reels'}
                          accent="#ff4d4f"
                        />
                      </div>
                    </Link>

                    <Link to="/chat" style={{ flex: 1, textDecoration: 'none' }}>
                      <div style={{ width: '100%' }}>
                        <StatCard
                          icon="💬"
                          label={t['home.chat_room'] || 'Chat Room'}
                          value={t['home.chat'] || 'Chat'}
                          accent="#ff4d4f"
                        />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* ── Social circle quick links ── */}
              <div className="col-12 col-md-6">
                <h5 className="home-section-heading">
                  {t['home.social_circle'] || 'Your Social Circle'}
                </h5>
                <Link to="/allfriends" style={{ textDecoration: 'none' }}>
                  <StatCard
                    icon="👥"
                    label={t['home.all_friends'] || 'All Friends'}
                    value={t['home.friends_label'] || 'Your Friends'}
                    accent="#1677ff"
                  />
                </Link>
                <Link to="/friendrequest" style={{ textDecoration: 'none' }}>
                  <StatCard
                    icon="📩"
                    label={t['home.friend_requests'] || 'Friend Requests'}
                    value={t['home.friends_request_label'] || 'Friends Request'}
                    accent="#1677ff"
                  />
                </Link>
                <Link to="/suggestions" style={{ textDecoration: 'none' }}>
                  <StatCard
                    icon="✨"
                    label={t['home.suggestions'] || 'Suggestions'}
                    value={t['home.view'] || 'View'}
                    accent="#1677ff"
                  />
                </Link>
              </div>
            </div>

            {/* ── Invite + Obtained Rewards ── */}
            <div className="home-invite-row mt-2 mb-2">
              <Link
                to="/invitaion"
                className="home-invite-btn"
              >
                {t['home.invite_link'] || 'Invite Link'}
              </Link>
              <button
                className="home-rewards-btn"
                onClick={() => setShowRewardsModal(true)}
              >
                {t['home.obtained_rewards'] || '🏆 Obtained Rewards'}
              </button>
            </div>

            {/* ── Post Composer ── */}
            <section className="mb-2" data-aos="fade-up">
              <div className="post-composer">

                {/* Visibility selector */}
                <select
                  className="post-visibility-select"
                  value={visibility}
                  onChange={e => setVisibility(e.target.value)}
                >
                  <option value="public">{t['home.public']   || '🌍 Public'}</option>
                  <option value="private">{t['home.private'] || '🔒 Private'}</option>
                  <option value="friends">{t['home.friends'] || '👥 Friends'}</option>
                </select>

                {/* Textarea */}
                <div className="post-textarea-wrap">
                  <textarea
                    className="post-textarea form-control border-0"
                    rows="5"
                    placeholder={t['post_placeholder'] || "What's on your mind?"}
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                    maxLength={5000}
                    style={{
                      /* Only the font is kept as inline — everything else is in Home.css */
                      fontFamily: "'Merriweather', serif",
                    }}
                  />

                  <button
                    type="button"
                    aria-label="Add media or file"
                    title="Add media or file"
                    className="post-media-icon-btn"
                    onClick={() => mediaUploadRef.current?.openFilePicker()}
                  >
                    <img src={AddFileIcon} alt="Add media" />
                  </button>
                </div>

                {/* Char count row */}
                <div className="post-char-row">
                  <span>{t['home.tip'] || '💡 Tip: Enter for paragraphs.'}</span>
                  <span
                    style={{
                      color: postContent.length > 4800 ? tokens.danger : tokens.textMuted,
                      fontWeight: postContent.length > 4800 ? 700 : 400,
                    }}
                  >
                    {postContent.length}/5000
                  </span>
                </div>

                {/* Media upload component */}
                <div className="mb-3 mt-1">
                  <EnhancedMediaUpload
                    ref={mediaUploadRef}
                    postContent={postContent}
                    onFilesPrepared={handleFilesPrepared}
                  />
                </div>

                {/* Action buttons */}
                <div className="post-action-row">
                  <button
                    className="post-cancel-btn"
                    onClick={handleCancelPost}
                    disabled={loading}
                  >
                    {t['home.cancel'] || 'Cancel'}
                  </button>

                  <button
                    className={`post-submit-btn${postSuccess ? ' success' : ''}`}
                    onClick={handleAddPost}
                    disabled={loading || postSuccess}
                  >
                    {loading ? (
                      <>
                        <span className="animated-spinner" />
                        {t['home.posting'] || 'Posting...'}
                      </>
                    ) : postSuccess ? (
                      <>
                        <span style={{ fontSize: '1.1rem' }}>✅</span>
                        {t['home.posted'] || 'Posted!'}
                      </>
                    ) : (
                      t['home.post_btn'] || 'Post'
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Feed ── */}
            <section>
              {loading ? (
                <p style={{ textAlign: 'center', color: tokens.textMuted }}>
                  {t['home.loading_posts'] || 'Loading posts...'}
                </p>
              ) : (
                <HomePosts />
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="col-12 col-lg-4" data-aos="fade-left">
            <div className="home-sidebar">
              <div className="home-sidebar-card">
                <h6>{t['home.social_circle'] || 'Your Social Circle'}</h6>
                <div className="d-flex flex-column gap-3">
                  <AllFriends />
                  <FriendRequest />
                  <Suggestion />
                </div>
              </div>
            </div>
          </div>

        </div>{/* end row */}

        {/* ObtainedRewardsModal */}
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