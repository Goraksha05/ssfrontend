import React, { useContext, useEffect, useState } from 'react';
import postContext from '../../Context/Posts/PostContext';
import HomePosts from './HomePosts';
import { jwtDecode } from "jwt-decode";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AllFriends from '../Friendship/AllFriends'
// import FriendRequest from '../Friendship/FriendRequest'
import Suggestion from '../Friendship/Suggestion'
// import MessageScroller from '../../Components/MessageScroller';
import axios from 'axios';

function Home() {
  const { addPost, loading } = useContext(postContext);
  const [postContent, setPostContent] = useState('');
  const [visibility, setVisibility] = useState("public");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [userData, setUserData] = useState(null);

  const token = localStorage.getItem('token');
  let userId = '';
  if (token) {
    const decoded = jwtDecode(token);
    userId = decoded.user?.id || '';
  }

  const inviteLink = `${window.location.origin}/invite/${userId}`;

  useEffect(() => {
    const fetchUser = async () => {
      if (!token || !userId) return;
      try {
        const res = await axios.get(`/api/auth/getuser/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setUserData(res.data);
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };
    fetchUser();
  }, [token, userId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAddPost = () => {
    if (!postContent.trim() && !selectedFile) {
      alert("Please write something or upload an image!");
      return;
    }

    let media = [];

    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        media.push({ url: reader.result, type: 'image' });
        addPost(postContent.trim(), visibility, media);
        resetForm();
      };
      reader.readAsDataURL(selectedFile);
    } else {
      addPost(postContent.trim(), visibility, []);
      resetForm();
    }
  };

  const handleCancelPost = () => {
    resetForm();
  };

  const resetForm = () => {
    setPostContent('');
    setVisibility('public');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 max-w-7xl mx-auto">
      <section className="flex-1 w-full" data-aos="fade-up">
        <div className="container">
          <textarea
            className="form-control"
            rows="5"
            placeholder="What's on your mind?"
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            style={{ background: '#FFC5A4' }} />

          <input
            type="file"
            accept="image/*"
            className="mt-3 w-full border p-2 rounded bg-blue-100"
            onChange={handleFileChange}
          />

          {previewUrl && (
            <div className="mt-3">
              <img
                src={previewUrl}
                alt="Preview"
                className="rounded max-h-60 object-contain border"
              />
            </div>
          )}

          <select
            className="mt-3 mx-5 w-full border p-2 rounded bg-blue-100"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">🌍 Public</option>
            <option value="private">🔒 Private</option>
            <option value="friends">👥 Friends</option>
          </select>

          <div className="d-flex justify-content-end mt-2 gap-2">
            <button className="btn btn-outline-secondary mt-2 rounded-full" onClick={handleCancelPost}>
              Cancel
            </button>
            <button className="btn btn-primary mt-2 rounded-full" onClick={handleAddPost}>
              Post
            </button>
          </div>
        </div>
        <div data-aos="fade-up">
          {loading ? <p className="text-center text-white">Loading posts...</p> : <HomePosts />}
        </div>
      </section>

      {/* Right Sidebar (only on desktop) */}
      <aside className="hidden lg:block w-full lg:w-[320px] space-y-4 mx-3" data-aos="fade-left">
        <div className="sticky top-4 space-y-4">
          <div className="card p-3 mt-3">
            <h5>Invite Friends</h5>
            <p className="small">Share this link to invite your friends:</p>
            <input
              type="text"
              className="form-control mb-2"
              value={inviteLink}
              readOnly
              onClick={(e) => e.target.select()}
            />
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                alert("Invitation link copied to clipboard!");
              }}
            >
              Copy Link
            </button>
          </div>

          {userData && (
            <div className="card p-3 mb-3">
              <h5 className="mb-2">🏆 Your Rewards</h5>
              <p>🛒 Grocery Coupons: ₹{userData.totalGroceryCoupons || 0}</p>
              <p>📈 Company Shares: {userData.totalShares || 0}</p>
              <p>🎟️ Referral Tokens: {userData.totalReferralToken || 0}</p>
            </div>
          )}

          <div className="card p-3 bg-transparent">
            <div className="grid grid-cols-1 gap-4">
              <div className="shadow space-y-6">
                <AllFriends />
              </div>
              {/* <div className="shadow space-y-6">
                <FriendRequest />
              </div> */}
              <div className="shadow space-y-6">
                <Suggestion />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <ToastContainer position="top-right" autoClose={3000} />
    </main>
  );
}

export default Home;
