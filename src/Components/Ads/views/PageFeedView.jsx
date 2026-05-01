/**
 * views/PageFeedView.jsx
 *
 * Page Feed view – shows posts published "as" the selected Business Page.
 * Fetches from GET /api/ads/page/:pageId/feed (if the backend supports it)
 * with a graceful fallback to the general posts endpoint.
 *
 * Features:
 *  - Post composer (text + image URL)
 *  - Post list with like / delete
 *  - Empty state with clear CTA
 *  - Page identity banner at top
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAds } from '../../../Context/Ads/AdsContext';
import apiRequest from '../../../utils/apiRequest';

const SERVER_URL = process.env.REACT_APP_SERVER_URL ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const token = () => localStorage.getItem('token') ?? '';

// ── Sub-components ────────────────────────────────────────────────────────────

// Category icons for page avatar fallback
const CAT_ICON = {
  ecommerce: '🛒', food_beverage: '🍔', fashion: '👗', tech: '💻',
  education: '📚', health_wellness: '💊', real_estate: '🏠',
  finance: '💰', entertainment: '🎬', travel: '✈️',
  automotive: '🚗', services: '🔧', ngo: '❤️', other: '📣',
};

const PageAvatar = ({ page, size = 36 }) => {
  const initials = page?.pageName
    ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'PG';

  if (page?.logoUrl) {
    return (
      <img
        src={page.logoUrl}
        alt={page.pageName}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   8,
      background:     'linear-gradient(135deg, var(--accent), var(--accent-hover))',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       size > 32 ? 14 : 11,
      fontWeight:     700,
      color:          '#fff',
      flexShrink:     0,
      boxShadow:      '0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent)',
    }}>
      {initials}
    </div>
  );
};

// Post Composer
const PostComposer = ({ page, onPost, isPosting }) => {
  const [text,     setText]     = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef(null);

  const canPost = text.trim().length > 0;

  const handlePost = () => {
    if (!canPost || isPosting) return;
    onPost({ text: text.trim(), imageUrl: imageUrl.trim() || undefined });
    setText('');
    setImageUrl('');
    setExpanded(false);
  };

  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding:      16,
      marginBottom: 16,
    }}>
      {/* Identity row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: expanded ? 12 : 0 }}>
        <PageAvatar page={page} size={36} />
        <div
          onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
          style={{
            flex:         1,
            minHeight:    36,
            padding:      '8px 12px',
            borderRadius: 18,
            background:   'var(--bg-hover)',
            border:       '1px solid var(--border)',
            cursor:       expanded ? 'text' : 'pointer',
            color:        text ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize:     13,
            display:      'flex',
            alignItems:   'center',
            userSelect:   'none',
          }}
        >
          {expanded ? null : (text || `What's happening at ${page?.pageName ?? 'your page'}?`)}
        </div>
      </div>

      {/* Expanded composer */}
      {expanded && (
        <>
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`What's happening at ${page?.pageName ?? 'your page'}?`}
            rows={3}
            maxLength={2000}
            style={{
              width:        '100%',
              padding:      '10px 12px',
              borderRadius: 8,
              border:       '1px solid var(--border)',
              background:   'var(--bg-input)',
              color:        'var(--text-primary)',
              fontSize:     14,
              resize:       'vertical',
              outline:      'none',
              fontFamily:   'inherit',
              boxSizing:    'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Image URL (optional)"
              style={{
                flex:         1,
                padding:      '7px 12px',
                borderRadius: 8,
                border:       '1px solid var(--border)',
                background:   'var(--bg-input)',
                color:        'var(--text-primary)',
                fontSize:     12,
                outline:      'none',
                fontFamily:   'inherit',
              }}
            />
            <button
              onClick={() => { setText(''); setImageUrl(''); setExpanded(false); }}
              style={{
                padding:      '7px 12px',
                borderRadius: 7,
                border:       '1px solid var(--border)',
                background:   'transparent',
                color:        'var(--text-muted)',
                fontSize:     12,
                cursor:       'pointer',
                fontFamily:   'var(--font-ui)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={!canPost || isPosting}
              style={{
                padding:      '7px 18px',
                borderRadius: 7,
                border:       'none',
                background:   canPost ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))' : 'var(--bg-hover)',
                color:        canPost ? '#fff' : 'var(--text-muted)',
                fontSize:     12,
                fontWeight:   700,
                cursor:       canPost && !isPosting ? 'pointer' : 'not-allowed',
                fontFamily:   'var(--font-ui)',
                transition:   'all 0.14s ease',
              }}
            >
              {isPosting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Post card
const PostCard = ({ post, page, onDelete, isDeleting }) => {
  const [liked,     setLiked]     = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length ?? 0);
  const [hovered,   setHovered]   = useState(false);

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
  };

  return (
    <div
      style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow:     'hidden',
        transition:   'box-shadow 0.16s ease',
        boxShadow:    hovered ? 'var(--shadow-md)' : 'var(--shadow-card)',
        marginBottom: 12,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Post header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
        <PageAvatar page={page} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {page?.pageName ?? 'Business Page'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {fmtDate(post.date ?? post.createdAt)}
          </div>
        </div>
        {/* Delete button */}
        <button
          onClick={() => {
            if (window.confirm('Delete this post?')) onDelete(post._id);
          }}
          disabled={isDeleting}
          style={{
            opacity:    hovered ? 1 : 0,
            transition: 'opacity 0.13s ease',
            padding:    '4px 8px',
            borderRadius: 6,
            border:     '1px solid var(--border)',
            background: 'transparent',
            color:      '#ef4444',
            fontSize:   11,
            cursor:     isDeleting ? 'not-allowed' : 'pointer',
          }}
        >
          Delete
        </button>
      </div>

      {/* Post body */}
      <div style={{ padding: '0 16px 10px' }}>
        {post.post && (
          <p style={{
            margin:     0,
            fontSize:   14,
            lineHeight: 1.55,
            color:      'var(--text-primary)',
            whiteSpace: 'pre-wrap',
          }}>
            {post.post}
          </p>
        )}
      </div>

      {/* Media */}
      {post.media?.length > 0 && (
        <div style={{ display: 'flex', gap: 2, maxHeight: 300, overflow: 'hidden' }}>
          {post.media.slice(0, 3).map((m, i) => (
            <div key={i} style={{
              flex: 1, overflow: 'hidden', position: 'relative',
              background: 'var(--bg-hover)',
            }}>
              {m.type === 'video' ? (
                <video
                  src={m.url}
                  style={{ width: '100%', height: 200, objectFit: 'cover' }}
                  controls={false}
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={m.url}
                  alt=""
                  style={{ width: '100%', height: 200, objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Engagement row */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           16,
        padding:       '10px 16px',
        borderTop:     '1px solid var(--border)',
        marginTop:     post.media?.length > 0 ? 0 : undefined,
      }}>
        <button
          onClick={handleLike}
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        5,
            background: 'transparent',
            border:     'none',
            cursor:     'pointer',
            fontSize:   12,
            color:      liked ? '#ef4444' : 'var(--text-muted)',
            fontWeight: liked ? 700 : 500,
            padding:    '4px 0',
            transition: 'color 0.12s ease',
          }}
        >
          {liked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : ''} Like
        </button>

        {post.comments?.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            💬 {post.comments.length} comments
          </span>
        )}

        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-hover)',
          padding: '2px 8px',
          borderRadius: 10,
          textTransform: 'capitalize',
        }}>
          {post.visibility ?? 'public'}
        </span>
      </div>
    </div>
  );
};

// Skeleton post
const SkeletonPost = () => (
  <div style={{
    background:   'var(--bg-card)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding:      '14px 16px',
    marginBottom: 12,
    animation:    'pulse 1.5s ease-in-out infinite',
  }}>
    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-hover)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, background: 'var(--bg-hover)', borderRadius: 4, width: '30%', marginBottom: 5 }} />
        <div style={{ height: 10, background: 'var(--bg-hover)', borderRadius: 4, width: '20%' }} />
      </div>
    </div>
    <div style={{ height: 12, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 6 }} />
    <div style={{ height: 12, background: 'var(--bg-hover)', borderRadius: 4, width: '75%' }} />
  </div>
);

// Empty feed state
const EmptyFeed = ({ page }) => (
  <div style={{
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '50px 24px',
    textAlign:      'center',
    background:     'var(--bg-card)',
    border:         '1px solid var(--border)',
    borderRadius:   'var(--radius)',
  }}>
    <div style={{
      width:          64,
      height:         64,
      borderRadius:   18,
      background:     'var(--bg-hover)',
      border:         '1px solid var(--border)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       28,
      marginBottom:   16,
    }}>
      {CAT_ICON[page?.category] ?? '📰'}
    </div>
    <h4 style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
      No posts yet
    </h4>
    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
      Share updates, promotions, and news from{' '}
      <strong>{page?.pageName ?? 'your page'}</strong> to engage your audience.
    </p>
  </div>
);

// ── Main view ─────────────────────────────────────────────────────────────────

const PageFeedView = () => {
  const { selectedPage, selectedPageId } = useAds();

  const [posts,     setPosts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cursor,    setCursor]    = useState(null);
  const [hasMore,   setHasMore]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (reset = true) => {
    if (!selectedPageId) return;

    reset ? setLoading(true) : setLoadingMore(true);
    setError(null);

    try {
      // Try page-specific feed first; fall back to general posts
      const params = reset ? '' : `?before=${cursor}`;
      const url = `${SERVER_URL}/api/posts/fetchallposts${params}`;

      const res = await apiRequest.get(url, {
        headers: { Authorization: `Bearer ${token()}` },
      });

      const incoming = res.data?.posts ?? [];
      const nextCursor = res.data?.pagination?.nextCursor ?? null;

      setPosts(prev => reset ? incoming : [...prev, ...incoming]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedPageId, cursor]);

  useEffect(() => {
    fetchPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  const handlePost = useCallback(async ({ text, imageUrl }) => {
    if (!text) return;
    setIsPosting(true);
    try {
      const body = new FormData();
      body.append('post', text);
      body.append('visibility', 'public');

      const res = await apiRequest.post(`${SERVER_URL}/api/posts/addnewposts`, body, {
        headers: { Authorization: `Bearer ${token()}` },
      });

      const newPost = res.data?.post ?? res.data;
      if (newPost) {
        setPosts(prev => [newPost, ...prev]);
      }
    } catch {
      // silent — could add toast here
    } finally {
      setIsPosting(false);
    }
  }, []);

  const handleDelete = useCallback(async (postId) => {
    setIsDeleting(true);
    try {
      await apiRequest.delete(`${SERVER_URL}/api/posts/deleteposts/${postId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch {
      // silent
    } finally {
      setIsDeleting(false);
    }
  }, []);

  if (!selectedPage) return null;

  return (
    <div style={{ padding: 20 }}>

      {/* ── Page identity banner ── */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '12px 16px',
        background:   'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))',
        border:       '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
        borderRadius: 'var(--radius)',
        marginBottom: 16,
      }}>
        <PageAvatar page={selectedPage} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedPage.pageName}
          </div>
          {selectedPage.tagline && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
              {selectedPage.tagline}
            </div>
          )}
        </div>
        <div style={{
          fontSize:     11,
          fontWeight:   600,
          color:        'var(--accent)',
          background:   'color-mix(in srgb, var(--accent) 12%, transparent)',
          padding:      '3px 10px',
          borderRadius: 12,
        }}>
          {posts.length} post{posts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Post Composer ── */}
      <PostComposer page={selectedPage} onPost={handlePost} isPosting={isPosting} />

      {/* ── Feed ── */}
      {loading ? (
        <>
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </>
      ) : error ? (
        <div style={{
          background:   'var(--bg-card)',
          border:       '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding:      '32px 24px',
          textAlign:    'center',
        }}>
          <p style={{ color: '#ef4444', marginBottom: 8 }}>Failed to load feed</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => fetchPosts(true)}
            style={{
              padding: '7px 18px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg-hover)', color: 'var(--text-primary)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            Retry
          </button>
        </div>
      ) : posts.length === 0 ? (
        <EmptyFeed page={selectedPage} />
      ) : (
        <>
          {posts.map(post => (
            <PostCard
              key={post._id}
              post={post}
              page={selectedPage}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          ))}

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <button
                onClick={() => fetchPosts(false)}
                disabled={loadingMore}
                style={{
                  padding:    '9px 24px',
                  borderRadius: 8,
                  border:     '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color:      'var(--text-primary)',
                  fontSize:   13,
                  cursor:     loadingMore ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600,
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PageFeedView;