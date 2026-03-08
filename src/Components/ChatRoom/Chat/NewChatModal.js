// src/Components/ChatRoom/Chat/NewChatModal.js
//
// Friend-Picker Modal — opened by the ⊕ FAB in ChatList.
//
// Props:
//   friends        Friend[]   — full friends list from FriendContext
//   loadingFriends boolean    — skeleton shown while friends load
//   isOnline       (id)=>bool — from OnlineUsersContext
//   onSelect       (friend)=>void — called when user picks a friend
//   onClose        ()=>void       — called on backdrop click / Escape / ✕

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getInitials } from '../../../utils/getInitials';

// ─── Colour helpers (duplicated locally so this file is self-contained) ───────
const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
const getColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

const resolveAvatar = (obj) =>
  obj?.profileavatar?.URL || obj?.profileImage || obj?.avatar || null;

// ─── Small Avatar used only inside the modal rows ────────────────────────────
const ModalAvatar = ({ name, imageUrl, online }) => (
  <div style={{ position: 'relative', flexShrink: 0, width: 42, height: 42 }}>
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={name}
        style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    ) : (
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: getColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, color: '#fff', userSelect: 'none',
      }}>
        {getInitials(name)}
      </div>
    )}
    {online && (
      <span
        aria-label="Online"
        style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 11, height: 11, borderRadius: '50%',
          background: '#22c55e',
          border: '2px solid var(--bg-secondary, #1e1e2e)',
          display: 'block',
        }}
      />
    )}
  </div>
);

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = ({ index }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: 10,
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
      background: 'var(--bg-secondary, #1e1e2e)',
      animation: 'sk-pulse 1.4s ease-in-out infinite',
    }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        height: 12, borderRadius: 6,
        background: 'var(--bg-secondary, #1e1e2e)',
        width: `${50 + (index % 3) * 15}%`,
        animation: 'sk-pulse 1.4s ease-in-out infinite',
      }} />
      <div style={{
        height: 10, borderRadius: 6,
        background: 'var(--bg-secondary, #1e1e2e)',
        width: `${30 + (index % 4) * 10}%`,
        animation: 'sk-pulse 1.4s ease-in-out infinite',
      }} />
    </div>
  </div>
);

// ─── NewChatModal ─────────────────────────────────────────────────────────────
const NewChatModal = ({ friends, loadingFriends, isOnline, onSelect, onClose }) => {
  const [q, setQ] = useState('');
  const inputRef  = useRef(null);

  // Auto-focus the search box when the modal mounts
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Filtered friend list (name / city / hometown)
  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return friends;
    return friends.filter(
      (f) =>
        f.name?.toLowerCase().includes(lower) ||
        f.currentcity?.toLowerCase().includes(lower) ||
        f.hometown?.toLowerCase().includes(lower),
    );
  }, [friends, q]);

  return (
    <>
      {/* Inject keyframe animations once */}
      <style>{`
        @keyframes ncm-bg-in    { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ncm-panel-in {
          from { opacity: 0; transform: scale(0.93) translateY(14px) }
          to   { opacity: 1; transform: scale(1)    translateY(0)     }
        }
        @keyframes sk-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
        .ncm-row:hover  { background: var(--bg-hover, rgba(255,255,255,0.06)) !important; }
        .ncm-close:hover { background: var(--bg-active, rgba(255,255,255,0.12)) !important; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          animation: 'ncm-bg-in 180ms ease',
        }}
      >
        {/* Panel — stop clicks from bubbling to backdrop */}
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="New conversation"
          style={{
            width: '100%', maxWidth: 420, maxHeight: '80vh',
            background: 'var(--bg-primary, #16161e)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.09))',
            borderRadius: 18,
            boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'ncm-panel-in 210ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.07))',
            flexShrink: 0,
          }}>
            <span style={{
              fontWeight: 700, fontSize: 15,
              color: 'var(--text-primary, #e8e8f0)', letterSpacing: '-0.01em',
            }}>
              New Conversation
            </span>
            <button
              className="ncm-close"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'var(--bg-hover, rgba(255,255,255,0.06))',
                border: 'none', cursor: 'pointer', borderRadius: '50%',
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary, #888)',
                transition: 'background 140ms',
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Search ──────────────────────────────────────────────── */}
          <div style={{ padding: '12px 16px 6px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-secondary, #1e1e2e)',
              borderRadius: 10, padding: '8px 12px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.07))',
            }}>
              <Search size={14} style={{ color: 'var(--text-secondary, #888)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search friends…"
                aria-label="Search friends"
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  color: 'var(--text-primary, #e8e8f0)',
                  fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
                }}
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, lineHeight: 1,
                    color: 'var(--text-secondary, #888)', display: 'flex',
                    transition: 'color 140ms',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Count hint */}
          {!loadingFriends && friends.length > 0 && (
            <div style={{
              padding: '2px 20px 8px', flexShrink: 0,
              fontSize: 11.5, color: 'var(--text-secondary, #888)',
            }}>
              {filtered.length} of {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* ── Friend rows ──────────────────────────────────────────── */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '2px 8px 12px' }}>
            {loadingFriends ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} index={i} />)
            ) : filtered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '36px 24px',
                color: 'var(--text-secondary, #888)', fontSize: 13.5,
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{q ? '🔍' : '👥'}</div>
                {q ? 'No friends match your search.' : 'You have no friends yet.'}
              </div>
            ) : (
              filtered.map((friend) => {
                const online = isOnline(friend._id);
                return (
                  <button
                    key={friend._id}
                    className="ncm-row"
                    onClick={() => onSelect(friend)}
                    style={{
                      width: '100%', border: 'none', background: 'transparent',
                      cursor: 'pointer', borderRadius: 10,
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 12px', textAlign: 'left',
                      transition: 'background 130ms',
                    }}
                  >
                    <ModalAvatar
                      name={friend.name}
                      imageUrl={resolveAvatar(friend)}
                      online={online}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 14,
                        color: 'var(--text-primary, #e8e8f0)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {friend.name}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        {online
                          ? <span style={{ color: '#22c55e', fontWeight: 600 }}>● Online</span>
                          : <span style={{ color: 'var(--text-secondary, #888)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                              {friend.currentcity || friend.hometown || 'Friend'}
                            </span>
                        }
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NewChatModal;