// src/components/Posts/Home.js
import React, {
  useContext, useEffect, useState, useRef, useCallback, useMemo, startTransition,
} from 'react';
import { Link, useNavigate }             from 'react-router-dom';
import postContext          from '../../Context/Posts/PostContext';
import HomePosts            from './HomePosts';
import { jwtDecode }        from 'jwt-decode';
import { ToastContainer, toast } from 'react-toastify';
import apiRequest           from '../../utils/apiRequest';
import AllFriends           from '../Friendship/AllFriends';
import FriendRequest        from '../Friendship/FriendRequest';
import Suggestion           from '../Friendship/Suggestion';
import MessageScroller      from '../TodayOffer/MessageScroller';
import { useI18n }          from '../../i18n/i18nContext';
import EnhancedMediaUpload  from './EnhancedMediaUpload';
import ObtainedRewardsModal from '../UserActivities/ObtainedRewardsModal';
import CropModal            from '../../utils/CropModal';
import { useTheme }         from '../../Context/ThemeUI/ThemeContext';
import { useScrollLock }    from '../../hooks/useScrollLock';
import { useSpecialOffer, SpecialOfferProvider }  from '../../Context/SpecialOffer/SpecialOfferContext';  // ← NEW
import { useAuth }          from '../../Context/Authorisation/AuthContext';
import HomeModeBanner       from '../Ads/HomeModeBanner';

import { buildInviteLink, copyToClipboard } from '../../utils/inviteLink';
import ShareModal from '../UserActivities/ShareModal';

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
/*  SpecialOfferBanner — countdown strip shown below MessageScroller          */
/* ═══════════════════════════════════════════════════════════════════════════ */
 
const OFFER_BANNER_CSS = `
@keyframes sob-glow {
  from { box-shadow: inset 0 0 0 0 rgba(255,210,0,0); }
  to   { box-shadow: inset 0 0 24px 0 rgba(255,210,0,0.07); }
}
.sob-root {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(255, 200, 0, 0.08);
  border-bottom: 1px solid rgba(255, 200, 0, 0.22);
  cursor: pointer;
  animation: sob-glow 2.4s ease-in-out infinite alternate;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.sob-root:hover { background: rgba(255, 200, 0, 0.14); }
.sob-icon {
  font-size: 1.1rem;
  animation: sob-pulse 1.4s ease-in-out infinite;
}
@keyframes sob-pulse {
  0%, 100% { transform: scale(1);    opacity: 1; }
  50%       { transform: scale(1.18); opacity: 0.85; }
}
.sob-label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ffd700;
  font-family: "Courier New", monospace;
}
.sob-sep {
  color: rgba(255, 200, 0, 0.35);
  font-size: 0.8rem;
}
.sob-timer {
  font-family: "Courier New", monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #ffd700;
  letter-spacing: 0.05em;
}
.sob-cta {
  font-size: 0.72rem;
  font-family: sans-serif;
  color: rgba(255,215,0,0.7);
  font-weight: 400;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .sob-label { font-size: 0.68rem; }
  .sob-timer { font-size: 0.9rem; }
  .sob-cta   { display: none; }
}
`;
 
// Inject CSS once at module scope
let sobCssInjected = false;
function injectSobCss() {
  if (sobCssInjected) return;
  sobCssInjected = true;
  const tag = document.createElement('style');
  tag.textContent = OFFER_BANNER_CSS;
  document.head.appendChild(tag);
}
 
