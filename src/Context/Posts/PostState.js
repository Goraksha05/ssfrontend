// src/Context/Posts/PostState.js
//
// FIX 1: fetchPosts now safely extracts the posts array whether the backend
//         returns a flat array  (original route)  OR  { posts, pagination }
//         (new paginated route). Either way statePosts is always an array.
//
// FIX 2: token is read inside fetchPosts (not at module level) so it is
//         always fresh after login.

import React, { useState, useEffect, useCallback } from "react";
import PostContext from "./PostContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from '../Authorisation/AuthContext';
import apiRequest from "../../utils/apiRequest";
import { emitSignal } from "../../utils/behaviorSDK";

const BACKEND_URL = process.env.REACT_APP_SERVER_URL ?? process.env.REACT_APP_BACKEND_URL;
const MEDIA_UPLOAD_TIMEOUT_MS = 120_000; // 2 minutes for file uploads

const PostState = ({ children }) => {
  const [statePosts, setStatePosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

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

      // ── FIX: Handle both response shapes robustly ──────────────────────────
      // Original backend  → res.data is a plain array
      // Paginated backend  → res.data is { posts: [...], pagination: {...} }
      let posts;
      if (Array.isArray(res.data)) {
        posts = res.data;
      } else if (Array.isArray(res.data?.posts)) {
        posts = res.data.posts;
      } else {
        // Unexpected shape — log it and set empty array to avoid crash
        console.warn('[PostState] Unexpected fetchallposts response shape:', res.data);
        posts = [];
      }

      setStatePosts(posts);
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
      setStatePosts(prev => [res.data.post, ...prev]);

      //-------- // ✅ Behavior tracking (SAFE + COMPLETE)
      try {
        const sdkSession = window.__sdkSession;

        const now = Date.now();
        const lastPostTime = localStorage.getItem('last_post_time');

        const timeSinceLastPost = lastPostTime
          ? now - Number(lastPostTime)
          : null;

        localStorage.setItem('last_post_time', now);

        if (sdkSession) {
          emitSignal(sdkSession, 'post_created', {
            interval_ms_since_last_post: timeSinceLastPost
          });
        }
      } catch (e) {
        console.warn('[BehaviorSDK] emit failed', e);
      }
      //-------- ✅ Behavior tracking end here ----------

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