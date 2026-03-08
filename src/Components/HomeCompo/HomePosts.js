import React, { useContext } from 'react';
import postContext from '../../Context/Posts/PostContext';
import PostItem from './HomePostitem';

/* ─── Skeleton post card ──────────────────────────────────────────────────── */
const SkeletonPost = () => (
  <div className="skeleton-card">
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 0' }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#252d45', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 13, width: '40%', background: '#252d45', borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 10, width: '25%', background: '#1e2840', borderRadius: 6 }} />
      </div>
    </div>
    {/* Body */}
    <div style={{ padding: '14px 14px 6px' }}>
      <div style={{ height: 12, background: '#252d45', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 12, width: '85%', background: '#1e2840', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 12, width: '60%', background: '#252d45', borderRadius: 6 }} />
    </div>
    {/* Media placeholder */}
    <div style={{ height: 200, background: '#141929', margin: '8px 0' }} />
    {/* Actions */}
    <div style={{ display: 'flex', gap: 16, padding: '10px 14px 14px', borderTop: '1px solid #252d45' }}>
      <div style={{ height: 28, width: 60, background: '#1e2840', borderRadius: 8 }} />
      <div style={{ height: 28, width: 80, background: '#1e2840', borderRadius: 8 }} />
    </div>
  </div>
);

/* ─── Empty state ─────────────────────────────────────────────────────────── */
const EmptyFeed = () => (
  <div style={{
    textAlign: 'center',
    padding: '56px 24px',
    background: '#1a2035',
    border: '1.5px dashed #252d45',
    borderRadius: 14,
    color: '#64748b',
  }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
    <p style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
      Nothing here yet
    </p>
    <p style={{ fontSize: 13, margin: 0 }}>
      Be the first to post something — your feed is waiting!
    </p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HomePosts                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */
function HomePosts() {
  const { statePosts, deletePost, toggleLikePost, loading } = useContext(postContext);

  const css = `
    @keyframes skeletonPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.55; }
    }
  `;

  if (loading) {
    return (
      <>
        <style>{css}</style>
        {[1, 2, 3].map(i => <SkeletonPost key={i} />)}
      </>
    );
  }

  if (!statePosts || statePosts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <>
      <style>{css}</style>
      {statePosts.map((post, index) => (
        <PostItem
          key={post._id || index}
          post={post}
          deletePost={() => deletePost(post._id)}
          toggleLikePost={toggleLikePost}
        />
      ))}
    </>
  );
}

export default HomePosts;