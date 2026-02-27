// src/components/Profile/ProfileModal.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal } from "react-bootstrap";
import FollowersModal from "./FollowersModal";
import apiRequest from "../../utils/apiRequest";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import { useFriend } from "../../Context/Friend/FriendContext";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import {
  MapPin, Clock, Users, Grid3X3, UserPlus, X,
  ChevronLeft, ChevronRight, Play
} from "lucide-react";

const formatLastSeen = (timestamp) => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Active now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const styles = {
  profileHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '20px 0 16px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #fff',
    boxShadow: '0 0 0 3px #6366f1, 0 4px 16px rgba(0,0,0,0.12)',
  },
  username: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
    margin: '4px 0 0',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
  locationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 500,
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    borderTop: '1px solid #f1f5f9',
    borderBottom: '1px solid #f1f5f9',
    marginTop: 4,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '14px 8px',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    transition: 'background 0.15s ease',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    borderRadius: 0,
  },
  statNum: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  statDivider: {
    width: 1,
    height: 32,
    background: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '16px 0 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaThumb: {
    aspectRatio: '1',
    objectFit: 'cover',
    width: '100%',
    cursor: 'pointer',
    display: 'block',
    transition: 'opacity 0.15s ease',
  },
  emptyMedia: {
    gridColumn: '1 / -1',
    padding: '32px 0',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
};

