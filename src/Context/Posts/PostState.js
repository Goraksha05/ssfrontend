import React, { useState, useEffect, useCallback } from "react";
import PostContext from "./PostContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from '../Authorisation/AuthContext'
import apiRequest from "../../utils/apiRequest";

const BACKEND_URL = process.env.REACT_APP_SERVER_URL ?? process.env.REACT_APP_BACKEND_URL;

// FIX: Separate timeouts for regular requests vs. media uploads.
// The default apiRequest timeout (15s) is far too short for file uploads
// that go through multer → disk → compression → DB save on the server.
const MEDIA_UPLOAD_TIMEOUT_MS = 120_000; // 2 minutes for files

const PostState = ({ children }) => {
  const [statePosts, setStatePosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const token = localStorage.getItem('token');

  const fetchPosts = useCallback(async () => {
    if (!token) {
      toast.error("Authentication token missing!");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest.get(`${BACKEND_URL}/api/posts/fetchallposts`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      setStatePosts(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch posts!");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPosts();
    }
  }, [isAuthenticated, fetchPosts]);

  const addPost = async (postContent, visibility = "public", selectedFiles = []) => {
    const token = localStorage.getItem('token');
    try {
      if (!token) {
        toast.error("Authentication token missing!");
        return;
      }

      if (!postContent && (!selectedFiles || selectedFiles.length === 0)) {
        toast.error("Please enter some text or upload media.");
        return;
      }

      const formData = new FormData();
      formData.append("post", postContent);
      formData.append("visibility", visibility);

      const hasFiles = selectedFiles && selectedFiles.length > 0;
      selectedFiles.forEach(file => {
        if (file instanceof File) {
          formData.append("media", file);
        }
      });

      setLoading(true);

      const res = await apiRequest.post(`${BACKEND_URL}/api/posts/addnewposts`, formData, {
        headers: {
          "Authorization": `Bearer ${token}`,
          // FIX: Do NOT manually set Content-Type for FormData — the browser
          // must set it with the correct multipart boundary automatically.
          // Setting it manually causes the server to reject the upload.
        },
        // FIX: Use a much longer timeout for media uploads. Compression and
        // DB operations on the server can take well over the default 15 s.
        timeout: hasFiles ? MEDIA_UPLOAD_TIMEOUT_MS : 15_000,
      });

      // Dismiss any "uploading" toast shown by Home.js
      toast.dismiss('post-loading');

      setStatePosts(prev => [res.data.post, ...prev]);
      toast.success(
        hasFiles
          ? "Post created! Media is being processed in the background."
          : "Post added successfully!"
      );
    } catch (err) {
      toast.dismiss('post-loading');

      if (err.code === 'ECONNABORTED') {
        // Still show the post if it was saved — the server responds quickly now.
        // A timeout here means the network itself is extremely slow.
        toast.error("Upload timed out. Check your connection and try again.");
      } else {
        const serverMsg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg;
        toast.error(serverMsg || "Failed to create post. Please try again.");
      }
      console.error("Post upload error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id) => {
    const token = localStorage.getItem('token');
    try {
      if (!token) {
        toast.error("Authentication token missing!");
        return;
      }
      await apiRequest.delete(
        `${BACKEND_URL}/api/posts/deleteposts/${id}`,
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
      );
      setStatePosts(prev => prev.filter(post => post._id !== id));
      toast.success("Post deleted!");
    } catch (err) {
      toast.error("Failed to delete post!");
    }
  };

  const toggleLikePost = async (postId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await apiRequest.put(
        `${BACKEND_URL}/api/posts/like/${postId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      setStatePosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, likes: res.data.likes } : post
        )
      );
    } catch (err) {
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