import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { getInitials } from '../../utils/getInitials';
import { Search, Users } from 'lucide-react';

const FollowersModal = ({ show, onClose, users, title }) => {
  const [search, setSearch] = useState('');

  const filtered = users.filter((user) => {
    const userInfo = user.user_id || user;
    const name = (userInfo.name || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <Modal show={show} onHide={onClose} size="sm" centered>
      <Modal.Header closeButton style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 20px' }}>
        <Modal.Title style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: '#6366f1' }} />
            {title}
            <span style={{
              marginLeft: 4,
              fontSize: 12,
              fontWeight: 700,
              background: '#e0e7ff',
              color: '#6366f1',
              padding: '2px 8px',
              borderRadius: 20,
            }}>
              {users.length}
            </span>
          </div>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ padding: '16px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        {/* Search */}
        {users.length > 4 && (
          <div style={{
            position: 'relative',
            marginBottom: 14,
          }}>
            <Search size={14} style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                border: '1.5px solid #e2e8f0',
                borderRadius: 10,
                fontSize: 13,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                color: '#0f172a',
                background: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <Users size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              {search ? 'No results found' : `No ${title.toLowerCase()} yet`}
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((user, index) => {
              const userInfo = user.user_id || user;
              const avatarUrl = user.profileavatar?.URL || userInfo.profileavatar?.URL;
              const name = userInfo.name || 'Unknown';
              const initials = getInitials(name);

              return (
                <li
                  key={userInfo._id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    transition: 'background 0.15s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0ff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #e0e7ff',
                        }}
                        onError={e => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: avatarUrl ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 15,
                      flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>@{name.toLowerCase().replace(/\s+/g, '')}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal.Body>

      <Modal.Footer style={{ borderTop: '1px solid #f1f5f9', padding: '12px 20px' }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 20px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: 20,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: '#64748b',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default FollowersModal;