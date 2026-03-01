import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { getInitials } from '../../utils/getInitials';

// ── Inline styles (no external CSS dependency) ───────────────────────────────
const styles = {
  page: {
    minHeight: '50vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #fafaff 100%)',
    padding: '12px 12px 12px',
    boxSizing: 'border-box',
  },
  card: {
    maxWidth: 600,
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 4px 24px rgba(80,80,160,0.10)',
    padding: '24px 20px',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '2px solid #eef0ff',
    paddingBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#3b4fd8',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: '1.5px solid #e0e0e0',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: '#888',
    transition: 'border-color 0.2s, color 0.2s',
    flexShrink: 0,
  },
  badge: {
    background: '#eef0ff',
    color: '#3b4fd8',
    borderRadius: 20,
    padding: '2px 10px',
    fontSize: 13,
    fontWeight: 600,
  },
  empty: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#aaa',
    fontSize: 15,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
    display: 'block',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: '#f8f9ff',
    borderRadius: 14,
    padding: '12px 14px',
    transition: 'box-shadow 0.15s',
    cursor: 'default',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    border: '2px solid #e0e4ff',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 700,
    fontSize: 15,
    color: '#1a1d3a',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  location: {
    fontSize: 12,
    color: '#888',
    margin: '2px 0 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  unfriendBtn: {
    background: 'none',
    border: '1.5px solid #ffcdd2',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#c62828',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1.5px solid #e0e4ff',
    borderRadius: 10,
    padding: '9px 14px',
    fontSize: 14,
    outline: 'none',
    marginBottom: 16,
    background: '#f8f9ff',
    color: '#1a1d3a',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
const AllFriends = () => {
  const { friends = [], unfriend, fetchFriends } = useFriend();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleUnfriend = async (id) => {
    if (removingId) return; // Prevent double-click
    setRemovingId(id);
    try {
      await unfriend(id);
      fetchFriends();
    } catch (err) {
      console.error('Failed to unfriend:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = friends.filter(f =>
    f.name?.toLowerCase().includes(query.toLowerCase()) ||
    f.hometown?.toLowerCase().includes(query.toLowerCase()) ||
    f.currentcity?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            All Friends
            {friends.length > 0 && (
              <span style={{ ...styles.badge, marginLeft: 10 }}>{friends.length}</span>
            )}
          </h2>
          <button
            onClick={() => navigate('/')}
            style={styles.closeBtn}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        {friends.length > 3 && (
          <input
            type="search"
            placeholder="Search friends…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={styles.search}
            aria-label="Search friends"
          />
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyIcon}>👥</span>
            {query ? 'No friends match your search.' : 'You have no friends yet.'}
          </div>
        ) : (
          <ul style={styles.list}>
            {filtered.map(friend => {
              const location = friend.currentcity || friend.hometown || '';
              const isRemoving = removingId === friend._id;

              return (
                <li key={friend._id} style={styles.item}>
                  <img
                    src={
                      friend.profileImage ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(friend.name))}&background=3b4fd8&color=fff`
                    }
                    alt={friend.name}
                    style={styles.avatar}
                    loading="lazy"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(friend.name))}&background=3b4fd8&color=fff`;
                    }}
                  />
                  <div style={styles.info}>
                    <p style={styles.name}>{friend.name}</p>
                    {location && <p style={styles.location}>📍 {location}</p>}
                  </div>
                  <button
                    onClick={() => handleUnfriend(friend._id)}
                    disabled={isRemoving}
                    style={{
                      ...styles.unfriendBtn,
                      opacity: isRemoving ? 0.6 : 1,
                      cursor:  isRemoving ? 'not-allowed' : 'pointer',
                    }}
                    aria-label={`Unfriend ${friend.name}`}
                    title={`Unfriend ${friend.name}`}
                  >
                    {isRemoving ? 'Removing…' : 'Unfriend'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AllFriends;