// src/components/Profile/ProfilePopoverCard.js
import React, { useEffect, useState } from "react";
import apiRequest from "../../utils/apiRequest";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import { useFriend } from "../../Context/Friend/FriendContext";

const ProfilePopoverCard = ({ userId, onClose }) => {
  const { authtoken } = useAuth();
  const { sendRequest } = useFriend();

  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const fetchProfile = async () => {
      try {
        const res = await apiRequest.get(`/api/profile/${userId}`, {
          headers: { Authorization: `Bearer ${authtoken}` },
        });
        setProfile(res.data.profile);
      } catch (err) {
        console.error("ProfilePopover fetch error:", err);
      }
    };
    fetchProfile();
  }, [userId, authtoken]);

  if (!profile) return null;

  const avatarUrl = profile.profileavatar?.URL || "/default-avatar.png";
  const username = profile.user_id?.username || "unknown";
  const name = profile.user_id?.name || "Unknown User";

  return (
    <div
      className="position-absolute bg-white border rounded shadow p-3"
      style={{
        top: "60px", // position relative to avatar in NotificationsPanel
        left: "0",
        zIndex: 2000,
        width: "260px",
      }}
      onMouseEnter={() => {
        if (onClose) clearTimeout(onClose.timeoutId); // cancel close timer
      }}
      onMouseLeave={() => {
        if (onClose) onClose();
      }}
    >
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <img
          src={avatarUrl}
          alt="avatar"
          className="rounded-circle"
          style={{ width: "55px", height: "55px", objectFit: "cover" }}
        />
        <div>
          <strong>{name}</strong>
          <div className="text-muted">@{username}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="d-flex justify-content-around text-center mb-2">
        <div>
          <strong>{profile.followers?.length || 0}</strong>
          <div className="small text-muted">Followers</div>
        </div>
        <div>
          <strong>{profile.following?.length || 0}</strong>
          <div className="small text-muted">Following</div>
        </div>
      </div>

      {/* Actions */}
      <button
        className="btn btn-sm btn-primary w-100"
        onClick={() => {
          if (profile.user_id?._id) sendRequest(profile.user_id._id);
        }}
      >
        Send Friend Request
      </button>
    </div>
  );
};

export default ProfilePopoverCard;