const ProfileModal = ({ userId, show, onClose }) => {
  const { authtoken } = useAuth();
  const { sendRequest, getFriendshipStatus } = useFriend();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null);
  const [fetching, setFetching] = useState(false);

  const videoRefs = useRef([]);

  const [photoViewer, setPhotoViewer] = useState({
    isOpen: false, currentIndex: 0, images: [],
  });

  useEffect(() => {
    if (!userId || !show) return;
    setFetching(true);
    setProfile(null);
    setPosts([]);

    const fetchData = async () => {
      try {
        const [profileRes, postsRes, statusRes] = await Promise.allSettled([
          apiRequest.get(`/api/profile/${userId}`, {
            headers: { Authorization: `Bearer ${authtoken}` },
          }),
          apiRequest.get(`/api/posts/fetchallposts`, {
            headers: { Authorization: `Bearer ${authtoken}` },
          }),
          getFriendshipStatus ? getFriendshipStatus(userId) : Promise.resolve(null),
        ]);

        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value.data.profile);
        }
        if (postsRes.status === "fulfilled") {
          const userPosts = postsRes.value.data.filter(
            (p) => p.user_id._id === userId && p.visibility === "public"
          );
          setPosts(userPosts);
        }
        if (statusRes.status === "fulfilled" && statusRes.value) {
          setFriendStatus(statusRes.value);
        }
      } catch (err) {
        console.error("ProfileModal fetch error:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [userId, show, authtoken, getFriendshipStatus]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) video.play().catch(() => {});
    });
  }, [posts]);

  const openPhotoViewer = (images, index) => setPhotoViewer({ isOpen: true, currentIndex: index, images });
  const closePhotoViewer = () => setPhotoViewer({ isOpen: false, currentIndex: 0, images: [] });

  const showPrevImage = useCallback(() => {
    setPhotoViewer((pv) => ({
      ...pv,
      currentIndex: (pv.currentIndex - 1 + pv.images.length) % pv.images.length,
    }));
  }, []);

  const showNextImage = useCallback(() => {
    setPhotoViewer((pv) => ({
      ...pv,
      currentIndex: (pv.currentIndex + 1) % pv.images.length,
    }));
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (!photoViewer.isOpen) return;
      if (e.key === "ArrowLeft") showPrevImage();
      if (e.key === "ArrowRight") showNextImage();
      if (e.key === "Escape") closePhotoViewer();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photoViewer.isOpen, showPrevImage, showNextImage]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: showNextImage,
    onSwipedRight: showPrevImage,
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const handleSendRequest = async () => {
    if (!profile?.user_id?._id) return;
    await sendRequest(profile.user_id._id);
    setRequestSent(true);
  };

  const getFriendButtonLabel = () => {
    if (requestSent) return "Request Sent";
    if (friendStatus?.status === "friends") return "Friends ✓";
    if (friendStatus?.status === "pending") return "Pending";
    return "Add Friend";
  };

  const isFriendOrPending = requestSent ||
    friendStatus?.status === "friends" ||
    friendStatus?.status === "pending";

  // Collect all images for photo viewer
  const allImages = posts.flatMap((p) =>
    (p.media || []).filter((m) => m.type === "image").map((m) => ({ url: m.url, post: p }))
  );

  const renderMedia = (post, media, postIndex, mediaIndex) => {
    if (media.type === "image") {
      const imgIndex = allImages.findIndex((img) => img.url === media.url && img.post._id === post._id);
      return (
        <div key={`${postIndex}-${mediaIndex}`} style={{ position: 'relative' }}>
          <img
            src={media.url}
            alt=""
            style={styles.mediaThumb}
            onClick={() => openPhotoViewer(allImages, imgIndex >= 0 ? imgIndex : 0)}
            onMouseEnter={e => e.target.style.opacity = 0.85}
            onMouseLeave={e => e.target.style.opacity = 1}
          />
        </div>
      );
    }

    if (media.type === "video") {
      const videoUrl = media.url.startsWith("http")
        ? media.url
        : `${process.env.REACT_APP_BACKEND_URL}${media.url}`;

      return (
        <div key={`${postIndex}-${mediaIndex}`} style={{ position: 'relative' }}>
          <video
            ref={(el) => (videoRefs.current[postIndex] = el)}
            src={videoUrl}
            muted loop playsInline autoPlay
            style={styles.mediaThumb}
            onClick={() => {
              onClose();
              navigate("/reels", { state: { startPostId: post._id }, replace: true });
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <Play size={20} fill="#fff" color="#fff" />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Modal show={show} onHide={onClose} centered size="md" contentClassName="profile-modal-content">
        <Modal.Header closeButton style={{
          border: 'none',
          padding: '16px 20px 8px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} style={{ color: '#94a3b8' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              {profile?.user_id?.lastActive
                ? formatLastSeen(profile.user_id.lastActive)
                : "Recently active"}
            </span>
          </div>
        </Modal.Header>

        <Modal.Body style={{ padding: '0 20px 8px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {fetching ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{
                width: 36, height: 36, border: '3px solid #e2e8f0',
                borderTopColor: '#6366f1', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Loading profile…</p>
            </div>
          ) : profile ? (
            <>
              {/* Profile Header */}
              <div style={styles.profileHeader}>
                <img
                  src={profile.profileavatar?.URL || "/default-avatar.png"}
                  alt="avatar"
                  style={styles.avatar}
                />
                <div style={{ textAlign: 'center' }}>
                  <h5 style={styles.username}>@{profile.user_id?.username || profile.user_id?.name}</h5>
                  {profile.user_id?.name && profile.user_id?.username && (
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: '#64748b', fontWeight: 600 }}>
                      {profile.user_id.name}
                    </p>
                  )}
                  {(profile.currentcity || profile.hometown) && (
                    <div style={styles.locationRow}>
                      <MapPin size={12} />
                      {[profile.currentcity, profile.hometown].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={styles.statsRow}>
                <button
                  style={styles.statItem}
                  onClick={() => setShowFollowers(true)}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={styles.statNum}>{profile.followers?.length || 0}</span>
                  <span style={styles.statLabel}>Followers</span>
                </button>
                <div style={styles.statDivider} />
                <button
                  style={styles.statItem}
                  onClick={() => setShowFollowing(true)}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={styles.statNum}>{profile.following?.length || 0}</span>
                  <span style={styles.statLabel}>Following</span>
                </button>
                <div style={styles.statDivider} />
                <div style={styles.statItem}>
                  <span style={styles.statNum}>{posts.length}</span>
                  <span style={styles.statLabel}>Posts</span>
                </div>
              </div>

              {/* Posts Grid */}
              <div style={styles.sectionTitle}>
                <Grid3X3 size={13} />
                Posts
              </div>
              <div style={styles.mediaGrid}>
                {posts.length === 0 ? (
                  <div style={styles.emptyMedia}>No public posts yet.</div>
                ) : (
                  posts.map((post, pIdx) =>
                    post.media?.map((m, idx) => renderMedia(post, m, pIdx, idx))
                  )
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
              <Users size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ margin: 0 }}>Profile not found</p>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer style={{
          border: 'none',
          padding: '12px 20px 20px',
          gap: 8,
          justifyContent: 'stretch',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 0',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 20,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 14,
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <button
            onClick={handleSendRequest}
            disabled={isFriendOrPending || !profile}
            style={{
              flex: 2,
              padding: '10px 0',
              background: isFriendOrPending ? '#e0e7ff' : '#6366f1',
              border: 'none',
              borderRadius: 20,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 14,
              fontWeight: 700,
              color: isFriendOrPending ? '#6366f1' : '#fff',
              cursor: isFriendOrPending ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: isFriendOrPending ? 'none' : '0 2px 8px rgba(99,102,241,0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            <UserPlus size={15} />
            {getFriendButtonLabel()}
          </button>
        </Modal.Footer>
      </Modal>

      <FollowersModal
        show={showFollowers}
        onClose={() => setShowFollowers(false)}
        users={profile?.followers || []}
        title="Followers"
      />
      <FollowersModal
        show={showFollowing}
        onClose={() => setShowFollowing(false)}
        users={profile?.following || []}
        title="Following"
      />

      {/* Full-screen Photo Viewer */}
      {photoViewer.isOpen && (
        <div
          {...swipeHandlers}
          onClick={closePhotoViewer}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.93)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Close */}
          <button
            onClick={closePhotoViewer}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10001,
            }}
          >
            <X size={18} />
          </button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: 20,
            left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            {photoViewer.currentIndex + 1} / {photoViewer.images.length}
          </div>

          {/* Prev */}
          {photoViewer.images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); showPrevImage(); }}
              style={{
                position: 'absolute', left: 16,
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Image */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '85vw', maxHeight: '85vh' }}
          >
            <img
              src={photoViewer.images[photoViewer.currentIndex]?.url}
              alt=""
              style={{
                maxWidth: '85vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            />
          </div>

          {/* Next */}
          {photoViewer.images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); showNextImage(); }}
              style={{
                position: 'absolute', right: 16,
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default ProfileModal;