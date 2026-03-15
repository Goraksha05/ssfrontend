// src/components/Posts/HomePosts.js
import React, { useContext } from 'react';
import postContext from '../../Context/Posts/PostContext';
import PostItem from './HomePostitem';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';
import './Home.css';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SkeletonPost — uses CSS classes from Home.css driven by ThemeContext vars  */
/* ═══════════════════════════════════════════════════════════════════════════ */
const SkeletonPost = () => (
  <div className="skeleton-card">

    {/* ── Header ── */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 0' }}>
      <div className="skel-circle" />
      <div style={{ flex: 1 }}>
        <div className="skel-bone"  style={{ height: 13, width: '40%', marginBottom: 6 }} />
        <div className="skel-line-dark" style={{ height: 10, width: '25%' }} />
      </div>
    </div>

    {/* ── Body ── */}
    <div style={{ padding: '14px 14px 6px' }}>
      <div className="skel-bone"      style={{ height: 12, marginBottom: 8 }} />
      <div className="skel-line-dark" style={{ height: 12, width: '85%', marginBottom: 8 }} />
      <div className="skel-bone"      style={{ height: 12, width: '60%' }} />
    </div>

    {/* ── Media placeholder ── */}
    <div className="skel-media" />

    {/* ── Actions ── */}
    <div style={{
      display: 'flex',
      gap: 16,
      padding: '10px 14px 14px',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="skel-action" style={{ width: 60 }} />
      <div className="skel-action" style={{ width: 80 }} />
    </div>

  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  EmptyFeed — uses CSS classes from Home.css driven by ThemeContext vars     */
/* ═══════════════════════════════════════════════════════════════════════════ */
const EmptyFeed = () => (
  <div className="empty-feed">
    <div className="empty-feed-emoji">📭</div>
    <p className="empty-feed-title">Nothing here yet</p>
    <p className="empty-feed-sub">
      Be the first to post something — your feed is waiting!
    </p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HomePosts                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */
function HomePosts() {
  const { statePosts, deletePost, toggleLikePost, loading } = useContext(postContext);

  /* useTheme is consumed here so HomePosts re-renders on theme change,
     ensuring skeleton bones always reflect the correct palette colours. */
  useTheme();

  if (loading) {
    return (
      <>
        {[1, 2, 3].map(i => <SkeletonPost key={i} />)}
      </>
    );
  }

  if (!statePosts || statePosts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <>
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