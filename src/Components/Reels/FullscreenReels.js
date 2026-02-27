// src/Components/Reels/FullscreenReels.js
import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import postContext from "../../Context/Posts/PostContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import {
  Heart,
  MessageCircle,
  Share2,
  X,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  // Pause,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Music2,
} from "lucide-react";
import { useSwipeable } from "react-swipeable";
import apiRequest from "../../utils/apiRequest";
import CommentsModal from "./CommentsModal";
import VerifiedBadge from "../Common/VerifiedBadge";
import ProfileModal from "../Profile/ProfileModal";
import "react-toastify/dist/ReactToastify.css";
import "./FullscreenReels.css";

const MEDIA_BASE_URL =
  process.env.REACT_APP_MEDIA_BASE_URL ||
  process.env.REACT_APP_SERVER_URL ||
  "https://api.sosholife.com";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const resolveUrl = (raw) => {
  if (!raw) return null;
  const s = typeof raw === "string" ? raw.trim() : null;
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("//")) return `https:${s}`;
  return `${MEDIA_BASE_URL}${s.startsWith("/") ? "" : "/"}${s}`;
};

const resolveAvatarUrl = (reel, author) => {
  const pick = (obj) => {
    if (!obj) return null;
    if (typeof obj === "string" && obj.trim()) return obj.trim();
    if (typeof obj === "object") {
      return (
        (obj.URL && obj.URL.trim()) ||
        (obj.url && obj.url.trim()) ||
        null
      );
    }
    return null;
  };
  const candidate =
    pick(reel?.profileavatar) ||
    pick(author?.profileavatar) ||
    pick(author?.user?.profileavatar);
  return resolveUrl(candidate);
};

const formatCount = (n) => {
  if (!n) return 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n;
};

/* ─── sub-component: progress bar ──────────────────────────────────────────── */
const ProgressBar = ({ progress, total, current }) => (
  <div className="reel-progress-bars">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className="reel-progress-track">
        <div
          className="reel-progress-fill"
          style={{
            width:
              i < current
                ? "100%"
                : i === current
                ? `${progress}%`
                : "0%",
          }}
        />
      </div>
    ))}
  </div>
);

/* ─── sub-component: avatar ring ──────────────────────────────────────────── */
const AvatarRing = ({ src, name, verified, onClick }) => (
  <div className="reel-avatar-wrapper" onClick={onClick}>
    <div className={`reel-avatar-ring ${!src ? "reel-avatar-placeholder" : ""}`}>
      {src ? (
        <img src={src} alt={name} className="reel-avatar-img" />
      ) : (
        <span className="reel-avatar-initial">
          {name?.[0]?.toUpperCase() || "?"}
        </span>
      )}
    </div>
    {verified && <span className="reel-verified-dot">✔</span>}
  </div>
);

/* ─── sub-component: action button ─────────────────────────────────────────── */
const ActionButton = ({ icon, label, active, onClick, color }) => (
  <button
    className={`reel-action-btn ${active ? "reel-action-active" : ""}`}
    style={active && color ? { "--action-color": color } : undefined}
    onClick={onClick}
    aria-label={label}
  >
    <span className="reel-action-icon">{icon}</span>
    {label !== undefined && <span className="reel-action-label">{label}</span>}
  </button>
);

