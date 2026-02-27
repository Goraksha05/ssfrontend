// SuggestionGridFeed.js
// Feed-integrated, Facebook-style responsive grid of "People You May Know"
// Exports: default -> SuggestionGridFeed, named -> SuggestionCard

import React, { useEffect, useState, useCallback } from "react";
import { useFriend } from "../../Context/Friend/FriendContext";
import { getInitials } from "../../utils/getInitials";
import { Skeleton } from "../ui/skeleton";
import { toast } from "react-toastify";
import FriendAddIcon from '../../Assets/FriendAddBtn.png';
import FriendRemoveIcon from '../../Assets/FriendRemoveBtn.png';

// -------------------------
// SuggestionCard (named)
// -------------------------
export function SuggestionCard({ user, onConnect, onHide, disabled = false }) {
  const [imgError, setImgError] = useState(false);

  const avatarUrl =
    user?.profileavatar?.URL ||
    user?.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(user?.name || "?"))}&background=EDEFF3&color=333&size=128`;

  return (
    <div className="p-2 h-100">
      <div
        className="d-flex align-items-center p-2 shadow-sm h-100"
        style={{ borderRadius: 10, backgroundColor: "#ffefe8ff" }}
      >
        <a
          href={`/profile/${user?._id || "#"}`}
          className="me-3 d-block"
          aria-label={`View ${user?.name || "profile"}`}
        >
          <img
            src={!imgError ? avatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(user?.name || "?"))}`}
            alt={`Profile of ${user?.name || "Unknown"}`}
            className="rounded-circle border"
            style={{ width: 56, height: 56, objectFit: "cover" }}
            onError={() => setImgError(true)}
          />
        </a>

        <div className="flex-grow-1 pe-2">
          <a
            href={`/profile/${user?._id || "#"}`}
            className="fw-semibold text-dark text-decoration-none d-block"
            style={{ fontSize: 24, lineHeight: 1.2 }}
          >
            {user?.name || "Unknown"}
          </a>
          {user?.mutualFriendsCount > 0 && (
            <div className="text-muted" style={{ fontSize: 15 }}>
              {user.mutualFriendsCount} mutual friend{user.mutualFriendsCount > 1 ? "s" : ""}
            </div>
          )}
          <small className="text-muted">{user?.hometown || user?.currentcity || ""}</small>
        </div>

        <div className="d-flex flex-column gap-1">
          <button
            onClick={() => onConnect(user?._id)}
            title="Add Friend"
            disabled={disabled}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
            aria-pressed={disabled}
          >
            <img
              src={FriendAddIcon}
              alt="Add Friend"
              style={{ width: "auto", height: "55px" }}
            />
          </button>

          {/* Remove Friend Button */}
          <button
            onClick={() => onHide(user?._id)}
            title="Remove Friend"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <img
              src={FriendRemoveIcon}
              alt="Remove Friend"
              style={{ width: "auto", height: "55px" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// SuggestionGridFeed (default export)
// -------------------------
export default function SuggestionGridFeed({ initialPerPage = 6 }) {
  const {
    suggestions = [],
    suggestionsLoading = false,
    fetchSuggestions,
    sendRequest,
  } = useFriend();

  const [hiddenSet, setHiddenSet] = useState(() => new Set());
  const [sentSet, setSentSet] = useState(() => new Set());
  const [connectingSet, setConnectingSet] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const perPage = initialPerPage;

  useEffect(() => {
    if (typeof fetchSuggestions === "function") fetchSuggestions();
  }, [fetchSuggestions]);

  const visibleSuggestions = Array.isArray(suggestions)
    ? suggestions.filter((s) => s && s._id && !hiddenSet.has(s._id))
    : [];

  const totalPages = Math.max(1, Math.ceil(visibleSuggestions.length / perPage));
  const paginated = visibleSuggestions.slice((page - 1) * perPage, page * perPage);

  const handleConnect = useCallback(
    async (id) => {
      if (!id) return;
      if (connectingSet.has(id)) return;
      setConnectingSet((prev) => new Set(prev).add(id));
      try {
        if (typeof sendRequest === "function") {
          const res = await sendRequest(id);
          if (res?.success) {
            setSentSet((prev) => new Set(prev).add(id));
            toast.success("Friend request sent");
          } else {
            toast.error("Failed to send friend request");
          }
          if (typeof fetchSuggestions === "function") fetchSuggestions();
        }
      } catch (err) {
        console.error("Send request error", err);
        toast.error("Failed to send friend request");
      } finally {
        setConnectingSet((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    },
    [sendRequest, fetchSuggestions, connectingSet]
  );

  const handleHide = useCallback((id) => {
    if (!id) return;
    setHiddenSet((prev) => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  return (
    <div className="container-fluid px-0" style={{ backgroundColor: "transparent" }}>
      <div className="row g-2">
        {suggestionsLoading &&
          Array.from({ length: perPage }).map((_, i) => (
            <div key={`sk-${i}`} className="col-12 col-md-6 col-lg-4 d-flex">
              <div className="p-2 flex-fill">
                <div className="d-flex align-items-center p-2 shadow-sm h-100 bg-light" style={{ borderRadius: 10 }}>
                  <Skeleton className="rounded-circle me-3" style={{ width: 56, height: 56 }} />
                  <div className="flex-grow-1">
                    <Skeleton style={{ width: "55%", height: 12, marginBottom: 6 }} />
                    <Skeleton style={{ width: "40%", height: 10 }} />
                  </div>
                  <Skeleton style={{ width: 90, height: 34, borderRadius: 6 }} />
                </div>
              </div>
            </div>
          ))}

        {!suggestionsLoading &&
          paginated.map((user) => (
            <div key={user._id} className="col-12 col-md-6 col-lg-4 d-flex">
              <div className="flex-fill">
                <SuggestionCard
                  user={user}
                  onConnect={handleConnect}
                  onHide={handleHide}
                  disabled={sentSet.has(user._id) || connectingSet.has(user._id)}
                />
              </div>
            </div>
          ))}
      </div>

      {!suggestionsLoading && visibleSuggestions.length === 0 && (
        <p className="text-muted text-center mt-3">No suggestions available at the moment.</p>
      )}

      {/* {!suggestionsLoading && visibleSuggestions.length > perPage && (
        <div className="mt-3 d-flex justify-content-center">
          <button
            type="button"
            className="btn btn-outline-primary rounded-pill"
            style={{ fontSize: 20 }}
            onClick={() => setPage((p) => (p < totalPages ? p + 1 : 1))}
          >
            Show more people
          </button>
        </div>
      )} */}
    </div>
  );
}
