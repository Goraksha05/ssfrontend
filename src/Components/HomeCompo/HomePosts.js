// src/components/Posts/HomePosts.js
//
// PERF FIXES:
//   1. deletePost callbacks are now memoised per post._id with useCallback +
//      a stable Map ref — no more inline arrow functions that force every
//      PostItem to re-render on every parent render.
//   2. MemoPostItem wraps PostItem in React.memo so it only re-renders when
//      its own post, deletePost, or toggleLikePost reference changes.
//   3. Sentinel IntersectionObserver unchanged — already optimal.

import React, { useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import postContext from '../../Context/Posts/PostContext';
import PostItem from './HomePostitem';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';

/* ── Memoised wrapper so PostItem skips re-renders ────────────────────────── */
const MemoPostItem = React.memo(PostItem);

/* ── SkeletonPost ─────────────────────────────────────────────────────────── */
const SkeletonPost = React.memo(() => (
  <div className="skeleton-card">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 0' }}>
      <div className="skel-circle" />
      <div style={{ flex: 1 }}>
        <div className="skel-bone"      style={{ height: 13, width: '40%', marginBottom: 6 }} />
        <div className="skel-line-dark" style={{ height: 10, width: '25%' }} />
      </div>
    </div>
    <div style={{ padding: '14px 14px 6px' }}>
      <div className="skel-bone"      style={{ height: 12, marginBottom: 8 }} />
      <div className="skel-line-dark" style={{ height: 12, width: '85%', marginBottom: 8 }} />
      <div className="skel-bone"      style={{ height: 12, width: '60%' }} />
    </div>
    <div className="skel-media" />
    <div style={{ display: 'flex', gap: 16, padding: '10px 14px 14px', borderTop: '1px solid var(--border)' }}>
      <div className="skel-action" style={{ width: 60 }} />
      <div className="skel-action" style={{ width: 80 }} />
    </div>
  </div>
));

/* ── EmptyFeed ────────────────────────────────────────────────────────────── */
const EmptyFeed = React.memo(() => (
  <div className="empty-feed">
    <div className="empty-feed-emoji">📭</div>
    <p className="empty-feed-title">Nothing here yet</p>
    <p className="empty-feed-sub">Be the first to post something — your feed is waiting!</p>
  </div>
));

/* ── HomePosts ────────────────────────────────────────────────────────────── */
function HomePosts() {
  const {
    statePosts,
    deletePost,
    toggleLikePost,
    loading,
    loadingMore,
    hasMore,
    loadMorePosts,
  } = useContext(postContext);

  const { tokens } = useTheme();
  const sentinelRef = useRef(null);

  // ── Stable deletePost callbacks per post id ──────────────────────────────
  // We keep one callback per post id in a Map so React.memo on PostItem can
  // actually skip re-renders (inline `() => deletePost(id)` creates a new
  // reference on every render, defeating memo).
  const deleteCallbacksRef = useRef(new Map());

  const getDeleteCallback = useCallback(
    (postId) => {
      if (!deleteCallbacksRef.current.has(postId)) {
        deleteCallbacksRef.current.set(postId, () => deletePost(postId));
      }
      return deleteCallbacksRef.current.get(postId);
    },
    [deletePost],
  );

  // Prune stale entries when posts list changes so the Map doesn't grow forever
  useMemo(() => {
    if (!statePosts) return;
    const currentIds = new Set(statePosts.map((p) => p._id));
    for (const id of deleteCallbacksRef.current.keys()) {
      if (!currentIds.has(id)) deleteCallbacksRef.current.delete(id);
    }
  }, [statePosts]);

  // ── Infinite scroll ──────────────────────────────────────────────────────
  const handleIntersect = useCallback(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMorePosts();
      }
    },
    [hasMore, loadingMore, loadMorePosts],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '300px',
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return <>{[1, 2, 3].map((i) => <SkeletonPost key={i} />)}</>;
  }

  if (!statePosts || statePosts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <>
      {statePosts.map((post, index) => (
        <MemoPostItem
          key={post._id || index}
          post={post}
          deletePost={getDeleteCallback(post._id)}
          toggleLikePost={toggleLikePost}
        />
      ))}

      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '20px 0', color: tokens.textMuted, fontSize: 14 }}>
          <span style={{ width: 20, height: 20, border: `2px solid ${tokens.textMuted}`, borderTopColor: tokens.accent, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          Loading more posts…
        </div>
      )}

      {!hasMore && statePosts.length > 0 && (
        <p style={{ textAlign: 'center', color: tokens.textMuted, fontSize: 13, padding: '24px 0 32px', userSelect: 'none' }}>
          ✅ You're all caught up!
        </p>
      )}
    </>
  );
}

export default HomePosts;