/* ─── main component ─────────────────────────────────────────────────────── */
const FullscreenReels = () => {
  const { statePosts, toggleLikePost } = useContext(postContext);

  /* state */
  const [reels, setReels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [savedPosts, setSavedPosts] = useState(new Set());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showUI, setShowUI] = useState(true);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const [heartPos, setHeartPos] = useState({ x: "50%", y: "50%" });
  const [likedPulse, setLikedPulse] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState("up"); // "up" | "down"

  /* refs */
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const uiTimerRef = useRef(null);
  const tapTimerRef = useRef(null);

  /* auth */
  const token = localStorage.getItem("token");
  let userId = null;
  try {
    userId = token ? jwtDecode(token)?.user?.id : null;
  } catch (_) {}

  const navigate = useNavigate();
  const location = useLocation();
  const startPostId = location.state?.startPostId;

  /* ── filter reels ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const videoPosts = statePosts.filter((p) =>
      p.media?.some((m) => ["video", "mkv", "webm", "mov"].includes(m.type))
    );
    setReels(videoPosts);
  }, [statePosts]);

  /* ── jump to startPostId ───────────────────────────────────────────────── */
  useEffect(() => {
    if (startPostId && reels.length > 0) {
      const idx = reels.findIndex((r) => r._id === startPostId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [startPostId, reels]);

  /* ── current reel data ─────────────────────────────────────────────────── */
  const currentReel = reels[currentIndex] || {};
  const author = currentReel.user_id || {};
  const isAuthorVerified = !!author?.subscription?.active;
  const avatarUrl = resolveAvatarUrl(currentReel, author);
  const isLiked = currentReel.likes?.includes(userId);
  const isSaved = savedPosts.has(currentReel._id);

  const videoMedia = currentReel.media?.find((m) =>
    ["video", "mkv", "webm", "mov"].includes(m.type)
  );
  const videoUrl = resolveUrl(videoMedia?.url);

  /* ── video progress tracking ───────────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [currentIndex]);

  /* ── auto-hide UI chrome ───────────────────────────────────────────────── */
  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 4000);
  }, []);

  useEffect(() => {
    resetUITimer();
    return () => {
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    };
  }, [resetUITimer, currentIndex]);

  /* ── navigation helpers ────────────────────────────────────────────────── */
  const navigateTo = useCallback(
    (dir) => {
      if (isTransitioning || reels.length === 0) return;
      setIsTransitioning(true);
      setDirection(dir);
      setProgress(0);
      setCaptionExpanded(false);
      setTimeout(() => {
        setCurrentIndex((prev) =>
          dir === "up"
            ? (prev + 1) % reels.length
            : (prev - 1 + reels.length) % reels.length
        );
        setIsTransitioning(false);
        setIsPaused(false);
      }, 260);
    },
    [isTransitioning, reels.length]
  );

  const handleNext = useCallback(() => navigateTo("up"), [navigateTo]);
  const handlePrev = useCallback(() => navigateTo("down"), [navigateTo]);

  /* ── play / pause ──────────────────────────────────────────────────────── */
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPaused) {
      video.play();
    } else {
      video.pause();
    }
    setIsPaused((p) => !p);
  }, [isPaused]);

  /* ── double-tap to like ────────────────────────────────────────────────── */
  const handleVideoTap = useCallback(
    (e) => {
      resetUITimer();
      if (tapTimerRef.current) {
        /* double tap */
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setHeartPos({ x: `${x}%`, y: `${y}%` });
        setDoubleTapHeart(true);
        setTimeout(() => setDoubleTapHeart(false), 900);
        if (!isLiked) {
          toggleLikePost(currentReel._id);
          setLikedPulse(true);
          setTimeout(() => setLikedPulse(false), 500);
        }
      } else {
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          togglePlayPause();
        }, 230);
      }
    },
    [resetUITimer, isLiked, currentReel._id, toggleLikePost, togglePlayPause]
  );

  /* ── swipe ─────────────────────────────────────────────────────────────── */
  const swipeHandlers = useSwipeable({
    onSwipedUp: handleNext,
    onSwipedDown: handlePrev,
    preventScrollOnSwipe: true,
    trackTouch: true,
    delta: 40,
  });

  /* ── follow ─────────────────────────────────────────────────────────────── */
  const fetchFollowingStatus = useCallback(async () => {
    if (!author?._id || !userId) return;
    try {
      const res = await apiRequest.get("/api/profile/getprofile");
      const list = res?.data?.profile?.following || [];
      setIsFollowing(list.map(String).includes(String(author._id)));
    } catch (_) {}
  }, [author?._id, userId]);

  useEffect(() => {
    fetchFollowingStatus();
  }, [fetchFollowingStatus]);

  const handleFollow = useCallback(async () => {
    if (!author?._id) return;
    try {
      const res = await apiRequest.put(`/api/profile/follow/${author._id}`, {});
      const following = Boolean(res?.data?.isFollowing);
      setIsFollowing(following);
      toast.success(following ? "Followed!" : "Unfollowed!");
    } catch (_) {
      toast.error("Action failed");
    }
  }, [author?._id]);

  /* ── save ───────────────────────────────────────────────────────────────── */
  const handleSave = useCallback(() => {
    setSavedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(currentReel._id)) {
        next.delete(currentReel._id);
        toast.info("Removed from saved");
      } else {
        next.add(currentReel._id);
        toast.success("Saved!");
      }
      return next;
    });
  }, [currentReel._id]);

  /* ── share ──────────────────────────────────────────────────────────────── */
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/reels?post=${currentReel._id}`;
    if (navigator.share) {
      await navigator.share({ title: "SoshoLife Reel", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  }, [currentReel._id]);

  /* ── keyboard nav ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown" || e.key === "j") handleNext();
      if (e.key === "ArrowUp" || e.key === "k") handlePrev();
      if (e.key === " " || e.key === "p") {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.key === "m") setIsMuted((m) => !m);
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, handlePrev, togglePlayPause, navigate]);

  /* ─────────────────────────────────────────── render ──────────────────── */
  return (
    <div
      ref={containerRef}
      className="reels-root"
      {...swipeHandlers}
      onMouseMove={resetUITimer}
      onTouchStart={resetUITimer}
    >
      {/* ── empty state ── */}
      {reels.length === 0 ? (
        <div className="reels-empty">
          <div className="reels-empty-icon">🎬</div>
          <p>No reels yet.</p>
          <span>Be the first to share a video!</span>
        </div>
      ) : (
        <>
          {/* ── video layer ── */}
          <div
            className={`reels-video-wrap ${isTransitioning ? `reel-exit-${direction}` : "reel-enter"}`}
            onClick={handleVideoTap}
          >
            {videoUrl ? (
              <video
                key={currentIndex}
                ref={videoRef}
                src={videoUrl}
                playsInline
                autoPlay
                loop={false}
                muted={isMuted}
                onEnded={handleNext}
                className="reels-video"
              />
            ) : (
              <div className="reels-no-video">⚠️ Video unavailable</div>
            )}

            {/* gradient overlays */}
            <div className="reels-gradient-top" />
            <div className="reels-gradient-bottom" />

            {/* double-tap heart burst */}
            {doubleTapHeart && (
              <span
                className="reel-heart-burst"
                style={{ left: heartPos.x, top: heartPos.y }}
              >
                ❤️
              </span>
            )}

            {/* pause icon */}
            {isPaused && (
              <div className="reels-pause-overlay">
                <Play size={52} />
              </div>
            )}
          </div>

          {/* ── top bar ── */}
          <div className={`reels-top ${showUI ? "ui-visible" : "ui-hidden"}`}>
            <ProgressBar
              progress={progress}
              total={reels.length > 10 ? 1 : reels.length}
              current={reels.length > 10 ? 0 : currentIndex}
            />
            <div className="reels-top-row">
              <span className="reels-title-logo">Reels</span>
              <button className="reels-close" onClick={() => navigate("/")}>
                <X size={22} />
              </button>
            </div>
          </div>

          {/* ── bottom overlay ── */}
          <div className={`reels-bottom ${showUI ? "ui-visible" : "ui-hidden"}`}>
            {/* author info */}
            <div className="reel-author-row">
              <AvatarRing
                src={avatarUrl}
                name={author?.name}
                verified={isAuthorVerified}
                onClick={() => {
                  if (author?._id) {
                    setSelectedUserId(author._id);
                    setShowProfileModal(true);
                  }
                }}
              />
              <div className="reel-author-info">
                <div className="reel-author-name-row">
                  <span className="reel-author-name">{author?.name || "Unknown"}</span>
                  {isAuthorVerified && (
                    <VerifiedBadge show size={14} />
                  )}
                </div>
                {userId && userId !== String(author._id) && (
                  <button
                    className={`reel-follow-btn ${isFollowing ? "reel-follow-btn--active" : ""}`}
                    onClick={handleFollow}
                  >
                    {isFollowing ? "Following" : "+ Follow"}
                  </button>
                )}
              </div>
            </div>

            {/* caption */}
            {currentReel.post && (
              <div
                className={`reel-caption ${captionExpanded ? "reel-caption--expanded" : ""}`}
                onClick={() => setCaptionExpanded((p) => !p)}
              >
                <span className="reel-caption-text">{currentReel.post}</span>
                {currentReel.post.length > 80 && !captionExpanded && (
                  <span className="reel-caption-more">more</span>
                )}
              </div>
            )}

            {/* audio badge */}
            <div className="reel-audio-badge">
              <Music2 size={12} />
              <span className="reel-audio-marquee">
                {currentReel.song || "Original Audio"}
              </span>
            </div>
          </div>

          {/* ── right action rail ── */}
          <div className={`reels-actions ${showUI ? "ui-visible" : "ui-hidden"}`}>
            {/* like */}
            <ActionButton
              icon={
                <Heart
                  size={28}
                  className={likedPulse ? "reel-heart-pulse" : ""}
                  fill={isLiked ? "currentColor" : "none"}
                />
              }
              label={formatCount(currentReel.likes?.length)}
              active={isLiked}
              color="#ff3b5c"
              onClick={() => {
                toggleLikePost(currentReel._id);
                setLikedPulse(true);
                setTimeout(() => setLikedPulse(false), 500);
              }}
            />

            {/* comments */}
            <ActionButton
              icon={<MessageCircle size={28} />}
              label={formatCount(currentReel.comments?.length || 0)}
              onClick={() => setShowComments(true)}
            />

            {/* save */}
            <ActionButton
              icon={
                <Bookmark
                  size={28}
                  fill={isSaved ? "currentColor" : "none"}
                />
              }
              label="Save"
              active={isSaved}
              color="#ffd700"
              onClick={handleSave}
            />

            {/* share */}
            <ActionButton
              icon={<Share2 size={28} />}
              label="Share"
              onClick={handleShare}
            />

            {/* mute */}
            <ActionButton
              icon={isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              onClick={() => setIsMuted((m) => !m)}
              label={isMuted ? "Unmute" : "Mute"}
            />

            {/* more */}
            <ActionButton
              icon={<MoreHorizontal size={24} />}
              onClick={resetUITimer}
            />
          </div>

          {/* ── nav arrows (desktop) ── */}
          <button
            className={`reel-nav reel-nav--prev ${showUI ? "ui-visible" : "ui-hidden"}`}
            onClick={handlePrev}
            aria-label="Previous reel"
          >
            <ChevronUp size={28} />
          </button>
          <button
            className={`reel-nav reel-nav--next ${showUI ? "ui-visible" : "ui-hidden"}`}
            onClick={handleNext}
            aria-label="Next reel"
          >
            <ChevronDown size={28} />
          </button>

          {/* ── reel counter badge ── */}
          <div className={`reel-counter ${showUI ? "ui-visible" : "ui-hidden"}`}>
            {currentIndex + 1} / {reels.length}
          </div>
        </>
      )}

      {/* ── modals ── */}
      {showComments && (
        <CommentsModal
          postId={currentReel._id}
          show={showComments}
          onClose={() => setShowComments(false)}
        />
      )}
      <ProfileModal
        userId={selectedUserId}
        show={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedUserId(null);
        }}
      />
    </div>
  );
};

export default FullscreenReels;