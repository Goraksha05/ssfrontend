import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Link } from "react-router-dom";
import postContext from '../../Context/Posts/PostContext';
import HomePosts from './HomePosts';
import { jwtDecode } from 'jwt-decode';
import { ToastContainer, toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import AllFriends from '../Friendship/AllFriends';
import FriendRequest from '../Friendship/FriendRequest';
import Suggestion from '../Friendship/Suggestion';
import MessageScroller from '../TodayOffer/MessageScroller';
import { useTranslation } from 'react-i18next';
import EnhancedMediaUpload from './EnhancedMediaUpload';
import ObtainedRewardsModal from '../UserActivities/ObtainedRewardsModal';
import AddFileIcon from '../../Assets/Add3DFile.png';

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

/* ─── Design tokens (matching the app's dark palette) ────────────────────── */
const T = {
  bg:       '#0b0f1a',
  surface:  '#141929',
  card:     '#1a2035',
  border:   '#252d45',
  accent:   '#f59e0b',   // amber
  accentSoft: 'rgba(245,158,11,0.12)',
  blue:     '#3b82f6',
  blueSoft: 'rgba(59,130,246,0.12)',
  green:    '#22c55e',
  red:      '#ef4444',
  text:     '#e2e8f0',
  muted:    '#64748b',
  radius:   16,
  shadow:   '0 4px 24px rgba(0,0,0,0.4)',
};

/* ─── Stat card ───────────────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, accent }) => (
  <div style={{
    flex: 1,
    minWidth: 80,
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    // padding: '5px 5px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 22 }}>{icon}</div>
    <div style={{ fontSize: 30, fontWeight: 700, color: accent || T.accent, lineHeight: 1.2 }}>{value}</div>
    <div style={{ fontSize: 14, color: T.muted, marginTop: 2 }}>{label}</div>
  </div>
);

function Home() {
  const { addPost, loading } = useContext(postContext);
  const [postContent, setPostContent] = useState('');
  const [visibility, setVisibility] = useState("public");
  const mediaUploadRef = useRef();
  const [communityCount, setCommunityCount] = useState(0);
  const [postSuccess, setPostSuccess] = useState(false);
  const [
    showRewardsModal, 
    setShowRewardsModal
  ] = useState(false);
  const token = localStorage.getItem('token');
  const userId = token ? jwtDecode(token)?.user?.id : '';
  const { t } = useTranslation();

  const [userData, setUserData] = useState(null);
  // const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      if (!token || !userId) return;
      try {
        const res = await apiRequest.get(`${SERVER_URL}/api/auth/getuser/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData(res.data);

        // ✅ Build invite link from referralId instead of _id
        // if (res.data?.referralId) {
        //   setInviteLink(`${window.location.origin}/invite/${res.data.referralId}`);
        // } else {
        //   setInviteLink('');
        // }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };
    fetchUser();
  }, [token, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        const res = await apiRequest.get(`${SERVER_URL}/api/activity/community/${userId}`);
        setCommunityCount(res.data.communityCount || 0);
      } catch (err) {
        console.error('Failed to fetch community count:', err);
      }
    })();
  }, [token, userId]);
  // const [showInvitedModal, setShowInvitedModal] = useState(false);
  // const [invitedList, setInvitedList] = useState([]);
  // const [loadingInvited, setLoadingInvited] = useState(false);

  // const fetchInvitedPeople = useCallback(async () => {
  //   if (!userData?.referralId) return;
  //   setLoadingInvited(true);
  //   try {
  //     const res = await apiRequest.get(`${SERVER_URL}/api/activity/invited/${userData.referralId}`, {
  //       headers: { Authorization: `Bearer ${token}` }
  //     });
  //     setInvitedList(res.data || []);
  //   } catch (err) {
  //     console.error("Failed to fetch invited list:", err);
  //   } finally {
  //     setLoadingInvited(false);
  //   }
  // }, [userData?.referralId, token]);

  // useEffect(() => {
  //   if (showInvitedModal) {
  //     fetchInvitedPeople();
  //   }
  // }, [showInvitedModal, fetchInvitedPeople]);

  const handleFilesPrepared = (files) => {
    if (!postContent.trim() && files.length === 0) {
      toast.error("Please write something or upload media!");
      return;
    }

    if (!postContent.trim() && files.length === 0) {
      toast.warning("⚠️ Please type at least 1 character or emoji in the text");
      return;
    }

    addPost(postContent.trim(), visibility, files);
    setPostContent('');
    setVisibility('public');
  };

  const resetForm = () => {
    setPostContent('');
    setVisibility('public');
  };

  const handleAddPost = useCallback(() => {
    if (mediaUploadRef.current?.hasMedia()) {
      // ✅ If media exists, trigger EnhancedMediaUpload submit
      toast.info("⏳ Uploading media...", {
        toastId: "post-loading", // prevent duplicate toasts
        autoClose: false,        // stays until manually dismissed
        closeOnClick: false,
        draggable: false,
      });
      mediaUploadRef.current.submitMediaPost();
    } else {
      if (!postContent.trim()) {
        toast.error("Please write something or upload media!");
        return;
      }

      toast.info("⏳ Posting... Please wait.", {
        toastId: "post-loading",
        autoClose: false,
        closeOnClick: false,
        draggable: false,
      });

      addPost(postContent.trim(), visibility);
      resetForm();
    }
  }, [addPost, postContent, visibility]);

  // Watch for transition from loading → success
  useEffect(() => {
    if (!loading) {
      // dismiss loading toast when posting finishes
      toast.dismiss("post-loading");

      // means post just finished and was reset
      setPostSuccess(true);
      const timer = setTimeout(() => setPostSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, postContent]);

  const handleCancelPost = () => {
    resetForm();
  };

  return (
    <div className='header mt-5 py-2'>
      <main className="container-fluid px-0" style={{ maxWidth: "100vw", overflowX: "hidden" }}>
        <MessageScroller />

        <div className="row gx-2 gy-4">
          {/* Main left content */}
          <div className="col-12 col-lg-8">
            {/* User rewards and invite */}
            <div className="row mb-4">
              {userData && (
                <div className="col-12 col-md-6">
                  <div className="card shadow-sm text-secondary p-3 h-100">
                    <h5 className="mb-3 text-light">🏆 Your Rewards</h5>
                    <p>🛒 Grocery Coupons: ₹{userData.totalGroceryCoupons || 0}</p>
                    <p>📈 Company Shares: {userData.totalShares || 0}</p>
                    <p>🎟️ Referral Tokens: {userData.totalReferralToken || 0}</p>
                    <StatCard icon="👥" label="Your Community Count"       value={communityCount} accent={T.yellow} />
                  </div>
                </div>
              )}

              <div className="col-12 col-md-6">
                <div className="card shadow-sm text-secondary h-100">

                  <div className="d-flex flex-wrap gap-2 mt-3 justify-content-center">
                    <Link
                      to="/reels/fullscreen"
                      className="btn btn-outline-danger text-warning rounded-pill btn-lg fw-semibold mx-2 glow-btn"
                    >
                      Launch Reels
                    </Link>
                    <Link
                      to="/chat"
                      className="btn btn-outline-danger text-warning rounded-pill btn-lg fw-semibold mx-2 glow-btn"
                    >
                      Chat Room
                    </Link>

                    <h5 className="text-light text-center w-100 mt-3 fw-bold">
                      Your Social Circle
                    </h5>

                    <Link
                      to="/allfriends"
                      className="btn btn-outline-primary text-warning rounded-pill btn-lg fw-semibold mx-2 glow-btn"
                    >
                      All Friends
                    </Link>
                    <Link
                      to="/friendrequest"
                      className="btn btn-outline-primary text-warning rounded-pill btn-lg fw-semibold mx-2 glow-btn"
                    >
                      Friend Requests
                    </Link>
                    <Link
                      to="/suggestions"
                      className="btn btn-outline-primary text-warning rounded-pill btn-lg fw-semibold mx-2 glow-btn"
                    >
                      Suggestions
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="invitation my-4">
              <div className="d-flex justify-content-center">
                <Link
                  to="/invitaion"
                  className="btn btn-success btn-sm rounded-pill btn-lg fw-semibold glow-btn w-50"
                  style={{
                    fontSize: 16
                  }}
                >
                  Invite Link
                </Link>
                <button className="btn btn-warning btn-sm rounded-pill btn-lg fw-semibold glow-btn w-50" onClick={() => setShowRewardsModal(true)}>
                  🏆 Obtained Rewards
                </button>
              </div>
            </div>

            {/* Post creation section */}
            <section className="mb-2" data-aos="fade-up">
              <div className="rounded shadow-sm">
                <select
                  className="form-select form-select-lg text-secondary fw-semibold bg-transparent"
                  style={{ fontSize: '0.8rem' }}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="public">🌍 Public</option>
                  <option value="private">🔒 Private</option>
                  <option value="friends">👥 Friends</option>
                </select>
                {/* Textarea wrapper (relative for overlay positioning) */}
                <div style={{ position: "relative" }}>
                  <textarea
                    className="form-control border-0"
                    rows="5"
                    placeholder={t("What's on your mind?")}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    style={{
                      background: "#ffe0ceff",
                      resize: "none",
                      fontSize: 21,
                      lineHeight: "1.6",
                      minHeight: "200px",
                      fontFamily: "'Merriweather', serif",
                    }}
                  />

                  {/* ✅ Overlapping AddFile button inside textarea */}
                  <button
                    type="button"
                    aria-label="Add media or file"
                    title="Add media or file"
                    onClick={() => mediaUploadRef.current?.openFilePicker()}
                    className="p-0 border-0 bg-transparent"
                    style={{
                      position: "absolute",
                      right: "12px",
                      bottom: "12px",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={AddFileIcon}
                      alt="Add file"
                      style={{
                        width: "53px",
                        height: "48px",
                        pointerEvents: "auto" // ensure clickable
                      }}
                    />
                    <div className="fw-bold text-primary" style={{ fontSize: "0.85rem", marginTop: "2px" }}>
                      Add File
                    </div>
                  </button>
                </div>

                <div className="d-flex justify-content-between mt-2 text-secondary small">
                  <span>💡 Tip: Enter for paragraphs.</span>
                  <span>{postContent.length}/5000</span>
                </div>

                <div className="mb-3">
                  <EnhancedMediaUpload
                    ref={mediaUploadRef}
                    postContent={postContent}
                    onFilesPrepared={handleFilesPrepared}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button
                    className="btn btn-outline-secondary btn-lg rounded-pill fw-semibold mb-2"
                    onClick={handleCancelPost}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`btn btn-lg 
                      rounded-pill mb-2
                      fw-semibold d-flex 
                      align-items-center 
                      justify-content-center 
                      ${postSuccess ? "btn-success" : "btn-primary"}`}
                    onClick={handleAddPost}
                    disabled={loading || postSuccess}
                    style={{ minWidth: "160px" }}
                  >
                    {loading ? (
                      <>
                        <span className="animated-spinner me-2"></span>
                        Posting...
                      </>
                    ) : postSuccess ? (
                      <>
                        <span className="text-white fs-5 me-2">✅</span>
                        Posted!
                      </>
                    ) : (
                      "Post"
                    )}
                  </button>
                </div>
              </div>

            </section>

            {/* Feed */}
            <section>
              {loading ? (
                <p className="text-center text-muted">Loading posts...</p>
              ) : (
                <HomePosts />
              )}
            </section>
          </div>

          {/* Sidebar: Friends, Requests, Suggestions */}
          <div className="col-12 col-lg-4" data-aos="fade-left">
            <div className="sticky-top" style={{ top: "80px" }}>
              <div className="card p-3 bg-dark shadow-sm mb-4 h-100">
                <h6 className="mb-3 text-white">Your Social Circle</h6>
                <div className="d-flex flex-column gap-3">
                  <AllFriends />
                  <FriendRequest />
                  <Suggestion />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invited Modal */}
        {/* {showInvitedModal && (
          <div
            className="modal fade show"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Invited People</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowInvitedModal(false)}
                  />
                </div>
                <div className="modal-body">
                  {loadingInvited ? (
                    <p>Loading...</p>
                  ) : invitedList.length === 0 ? (
                    <p>No invited people found.</p>
                  ) : (
                    <ul className="list-group">
                      {invitedList.map((person) => (
                        <li
                          key={person._id}
                          className="list-group-item d-flex justify-content-between align-items-center flex-wrap"
                        >
                          <span style={{ fontSize: '1.2rem', fontWeight: '500' }}>
                            {person.name}
                          </span>
                          <span
                            className={`badge ${person.subscription?.active ? 'bg-success' : 'bg-secondary'
                              }`}
                          >
                            {person.subscription?.active ? 'Active' : 'Inactive'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )} */}

        <ObtainedRewardsModal
          show={showRewardsModal}
          onClose={() => setShowRewardsModal(false)}
          token={token}
        />

        <ToastContainer position="top-right" autoClose={3000} />
      </main>
    </div>
  );
}

export default Home;
