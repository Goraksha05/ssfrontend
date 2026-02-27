// src/Context/Friend/FriendReducer.js

const FriendReducer = (state, action) => {
  switch (action.type) {
    // ── Bulk setters (from API fetches) ──────────────────────────────────────
    case 'SET_FRIENDS':
      return { ...state, friends: Array.isArray(action.payload) ? action.payload : [] };

    case 'SET_REQUESTS':
      return { ...state, requests: Array.isArray(action.payload) ? action.payload : [] };

    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: Array.isArray(action.payload) ? action.payload : [] };

    // ── Loading flags (keyed by 'loading' | 'requestsLoading' | 'suggestionsLoading') ──
    case 'SET_LOADING':
      return { ...state, [action.key]: action.value };

    // ── Optimistic mutations ──────────────────────────────────────────────────

    // Add a single friend (after accept)
    case 'ADD_FRIEND':
      return {
        ...state,
        friends: [...state.friends, action.payload],
        requests: state.requests.filter(
          (req) => req._id !== action.payload._id && req.requester?._id !== action.payload._id
        ),
      };

    // Remove a friend by user _id (after unfriend)
    case 'REMOVE_FRIEND':
      return {
        ...state,
        friends: state.friends.filter((f) => f._id !== action.payload),
      };

    // Remove a request by either its own _id or the requester's _id (after accept/decline)
    case 'REMOVE_REQUEST':
      return {
        ...state,
        requests: state.requests.filter(
          (req) => req._id !== action.payload && req.requester?._id !== action.payload
        ),
      };

    // Remove a suggestion by _id (after sending a request)
    case 'REMOVE_SUGGESTION':
      return {
        ...state,
        suggestions: state.suggestions.filter((s) => s._id !== action.payload),
      };

    // Full reset on logout
    case 'CLEAR_FRIEND_DATA':
      return {
        friends: [],
        requests: [],
        suggestions: [],
        loading: false,
        suggestionsLoading: false,
        requestsLoading: false,
      };

    default:
      return state;
  }
};

export default FriendReducer;