import React, { useEffect, useState, useContext, useMemo, useCallback } from "react";
import ProfileContext from "../../Context/Profile/ProfileContext";
import postContext from "../../Context/Posts/PostContext";
import usePostCount from "../../utils/PostCount";
import { toast, ToastContainer } from "react-toastify";
import Swal from "sweetalert2";
import confetti from "canvas-confetti";
import handleAuthError from "../../utils/handleAuthError";
import "react-toastify/dist/ReactToastify.css";
import PrivacySettings from "../Profile/PrivacySettings";
import NotificationSettings from "../Profile/NotificationSettings";
import FollowersModal from "../Profile/FollowersModal";
import { useFriend } from "../../Context/Friend/FriendContext";
import getSocket from "../../WebSocket/WebSocketClient";
import { 
  BadgeCheck, 
  Camera, 
  Edit3, 
  // Eye, 
  Bell, 
  Lock, 
  // Grid, 
  // Users, 
  // UserCheck, 
  Image, 
  X, 
  Upload, 
  RotateCcw, 
  Save, 
  Calendar, 
  MapPin, 
  Heart, 
  User 
} from "lucide-react";
import { useSubscription } from "../../Context/Subscription/SubscriptionContext";
import apiRequest from "../../utils/apiRequest";
import "./Profile.css";

