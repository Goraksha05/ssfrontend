// src/Context/Friend/FriendReducer.js
//
// New actions added:
//   SET_SENT_REQUESTS, ADD_SENT_REQUEST, REMOVE_SENT_REQUEST

const FriendReducer = (state, action) => {
  switch (action.type) {

    // ── Bulk setters ─────────────────────────────────────────────────────────
    case 'SET_FRIENDS':
      return { ...state, friends: Array.isArray(action.payload) ? action.payload : [] };

    case 'SET_REQUESTS':
      return { ...state, requests: Array.isArray(action.payload) ? action.payload : [] };

    case 'SET_SENT_REQUESTS':
      return { ...state, sentRequests: Array.isArray(action.payload) ? action.payload : [] };

    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: Array.isArray(action.payload) ? action.payload : [] };

    // ── Loading flags ─────────────────────────────────────────────────────────
    case 'SET_LOADING':
      return { ...state, [action.key]: action.value };

    // ── Optimistic mutations ──────────────────────────────────────────────────
    case 'ADD_FRIEND':
      return {
        ...state,
        friends: [...state.friends, action.payload],
        requests: state.requests.filter(
          (r) => r._id !== action.payload._id && r.requester?._id !== action.payload._id
        ),
      };

    case 'REMOVE_FRIEND':
      return {
        ...state,
        friends: state.friends.filter((f) => f._id !== action.payload),
      };

    case 'REMOVE_REQUEST':
      return {
        ...state,
        requests: state.requests.filter(
          (r) => r._id !== action.payload && r.requester?._id !== action.payload
        ),
      };

    case 'ADD_SENT_REQUEST':
      // Avoid duplicate entries
      if (state.sentRequests.some(r => r._id === action.payload._id)) return state;
      return {
        ...state,
        sentRequests: [action.payload, ...state.sentRequests],
      };

    case 'REMOVE_SENT_REQUEST':
      return {
        ...state,
        sentRequests: state.sentRequests.filter(
          (r) => r._id !== action.payload && r.recipient?._id !== action.payload
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
        friends:          [],
        requests:         [],
        sentRequests:     [],
        suggestions:      [],
        loading:          false,
        suggestionsLoading: false,
        requestsLoading:  false,
        sentLoading:      false,
      };

    default:
      return state;
  }
};

export default FriendReducer;