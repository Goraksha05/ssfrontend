// src/components/OnlineDot.js
//
// Reusable presence indicator component.
// Uses the improved usePresence hook which reads from OnlineUsersContext
// (no raw socket listeners per-component).

import React from 'react';
import { usePresence } from '../hooks/usePresence';

/**
 * Displays a user's name with an online/offline dot and optional typing indicator.
 *
 * @param {{ user: { _id: string, name: string } }} props
 */
const OnlineDot = ({ user }) => {
  const { isOnline, isTyping } = usePresence();

  if (!user?._id) return null;

  const online  = isOnline(user._id);
  const typing  = isTyping(user._id);

  return (
    <div className="d-flex align-items-center gap-2">
      {/* Presence dot */}
      <span
        style={{
          display:      'inline-block',
          width:        10,
          height:       10,
          borderRadius: '50%',
          background:   online ? '#22c55e' : '#9ca3af',
          flexShrink:   0,
          transition:   'background 0.3s ease',
        }}
        title={online ? 'Online' : 'Offline'}
        aria-label={online ? 'Online' : 'Offline'}
      />

      {/* Name */}
      <span style={{ fontWeight: 500 }}>{user.name}</span>

      {/* Typing indicator */}
      {typing && (
        <span
          style={{
            fontSize:   '0.75rem',
            color:      '#3b82f6',
            fontStyle:  'italic',
            animation:  'pulse 1s infinite',
          }}
          aria-live="polite"
          aria-label="typing"
        >
          typing…
        </span>
      )}
    </div>
  );
};

export default OnlineDot;

/**
 * Headless hook variant — returns presence booleans without rendering anything.
 * Useful in chat headers, sidebar items, etc.
 *
 * @param {string} userId
 */
export const useUserPresence = (userId) => {
  const { isOnline, isTyping } = usePresence();
  return {
    isOnline: isOnline(userId),
    isTyping: isTyping(userId),
  };
};