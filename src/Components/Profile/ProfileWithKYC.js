import React, { useEffect, useState, useContext, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import ProfileContext from "../../Context/Profile/ProfileContext";
import postContext from "../../Context/Posts/PostContext";
import usePostCount from "../../utils/PostCount";
import KycVerification from "../KYC/KycVerification";
import { toast, ToastContainer } from "react-toastify";
import Swal from "sweetalert2";
import confetti from "canvas-confetti";
import handleAuthError from "../../utils/handleAuthError";
import "react-toastify/dist/ReactToastify.css";
import PrivacySettings from "./PrivacySettings";
import DeleteAccount from "./DeleteAccount";
import NotificationSettings from "./NotificationSettings";
import FollowersModal from "./FollowersModal";
import { useFriend } from "../../Context/Friend/FriendContext";
import getSocket from "../../WebSocket/WebSocketClient";
import {
  BadgeCheck,
  Camera,
  Edit3,
  // Bell,
  IdCard,
  Lock,
  Image,
  X,
  Upload,
  RotateCcw,
  Save,
  Calendar,
  MapPin,
  Heart,
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileCheck,
} from "lucide-react";
import { useSubscription } from "../../Context/Subscription/SubscriptionContext";
import { useKyc, KYC_STATUSES } from "../../Context/KYC/KycContext";
import apiRequest from "../../utils/apiRequest";
import "./Profile.css";

/* ═══════════════════════════════════════════════════
   KYC STATUS CONFIG
═══════════════════════════════════════════════════ */
const KYC_STATUS_CONFIG = {
  not_started: {
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
    Icon: IdCard,
    label: "Not Started",
    badge: null,
    message:
      "Complete identity verification to unlock reward claims and the verified badge.",
    actionLabel: "Start KYC Verification",
    actionStyle: "primary",
  },
  required: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fcd34d",
    Icon: AlertTriangle,
    label: "Required",
    badge: "Action Required",
    badgeColor: "#d97706",
    badgeBg: "#fef3c7",
    message:
      "Your account requires identity verification before you can claim rewards.",
    actionLabel: "Complete KYC Now",
    actionStyle: "warning",
  },
  submitted: {
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    Icon: Clock,
    label: "Under Review",
    badge: "Pending Review",
    badgeColor: "#2563eb",
    badgeBg: "#dbeafe",
    message:
      "Your documents have been submitted and are being reviewed by our team. This typically takes 1–2 business days.",
    actionLabel: null,
    actionStyle: null,
  },
  verified: {
    color: "#059669",
    bg: "#ecfdf5",
    border: "#6ee7b7",
    Icon: CheckCircle2,
    label: "Verified",
    badge: "Verified",
    badgeColor: "#059669",
    badgeBg: "#d1fae5",
    message:
      "Your identity has been verified. You can now claim all rewards and you carry the verified badge.",
    actionLabel: null,
    actionStyle: null,
  },
  rejected: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fca5a5",
    Icon: XCircle,
    label: "Rejected",
    badge: "Rejected",
    badgeColor: "#dc2626",
    badgeBg: "#fee2e2",
    message:
      "Your KYC was not approved. Please review the reason below and resubmit with correct documents.",
    actionLabel: "Resubmit Documents",
    actionStyle: "danger",
  },
};