function SpecialOfferBanner() {
  const navigate = useNavigate();
  const { isActive, expiresIn } = useSpecialOffer();
 
  useEffect(() => { injectSobCss(); }, []);
 
  if (!isActive || expiresIn <= 0) return null;
 
  const h   = Math.floor(expiresIn / 3600);
  const m   = Math.floor((expiresIn % 3600) / 60);
  const s   = expiresIn % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const display = h > 0 ? `${pad(h)}:${pad(m)}` : `${pad(m)}:${pad(s)}`;
 
  return (
    <div
      className="sob-root"
      role="button"
      tabIndex={0}
      aria-label={`Special offer live — ${display} remaining. Click to view.`}
      onClick={() => navigate('/rewards?tab=special')}
      onKeyDown={e => e.key === 'Enter' && navigate('/rewards?tab=special')}
    >
      <span className="sob-icon">⚡</span>
      <span className="sob-label">12-Hour Offer Live</span>
      <span className="sob-sep">|</span>
      <span className="sob-timer">Ends in: {display}</span>
      <span className="sob-cta">— Tap to earn ₹100/referral →</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Home                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
function Home() {
  const { addPost, loading }                  = useContext(postContext);
  const { tokens }                            = useTheme();

  const [mode, setMode]                       = useState('home');

  const [postContent,     setPostContent]     = useState('');
  const [inputValue,      setInputValue]      = useState('');
  const [visibility,      setVisibility]      = useState('public');
  const [communityCount,  setCommunityCount]  = useState(0);
  const [postSuccess,     setPostSuccess]     = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [hasPostedOnce,   setHasPostedOnce]   = useState(false);
  const [cropPayload, setCropPayload]         = useState(null);
  const mediaUploadRef                        = useRef();

  const [showShareModal, setShowShareModal] = useState(false);

  const token  = localStorage.getItem('token');
  const userId = token ? jwtDecode(token)?.user?.id : '';
  const { token: authToken } = useAuth();

  const { t } = useI18n();

  const [wallet,         setWallet]         = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [userData,       setUserData]       = useState(null);

  const inviteLink = useMemo(
    () => buildInviteLink(userData?.referralId ?? ''),
    [userData?.referralId]
  );

  // ── CHANGE 4: Remove setInviteLink from the getuser effect ────────────────
  // The effect now only sets userData. inviteLink is derived above via useMemo,
  // so there is no more manual URL construction in this component.
  useScrollLock(Boolean(showRewardsModal));
  useScrollLock(Boolean(cropPayload));
  // ── CHANGE 5: Also lock scroll when the share modal is open ───────────────
  useScrollLock(Boolean(showShareModal));

  /* ── Debounce textarea → postContent ─────────────────────────────────────── */
  useEffect(() => {
    const id = setTimeout(() => {
      startTransition(() => setPostContent(inputValue));
    }, 150);
    return () => clearTimeout(id);
  }, [inputValue]);

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
        // CHANGE 4 (continued): setInviteLink() call removed — no longer needed.
      })
      .catch(err => console.error('[Home] getuser failed:', err));

    return () => { cancelled = true; };
  }, [token, userId]);

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

  useEffect(() => {
    if (!token || !userId) return;
    apiRequest
      .get(`${SERVER_URL}/api/activity/community/${userId}`)
      .then(res => setCommunityCount(res.data?.communityCount || 0))
      .catch(err => console.error('[Home] community count failed:', err));
  }, [token, userId]);

  const displayGroceryCoupons = useMemo(
    () => wallet?.totalGroceryCoupons ?? userData?.totalGroceryCoupons ?? 0,
    [wallet, userData]
  );
  const displayShares = useMemo(
    () => wallet?.totalShares ?? userData?.totalShares ?? 0,
    [wallet, userData]
  );
  const displayReferralToken = useMemo(
    () => wallet?.totalReferralToken ?? userData?.totalReferralToken ?? 0,
    [wallet, userData]
  );

  const statsLoading = rewardsLoading && wallet === null;

  const handleFilesPrepared = useCallback((files) => {
    if (!postContent.trim() && files.length === 0) {
      toast.error(t['home.write_or_upload'] || 'Please write something or upload media!');
      return;
    }
    addPost(postContent.trim(), visibility, files);
    setInputValue('');
    startTransition(() => {
      setPostContent('');
      setVisibility('public');
    });
  }, [addPost, postContent, visibility, t]);

  const resetForm = useCallback(() => {
    setInputValue('');
    startTransition(() => {
      setPostContent('');
      setVisibility('public');
    });
  }, []);

  const handleAddPost = useCallback(() => {
    if (mediaUploadRef.current?.hasMedia()) {
      toast.info(t['home.uploading_media'] || '⏳ Uploading media…', {
        toastId: 'post-loading', autoClose: false, closeOnClick: false, draggable: false,
      });
      setTimeout(() => mediaUploadRef.current?.submitMediaPost(), 0);
    } else {
      if (!postContent.trim()) {
        toast.error(t['home.write_or_upload'] || 'Please write something or upload media!');
        return;
      }
      toast.info(t['home.posting_wait'] || '⏳ Posting… Please wait.', {
        toastId: 'post-loading', autoClose: false, closeOnClick: false, draggable: false,
      });
      setHasPostedOnce(true);
      setTimeout(() => {
        addPost(postContent.trim(), visibility);
        resetForm();
      }, 0);
    }
  }, [addPost, postContent, visibility, t, resetForm]);

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

  const handleCropRequest = useCallback((payload) => {
    setCropPayload(payload);
  }, []);

  const handleInviteClick = useCallback(async (e) => {
    e.preventDefault(); // prevent the <Link> navigation
    if (!inviteLink) {
      toast.info('Your invite link is loading, please try again in a moment.');
      return;
    }
    await copyToClipboard(inviteLink);
    setShowShareModal(true);
  }, [inviteLink]);

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="home-root header">
      <HomeModeBanner mode={mode} setMode={setMode} />
      <main className="home-main container-fluid px-0">
        <SpecialOfferProvider token={authToken}>
          <MessageScroller />
          <SpecialOfferBanner />
        </SpecialOfferProvider>
        <div className="row gx-2 gy-4">

          {/* ── Main content column ── */}
          <div className="col-12 col-lg-8 home-feed-col">

            <div className="row">

              {/* ── Earned Rewards strip ── */}
              <div className="col-12 col-md-6">
                <h5 className="home-section-heading">
                  {t['home.earned_rewards'] ?? '🏆🏆🏆🏆🏆Earned Rewards🏆🏆🏆🏆🏆'}
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

            <div className="home-invite-row mt-2 mb-2">
              <Link
                to="/invitation"
                className="home-invite-btn"
                onClick={handleInviteClick}
              >
                {t['home.invite_link'] || '📤 Invite Link'}
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

                <select
                  className="post-visibility-select"
                  value={visibility}
                  onChange={e => setVisibility(e.target.value)}
                >
                  <option value="public">{t['home.public']   || '🌍 Public'}</option>
                  <option value="private">{t['home.private'] || '🔒 Private'}</option>
                  <option value="friends">{t['home.friends'] || '👥 Friends'}</option>
                </select>

                <div className="post-textarea-wrap">
                  <textarea
                    className="post-textarea form-control border-0"
                    rows="5"
                    placeholder={t['post_placeholder'] || "What's on your mind?"}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    maxLength={5000}
                    style={{ fontFamily: "'Merriweather', serif" }}
                  />
                </div>

                <div className="post-char-row">
                  <span>{t['home.tip'] || '💡 Tip: Enter for paragraphs.'}</span>
                  <span
                    style={{
                      color: inputValue.length > 4800 ? tokens.danger : tokens.textMuted,
                      fontWeight: inputValue.length > 4800 ? 700 : 400,
                    }}
                  >
                    {inputValue.length}/5000
                  </span>
                </div>

                <div className="mb-3 mt-1">
                  <EnhancedMediaUpload
                    ref={mediaUploadRef}
                    postContent={postContent}
                    onFilesPrepared={handleFilesPrepared}
                    onCropRequest={handleCropRequest}
                  />
                </div>

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

        </div>

        <ObtainedRewardsModal
          show={showRewardsModal}
          onClose={handleRewardsModalClose}
        />

        <ShareModal
          show={showShareModal}
          inviteLink={inviteLink}
          senderName={userData?.name ?? ''}
          onClose={() => setShowShareModal(false)}
          title="Share Your Invite Link"
        />

        <ToastContainer position="top-right" autoClose={3000} />
      </main>

      {cropPayload && (
        <CropModal
          image={cropPayload.image}
          onClose={cropPayload.onClose}
          onApply={cropPayload.onApply}
          crop={cropPayload.crop}
          setCrop={cropPayload.setCrop}
          zoom={cropPayload.zoom}
          setZoom={cropPayload.setZoom}
          onCropComplete={cropPayload.onCropComplete}
          initialAspect={1}
          applying={cropPayload.applying}
          title="Crop Image"
        />
      )}
    </div>
  );
}

export default Home;