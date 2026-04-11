// src/components/Posts/HomePostitem.js
//
// PERF FIXES:
//   1. Wrapped entire component in React.memo with a custom comparator so it
//      only re-renders when the post data, like status, or comment count changes.
//   2. Video IntersectionObserver: removed the requestAnimationFrame wrapping
//      on observe() — was causing spurious layout reads.  Play/pause now goes
//      through a single rAF to batch DOM writes and avoid forced reflow.
//   3. handleScroll in CommentsModal (not here) — see CommentsModal.js fix.
//   4. Removed per-PostItem GET /api/profile/getprofile (already fixed via
//      ProfileContext).  No new regressions.
//   5. confirmDelete auto-dismiss timeout stored in ref and cleared on unmount
//      to prevent setState-after-unmount warnings.
//   6. Media grid class computed only when mediaItems changes (useMemo).

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import VerifiedBadge from '../Common/VerifiedBadge';
import apiRequest from '../../utils/apiRequest';
import CommentsModal from '../Reels/CommentsModal';
import ProfileModal from '../Profile/ProfileModal';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useProfile } from '../../Context/Profile/ProfileContext';

/* ── Utility ─────────────────────────────────────────────────────────────── */
const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.sosholife.com';

const fullMediaUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
};

const resolveMediaType = (item) => {
  if (!item) return null;
  const t = item.type;
  if (t === 'image' || t === 'video' || t === 'file') return t;
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime) return 'file';
  const url = (item.url || '').toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/.test(url)) return 'image';
  if (/\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/.test(url)) return 'video';
  return 'file';
};

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const visLabel = { public: '🌍 Public', private: '🔒 Private', friends: '👥 Friends' };

