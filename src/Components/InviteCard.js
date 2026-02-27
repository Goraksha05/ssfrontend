// src/Components/InviteCard.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../Context/Authorisation/AuthContext";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import download from "downloadjs";
import apiRequest from "../utils/apiRequest";
import appLogo from "../Assets/logo.png";
import ShareModal from "../Components/UserActivities/ShareModal";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

const InviteCard = () => {
  const { user, authtoken } = useAuth();
  const [inviteLink, setInviteLink] = useState("");
  const [invitedList, setInvitedList] = useState([]);
  const [loadingInvited, setLoadingInvited] = useState(false);
  const [showInvitedModal, setShowInvitedModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // UI wrapper for overlay; QRCanvas ref for export
  const qrCanvasRef = useRef(null);
  const qrBoxRef = useRef(null);
  const navigate = useNavigate();

  // ——— Build invite link from user.referralId ———
  useEffect(() => {
    if (user?.referralId) {
      const base =
        process.env.REACT_APP_PUBLIC_WEB_URL || window.location.origin;
      setInviteLink(`${base}/invite/${user.referralId}`);
    } else {
      setInviteLink("");
    }
  }, [user]);

  // ——— Fetch invited people ———
  const fetchInvitedPeople = useCallback(async () => {
    if (!user?.referralId) return;
    setLoadingInvited(true);
    try {
      const res = await apiRequest.get(
        `${SERVER_URL}/api/activity/invited/${encodeURIComponent(
          user.referralId
        )}`,
        { headers: { Authorization: `Bearer ${authtoken}` } }
      );
      setInvitedList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch invited list:", err);
    } finally {
      setLoadingInvited(false);
    }
  }, [user?.referralId, authtoken]);

  // ——— Helpers to compose PNG from the QR canvas + logo ———
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const roundRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const composeQRWithLogo = async () => {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas) return null;

    const width = qrCanvas.width;
    const height = qrCanvas.height;

    // offscreen canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // white background to avoid transparent edges in some viewers
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // draw the QR as-is (includes includeMargin already)
    ctx.drawImage(qrCanvas, 0, 0);

    // logo with a white rounded pad for readability
    const logo = await loadImage(appLogo);
    const logoSize = Math.round(width * 0.22); // ~22% of QR width
    const pad = Math.max(6, Math.round(width * 0.04));
    const radius = Math.max(8, Math.round(width * 0.06));
    const x = Math.round((width - logoSize) / 2);
    const y = Math.round((height - logoSize) / 2);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, radius);
    ctx.fill();

    ctx.drawImage(logo, x, y, logoSize, logoSize);

    return canvas;
  };

  // ——— Actions: Download / Share (full, uncropped) ———
  const handleDownloadQR = async () => {
    const canvas = await composeQRWithLogo();
    if (!canvas) return;
    download(canvas.toDataURL("image/png"), "invite-qr.png");
  };

  const handleShareQR = async () => {
    const canvas = await composeQRWithLogo();
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "invite-qr.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Join me on SoShoLife",
            text: "Scan this QR or use my invite link to join!",
          });
        } catch (err) {
          console.error("Sharing failed:", err);
        }
      } else {
        // Fallback: download if Web Share API (files) is unsupported
        download(URL.createObjectURL(blob), "invite-qr.png");
      }
    }, "image/png");
  };

  const handleClose = () => navigate("/");

  return (
    <div className="container-fluid py-5 mt-5">
      <div className="row justify-content-center">
        <div className="card border-0 rounded bg-dark text-light position-relative p-4">
          {/* Close */}
          <button
            onClick={handleClose}
            className="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-2"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>

          {/* Title */}
          <h4 className="mb-2 fw-bold text-center">🎉 Invite Friends</h4>
          <p className="small text-secondary text-center mb-4">
            Share your link or QR code to invite friends.
          </p>

          {/* Invite Link */}
          <div className="input-group mb-4">
            <input
              type="text"
              className="form-control bg-transparent text-light border-secondary"
              value={inviteLink}
              readOnly
              onClick={(e) => e.target.select()}
            />
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                if (inviteLink) {
                  navigator.clipboard.writeText(inviteLink);
                  alert("Invitation link copied!");
                } else {
                  alert("Referral ID not available yet.");
                }
              }}
            >
              Copy
            </button>
          </div>

          {/* QR UI (no fixed width/height; no clipping) */}
          <div
            ref={qrBoxRef}
            className="position-relative mx-auto bg-white p-2 rounded shadow-sm"
            style={{ display: "inline-block", lineHeight: 0 }}
          >
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={inviteLink}
              size={240}
              level="H"
              includeMargin
            />
            {/* Centered overlay for on-screen preview only */}
            <img
              src={appLogo}
              alt="logo"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "22%",
                height: "22%",
                transform: "translate(-50%, -50%)",
                borderRadius: "12px",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Actions */}
          <div className="d-grid gap-2 mt-4">
            <button className="btn btn-success" onClick={handleDownloadQR}>
              ⬇️ Download QR
            </button>
            <button className="btn btn-info" onClick={handleShareQR}>
              📤 Share QR as Image
            </button>
            <button className="btn btn-warning" onClick={() => setShowShareModal(true)}>
              🔗 Share Referral Link
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                fetchInvitedPeople();
                setShowInvitedModal(true);
              }}
            >
              👥 View Invited People
            </button>
          </div>
        </div>
      </div>

      {/* Invited List Modal */}
      {showInvitedModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 shadow-lg bg-dark text-light">
              <div className="modal-header border-0">
                <h5 className="modal-title">👥 Invited People</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowInvitedModal(false)}
                />
              </div>
              <div className="modal-body">
                {loadingInvited ? (
                  <div className="text-center py-3">Loading...</div>
                ) : invitedList.length === 0 ? (
                  <p className="text-center text-muted">No invited people found.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {invitedList.map((person) => (
                      <li
                        key={person._id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <span className="fw-semibold">{person.name}</span>
                        <span
                          className={`badge ${person.subscription?.active ? "bg-success" : "bg-danger"
                            }`}
                        >
                          {person.subscription?.active ? "Active" : "Inactive"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal inviteLink={inviteLink} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
};

export default InviteCard;
