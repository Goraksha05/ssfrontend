/**
 * FollowersModal.js
 *
 * CHANGE: Replaced useScrollLock() with useRegisterModal() from ModalContext.
 * Scroll locking is now handled centrally — no risk of lock/unlock race conditions.
 */

import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { getInitials } from '../../utils/getInitials';
import { Search, Users } from 'lucide-react';
import { useRegisterModal } from '../../Context/ModalContext';

const FollowersModal = ({ show, onClose, users, title }) => {
  // Central scroll lock — replaces: useScrollLock(users.length > 0 && show && true, show)
  useRegisterModal(show && users.length > 0);

  const [search, setSearch] = useState('');

  const filtered = users.filter((user) => {
    const userInfo = user.user_id || user;
    return (userInfo.name || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Modal show={show} onHide={onClose} size="sm" centered dialogClassName="flm-dialog">
      <div className="flm-panel">

        {/* Header */}
        <div className="flm-header">
          <div className="flm-header-left">
            <div className="flm-header-icon">
              <Users size={16} />
            </div>
            <div>
              <h2 className="flm-title">{title}</h2>
              <span className="flm-count-badge">{users.length}</span>
            </div>
          </div>
          <button className="flm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Search */}
        {users.length > 4 && (
          <div className="flm-search-wrap">
            <Search size={13} className="flm-search-icon" />
            <input
              type="text" className="flm-search-input"
              placeholder="Search by name…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="flm-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        )}

        {/* List */}
        <div className="flm-body">
          {filtered.length === 0 ? (
            <div className="flm-empty">
              <div className="flm-empty-icon">
                <Users size={28} />
              </div>
              <p className="flm-empty-text">
                {search ? 'No results found' : `No ${title.toLowerCase()} yet`}
              </p>
            </div>
          ) : (
            <ul className="flm-list">
              {filtered.map((user, index) => {
                const userInfo = user.user_id || user;
                const avatarUrl = user.profileavatar?.URL || userInfo.profileavatar?.URL;
                const name = userInfo.name || 'Unknown';
                const initials = getInitials(name);
                const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

                return (
                  <li key={userInfo._id || index} className="flm-item">
                    <div className="flm-avatar-wrap">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl} alt={name} className="flm-avatar-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="flm-avatar-fallback"
                        style={{
                          display: avatarUrl ? 'none' : 'flex',
                          background: `hsl(${hue},55%,52%)`,
                        }}
                      >
                        {initials}
                      </div>
                    </div>
                    <div className="flm-item-info">
                      <p className="flm-item-name">{name}</p>
                      <p className="flm-item-handle">
                        @{name.toLowerCase().replace(/\s+/g, '')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flm-footer">
          <button className="flm-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default FollowersModal;