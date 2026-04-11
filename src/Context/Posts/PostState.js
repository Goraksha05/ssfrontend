// src/Context/Posts/PostState.js

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PostContext from './PostContext';
import { useAuth } from '../Authorisation/AuthContext';
import apiRequest from '../../utils/apiRequest';
import { emitSignal } from '../../utils/behaviorSDK';

// ── Constants ─────────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.REACT_APP_SERVER_URL ?? process.env.REACT_APP_BACKEND_URL ?? '';
const MEDIA_UPLOAD_TIMEOUT_MS = 180_000; // 3 min
const PAGE_LIMIT = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token');
}

/**
 * Resolve a media type string from whatever the backend returns.
 * Handles old responses (no `type`), MIME-type fallback, and URL extension sniff.
 */
function normaliseMediaType(item) {
  if (!item) return null;
  const t = item.type;
  if (t === 'image' || t === 'video' || t === 'file') return t;
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  const url = (item.url || '').toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/.test(url)) return 'image';
  if (/\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/.test(url)) return 'video';
  return 'file';
}

function normalisePost(post) {
  if (!post) return post;
  if (!Array.isArray(post.media) || post.media.length === 0) return post;
  return {
    ...post,
    media: post.media
      .filter((item) => item?.url)
      .map((item) => ({ ...item, url: item.url, type: normaliseMediaType(item) })),
  };
}

// ── PostState ─────────────────────────────────────────────────────────────────