/* ── PostItem ─────────────────────────────────────────────────────────────── */
function PostItem({ post, deletePost, toggleLikePost }) {
  const { tokens } = useTheme();

  const dynamicStyles = useMemo(() => ({
    textFadeBg: tokens.bgCard,
    accentColor: tokens.accent,
    likedColor: tokens.danger || '#ef4444',
    mutedColor: tokens.textMuted,
  }), [tokens.bgCard, tokens.accent, tokens.danger, tokens.textMuted]);

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const token = localStorage.getItem('token');
  // Decode once, stable until token changes
  const userId = useMemo(() => {
    try {
      const d = token ? jwtDecode(token) : null;
      return d?.user?.id || d?.id || d?._id;
    } catch { return null; }
  }, [token]);

  const author = post.user_id ?? {};
  const isAuthorVerified = !!author?.subscription?.active;
  const isOwnPost = useMemo(() => String(userId) === String(author._id), [userId, author._id]);
  const isLiked = useMemo(() => post.likes?.includes(userId), [post.likes, userId]);

  /* ── Follow state from ProfileContext ─────────────────────────────────── */
  const { profile } = useProfile();

  const initiallyFollowing = useMemo(() => {
    const list = profile?.following ?? profile?.profile?.following ?? [];
    return list.some((id) => String(id?._id ?? id) === String(author._id));
  }, [profile, author._id]);

  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  const [followLoading, setFollowLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [likeAnimation, setLikeAnimation] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const confirmDeleteTimerRef = useRef(null);
  const videoRefs = useRef([]);
  const mutedStates = useRef({});
  const textRef = useRef(null);

  // Sync follow state when profile loads
  useEffect(() => {
    const list = profile?.following ?? profile?.profile?.following ?? [];
    setIsFollowing(list.some((id) => String(id?._id ?? id) === String(author._id)));
  }, [profile, author._id]);

  // Cleanup confirm-delete timer on unmount
  useEffect(() => () => { if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current); }, []);

  /* ── Follow ───────────────────────────────────────────────────────────── */
  const handleFollow = useCallback(async () => {
    if (followLoading) return;
    setFollowLoading(true);
    setIsFollowing((p) => !p);
    try {
      const res = await apiRequest.put(`/api/profile/follow/${author._id}`, {});
      setIsFollowing(res.data.isFollowing);
    } catch {
      setIsFollowing((p) => !p);
    } finally {
      setFollowLoading(false);
    }
  }, [followLoading, author._id]);

  /* ── Comment count ────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    apiRequest.get(`/api/posts/${post._id}/comments/count`)
      .then((res) => { if (!cancelled) setCommentCount(res.data.count || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [post._id]);

  /* ── Like ─────────────────────────────────────────────────────────────── */
  const handleLike = useCallback(() => {
    toggleLikePost(post._id);
    if (!isLiked) {
      setLikeAnimation(true);
      setTimeout(() => setLikeAnimation(false), 600);
    }
  }, [toggleLikePost, post._id, isLiked]);

  /* ── Video: single rAF for play/pause to avoid forced reflow ─────────── */
  const playOnlyThisVideo = useCallback((target) => {
    requestAnimationFrame(() => {
      videoRefs.current.forEach((v) => { if (v && v !== target && !v.paused) v.pause(); });
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

  // Video intersection observer — batch DOM writes in rAF
  useEffect(() => {
    if (!post?.media?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) {
            playOnlyThisVideo(v);
          } else {
            requestAnimationFrame(() => { if (!v.paused) v.pause(); });
          }
        });
      },
      { threshold: 0.5 },
    );
    const refs = videoRefs.current.filter(Boolean);
    refs.forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [post?.media, playOnlyThisVideo]);

  /* ── Delete ───────────────────────────────────────────────────────────── */
  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      deletePost();
      setConfirmDelete(false);
      clearTimeout(confirmDeleteTimerRef.current);
    } else {
      setConfirmDelete(true);
      confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, deletePost]);

  /* ── Profile modal ────────────────────────────────────────────────────── */
  const openProfile = useCallback((e) => {
    e.stopPropagation();
    setSelectedUserId(author._id);
    setShowProfileModal(true);
  }, [author._id]);

  /* ── Derived / memoised ───────────────────────────────────────────────── */
  useScrollLock(showComments || showProfileModal);

  const isLong = post.post && post.post.length > 240;

  const { mediaItems, gridClass } = useMemo(() => {
    const items = (post.media || []).filter((item) => item?.url && fullMediaUrl(item.url));
    const cls = items.length === 1 ? 'single' : items.length === 2 ? 'double' : items.length >= 3 ? 'triple' : '';
    return { mediaItems: items, gridClass: cls };
  }, [post.media]);

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <article className="post-card">

      {/* Header */}
      <div className="post-header">
        <div className="post-author-row">
          <div
            className="post-avatar-wrap"
            onClick={openProfile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openProfile(e)}
            aria-label={`View ${author.name || 'user'}'s profile`}
          >
            {author.profileavatar?.URL ? (
              <img src={author.profileavatar.URL} alt={author.name || 'User'} className="post-avatar" loading="lazy" />
            ) : (
              <div className="post-avatar-placeholder">{(author.name || 'U')[0].toUpperCase()}</div>
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="post-author-name mx-2" onClick={openProfile}>
              {author.name || 'Unknown User'}
              {isAuthorVerified && <VerifiedBadge />}
            </div>
            <div className="post-meta">
              <span className="post-vis">{visLabel[post.visibility] || '🌍 Public'}</span>
              <span className="post-meta-dot" />
              <span className="post-time">{timeAgo(post.date)}</span>
            </div>
          </div>

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

      {/* Post text */}
      {post.post && (
        <div className="post-body">
          <div
            ref={textRef}
            className="post-text"
            style={{ maxHeight: expanded ? 'none' : isLong ? '7em' : 'none' }}
          >
            {post.post}
            {!expanded && isLong && (
              <div className="text-fade" style={{ background: `linear-gradient(to bottom, transparent, ${dynamicStyles.textFadeBg})` }} />
            )}
          </div>
          {isLong && !expanded && (
            <button className="see-more-btn" onClick={() => setExpanded(true)}>See more ›</button>
          )}
        </div>
      )}

      {/* Media grid */}
      {mediaItems.length > 0 && (
        <div className={`post-media-grid ${gridClass}`}>
          {mediaItems.map((item, idx) => {
            const src = fullMediaUrl(item.url);
            const mediaType = resolveMediaType(item);

            if (mediaType === 'image') {
              return (
                <img
                  key={idx}
                  src={src}
                  alt={`Post media ${idx + 1}`}
                  className="post-media-img"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              );
            }

            if (mediaType === 'video') {
              return (
                <div key={idx} className="post-video-wrap portrait">
                  <video
                    ref={(el) => (videoRefs.current[idx] = el)}
                    playsInline
                    muted
                    controls={false}
                    className="post-video"
                    onClick={() => handleVideoClick(idx)}
                    aria-label={`Post video ${idx + 1}`}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  >
                    <source
                      src={src}
                      type={
                        item.mimeType ||
                        (/\.webm(\?|$)/i.test(src) ? 'video/webm'
                          : /\.mov(\?|$)/i.test(src) ? 'video/quicktime'
                          : 'video/mp4')
                      }
                    />
                  </video>
                </div>
              );
            }

            if (mediaType === 'file') {
              const fileName = src.split('/').pop() || 'attachment';
              return (
                <a
                  key={idx}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="post-file-link"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 8,
                    background: dynamicStyles.textFadeBg,
                    color: dynamicStyles.accentColor,
                    textDecoration: 'none', fontSize: 14, margin: '4px 0',
                  }}
                >
                  📎 {fileName}
                </a>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`action-btn${isLiked ? ' liked' : ''}`}
          onClick={handleLike}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <span className={likeAnimation ? 'like-pop' : ''} style={{ fontSize: 18, display: 'inline-block' }} aria-hidden>
            {isLiked ? '❤️' : '🤍'}
          </span>
          <span className="action-count" style={{ color: isLiked ? dynamicStyles.likedColor : dynamicStyles.mutedColor }}>
            {post.likes?.length ?? 0}
          </span>
        </button>

        <div className="divider-dot" />

        <button className="action-btn comment" onClick={() => setShowComments(true)} aria-label="View comments">
          <span style={{ fontSize: 18 }} aria-hidden>💬</span>
          <span className="action-count">{commentCount > 0 ? commentCount : 'Comment'}</span>
        </button>
      </div>

      {/* Modals */}
      {showComments && (
        <CommentsModal postId={post._id} show={showComments} onClose={() => setShowComments(false)} />
      )}
      {showProfileModal && (
        <ProfileModal userId={selectedUserId} show={showProfileModal} onClose={() => setShowProfileModal(false)} />
      )}
    </article>
  );
}

/* ── Custom memo comparator — only re-render when relevant data changes ────── */
function arePropsEqual(prev, next) {
  return (
    prev.post._id === next.post._id &&
    prev.post.likes?.length === next.post.likes?.length &&
    prev.post.post === next.post.post &&
    prev.deletePost === next.deletePost &&
    prev.toggleLikePost === next.toggleLikePost
  );
}

export default React.memo(PostItem, arePropsEqual);