/* ═══════════════════════════════════════════════════
   SCORE CHIP
═══════════════════════════════════════════════════ */
const ScoreChip = ({ label, value, ok, sub }) => (
  <div
    style={{
      background: ok ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${ok ? "#bbf7d0" : "#fca5a5"}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 4,
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 16,
        fontWeight: 800,
        color: ok ? "#059669" : "#dc2626",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
    >
      {value}
    </div>
    {sub && (
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginTop: 2,
          fontFamily: "Plus Jakarta Sans, sans-serif",
        }}
      >
        {sub}
      </div>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════
   KYC TAB — consumes KycContext, no local fetch
═══════════════════════════════════════════════════ */
const KYCTab = ({ onStartVerification }) => {
  // ✅ All KYC state comes from the shared context — no duplicate fetch
  const {
    kycData,
    status,
    loading,
    isVerified: kycVerified,
    isSubmitted,
    isRejected,
  } = useKyc();

  const config = KYC_STATUS_CONFIG[status] || KYC_STATUS_CONFIG.not_started;
  const { Icon: StatusIcon } = config;

  const docs = kycData?.documents || {};
  const docList = [
    { label: "Aadhaar Card",           key: "aadhaarFile" },
    { label: "PAN Card",               key: "panFile" },
    { label: "Bank Passbook",          key: "bankPassbookFile" },
    { label: "Selfie",                 key: "selfie" },
  ];

  const score            = kycData?.score;
  const liveness         = kycData?.liveness;
  const rejectionReason  = kycData?.rejectionReason;
  const verifiedAt       = kycData?.verifiedAt;
  const showScores       = isSubmitted || kycVerified || isRejected;
  const showDocs         = isSubmitted || kycVerified || isRejected;
  const showChecklist    = status === KYC_STATUSES.NOT_STARTED || status === KYC_STATUSES.REQUIRED;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>

      {/* ── Loading skeleton overlay ── */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.82)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid #e2e8f0",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "kyc-spin 0.8s linear infinite",
            }}
          />
        </div>
      )}

      {/* ── Status Card ── */}
      <div
        style={{
          background: config.bg,
          border: `1.5px solid ${config.border}`,
          borderRadius: 16,
          padding: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative arc */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: config.color,
            opacity: 0.06,
          }}
        />

        {/* Status badge pill */}
        {config.badge && (
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                color: config.badgeColor,
                background: config.badgeBg,
                border: `1px solid ${config.border}`,
                padding: "3px 10px",
                borderRadius: 20,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {config.badge}
            </span>
          </div>
        )}

        {/* Icon + heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `${config.color}18`,
              border: `1.5px solid ${config.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <StatusIcon size={24} color={config.color} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: config.color,
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              KYC {config.label}
            </h3>
            {verifiedAt && (
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 12,
                  color: "#6b7280",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                Verified on{" "}
                {new Date(verifiedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>

        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            color: "#374151",
            lineHeight: 1.6,
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
        >
          {config.message}
        </p>

        {/* Rejection reason */}
        {isRejected && rejectionReason && (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fca5a5",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 13,
                fontWeight: 700,
                color: "#dc2626",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Rejection Reason
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#374151",
                lineHeight: 1.5,
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              {rejectionReason}
            </p>
          </div>
        )}

        {/* ✅ CTA scrolls to the upload form below — no broken /kyc navigation */}
        {config.actionLabel && (
          <button
            onClick={onStartVerification}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 24px",
              borderRadius: 24,
              border: "none",
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              background:
                config.actionStyle === "warning"
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : config.actionStyle === "danger"
                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                    : "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#fff",
              boxShadow:
                config.actionStyle === "warning"
                  ? "0 4px 14px rgba(245,158,11,0.35)"
                  : config.actionStyle === "danger"
                    ? "0 4px 14px rgba(239,68,68,0.35)"
                    : "0 4px 14px rgba(99,102,241,0.35)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
          >
            <ShieldCheck size={16} />
            {config.actionLabel}
          </button>
        )}
      </div>

      {/* ── Verification Scores ── */}
      {showScores && score != null && (
        <div
          style={{
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 14,
            padding: "20px 22px",
          }}
        >
          <h4
            style={{
              margin: "0 0 16px",
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              fontFamily: "Plus Jakarta Sans, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Verification Summary
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            <ScoreChip
              label="KYC Score"
              value={`${Math.round((score || 0) * 100)}%`}
              ok={score >= 0.6}
            />
            {liveness && (
              <ScoreChip
                label="Liveness"
                value={liveness.live ? "Live ✓" : "Failed"}
                ok={liveness.live}
                sub={liveness.reason || null}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Submitted Documents Checklist ── */}
      {showDocs && (
        <div
          style={{
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 14,
            padding: "20px 22px",
          }}
        >
          <h4
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              fontFamily: "Plus Jakarta Sans, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Submitted Documents
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {docList.map(({ label, key }) => {
              const submitted = !!docs[key];
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: submitted ? "#f0fdf4" : "#f9fafb",
                    border: `1px solid ${submitted ? "#bbf7d0" : "#e5e7eb"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileCheck size={14} color={submitted ? "#059669" : "#9ca3af"} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#374151",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: submitted ? "#059669" : "#9ca3af",
                    }}
                  >
                    {submitted ? "✓ Uploaded" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── "What you'll need" info box (not_started / required only) ── */}
      {showChecklist && (
        <div
          style={{
            background: "#fafafa",
            border: "1.5px solid #e5e7eb",
            borderRadius: 14,
            padding: "20px 22px",
          }}
        >
          <h4
            style={{
              margin: "0 0 12px",
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            What you'll need
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "🪪", text: "Aadhaar Card (front side)" },
              { icon: "💳", text: "PAN Card" },
              { icon: "🏦", text: "Bank Passbook (first page)" },
              { icon: "🤳", text: "A clear selfie for liveness check" },
            ].map(({ icon, text }) => (
              <div
                key={text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "#374151",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 9,
              fontSize: 12,
              color: "#1d4ed8",
              fontFamily: "Plus Jakarta Sans, sans-serif",
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            🔒 Your documents are encrypted and only used for identity verification. We never share them with third parties.
          </div>
        </div>
      )}

      <style>{`@keyframes kyc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   MAIN PROFILE COMPONENT
═══════════════════════════════════════════════════ */
const Profile = () => {
  const { profile, loading, formData, fetchProfile, handleChange, handleEdit } =
    useContext(ProfileContext);
  const { statePosts } = useContext(postContext);

  // ✅ Consume shared KYC context — single source of truth, no stale user.kyc
  const { status: kycStatus, needsAction: showKycBadge } = useKyc();

  // ── Read ?tab=kyc from URL so KYCStatusBanner CTA lands on the right tab ──
  const location = useLocation();
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    const validTabs = ["view", "edit", "privacy", "kyc", "deleteAccount"];
    if (tabParam && validTabs.includes(tabParam)) return tabParam;
    // Also support router state (fallback)
    if (location.state?.openTab && validTabs.includes(location.state.openTab)) {
      return location.state.openTab;
    }
    return "view";
  };

  const [tab,            setTab]            = useState(getInitialTab);
  const [avatarFile,     setAvatarFile]     = useState(null);
  const [coverFile,      setCoverFile]      = useState(null);
  const [previewAvatar,  setPreviewAvatar]  = useState("");
  const [previewCover,   setPreviewCover]   = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover,  setUploadingCover]  = useState(false);

  // Ref used to scroll to the upload form when the CTA is clicked
  const uploadFormRef = React.useRef(null);

  const profileUserId = useMemo(
    () => profile?.user_id?._id || profile?.user_id || null,
    [profile]
  );
  const postCount    = usePostCount(statePosts, profileUserId);
  const userName     = profile?.user_id?.name || "";
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
      await apiRequest.post(
        "/profile/createprofile",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.info("Profile created!");
      await fetchProfile();
      await fetchSuggestions();

      const socket = getSocket();
      if (socket?.connected && profile) {
        socket.emit("user-online", {
          userId:      profile.user_id?._id || profile.user_id,
          name:        profile.user_id?.name || "",
          hometown:    profile.hometown,
          currentcity: profile.currentcity,
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
    const token      = localStorage.getItem("token");
    const setUploading = endpoint === "avatar" ? setUploadingAvatar : setUploadingCover;
    const label      = endpoint === "avatar" ? "Avatar" : "Cover photo";

    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const fd = new FormData();
    fd.append("media", file);
    setUploading(true);
    const uploadToastId = toast.loading(`Uploading ${label.toLowerCase()}... please wait.`);

    try {
      await apiRequest.put(`/api/profile/${endpoint}`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 90_000,
      });
      toast.update(uploadToastId, {
        render:     `${label} updated successfully!`,
        type:       "success",
        isLoading:  false,
        autoClose:  3000,
      });
      fetchProfile();
    } catch (error) {
      const isTimeout = error?.code === "ECONNABORTED";
      toast.update(uploadToastId, {
        render:    isTimeout ? "Upload timed out — please try again." : `Failed to upload ${label.toLowerCase()}.`,
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
      title:              "Save Changes?",
      text:               "Update your profile information?",
      icon:               "question",
      showCancelButton:   true,
      confirmButtonText:  "Save",
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
              userId:      profile.user_id?._id || profile.user_id,
              name:        profile.user_id?.name || "",
              hometown:    formData.hometown,
              currentcity: formData.currentcity,
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

  /* ── Tabs — badge only on KYC, not on Danger Zone ── */
  const tabs = [
    { id: "view",          label: "Profile",     icon: User },
    { id: "edit",          label: "Edit",         icon: Edit3 },
    { id: "privacy",       label: "Privacy",      icon: Lock },
    // ✅ Badge only on the KYC tab; Danger Zone never shows the KYC dot
    { id: "kyc",           label: "KYC",          icon: IdCard,     badge: showKycBadge },
    { id: "deleteAccount", label: "Danger Zone",  icon: ShieldCheck, badge: false },
    // { id: "notifications", label: "Alerts", icon: Bell },
  ];

  /* ── renderViewTab ── */
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

              {/* ✅ KYC chip uses live context status */}
              {kycStatus === KYC_STATUSES.VERIFIED && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#059669",
                    background: "#d1fae5",
                    border: "1px solid #6ee7b7",
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  <IdCard size={11} /> KYC
                </span>
              )}
              {kycStatus === KYC_STATUSES.REQUIRED && (
                <button
                  onClick={() => setTab("kyc")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#d97706",
                    background: "#fef3c7",
                    border: "1px solid #fcd34d",
                    padding: "2px 8px",
                    borderRadius: 20,
                    cursor: "pointer",
                  }}
                >
                  ⚠️ KYC Required
                </button>
              )}
              {kycStatus === KYC_STATUSES.REJECTED && (
                <button
                  onClick={() => setTab("kyc")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#dc2626",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    padding: "2px 8px",
                    borderRadius: 20,
                    cursor: "pointer",
                  }}
                >
                  ❌ KYC Rejected
                </button>
              )}
            </div>
            <p className="profile-userid">
              @{userIdDisplay.toString().slice(-8) || "user"}
            </p>
            {(profile.currentcity || profile.hometown) && (
              <p className="profile-location">
                <MapPin size={13} />
                {[profile.currentcity, profile.hometown].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="profile-joined">
              <Calendar size={13} />
              Joined{" "}
              {new Date(profile.sosholifejoinedon).toLocaleDateString("en-US", {
                month: "long",
                year:  "numeric",
              })}
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
                {profile.dob
                  ? new Date(profile.dob).toLocaleDateString("en-US", {
                      month: "long",
                      day:   "numeric",
                      year:  "numeric",
                    })
                  : "Not provided"}
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
          {isVerified && (
            <span className="badge-verified-sm">
              <BadgeCheck size={12} /> Active
            </span>
          )}
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

  /* ── renderEditTab ── */
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

  /* ── renderKycTab — status card + upload form, properly connected ── */
  const renderKycTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/*
        KYCTab shows the live status card, score summary, and documents checklist.
        onStartVerification scrolls smoothly to the upload form below — 
        no broken /kyc route navigation.
      */}
      <KYCTab
        onStartVerification={() =>
          uploadFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      />

      {/*
        KycVerification is the upload form — it internally checks KycContext status
        and only renders the file slots when action is needed (not_started, required, rejected).
        After a successful submission it calls refetch() on KycContext, which automatically
        updates the status card above without any prop-drilling or extra state.
      */}
      <div ref={uploadFormRef}>
        <KycVerification />
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <div className="profile-page-root">
      <main className="profile-main">
        {/* Tab Navigation */}
        <nav className="profile-tab-nav">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={`profile-tab-btn ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
              style={{ position: "relative" }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {/* ✅ Red dot only renders on KYC tab when action is genuinely needed */}
              {badge && tab !== id && (
                <span
                  style={{
                    position:     "absolute",
                    top:          6,
                    right:        6,
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   "#ef4444",
                    border:       "1.5px solid #fff",
                    animation:    "pulse-badge 2s infinite",
                  }}
                />
              )}
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
              {tab === "view"          && renderViewTab()}
              {tab === "edit"          && renderEditTab()}
              {tab === "privacy"       && <PrivacySettings />}
              {tab === "notifications" && <NotificationSettings />}
              {tab === "kyc"           && renderKycTab()}
              {tab === "deleteAccount" && <DeleteAccount />}
            </>
          ) : (
            <div className="profile-empty">
              <User size={48} />
              <h3>No Profile Found</h3>
              <p>We couldn't load your profile. Please try again.</p>
              <button className="form-save-btn" onClick={() => fetchProfile()}>
                Retry
              </button>
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

      <style>{`
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%       { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default Profile;