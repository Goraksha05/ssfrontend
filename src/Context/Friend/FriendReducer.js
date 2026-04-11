// src/Context/Friend/FriendReducer.js
//
// Production improvements:
//   - All mutations use shallow-copy patterns that are safe with React's
//     Object.is comparison (no array mutation in-place).
//   - SET_FRIENDS / SET_SUGGESTIONS / SET_REQUESTS / SET_SENT_REQUESTS perform
//     deduplication to guard against double network responses.
//   - UPDATE_FRIEND patches a single friend record without a full array rebuild.
//   - All array operations are pure — no side effects.

const dedupe = (arr, key = '_id') => {
  const seen = new Set();
  return arr.filter((item) => {
    const k = item?.[key];
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const FriendReducer = (state, action) => {
  switch (action.type) {

    // ── Bulk setters (always dedupe on arrival) ───────────────────────────────
    case 'SET_FRIENDS':
      return {
        ...state,
        friends: dedupe(Array.isArray(action.payload) ? action.payload : []),
      };

    case 'SET_REQUESTS':
      return {
        ...state,
        requests: dedupe(Array.isArray(action.payload) ? action.payload : []),
      };

    case 'SET_SENT_REQUESTS':
      return {
        ...state,
        sentRequests: dedupe(Array.isArray(action.payload) ? action.payload : []),
      };

    case 'SET_SUGGESTIONS':
      return {
        ...state,
        suggestions: dedupe(Array.isArray(action.payload) ? action.payload : []),
      };

    // ── Loading flags ─────────────────────────────────────────────────────────
    case 'SET_LOADING':
      return { ...state, [action.key]: Boolean(action.value) };

    // ── Optimistic mutations ──────────────────────────────────────────────────

    case 'ADD_FRIEND': {
      // Add if not already present; also remove from requests/sentRequests
      const existing = state.friends.some((f) => f._id === action.payload._id);
      return {
        ...state,
        friends: existing
          ? state.friends
          : [...state.friends, action.payload],
        requests: state.requests.filter(
          (r) =>
            r._id !== action.payload._id &&
            r.requester?._id !== action.payload._id
        ),
        sentRequests: state.sentRequests.filter(
          (r) =>
            r._id !== action.payload._id &&
            r.recipient?._id !== action.payload._id
        ),
      };
    }

    case 'REMOVE_FRIEND':
      return {
        ...state,
        friends: state.friends.filter((f) => f._id !== action.payload),
      };

    // Patch a single friend record (e.g. online status, mutual count)
    case 'UPDATE_FRIEND':
      return {
        ...state,
        friends: state.friends.map((f) =>
          f._id === action.payload._id ? { ...f, ...action.payload } : f
        ),
      };

    case 'REMOVE_REQUEST':
      return {
        ...state,
        requests: state.requests.filter(
          (r) =>
            r._id !== action.payload &&
            r.requester?._id !== action.payload
        ),
      };

    case 'ADD_SENT_REQUEST': {
      const alreadySent = state.sentRequests.some(
        (r) => r._id === action.payload._id
      );
      return alreadySent
        ? state
        : { ...state, sentRequests: [action.payload, ...state.sentRequests] };
    }

    case 'REMOVE_SENT_REQUEST':
      return {
        ...state,
        sentRequests: state.sentRequests.filter(
          (r) =>
            r._id !== action.payload &&
            r.recipient?._id !== action.payload
        ),
      };

    case 'REMOVE_SUGGESTION':
      return {
        ...state,
        suggestions: state.suggestions.filter((s) => s._id !== action.payload),
      };

    // ── Full reset on logout ──────────────────────────────────────────────────
    case 'CLEAR_FRIEND_DATA':
      return {
        friends:            [],
        requests:           [],
        sentRequests:       [],
        suggestions:        [],
        loading:            false,
        suggestionsLoading: false,
        requestsLoading:    false,
        sentLoading:        false,
      };

    default:
      return state;
  }
};

export default FriendReducer;