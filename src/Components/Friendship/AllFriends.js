import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { getInitials } from '../../utils/getInitials';
import UnfriendBtn from '../../Assets/RectaUnfrndBtn.png';
import './AllFriends.css';

const AllFriends = () => {
  const { friends = [], unfriend, fetchFriends } = useFriend();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleUnfriend = async (id) => {
    if (removingId) return;
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
    <div className="af-page">
      <div className="af-card">

        {/* Header */}
        <div className="af-header">
          <h2 className="af-title">
            All Friends
            {friends.length > 0 && (
              <span className="af-badge">{friends.length}</span>
            )}
          </h2>
          <button
            onClick={() => navigate('/')}
            className="af-close-btn"
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
            className="af-search"
            aria-label="Search friends"
          />
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="af-empty">
            <span className="af-empty-icon">👥</span>
            {query ? 'No friends match your search.' : 'You have no friends yet.'}
          </div>
        ) : (
          <ul className="af-list">
            {filtered.map(friend => {
              const location  = friend.currentcity || friend.hometown || '';
              const isRemoving = removingId === friend._id;

              return (
                <li key={friend._id} className="af-item">
                  <img
                    src={
                      friend.profileImage ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(friend.name))}&background=3b4fd8&color=fff`
                    }
                    alt={friend.name}
                    className="af-avatar"
                    loading="lazy"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(friend.name))}&background=3b4fd8&color=fff`;
                    }}
                  />
                  <div className="af-info">
                    <p className="af-name">{friend.name}</p>
                    {location && <p className="af-location">📍 {location}</p>}
                  </div>
                  <button
                    onClick={() => handleUnfriend(friend._id)}
                    disabled={isRemoving}
                    className={`af-unfriend-btn ${isRemoving ? 'af-unfriend-btn--removing' : ''}`}
                    aria-label={`Unfriend ${friend.name}`}
                    title={`Unfriend ${friend.name}`}
                    style={{ backgroundImage: `url(${UnfriendBtn})` }}
                  >
                    <span className="af-unfriend-btn-label">
                      {isRemoving ? 'Removing…' : 'Unfriend'}
                    </span>
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