const PostState = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // Core state
  const [posts, setPosts]           = useState([]);
  const [postMap, setPostMap]       = useState(new Map()); // id → post (O(1) lookups)
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState(null);
  const [nextCursor, setNextCursor] = useState(null);   // ObjectId string
  const [hasMore, setHasMore]       = useState(true);

  // Guards
  const fetchingRef = useRef(false);
  const abortRef    = useRef(null);  // AbortController for the active fetch

  // ── Internal sync helper ────────────────────────────────────────────────
  // Keeps the posts array and postMap in sync from a single source-of-truth list.
  const syncState = useCallback((newPosts) => {
    setPosts(newPosts);
    setPostMap(new Map(newPosts.map((p) => [p._id, p])));
  }, []);

  // ── fetchPosts (first page / refresh) ────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    const token = getToken();
    if (!token || fetchingRef.current) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest.get(
        `${BACKEND_URL}/api/posts/fetchallposts?limit=${PAGE_LIMIT}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      const data = res.data;
      let rawPosts;

      if (Array.isArray(data)) {
        rawPosts = data;
        setNextCursor(null);
        setHasMore(false);
      } else if (Array.isArray(data?.posts)) {
        rawPosts = data.posts;
        setNextCursor(data.pagination?.nextCursor ?? null);
        setHasMore(data.pagination?.hasMore ?? false);
      } else {
        console.warn('[PostState] Unexpected fetchallposts response shape:', data);
        rawPosts = [];
        setHasMore(false);
      }

      syncState(rawPosts.map(normalisePost));
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error('[PostState] fetchPosts:', err);
      setError('Failed to load posts. Tap to retry.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [syncState]);

  // ── loadMorePosts (subsequent pages) ────────────────────────────────────
  const loadMorePosts = useCallback(async () => {
    const token = getToken();
    if (!token || loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const res = await apiRequest.get(
        `${BACKEND_URL}/api/posts/fetchallposts?limit=${PAGE_LIMIT}&before=${nextCursor}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;
      const rawPosts = Array.isArray(data?.posts) ? data.posts : [];
      const newPosts = rawPosts.map(normalisePost);

      setPosts((prev) => {
        const updated = [...prev, ...newPosts];
        setPostMap(new Map(updated.map((p) => [p._id, p])));
        return updated;
      });

      setNextCursor(data.pagination?.nextCursor ?? null);
      setHasMore(data.pagination?.hasMore ?? false);
    } catch (err) {
      console.error('[PostState] loadMorePosts:', err);
      toast.error('Failed to load more posts.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, nextCursor, loadingMore]);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      setNextCursor(null);
      setHasMore(true);
      fetchPosts();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line
  }, [isAuthenticated]); // fetchPosts intentionally omitted — stable ref

  // ── addPost ──────────────────────────────────────────────────────────────
  const addPost = useCallback(async (
    postContent,
    visibility = 'public',
    selectedFiles = [],
  ) => {
    const token = getToken();
    if (!token) { toast.error('Authentication token missing!'); return; }

    if (!postContent?.trim() && (!selectedFiles?.length)) {
      toast.error('Please enter some text or upload media.');
      return;
    }

    const hasFiles = selectedFiles?.length > 0;
    const formData = new FormData();
    formData.append('post', postContent ?? '');
    formData.append('visibility', visibility);
    selectedFiles?.forEach((file) => {
      if (file instanceof File) formData.append('media', file);
    });

    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/posts/addnewposts`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: hasFiles ? MEDIA_UPLOAD_TIMEOUT_MS : 15_000,
        }
      );

      const newPost = normalisePost(res.data.post);

      // Optimistically prepend
      setPosts((prev) => {
        const updated = [newPost, ...prev];
        setPostMap(new Map(updated.map((p) => [p._id, p])));
        return updated;
      });

      if (hasFiles) {
        // Re-fetch after background compression to pick up final URLs
        setTimeout(fetchPosts, 5_000);
      }

      // Behavior signal
      try {
        const session = window.__sdkSession;
        const now = Date.now();
        const last = localStorage.getItem('last_post_time');
        localStorage.setItem('last_post_time', now);
        if (session) {
          emitSignal(session, 'post_created', {
            interval_ms_since_last_post: last ? now - Number(last) : null,
          });
        }
      } catch { /* non-fatal */ }

      toast.success(
        hasFiles
          ? 'Post created! Media is being processed in the background.'
          : 'Post added successfully!'
      );

      return newPost;
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        toast.error('Upload timed out. Check your connection and try again.');
      } else {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          'Failed to create post. Please try again.';
        toast.error(msg);
      }
      console.error('[PostState] addPost:', err.response?.data ?? err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchPosts]);

  // ── updatePost — patch a single post in-place ────────────────────────────
  // Used by comment counts, moderation status, etc.
  const updatePost = useCallback((id, patch) => {
    setPosts((prev) => {
      const updated = prev.map((p) =>
        p._id === id ? { ...p, ...patch } : p
      );
      setPostMap(new Map(updated.map((p) => [p._id, p])));
      return updated;
    });
  }, []);

  // ── deletePost (optimistic) ──────────────────────────────────────────────
  const deletePost = useCallback(async (id) => {
    const token = getToken();
    if (!token) { toast.error('Authentication token missing!'); return; }

    // Capture for rollback
    const snapshot = posts.find((p) => p._id === id);
    const snapshotIdx = posts.findIndex((p) => p._id === id);

    // Optimistic remove
    setPosts((prev) => {
      const updated = prev.filter((p) => p._id !== id);
      setPostMap(new Map(updated.map((p) => [p._id, p])));
      return updated;
    });

    try {
      await apiRequest.delete(
        `${BACKEND_URL}/api/posts/deleteposts/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Post deleted!');
    } catch (err) {
      // Rollback
      if (snapshot) {
        setPosts((prev) => {
          const updated = [...prev];
          updated.splice(snapshotIdx, 0, snapshot);
          setPostMap(new Map(updated.map((p) => [p._id, p])));
          return updated;
        });
      }
      toast.error('Failed to delete post.');
      console.error('[PostState] deletePost:', err);
    }
  }, [posts]);

  // ── toggleLikePost (optimistic) ──────────────────────────────────────────
  const toggleLikePost = useCallback(async (postId, currentUserId) => {
    const token = getToken();
    if (!token || !currentUserId) return;

    // Capture for rollback
    const original = postMap.get(postId);
    if (!original) return;

    const alreadyLiked = original.likes?.includes(currentUserId);
    const optimisticLikes = alreadyLiked
      ? original.likes.filter((id) => id !== currentUserId)
      : [...(original.likes ?? []), currentUserId];

    // Optimistic update
    updatePost(postId, { likes: optimisticLikes });

    try {
      const res = await apiRequest.put(
        `${BACKEND_URL}/api/posts/like/${postId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Reconcile with server truth
      updatePost(postId, { likes: res.data.likes });
    } catch (err) {
      // Rollback
      updatePost(postId, { likes: original.likes });
      toast.error('Failed to like/unlike post.');
      console.error('[PostState] toggleLikePost:', err);
    }
  }, [postMap, updatePost]);

  // ── Stable context value (memoised) ─────────────────────────────────────
  const value = useMemo(() => ({
    statePosts: posts,
    postMap,
    loading,
    loadingMore,
    error,
    hasMore,
    nextCursor,
    fetchPosts,
    loadMorePosts,
    addPost,
    deletePost,
    updatePost,
    toggleLikePost,
  }), [
    posts, postMap, loading, loadingMore, error, hasMore, nextCursor,
    fetchPosts, loadMorePosts, addPost, deletePost, updatePost, toggleLikePost,
  ]);

  return (
    <PostContext.Provider value={value}>
      {children}
    </PostContext.Provider>
  );
};

export default PostState;