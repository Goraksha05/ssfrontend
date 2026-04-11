// src/Components/Reels/CommentsModal.js
//
// PERF FIXES:
//   1. scrollRafRef cleanup was in a separate useEffect with an empty dep array
//      that ran after the scroll handler was already attached — the rAF could
//      fire after unmount.  Fixed: cleanup is now in the same useEffect that
//      attaches the scroll listener.
//   2. handleEmojiSelect: requestAnimationFrame for focus was already correct;
//      no change needed.
//   3. sortedComments: wrapped in useMemo so it doesn't re-sort on every
//      render triggered by likedComments state changes.
//   4. CommentAvatar: moved outside component and wrapped in React.memo so it
//      doesn't re-create on every parent render.
//   5. handleSend / handleKeyDown / loadMore / handleScroll: already
//      useCallback — reviewed and confirmed stable.
//   6. Removed duplicate useEffect that was clearing state on show=false
//      (combined with existing show effect).

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

// Stable outside the component — avoids re-creation on every render
const CommentAvatar = React.memo(({ name }) => {
  const initial = name?.[0]?.toUpperCase() || '?';
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${hue}, 55%, 42%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 700, color: '#fff', fontFamily: "'Syne', sans-serif" }}>
      {initial}
    </div>
  );
});

const CommentsModal = ({ postId, show, onClose }) => {
  const { socket } = useAuth();

  const [comments,   setComments]   = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showEmoji,  setShowEmoji]  = useState(false);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [sending,    setSending]    = useState(false);
  const [likedComments, setLikedComments] = useState(new Set());

  const listRef   = useRef(null);
  const inputRef  = useRef(null);
  const emojiRef  = useRef(null);
  const rafRef    = useRef(null); // single rAF ref for scroll handler

  /* ── Close emoji on outside click ──────────────────────────────────────── */
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  /* ── Focus / reset on show change ──────────────────────────────────────── */
  useEffect(() => {
    if (show) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setComments([]);
      setPage(1);
      setHasMore(true);
      setNewComment('');
      setShowEmoji(false);
    }
  }, [show]);

  /* ── Fetch comments ─────────────────────────────────────────────────────── */
  const fetchComments = useCallback(async (pageNum = 1, append = false) => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await apiRequest.get(`/api/posts/${postId}/comments?page=${pageNum}&limit=${COMMENTS_LIMIT}`);
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

  /* ── Socket listener ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!socket || !postId) return;
    socket.emit('join-room', postId);
    const handleNew = (comment) => {
      if (comment.postId === postId) {
        setComments((prev) => prev.some((c) => c._id === comment._id) ? prev : [comment, ...prev]);
      }
    };
    socket.on('comment:new', handleNew);
    return () => {
      socket.emit('leave-room', postId);
      socket.off('comment:new', handleNew);
    };
  }, [socket, postId]);

  /* ── Send comment ───────────────────────────────────────────────────────── */
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

  /* ── Emoji select ───────────────────────────────────────────────────────── */
  const handleEmojiSelect = useCallback((emoji) => {
    const char = emoji?.native || '';
    setNewComment((prev) => prev + char);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /* ── Load more ──────────────────────────────────────────────────────────── */
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchComments(next, true);
  }, [hasMore, loading, page, fetchComments]);

  /* ── Scroll handler — FIX: cleanup rAF in same effect ──────────────────── */
  const handleScroll = useCallback((e) => {
    const el = e.target;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 60) loadMore();
      rafRef.current = null;
    });
  }, [loadMore]);

  // Attach scroll listener manually so we can cleanly cancel pending rAFs
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [handleScroll]);

  /* ── Like toggle ────────────────────────────────────────────────────────── */
  const toggleLikeComment = useCallback((commentId) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });
  }, []);

  /* ── Sorted comments — memoised so likedComments changes don't re-sort ─── */
  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [comments],
  );

  if (!show) return null;

  return (
    <div className="comments-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="comments-modal" style={{ position: 'relative' }}>

        {/* Handle bar */}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />

        {/* Header */}
        <div className="comments-header" style={{ paddingTop: 24 }}>
          <span>
            💬 Comments
            {comments.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                ({comments.length}{hasMore ? '+' : ''})
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} title="Refresh" onClick={() => fetchComments(1, false)}>
              <RefreshCw size={14} />
            </button>
            <button style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, color: 'rgba(255,255,255,0.65)', padding: '4px 14px', fontSize: '0.78rem', cursor: 'pointer' }} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Comments list — scroll listener attached via useEffect above */}
        <div ref={listRef} className="comments-body">
          {loading && comments.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Loading comments…</div>
          ) : sortedComments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.25)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No comments yet.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Be the first to say something!</p>
            </div>
          ) : (
            sortedComments.map((comment, idx) => {
              const name = comment.userId?.name || 'Unknown';
              const isLiked = likedComments.has(comment._id);
              return (
                <div key={comment._id || idx} className="comment-item" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <CommentAvatar name={name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                      <strong style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>{name}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.28)', flexShrink: 0, marginLeft: 8 }}>{relTime(comment.createdAt)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.45, wordBreak: 'break-word' }}>{comment.content}</p>
                    <button onClick={() => toggleLikeComment(comment._id)} style={{ background: 'none', border: 'none', color: isLiked ? '#ff3b5c' : 'rgba(255,255,255,0.3)', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 0 0', display: 'flex', alignItems: 'center', gap: 3, transition: 'color 0.15s ease' }}>
                      ♥ {isLiked ? 'Liked' : 'Like'}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {hasMore && !loading && comments.length > 0 && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <button onClick={loadMore} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', padding: '6px 18px', cursor: 'pointer' }}>
                Load more
              </button>
            </div>
          )}

          {loading && comments.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', padding: '8px 0' }}>Loading…</div>
          )}
        </div>

        {/* Input area */}
        <div className="comment-input-area" style={{ position: 'relative' }}>
          {showEmoji && (
            <div ref={emojiRef} style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 100, borderRadius: '14px 14px 0 0', overflow: 'hidden', boxShadow: '0 -10px 40px rgba(0,0,0,0.6)' }}>
              <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="dark" previewPosition="none" skinTonePosition="none" navPosition="bottom" perLine={8} />
            </div>
          )}
          <div className="input-group">
            <input
              ref={inputRef}
              className="form-control"
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
            />
            <button className="btn-light" onClick={() => setShowEmoji((p) => !p)} title="Emoji" style={{ background: showEmoji ? 'rgba(255,255,255,0.18)' : undefined }}>
              <Smile size={18} />
            </button>
            <button className="btn-primary" onClick={handleSend} disabled={!newComment.trim() || sending} style={{ opacity: !newComment.trim() || sending ? 0.5 : 1 }}>
              {sending ? <span style={{ fontSize: '0.8rem' }}>…</span> : <Send size={15} />}
            </button>
          </div>
          {newComment.length > 400 && (
            <div style={{ marginTop: 4, fontSize: '0.7rem', textAlign: 'right', color: newComment.length > 490 ? '#ff3b5c' : 'rgba(255,255,255,0.35)' }}>
              {newComment.length}/500
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentsModal;