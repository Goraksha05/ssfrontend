// src/components/Posts/HomePostitem.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import VerifiedBadge from '../Common/VerifiedBadge';
import apiRequest from '../../utils/apiRequest';
import CommentsModal from '../Reels/CommentsModal';
import ProfileModal from '../Profile/ProfileModal';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';
import './Home.css';

/* ─── Utility ─────────────────────────────────────────────────────────────── */
const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.sosholife.com';
const fullMediaUrl = (url) => (url.startsWith('http') ? url : `${baseUrl}${url}`);

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const visLabel = {
  public: '🌍 Public',
  private: '🔒 Private',
  friends: '👥 Friends',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PostItem                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
function PostItem({ post, deletePost, toggleLikePost }) {
  /* ── Theme ──────────────────────────────────────────────────────────────── */
  const { tokens } = useTheme();

  /* Pull a small set of per-theme values that are still needed for
     dynamic inline styles (gradient fade, accent colour overrides etc.) */
  const dynamicStyles = {
    textFadeBg: tokens.bgCard,
    accentColor: tokens.accent,
    likedColor: tokens.danger || '#ef4444',
    mutedColor: tokens.textMuted,
  };

  /* ── Auth ───────────────────────────────────────────────────────────────── */
  const token = localStorage.getItem('token');
  const decoded = token ? jwtDecode(token) : null;
  const userId = decoded?.user?.id;

  const author = post.user_id ?? {};
  const isAuthorVerified = !!author?.subscription?.active;
  const isOwnPost = userId === author._id;
  const isLiked = post.likes?.includes(userId);

  /* ── State ──────────────────────────────────────────────────────────────── */
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [likeAnimation, setLikeAnimation] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const textRef = useRef(null);
  const videoRefs = useRef([]);
  const mutedStates = useRef({});

  /* ── Follow status ──────────────────────────────────────────────────────── */
  const fetchFollowingStatus = useCallback(async () => {
    if (!author._id || !userId) return;
    try {
      const res = await apiRequest.get('/api/profile/getprofile');
      const followingList = res.data?.profile?.following || res.data?.following || [];
      setIsFollowing(followingList.some(id => String(id) === String(author._id)));
    } catch { /* silent */ }
  }, [author._id, userId]);

  useEffect(() => { fetchFollowingStatus(); }, [fetchFollowingStatus]);

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const res = await apiRequest.put(`/api/profile/follow/${author._id}`, {});
      setIsFollowing(res.data.isFollowing);
    } catch (err) {
      console.error('Follow/unfollow failed', err);
    } finally {
      setFollowLoading(false);
    }
  };

  /* ── Comment count ──────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest.get(`/api/posts/${post._id}/comments/count`);
        setCommentCount(res.data.count || 0);
      } catch { /* silent */ }
    })();
  }, [post._id]);

  /* ── Like with animation ────────────────────────────────────────────────── */
  const handleLike = () => {
    toggleLikePost(post._id);
    if (!isLiked) {
      setLikeAnimation(true);
      setTimeout(() => setLikeAnimation(false), 600);
    }
  };

  /* ── Video intersection autoplay ────────────────────────────────────────── */
  const playOnlyThisVideo = useCallback((target) => {
    requestAnimationFrame(() => {
      videoRefs.current.forEach(v => { if (v && v !== target && !v.paused) v.pause(); });
      if (target.paused) target.play().catch(() => { });
    });
  }, []);

  const handleVideoClick = useCallback((idx) => {
    const v = videoRefs.current[idx];
    if (!v) return;
    requestAnimationFrame(() => {
      if (mutedStates.current[idx] === undefined) { mutedStates.current[idx] = true; v.muted = true; }
      if (v.paused) {
        playOnlyThisVideo(v);
        if (mutedStates.current[idx]) { v.muted = false; v.volume = 1; mutedStates.current[idx] = false; }
      } else {
        v.pause();
        v.muted = !mutedStates.current[idx];
        mutedStates.current[idx] = v.muted;
      }
    });
  }, [playOnlyThisVideo]);

  useEffect(() => {
    if (!post?.media?.length) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) playOnlyThisVideo(v);
        else requestAnimationFrame(() => { if (!v.paused) v.pause(); });
      });
    }, { threshold: 0.5 });
    videoRefs.current.forEach(v => v && observer.observe(v));
    return () => observer.disconnect();
  }, [post?.media, playOnlyThisVideo]);

  /* ── Delete ─────────────────────────────────────────────────────────────── */
  const handleDeleteClick = () => {
    if (confirmDelete) {
      deletePost();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  /* ── Derived ─────────────────────────────────────────────────────────────── */
  const isLong = post.post && post.post.length > 240;
  const mediaItems = post.media || [];
  const gridClass = mediaItems.length === 1 ? 'single'
    : mediaItems.length === 2 ? 'pair'
      : 'trio';

  const openProfile = () => {
    setSelectedUserId(author._id);
    setShowProfileModal(true);
  };

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <article className="post-card">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="post-header">
        <div className="post-author-row">

          {/* Avatar */}
          <div className="post-avatar-wrap">
            {post.profileavatar ? (
              <img
                src={post.profileavatar}
                alt={author.name || 'User'}
                className="post-avatar"
                onClick={openProfile}
              />
            ) : (
              <div className="post-avatar-placeholder">👤</div>
            )}

            {isAuthorVerified && (
              <span
                className="position-absolute top-0 start-100 translate-middle bg-primary rounded-circle"
                style={{ lineHeight: 0 }}
              >
                <VerifiedBadge show={isAuthorVerified} size={8} />
              </span>
            )}
          </div>

          {/* Name + meta */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="post-author-name mx-2" onClick={openProfile}>
              {author.name || 'Unknown User'}
            </div>
            <div className="post-meta">
              <span className="post-vis">{visLabel[post.visibility] || '🌍 Public'}</span>
              <span className="post-meta-dot" />
              <span className="post-time">{timeAgo(post.date)}</span>
            </div>
          </div>

          {/* Follow / Unfollow */}
          {!isOwnPost && (
            <button
              className={`follow-btn${isFollowing ? ' following' : ''}`}
              onClick={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? '…' : isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>

        {/* Delete */}
        {isOwnPost && (
          <button
            className={`delete-btn${confirmDelete ? ' confirm' : ''}`}
            onClick={handleDeleteClick}
            title={confirmDelete ? 'Tap again to confirm' : 'Delete post'}
            aria-label="Delete post"
          >
            {confirmDelete ? '⚠️' : '🗑️'}
          </button>
        )}
      </div>

      {/* ── Post text ───────────────────────────────────────────────────── */}
      {post.post && (
        <div className="post-body">
          <div
            ref={textRef}
            className="post-text"
            style={{ maxHeight: expanded ? 'none' : isLong ? '7em' : 'none' }}
          >
            {post.post}
            {/* Gradient fade when collapsed */}
            {!expanded && isLong && (
              <div
                className="text-fade"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${dynamicStyles.textFadeBg})`,
                }}
              />
            )}
          </div>
          {isLong && !expanded && (
            <button className="see-more-btn" onClick={() => setExpanded(true)}>
              See more ›
            </button>
          )}
        </div>
      )}

      {/* ── Media ───────────────────────────────────────────────────────── */}
      {mediaItems.length > 0 && (
        <div className={`post-media-grid ${gridClass}`}>
          {mediaItems.map((item, idx) => {
            const src = fullMediaUrl(item.url);

            if (item.type === 'image') {
              return (
                <img
                  key={idx}
                  src={src}
                  alt={`Post ${idx + 1}`}
                  className="post-media-img"
                  loading="lazy"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              );
            }

            if (item.type === 'video') {
              return (
                <div key={idx} className="post-video-wrap portrait">
                  <video
                    ref={el => (videoRefs.current[idx] = el)}
                    playsInline
                    muted
                    controls={false}
                    className="post-video"
                    onClick={() => handleVideoClick(idx)}
                    aria-label={`Post video ${idx + 1}`}
                  >
                    <source src={src} type={item.mimeType || 'video/mp4'} />
                  </video>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* ── Actions bar ─────────────────────────────────────────────────── */}
      <div className="post-actions">

        {/* Like */}
        <button
          className={`action-btn${isLiked ? ' liked' : ''}`}
          onClick={handleLike}
          aria-label={isLiked ? 'Unlike' : 'Like'}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <span
            className={likeAnimation ? 'like-pop' : ''}
            style={{ fontSize: 18, display: 'inline-block' }}
            aria-hidden
          >
            {isLiked ? '❤️' : '🤍'}
          </span>
          <span
            className="action-count"
            style={{ color: isLiked ? dynamicStyles.likedColor : dynamicStyles.mutedColor }}
          >
            {post.likes?.length ?? 0}
          </span>
        </button>

        <div className="divider-dot" />

        {/* Comment */}
        <button
          className="action-btn comment"
          onClick={() => setShowComments(true)}
          aria-label="View comments"
          title="Comment"
        >
          <span style={{ fontSize: 18 }} aria-hidden>💬</span>
          <span className="action-count">
            {commentCount > 0 ? commentCount : 'Comment'}
          </span>
        </button>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showComments && (
        <CommentsModal
          postId={post._id}
          show={showComments}
          onClose={() => setShowComments(false)}
        />
      )}

      <ProfileModal
        userId={selectedUserId}
        show={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </article>
  );
}

export default PostItem;