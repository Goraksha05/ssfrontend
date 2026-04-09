// src/components/Posts/HomePostitem.js
//
// FIX 1: fullMediaUrl now guards against undefined/null/empty url values so
//         it never calls .startsWith() on a non-string and never returns a
//         broken URL like "https://api.sosholife.comundefined".
//
// FIX 2: The media render block now handles items whose type is 'file' or
//         whose type could not be determined (e.g. right after upload before
//         the server normalises it) by falling back to a download link instead
//         of silently returning null and hiding the attachment from the user.
//
// FIX 3: Added a mimeType-based fallback to the type guard so that the
//         immediately-prepended post (which still carries mimeType from the
//         Multer file object before Mongoose strips it) is rendered correctly
//         without waiting for the re-fetch.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import VerifiedBadge from '../Common/VerifiedBadge';
import apiRequest from '../../utils/apiRequest';
import CommentsModal from '../Reels/CommentsModal';
import ProfileModal from '../Profile/ProfileModal';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';

/* ─── Utility ─────────────────────────────────────────────────────────────── */
const baseUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.sosholife.com';

/**
 * FIX 1: Guard against undefined/null/empty url before calling .startsWith().
 * Returns null for unusable values so callers can skip rendering.
 */
const fullMediaUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  return url.startsWith('http') ? url : `${baseUrl}${url}`;
};

/**
 * FIX 3: Resolve the effective media type from a media item object.
 * Checks `type` first (schema field), then `mimeType` (present on the
 * immediately-returned document before Mongoose strips non-schema fields),
 * then falls back to URL extension sniffing.
 */
const resolveMediaType = (item) => {
  if (!item) return null;

  const t = item.type;
  if (t === 'image' || t === 'video' || t === 'file') return t;

  // mimeType is present on the locally-prepended post right after upload
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime) return 'file'; // any other mime type → treat as download

  // Last resort: extension sniff
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

  const dynamicStyles = {
    textFadeBg: tokens.bgCard,
    accentColor: tokens.accent,
    likedColor: tokens.danger || '#ef4444',
    mutedColor: tokens.textMuted,
  };

  /* ── Auth ───────────────────────────────────────────────────────────────── */
  const token = localStorage.getItem('token');
  const decoded = token ? jwtDecode(token) : null;
  const userId = decoded?.user?.id || decoded?.id || decoded?._id;

  const author = post.user_id ?? {};
  const isAuthorVerified = !!author?.subscription?.active;
  const isOwnPost = String(userId) === String(author._id);
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

  // FIX 1 + FIX 2: filter out items with no usable URL upfront so the grid
  // count and class assignment are based only on actually-renderable items.
  const mediaItems = (post.media || []).filter(item => {
    if (!item) return false;
    const src = fullMediaUrl(item.url);
    return src !== null; // drop items whose URL cannot be resolved
  });

  const gridClass = mediaItems.length === 1 ? 'single'
    : mediaItems.length === 2 ? 'pair'
      : 'trio';

  useScrollLock(showProfileModal);

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
            // FIX 1: fullMediaUrl already guarded; mediaItems only contains
            // items with a valid URL so src is guaranteed to be a string here.
            const src = fullMediaUrl(item.url);

            // FIX 3: use resolveMediaType so mimeType-only items (just-uploaded
            // posts before re-fetch) are also rendered correctly.
            const mediaType = resolveMediaType(item);

            if (mediaType === 'image') {
              return (
                <img
                  key={idx}
                  src={src}
                  alt={`Post media ${idx + 1}`}
                  className="post-media-img"
                  loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              );
            }

            if (mediaType === 'video') {
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
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  >
                    {/* FIX 3: prefer explicit mimeType when available, then
                        infer from extension, fall back to video/mp4 */}
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

            // FIX 2: 'file' type or unresolved — render a download link so the
            // attachment is visible rather than silently hidden.
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: dynamicStyles.textFadeBg,
                    color: dynamicStyles.accentColor,
                    textDecoration: 'none',
                    fontSize: 14,
                    margin: '4px 0',
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

      {showProfileModal && (
        <ProfileModal
          userId={selectedUserId}
          show={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </article>
  );
}

export default PostItem;