const Profile = () => {
  const { profile, loading, formData, fetchProfile, handleChange, handleEdit } = useContext(ProfileContext);
  const { statePosts } = useContext(postContext);

  const [tab, setTab] = useState("view");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [previewCover, setPreviewCover] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const profileUserId = useMemo(() => profile?.user_id?._id || profile?.user_id || null, [profile]);
  const postCount = usePostCount(statePosts, profileUserId);
  const userName = profile?.user_id?.name || "";
  const userIdDisplay = profileUserId || "";

  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const { fetchSuggestions } = useFriend();
  const { subscriptionPlan } = useSubscription();
  const isVerified = subscriptionPlan === "annual";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetchProfile();
  }, [fetchProfile]);

  const createDefaultProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      await apiRequest.post("/profile/createprofile", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.info("Profile created!");
      await fetchProfile();
      await fetchSuggestions();

      const socket = getSocket();
      if (socket?.connected && profile) {
        socket.emit("user-online", {
          userId: profile.user_id?._id || profile.user_id,
          name: profile.user_id?.name || "",
          hometown: profile.hometown,
          currentcity: profile.currentcity
        });
      }
    } catch (error) {
      handleAuthError(error);
      toast.error("Failed to create profile");
    }
  }, [fetchProfile, fetchSuggestions, profile]);

  useEffect(() => {
    if (!loading && !profile) {
      createDefaultProfile();
    }
  }, [loading, profile, createDefaultProfile]);

  const handleFileSelect = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadFile = async (file, endpoint) => {
    const token = localStorage.getItem("token");
    const setUploading = endpoint === "avatar" ? setUploadingAvatar : setUploadingCover;
    const label = endpoint === "avatar" ? "Avatar" : "Cover photo";

    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const fd = new FormData();
    fd.append("media", file);
    setUploading(true);

    // Show a persistent "uploading" toast — Cloudinary uploads can take 20-60s
    // on a slow connection. Without this the UI looks frozen.
    const uploadToastId = toast.loading(`Uploading ${label.toLowerCase()}... please wait.`);

    try {
      await apiRequest.put(`/api/profile/${endpoint}`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        // FIX: The default 15s timeout is too short for Cloudinary uploads.
        // The file must be streamed browser -> server -> Cloudinary CDN.
        // Allow 90s so slow connections and large files don't false-timeout.
        timeout: 90_000,
      });

      toast.update(uploadToastId, {
        render:    `${label} updated successfully!`,
        type:      "success",
        isLoading: false,
        autoClose: 3000,
      });

      fetchProfile();
    } catch (error) {
      const isTimeout = error?.code === "ECONNABORTED";
      toast.update(uploadToastId, {
        render:    isTimeout
                     ? `Upload timed out — the image may be too large or your connection is slow. Please try again.`
                     : `Failed to upload ${label.toLowerCase()}. Please try again.`,
        type:      "error",
        isLoading: false,
        autoClose: 5000,
      });
      handleAuthError(error);
    } finally {
      setUploading(false);
    }
  };

  const handleReferralCopy = () => {
    if (!isVerified) {
      toast.error("Only verified users can refer others.");
      return;
    }
    const refId = profile?.user_id?.referralId || "";
    if (!refId) {
      toast.error("Referral ID not found.");
      return;
    }
    navigator.clipboard
      .writeText(refId)
      .then(() => toast.success("Referral ID copied!"))
      .catch(() => toast.error("Failed to copy."));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = ["sex", "relationship"];
    const missing = requiredFields.filter((field) => !formData[field]);

    if (missing.length > 0) {
      Swal.fire({ icon: "error", title: "Missing Fields", text: "Please fill all required fields." });
      return;
    }

    const result = await Swal.fire({
      title: "Save Changes?",
      text: "Update your profile information?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Save",
      confirmButtonColor: "#6366f1",
    });

    if (result.isConfirmed) {
      try {
        await handleEdit(formData, async () => {
          Swal.fire({ icon: "success", title: "Saved!", timer: 1500, showConfirmButton: false });
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTab("view");
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          await fetchSuggestions();

          const socket = getSocket();
          if (socket?.connected && profile) {
            socket.emit("user-online", {
              userId: profile.user_id?._id || profile.user_id,
              name: profile.user_id?.name || "",
              hometown: formData.hometown,
              currentcity: formData.currentcity
            });
          }
        });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: "Profile update failed." });
      }
    }
  };

  const resetForm = async () => {
    await fetchProfile();
    setAvatarFile(null);
    setCoverFile(null);
    setPreviewAvatar("");
    setPreviewCover("");
  };

  const tabs = [
    { id: "view", label: "Profile", icon: User },
    { id: "edit", label: "Edit", icon: Edit3 },
    { id: "privacy", label: "Privacy", icon: Lock },
    { id: "notifications", label: "Alerts", icon: Bell },
  ];

  const renderViewTab = () => (
    <div className="profile-view-container">
      {/* Cover Photo */}
      <div className="profile-cover-wrapper">
        {profile.coverImage ? (
          <img src={profile.coverImage} alt="Cover" className="profile-cover-img" />
        ) : (
          <div className="profile-cover-placeholder">
            <div className="cover-gradient" />
          </div>
        )}
        <button className="cover-edit-btn" onClick={() => setTab("edit")}>
          <Camera size={16} />
          <span>Edit Cover</span>
        </button>
      </div>

      {/* Avatar + Info */}
      <div className="profile-header-card">
        <div className="profile-avatar-section">
          <div className="avatar-wrapper">
            <img
              src={profile.profileavatar?.URL || "/default-avatar.png"}
              alt="Avatar"
              className="profile-avatar-img"
            />
            {isVerified && (
              <span className="verified-badge" title="Verified">
                <BadgeCheck size={20} />
              </span>
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-name-row">
              <h2 className="profile-name">{userName || "Your Name"}</h2>
              {isVerified && <span className="verified-label">Verified</span>}
            </div>
            <p className="profile-userid">@{userIdDisplay.toString().slice(-8) || "user"}</p>
            {(profile.currentcity || profile.hometown) && (
              <p className="profile-location">
                <MapPin size={13} />
                {[profile.currentcity, profile.hometown].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="profile-joined">
              <Calendar size={13} />
              Joined {new Date(profile.sosholifejoinedon).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>

          <button className="edit-profile-btn" onClick={() => setTab("edit")}>
            <Edit3 size={15} />
            Edit Profile
          </button>
        </div>

        {/* Stats Row */}
        <div className="profile-stats-row">
          <button className="stat-item" onClick={() => setShowFollowers(true)}>
            <span className="stat-number">{profile.followers?.length || 0}</span>
            <span className="stat-label">Followers</span>
          </button>
          <div className="stat-divider" />
          <button className="stat-item" onClick={() => setShowFollowing(true)}>
            <span className="stat-number">{profile.following?.length || 0}</span>
            <span className="stat-label">Following</span>
          </button>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">{postCount}</span>
            <span className="stat-label">Posts</span>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="profile-detail-card">
        <h3 className="detail-card-title">About</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <Calendar size={16} className="detail-icon" />
            <div>
              <span className="detail-label">Birthday</span>
              <span className="detail-value">
                {profile.dob ? new Date(profile.dob).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not provided"}
              </span>
            </div>
          </div>
          <div className="detail-item">
            <MapPin size={16} className="detail-icon" />
            <div>
              <span className="detail-label">Current City</span>
              <span className="detail-value">{profile.currentcity || "Not provided"}</span>
            </div>
          </div>
          <div className="detail-item">
            <MapPin size={16} className="detail-icon" />
            <div>
              <span className="detail-label">Hometown</span>
              <span className="detail-value">{profile.hometown || "Not provided"}</span>
            </div>
          </div>
          <div className="detail-item">
            <User size={16} className="detail-icon" />
            <div>
              <span className="detail-label">Gender</span>
              <span className="detail-value">{profile.sex || "Not provided"}</span>
            </div>
          </div>
          <div className="detail-item">
            <Heart size={16} className="detail-icon" />
            <div>
              <span className="detail-label">Relationship</span>
              <span className="detail-value">{profile.relationship || "Not provided"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Section */}
      <div className="profile-detail-card">
        <div className="referral-header">
          <h3 className="detail-card-title">Referral Program</h3>
          {isVerified && <span className="badge-verified-sm"><BadgeCheck size={12} /> Active</span>}
        </div>
        {isVerified ? (
          <div className="referral-row">
            <input
              type="text"
              className="referral-input"
              value={profile?.user_id?.referralId || "No referral ID"}
              readOnly
            />
            <button className="referral-copy-btn" onClick={handleReferralCopy}>
              Copy
            </button>
          </div>
        ) : (
          <p className="referral-locked-msg">
            🔒 Referral links are available to verified (annual plan) members only.
          </p>
        )}
      </div>
    </div>
  );

  const renderEditTab = () => (
    <form onSubmit={handleSubmit} className="profile-edit-form">
      <h3 className="edit-section-title">Edit Profile</h3>

      {/* Avatar Upload */}
      <div className="upload-section">
        <label className="upload-section-label">
          <Camera size={16} /> Profile Photo
        </label>
        <div className="upload-preview-row">
          <div className="avatar-preview-wrap">
            <img
              src={previewAvatar || profile?.profileavatar?.URL || "/default-avatar.png"}
              alt="Avatar preview"
              className="avatar-preview-img"
            />
          </div>
          <div className="upload-actions">
            <label className="upload-file-btn">
              <Upload size={14} /> Choose Photo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFileSelect(e, setAvatarFile, setPreviewAvatar)}
              />
            </label>
            {avatarFile && (
              <>
                <button
                  type="button"
                  className="upload-confirm-btn"
                  disabled={uploadingAvatar}
                  onClick={() => uploadFile(avatarFile, "avatar")}
                >
                  {uploadingAvatar ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  className="upload-remove-btn"
                  onClick={() => { setAvatarFile(null); setPreviewAvatar(""); }}
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cover Upload */}
      <div className="upload-section">
        <label className="upload-section-label">
          <Image size={16} /> Cover Photo
        </label>
        {previewCover && (
          <div className="cover-preview-wrap">
            <img src={previewCover} alt="Cover preview" className="cover-preview-img" />
          </div>
        )}
        <div className="upload-actions">
          <label className="upload-file-btn">
            <Upload size={14} /> Choose Cover
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFileSelect(e, setCoverFile, setPreviewCover)}
            />
          </label>
          {coverFile && (
            <>
              <button
                type="button"
                className="upload-confirm-btn"
                disabled={uploadingCover}
                onClick={() => uploadFile(coverFile, "cover")}
              >
                {uploadingCover ? "Uploading..." : "Upload"}
              </button>
              <button
                type="button"
                className="upload-remove-btn"
                onClick={() => { setCoverFile(null); setPreviewCover(""); }}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="form-divider" />

      {/* Form Fields */}
      <div className="form-grid">
        <div className="form-field">
          <label className="form-field-label">Date of Birth</label>
          <input
            type="date"
            name="dob"
            className="form-field-input"
            value={formData?.dob || ""}
            onChange={handleChange}
          />
        </div>
        <div className="form-field">
          <label className="form-field-label">Hometown</label>
          <input
            type="text"
            name="hometown"
            className="form-field-input"
            placeholder="Where are you from?"
            value={formData?.hometown || ""}
            onChange={handleChange}
          />
        </div>
        <div className="form-field">
          <label className="form-field-label">Current City</label>
          <input
            type="text"
            name="currentcity"
            className="form-field-input"
            placeholder="Where do you live now?"
            value={formData?.currentcity || ""}
            onChange={handleChange}
          />
        </div>
        <div className="form-field">
          <label className="form-field-label">Gender</label>
          <select
            name="sex"
            className="form-field-input"
            value={formData?.sex || ""}
            onChange={handleChange}
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to mention">Prefer not to say</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-field-label">Relationship Status</label>
          <select
            name="relationship"
            className="form-field-input"
            value={formData?.relationship || ""}
            onChange={handleChange}
          >
            <option value="">Select status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Prefer not to mention">Prefer not to say</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="form-reset-btn" onClick={resetForm}>
          <RotateCcw size={15} /> Reset
        </button>
        <button type="submit" className="form-save-btn">
          <Save size={15} /> Save Changes
        </button>
      </div>
    </form>
  );

  return (
    <div className="profile-page-root">
      <main className="profile-main">
        {/* Tab Navigation */}
        <nav className="profile-tab-nav">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`profile-tab-btn ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="profile-content">
          {loading ? (
            <div className="profile-loading">
              <div className="loading-spinner" />
              <p>Loading your profile...</p>
            </div>
          ) : profile ? (
            <>
              {tab === "view" && renderViewTab()}
              {tab === "edit" && renderEditTab()}
              {tab === "privacy" && <PrivacySettings />}
              {tab === "notifications" && <NotificationSettings />}
            </>
          ) : (
            <div className="profile-empty">
              <User size={48} />
              <h3>No Profile Found</h3>
              <p>We couldn't load your profile. Please try again.</p>
              <button className="form-save-btn" onClick={() => fetchProfile()}>Retry</button>
            </div>
          )}
        </div>
      </main>

      <ToastContainer position="top-right" autoClose={3500} />

      {profile && (
        <>
          <FollowersModal
            show={showFollowers}
            onClose={() => setShowFollowers(false)}
            users={profile.followers || []}
            title="Followers"
          />
          <FollowersModal
            show={showFollowing}
            onClose={() => setShowFollowing(false)}
            users={profile.following || []}
            title="Following"
          />
        </>
      )}
    </div>
  );
};

export default Profile;