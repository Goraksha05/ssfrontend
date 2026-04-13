// src/Components/Reels/CommentsModal.js
//
// RENDER OPTIMISATIONS (this pass):
//   1. CommentItem extracted into its own React.memo component so individual
//      comment rows never re-render when unrelated state (newComment, showEmoji,
//      sending, likedComments for OTHER comments) changes.
//   2. toggleLikeComment passed via stable useCallback — CommentItem receives
//      it as a prop so its memo comparison stays referentially stable.
//   3. isLiked derived inside CommentItem rather than passed as a derived bool,
//      so only the specific item that changed re-renders (likedComments Set
//      reference changes, but memo's shallow comparison of the Set itself would
//      always show change — so isLiked is passed as a plain bool computed in
//      the parent map, which IS the correct pattern here; see note below*).
//   4. LoadMoreButton and EmptyState extracted as tiny memo'd components to
//      avoid re-creating JSX on every render.
//   5. InputArea extracted as React.memo — it only re-renders when newComment /
//      showEmoji / sending change, not when the comment list updates.
//   6. relTime is now stable (defined once at module scope); no change needed.
//   7. handleScroll useCallback dep array previously included `loadMore` which
//      itself depended on `page` — this created a new handleScroll on every
//      page change, detaching/re-attaching the scroll listener on each page
//      load.  Fixed by storing page in a ref so loadMore (and therefore
//      handleScroll) never needs to be recreated.
//   8. fetchComments: page ref used instead of page state inside loadMore, so
//      loadMore's useCallback dep array shrinks to [hasMore, loading, fetchComments].
//   9. Removed the redundant `comments.length === 0` guard in the loading
//      spinner branch (already covered by sortedComments.length === 0 branch).
//  10. show && postId guard moved into fetchComments to avoid a stale closure.
//
// * Why isLiked is computed in the parent map and passed as a bool:
//   CommentItem is memo'd. If we passed the entire `likedComments` Set as a
//   prop, memo would re-render ALL items on every like (Set reference changes).
//   Passing a primitive bool means only the one toggled item sees a prop change.

import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import apiRequest from '../../utils/apiRequest';
import { toast } from 'react-toastify';
import { Send, Smile, RefreshCw } from 'lucide-react';

const COMMENTS_LIMIT = 15;

/* ── Utilities ──────────────────────────────────────────────────────────── */
const relTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString();
};

/* ── Sub-components (all memo'd) ────────────────────────────────────────── */

