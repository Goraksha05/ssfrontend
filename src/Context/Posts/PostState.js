// src/Context/Posts/PostState.js
//
// FIX 1: fetchPosts now safely extracts the posts array whether the backend
//         returns a flat array  (original route)  OR  { posts, pagination }
//         (new paginated route). Either way statePosts is always an array.
//
// FIX 2: token is read inside fetchPosts (not at module level) so it is
//         always fresh after login.
//
// FIX 3: After addPost succeeds for a media post, fetchPosts is called again
//         so the feed reflects the persisted, server-side state (including the
//         background-compressed media URLs) instead of relying solely on the
//         immediately-returned Mongoose document whose media URLs may differ
//         after background compression completes.
//
// FIX 4: addPost now normalises the locally-prepended post so that every
//         media item is guaranteed to have { url, type } — the exact shape
//         HomePostitem expects — even before the re-fetch lands.

import React, { useState, useEffect, useCallback } from "react";
import PostContext from "./PostContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from '../Authorisation/AuthContext';
import apiRequest from "../../utils/apiRequest";
import { emitSignal } from "../../utils/behaviorSDK";

const BACKEND_URL = process.env.REACT_APP_SERVER_URL ?? process.env.REACT_APP_BACKEND_URL;
const MEDIA_UPLOAD_TIMEOUT_MS = 180_000; // 3 minutes for file uploads

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a media type string ('image' | 'video' | 'file') from whatever the
 * backend stored.  The Mongoose Posts schema only persists `url` and `type`
 * in each media sub-document — `mimeType` is stripped on save.  We therefore
 * fall back to sniffing the URL extension when `type` is absent.
 */
function normaliseMediaType(item) {
  if (!item) return null;

  const t = item.type;
  if (t === 'image' || t === 'video' || t === 'file') return t;

  // Fallback: infer from mimeType (present on the immediately-returned
  // document before Mongoose strips non-schema fields on the next fetch)
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';

  // Last resort: extension sniff from the URL
  const url = (item.url || '').toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/.test(url)) return 'image';
  if (/\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/.test(url)) return 'video';

  return 'file';
}

/**
 * Normalise a post object returned by the backend so HomePostitem always
 * receives a consistent shape regardless of which API response it came from.
 */
function normalisePost(post) {
  if (!post) return post;
  if (!Array.isArray(post.media) || post.media.length === 0) return post;

  return {
    ...post,
    media: post.media
      .filter(item => item && item.url)          // drop items with no URL
      .map(item => ({
        ...item,
        url:  item.url,
        type: normaliseMediaType(item),           // guaranteed 'image'|'video'|'file'
      })),
  };
}

