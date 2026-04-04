// src/Components/ChatRoom/Chat/MessageBubble.js
//
// ── Role change ──────────────────────────────────────────────────────────────
//
// MessageBubble is now a ROUTER, not a renderer.
//
// It answers one question: "did the logged-in user send this message?"
//   YES → delegates to <SentMessage>    (right-aligned, green bubble, ticks)
//   NO  → delegates to <ReceivedMessage> (left-aligned, white bubble, avatar)
//
// This separation fixes the alignment bug where every bubble appeared on the
// left, because `isMine` was computed but the CSS classes were applied
// inconsistently when all layout lived in one giant component.
//
// ReplyContext is still exported from here so ChatWindow.js and both child
// components can import it from a single stable path without circular deps.
//
// Grouping logic (sameAsPrev / sameAsNext) lives here so neither child
// component needs to know about its neighbours — ChatWindow just passes
// msg/prevMsg/nextMsg and MessageBubble resolves isFirstInGroup/isLastInGroup.

import React, { createContext } from 'react';
import { useAuth }       from '../../../Context/Authorisation/AuthContext';
import SentMessage       from './SentMessage';
import ReceivedMessage   from './ReceivedMessage';

// ── ReplyContext ──────────────────────────────────────────────────────────────
// Exported so ChatWindow can provide it and both child components can consume
// it without needing to prop-drill setReplyTo three levels deep.
export const ReplyContext = createContext(null);

// ── Grouping helper ───────────────────────────────────────────────────────────
// Two messages belong to the same "group" when:
//   • same sender AND
//   • sent within 5 minutes of each other
const FIVE_MINUTES = 5 * 60_000;

function sameGroup(a, b) {
  if (!a || !b) return false;
  return (
    a.sender?._id === b.sender?._id &&
    Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) < FIVE_MINUTES
  );
}

// ── MessageBubble (router) ────────────────────────────────────────────────────
const MessageBubble = ({ msg, prevMsg, nextMsg, recipientInfo }) => {
  const { user } = useAuth();

  // ── Ownership check ───────────────────────────────────────────────
  // Support both `user._id` (MongoDB ObjectId string) and `user.id`
  // (the field the backend's getloggeduser endpoint returns).
  const myId  = user?._id?.toString() ?? user?.id?.toString() ?? null;
  const isMine = !!myId && msg?.sender?._id?.toString() === myId;

  // ── Grouping ──────────────────────────────────────────────────────
  // isFirstInGroup: this is the START of a new run of messages from
  //   this sender → show bubble tail + (for received) sender name label.
  // isLastInGroup: this is the END of the run → show avatar for received.
  const isFirstInGroup = !sameGroup(msg, prevMsg);
  const isLastInGroup  = !sameGroup(msg, nextMsg);

  // ── Route ─────────────────────────────────────────────────────────
  if (isMine) {
    return (
      <SentMessage
        msg={msg}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
      />
    );
  }

  return (
    <ReceivedMessage
      msg={msg}
      isFirstInGroup={isFirstInGroup}
      isLastInGroup={isLastInGroup}
      recipientInfo={recipientInfo}
    />
  );
};

export default MessageBubble;