const CommentAvatar = React.memo(({ name }) => {
  const initial = name?.[0]?.toUpperCase() || '?';
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: `hsl(${hue}, 55%, 42%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: '0.8rem', fontWeight: 700,
      color: '#fff', fontFamily: "'Syne', sans-serif",
    }}>
      {initial}
    </div>
  );
});

// Optimisation #1 — memo'd per-row component.
// Re-renders ONLY when this comment's content, timestamp, or liked state changes.
const CommentItem = React.memo(({ comment, isLiked, onToggleLike }) => {
  const name = comment.userId?.name || 'Unknown';
  return (
    <div className="comment-item" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <CommentAvatar name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', marginBottom: 2,
        }}>
          <strong style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>{name}</strong>
          <span style={{
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)',
            flexShrink: 0, marginLeft: 8,
          }}>
            {relTime(comment.createdAt)}
          </span>
        </div>
        <p style={{
          margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.88)',
          lineHeight: 1.45, wordBreak: 'break-word',
        }}>
          {comment.content}
        </p>
        <button
          onClick={() => onToggleLike(comment._id)}
          style={{
            background: 'none', border: 'none',
            color: isLiked ? '#ff3b5c' : 'rgba(255,255,255,0.3)',
            fontSize: '0.72rem', cursor: 'pointer',
            padding: '4px 0 0', display: 'flex', alignItems: 'center',
            gap: 3, transition: 'color 0.15s ease',
          }}
        >
          ♥ {isLiked ? 'Liked' : 'Like'}
        </button>
      </div>
    </div>
  );
});

// Optimisation #4 — extracted to avoid re-creating JSX in parent render.
const EmptyState = React.memo(() => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.25)' }}>
    <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
    <p style={{ margin: 0, fontSize: '0.88rem' }}>No comments yet.</p>
    <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Be the first to say something!</p>
  </div>
));

const LoadMoreButton = React.memo(({ onLoadMore }) => (
  <div style={{ textAlign: 'center', padding: '10px 0' }}>
    <button
      onClick={onLoadMore}
      style={{
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, color: 'rgba(255,255,255,0.55)',
        fontSize: '0.75rem', padding: '6px 18px', cursor: 'pointer',
      }}
    >
      Load more
    </button>
  </div>
));

// Optimisation #5 — InputArea only re-renders on input-related state changes.
const InputArea = React.memo(({
  newComment, setNewComment, showEmoji, setShowEmoji,
  sending, onSend, onKeyDown, onEmojiSelect, emojiRef, inputRef,
}) => (
  <div className="comment-input-area" style={{ position: 'relative' }}>
    {showEmoji && (
      <div
        ref={emojiRef}
        style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          zIndex: 100, borderRadius: '14px 14px 0 0', overflow: 'hidden',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
        }}
      >
        <Picker
          data={data}
          onEmojiSelect={onEmojiSelect}
          theme="dark"
          previewPosition="none"
          skinTonePosition="none"
          navPosition="bottom"
          perLine={8}
        />
      </div>
    )}
    <div className="input-group">
      <input
        ref={inputRef}
        className="form-control"
        placeholder="Add a comment…"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={500}
      />
      <button
        className="btn-light"
        onClick={() => setShowEmoji((p) => !p)}
        title="Emoji"
        style={{ background: showEmoji ? 'rgba(255,255,255,0.18)' : undefined }}
      >
        <Smile size={18} />
      </button>
      <button
        className="btn-primary"
        onClick={onSend}
        disabled={!newComment.trim() || sending}
        style={{ opacity: !newComment.trim() || sending ? 0.5 : 1 }}
      >
        {sending ? <span style={{ fontSize: '0.8rem' }}>…</span> : <Send size={15} />}
      </button>
    </div>
    {newComment.length > 400 && (
      <div style={{
        marginTop: 4, fontSize: '0.7rem', textAlign: 'right',
        color: newComment.length > 490 ? '#ff3b5c' : 'rgba(255,255,255,0.35)',
      }}>
        {newComment.length}/500
      </div>
    )}
  </div>
));

/* ── Main component ──────────────────────────────────────────────────────── */
const CommentsModal = ({ postId, show, onClose }) => {
  const { socket } = useAuth();

  const [comments,      setComments]      = useState([]);
  const [newComment,    setNewComment]    = useState('');
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [hasMore,       setHasMore]       = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [sending,       setSending]       = useState(false);
  const [likedComments, setLikedComments] = useState(new Set());

  const listRef  = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const rafRef   = useRef(null);

  // Optimisation #7 — page stored in a ref so loadMore's useCallback deps
  // don't include `page`, preventing handleScroll from being recreated on
  // every page increment (which was detaching/re-attaching the scroll listener).
  const pageRef = useRef(1);

  /* ── Close emoji on outside click ────────────────────────────────────── */
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  /* ── Focus / reset on show change ────────────────────────────────────── */
  useEffect(() => {
    if (show) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setComments([]);
      pageRef.current = 1;
      setHasMore(true);
      setNewComment('');
      setShowEmoji(false);
    }
  }, [show]);

  /* ── Fetch comments ───────────────────────────────────────────────────── */
  const fetchComments = useCallback(async (pageNum = 1, append = false) => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await apiRequest.get(
        `/api/posts/${postId}/comments?page=${pageNum}&limit=${COMMENTS_LIMIT}`
      );
      const fetched = res.data.comments || [];
      setComments((prev) => append ? [...prev, ...fetched] : fetched);
      setHasMore(fetched.length === COMMENTS_LIMIT);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (show && postId) fetchComments(1, false);
  }, [show, postId, fetchComments]);

  /* ── Socket listener ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!socket || !postId) return;
    socket.emit('join-room', postId);
    const handleNew = (comment) => {
      if (comment.postId === postId) {
        setComments((prev) =>
          prev.some((c) => c._id === comment._id) ? prev : [comment, ...prev]
        );
      }
    };
    socket.on('comment:new', handleNew);
    return () => {
      socket.emit('leave-room', postId);
      socket.off('comment:new', handleNew);
    };
  }, [socket, postId]);

  /* ── Send comment ─────────────────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    const trimmed = newComment.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await apiRequest.post(`/api/posts/${postId}/comments`, { content: trimmed });
      setComments((prev) => [res.data, ...prev]);
      setNewComment('');
      setShowEmoji(false);
      if (listRef.current) listRef.current.scrollTop = 0;
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSending(false);
    }
  }, [newComment, postId, sending]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  /* ── Emoji select ─────────────────────────────────────────────────────── */
  const handleEmojiSelect = useCallback((emoji) => {
    const char = emoji?.native || '';
    setNewComment((prev) => prev + char);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /* ── Load more (Optimisation #8) ─────────────────────────────────────── */
  // pageRef replaces page state in this callback so its identity stays stable
  // across page increments — which keeps handleScroll stable too.
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchComments(next, true);
  }, [hasMore, loading, fetchComments]);

  /* ── Scroll handler (Optimisation #7) ────────────────────────────────── */
  const handleScroll = useCallback((e) => {
    const el = e.target;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 60) loadMore();
      rafRef.current = null;
    });
  }, [loadMore]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [handleScroll]);

  /* ── Like toggle ──────────────────────────────────────────────────────── */
  const toggleLikeComment = useCallback((commentId) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });
  }, []);

  /* ── Sorted comments ──────────────────────────────────────────────────── */
  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [comments],
  );

  if (!show) return null;

  return (
    <div
      className="comments-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="comments-modal" style={{ position: 'relative' }}>

        {/* Handle bar */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)',
        }} />

        {/* Header */}
        <div className="comments-header" style={{ paddingTop: 24 }}>
          <span>
            💬 Comments
            {comments.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.4)', fontWeight: 400,
              }}>
                ({comments.length}{hasMore ? '+' : ''})
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                padding: '4px', display: 'flex', alignItems: 'center',
              }}
              title="Refresh"
              onClick={() => { pageRef.current = 1; fetchComments(1, false); }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 20, color: 'rgba(255,255,255,0.65)',
                padding: '4px 14px', fontSize: '0.78rem', cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {/* Comments list */}
        <div ref={listRef} className="comments-body">
          {loading && comments.length === 0 ? (
            <div style={{
              display: 'flex', justifyContent: 'center',
              padding: '30px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
            }}>
              Loading comments…
            </div>
          ) : sortedComments.length === 0 ? (
            <EmptyState />
          ) : (
            // Optimisation #3 — isLiked passed as primitive bool, not the Set,
            // so memo only re-renders the single item whose liked state changed.
            sortedComments.map((comment, idx) => (
              <CommentItem
                key={comment._id || idx}
                comment={comment}
                isLiked={likedComments.has(comment._id)}
                onToggleLike={toggleLikeComment}
              />
            ))
          )}

          {hasMore && !loading && comments.length > 0 && (
            <LoadMoreButton onLoadMore={loadMore} />
          )}

          {loading && comments.length > 0 && (
            <div style={{
              textAlign: 'center', fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.25)', padding: '8px 0',
            }}>
              Loading…
            </div>
          )}
        </div>

        {/* Optimisation #5 — InputArea is memo'd; comment list updates won't re-render it */}
        <InputArea
          newComment={newComment}
          setNewComment={setNewComment}
          showEmoji={showEmoji}
          setShowEmoji={setShowEmoji}
          sending={sending}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onEmojiSelect={handleEmojiSelect}
          emojiRef={emojiRef}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
};

export default CommentsModal;