const PostState = ({ children }) => {
  const [statePosts, setStatePosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  // ── fetchPosts ──────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    // Always read token fresh — avoids stale closure after login
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("Authentication token missing!");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest.get(`${BACKEND_URL}/api/posts/fetchallposts`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Handle both response shapes robustly:
      //   Old backend  → res.data is a plain array
      //   New backend  → res.data is { posts: [...], pagination: {...} }
      let posts;
      if (Array.isArray(res.data)) {
        posts = res.data;
      } else if (Array.isArray(res.data?.posts)) {
        posts = res.data.posts;
      } else {
        console.warn('[PostState] Unexpected fetchallposts response shape:', res.data);
        posts = [];
      }

      // FIX 4: normalise each post so media items always have the correct shape
      setStatePosts(posts.map(normalisePost));
    } catch (err) {
      console.error('[PostState] fetchPosts error:', err);
      toast.error("Failed to fetch posts!");
    } finally {
      setLoading(false);
    }
  }, []); // no deps — reads token fresh on each call

  useEffect(() => {
    if (isAuthenticated) {
      fetchPosts();
    }
  }, [isAuthenticated, fetchPosts]);

  // ── addPost ─────────────────────────────────────────────────────────────────
  const addPost = async (postContent, visibility = "public", selectedFiles = []) => {
    const token = localStorage.getItem('token');
    if (!token) { toast.error("Authentication token missing!"); return; }

    if (!postContent && (!selectedFiles || selectedFiles.length === 0)) {
      toast.error("Please enter some text or upload media.");
      return;
    }

    const formData = new FormData();
    formData.append("post", postContent);
    formData.append("visibility", visibility);

    const hasFiles = selectedFiles && selectedFiles.length > 0;
    selectedFiles.forEach(file => {
      if (file instanceof File) formData.append("media", file);
    });

    setLoading(true);
    try {
      const res = await apiRequest.post(`${BACKEND_URL}/api/posts/addnewposts`, formData, {
        headers: { "Authorization": `Bearer ${token}` },
        // Do NOT set Content-Type manually for FormData
        timeout: hasFiles ? MEDIA_UPLOAD_TIMEOUT_MS : 15_000,
      });

      toast.dismiss('post-loading');

      // FIX 3 + FIX 4:
      // For text-only posts the immediately-returned document is perfectly
      // usable, so prepend it right away for snappy UX.
      //
      // For media posts the backend responds BEFORE background compression
      // runs, so the media URLs in res.data.post are the original (uncompressed)
      // paths — which ARE valid and renderable.  We normalise the shape so
      // HomePostitem receives a consistent object, then schedule a re-fetch
      // after a short delay to pick up the compressed URLs and any moderation
      // status changes written by the background job.
      const newPost = normalisePost(res.data.post);
      setStatePosts(prev => [newPost, ...prev]);

      if (hasFiles) {
        // Re-fetch after background processing has had time to complete.
        // 4 s is generous for compression; the post will already be visible
        // via the local prepend above.
        setTimeout(() => {
          fetchPosts();
        }, 4000);
      }

      // ── Behavior tracking ────────────────────────────────────────────────
      try {
        const sdkSession = window.__sdkSession;
        const now = Date.now();
        const lastPostTime = localStorage.getItem('last_post_time');
        const timeSinceLastPost = lastPostTime ? now - Number(lastPostTime) : null;
        localStorage.setItem('last_post_time', now);
        if (sdkSession) {
          emitSignal(sdkSession, 'post_created', {
            interval_ms_since_last_post: timeSinceLastPost,
          });
        }
      } catch (e) {
        console.warn('[BehaviorSDK] emit failed', e);
      }
      // ── End behavior tracking ────────────────────────────────────────────

      toast.success(
        hasFiles
          ? "Post created! Media is being processed in the background."
          : "Post added successfully!"
      );
    } catch (err) {
      toast.dismiss('post-loading');
      if (err.code === 'ECONNABORTED') {
        toast.error("Upload timed out. Check your connection and try again.");
      } else {
        const serverMsg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg;
        toast.error(serverMsg || "Failed to create post. Please try again.");
      }
      console.error('[PostState] addPost error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── deletePost ──────────────────────────────────────────────────────────────
  const deletePost = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) { toast.error("Authentication token missing!"); return; }
    try {
      await apiRequest.delete(
        `${BACKEND_URL}/api/posts/deleteposts/${id}`,
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
      );
      setStatePosts(prev => prev.filter(post => post._id !== id));
      toast.success("Post deleted!");
    } catch {
      toast.error("Failed to delete post!");
    }
  };

  // ── toggleLikePost ──────────────────────────────────────────────────────────
  const toggleLikePost = async (postId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await apiRequest.put(
        `${BACKEND_URL}/api/posts/like/${postId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setStatePosts(prev =>
        prev.map(post => post._id === postId ? { ...post, likes: res.data.likes } : post)
      );
    } catch {
      toast.error("Failed to like/unlike post!");
    }
  };

  return (
    <PostContext.Provider value={{ statePosts, addPost, deletePost, toggleLikePost, loading }}>
      {children}
    </PostContext.Provider>
  );
};

export default PostState;