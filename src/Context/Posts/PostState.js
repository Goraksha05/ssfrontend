import React, { useState, useEffect, useCallback } from "react";
import PostContext from "./PostContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from '../Authorisation/AuthContext'
import apiRequest from "../../utils/apiRequest";

const BACKEND_URL = process.env.REACT_APP_SERVER_URL ?? process.env.REACT_APP_BACKEND_URL;

const PostState = ({ children }) => {
  const [statePosts, setStatePosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const token = localStorage.getItem('token')  // directly get it here

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
      setStatePosts(res.data);  // Make sure your backend sends the posts as res.json(posts)
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

      // if (!postContent || postContent.trim().length < 3) {
      //   toast.error("Post must be at least 3 characters long.");
      //   return;
      // }
      if (!postContent && (!selectedFiles || selectedFiles.length === 0)) {
        toast.error("Please enter some text or upload media.");
        return;
      }


      const formData = new FormData();
      formData.append("post", postContent);
      formData.append("visibility", visibility);

      selectedFiles.forEach(file => {
        if (file instanceof File) {
          formData.append("media", file);
        }
      });

      const res = await apiRequest.post(`${BACKEND_URL}/api/posts/addnewposts`, formData, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      setStatePosts(prev => [res.data.post, ...prev]);
      toast.success("Post added successfully!");
    } catch (err) {
      console.error("Post upload error:", err.response?.data || err.message);
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


  // useEffect(() => {
  //   fetchPosts();
  // }, [fetchPosts]);  // token is already inside fetchPosts dependency, no need to add it here

  return (
    <PostContext.Provider value={{ statePosts, addPost, deletePost, toggleLikePost, loading }}>
      {children}
    </PostContext.Provider>
  );
};

export default PostState;
