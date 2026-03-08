// src/components/Posts/HomePostitem.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import VerifiedBadge from '../Common/VerifiedBadge';
import apiRequest from '../../utils/apiRequest';
import CommentsModal from '../Reels/CommentsModal';
import ProfileModal from '../Profile/ProfileModal';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';

/* ─── Utility ─────────────────────────────────────────────────────────────── */
const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.sosholife.com';
const fullMediaUrl = (url) => (url.startsWith('http') ? url : `${baseUrl}${url}`);

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const visLabel = { public: '🌍 Public', private: '🔒 Private', friends: '👥 Friends' };

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PostItem                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
function PostItem({ post, deletePost, toggleLikePost }) {
    const { tokens, isDark } = useTheme();

  /* ─── Design tokens resolved from theme ──────────────────────────────── */
  const T = {
    card:    tokens.bgCard,
    surface: tokens.bgCardAlt,
    border:  tokens.border,
    accent:  '#f59e0b',
    blue:    '#3b82f6',
    red:     tokens.danger,
    green:   tokens.success,
    text:    tokens.textPrimary,
    muted:   tokens.textMuted,
    radius:  14,
    avatarPlaceholderBg: isDark ? '#2a3550' : '#dde3f5',
  };
  const token   = localStorage.getItem('token');
  const decoded = token ? jwtDecode(token) : null;
  const userId  = decoded?.user?.id;

  const author          = post.user_id ?? {};
  const isAuthorVerified= !!author?.subscription?.active;
  const isOwnPost       = userId === author._id;
  const isLiked         = post.likes?.includes(userId);

  const [isFollowing, setIsFollowing]       = useState(false);
  const [followLoading, setFollowLoading]   = useState(false);
  const [showComments, setShowComments]     = useState(false);
  const [commentCount, setCommentCount]     = useState(0);
  const [expanded, setExpanded]             = useState(false);
  const [likeAnimation, setLikeAnimation]  = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId]     = useState(null);
  const [confirmDelete, setConfirmDelete]       = useState(false);

  const textRef = useRef(null);
  const videoRefs    = useRef([]);
  const mutedStates  = useRef({});

  /* ── Follow status ─────────────────────────────────────────────────────── */
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

  /* ── Comment count ─────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest.get(`/api/posts/${post._id}/comments/count`);
        setCommentCount(res.data.count || 0);
      } catch { /* silent */ }
    })();
  }, [post._id]);

  /* ── Like with animation ───────────────────────────────────────────────── */
  const handleLike = () => {
    toggleLikePost(post._id);
    if (!isLiked) {
      setLikeAnimation(true);
      setTimeout(() => setLikeAnimation(false), 600);
    }
  };

  /* ── Video intersection autoplay ───────────────────────────────────────── */
  const playOnlyThisVideo = useCallback((target) => {
    requestAnimationFrame(() => {
      videoRefs.current.forEach(v => { if (v && v !== target && !v.paused) v.pause(); });
      if (target.paused) target.play().catch(() => {});
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

  /* ── Delete confirmation ───────────────────────────────────────────────── */
  const handleDeleteClick = () => {
    if (confirmDelete) {
      deletePost();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  const isLong = post.post && post.post.length > 240;

  const css = `
    @keyframes heartPop {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.45); }
      70%  { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    .like-pop { animation: heartPop 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }

    .post-card {
      background: ${T.card};
      border: 1.5px solid ${T.border};
      border-radius: ${T.radius}px;
      overflow: hidden;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    .post-card:hover { border-color: #2d3a5c; }

    .post-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 14px 14px 0;
      gap: 10px;
    }
    .post-author-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    .post-avatar-wrap { position: relative; flex-shrink: 0; }
    .post-avatar {
      width: 42px; height: 42px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid ${T.accent};
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .post-avatar:hover { opacity: 0.85; }
    .post-avatar-placeholder {
      width: 42px; height: 42px;
      border-radius: 50%;
      background: #2a3550;
      border: 2px solid ${T.accent};
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; color: ${T.muted};
    }
    .verified-dot {
      position: absolute; bottom: 0; right: -2px;
      background: ${T.card};
      border-radius: 50%;
      padding: 1px;
    }
    .post-author-name {
      font-weight: 700;
      font-size: 15px;
      color: ${T.text};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .post-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .post-vis {
      font-size: 11px;
      color: ${T.muted};
    }
    .post-time {
      font-size: 11px;
      color: ${T.muted};
    }

    .follow-btn {
      background: transparent;
      border: 1.5px solid ${T.blue};
      border-radius: 99px;
      padding: 4px 12px;
      color: ${T.blue};
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }
    .follow-btn.following {
      border-color: ${T.muted};
      color: ${T.muted};
    }
    .follow-btn:hover { background: ${T.blueSoft || 'rgba(59,130,246,0.12)'}; }
    .follow-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .delete-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      color: ${T.muted};
      font-size: 16px;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .delete-btn:hover, .delete-btn.confirm { color: ${T.red}; background: rgba(239,68,68,0.1); }

    /* Post body */
    .post-body {
      padding: 12px 14px 10px;
    }
    .post-text {
      color: ${T.text};
      font-size: 15px;
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      overflow: hidden;
      transition: max-height 0.35s ease;
      position: relative;
    }
    .text-fade {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 56px;
      background: linear-gradient(to bottom, transparent, ${T.card});
      pointer-events: none;
    }
    .see-more-btn {
      background: none;
      border: none;
      color: ${T.accent};
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 0;
      margin-top: 4px;
    }

    /* Media */
    .post-media-grid {
      display: grid;
      gap: 3px;
    }
    .post-media-grid.single { grid-template-columns: 1fr; }
    .post-media-grid.pair   { grid-template-columns: 1fr 1fr; }
    .post-media-grid.trio   { grid-template-columns: 1fr 1fr; }
    .post-media-img {
      width: 100%;
      object-fit: cover;
      display: block;
      max-height: 420px;
      background: #000;
    }
    .post-media-grid.single .post-media-img { max-height: 480px; }
    .post-video-wrap {
      position: relative;
      padding-top: 56.25%;
      background: #000;
    }
    .post-video-wrap.portrait { padding-top: 177.78%; }
    .post-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: pointer;
    }

    /* Actions bar */
    .post-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px 12px;
      border-top: 1px solid ${T.border};
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 7px 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      color: ${T.muted};
      transition: background 0.14s, color 0.14s;
    }
    .action-btn:hover { background: ${T.surface}; }
    .action-btn.liked { color: ${T.red}; }
    .action-btn.comment:hover { color: ${T.blue}; }
    .action-count {
      font-size: 13px;
      font-weight: 700;
    }
    .divider-dot {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: ${T.border};
      margin: 0 2px;
    }
  `;

  const mediaItems = post.media || [];
  const gridClass  = mediaItems.length === 1 ? 'single' : mediaItems.length === 2 ? 'pair' : 'trio';

  return (
    <>
      <style>{css}</style>
      <article className="post-card">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="post-header">
          <div className="post-author-row">
            {/* Avatar */}
            <div className="post-avatar-wrap">
              {post.profileavatar ? (
                <img
                  src={post.profileavatar}
                  alt={author.name || 'User'}
                  className="post-avatar"
                  onClick={() => { setSelectedUserId(author._id); setShowProfileModal(true); }}
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
            <div style={{ minWidth: 0 }}>
              <div
                className="post-author-name mx-1"
                style={{ cursor: 'pointer' }}
                onClick={() => { setSelectedUserId(author._id); setShowProfileModal(true); }}
              >
                {author.name || 'Unknown User'}
              </div>
              <div className="post-meta">
                <span className="post-vis">{visLabel[post.visibility] || '🌍 Public'}</span>
                <span style={{ color: T.border }}>·</span>
                <span className="post-time">{timeAgo(post.date)}</span>
              </div>
            </div>

            {/* Follow / Unfollow */}
            {!isOwnPost && (
              <button
                className={`follow-btn ${isFollowing ? 'following' : ''}`}
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
              className={`delete-btn ${confirmDelete ? 'confirm' : ''}`}
              onClick={handleDeleteClick}
              title={confirmDelete ? 'Tap again to confirm' : 'Delete post'}
              aria-label="Delete post"
            >
              {confirmDelete ? '⚠️' : '🗑️'}
            </button>
          )}
        </div>

        {/* ── Post text ───────────────────────────────────────────────── */}
        {post.post && (
          <div className="post-body">
            <div
              ref={textRef}
              className="post-text"
              style={{ maxHeight: expanded ? 'none' : isLong ? '7em' : 'none' }}
            >
              {post.post}
              {!expanded && isLong && <div className="text-fade" />}
            </div>
            {isLong && !expanded && (
              <button className="see-more-btn" onClick={() => setExpanded(true)}>
                See more ›
              </button>
            )}
          </div>
        )}

        {/* ── Media ───────────────────────────────────────────────────── */}
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
                const isPortrait = true; // default; IntersectionObserver handles auto-play
                return (
                  <div key={idx} className={`post-video-wrap${isPortrait ? ' portrait' : ''}`}>
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

        {/* ── Actions bar ─────────────────────────────────────────────── */}
        <div className="post-actions">
          {/* Like */}
          <button
            className={`action-btn ${isLiked ? 'liked' : ''}`}
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
            <span className="action-count" style={{ color: isLiked ? T.red : T.muted }}>
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

        {/* ── Modals ──────────────────────────────────────────────────── */}
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
    </>
  );
}

export default PostItem;