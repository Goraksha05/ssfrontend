// src/config/api.js
// ---------------------------------------------------------------
// Single source of truth for the backend base URL.
//
// Reads from your frontend .env file in priority order:
//   1. REACT_APP_SERVER_URL   (primary — matches your existing .env)
//   2. REACT_APP_BACKEND_URL  (fallback — also in your .env)
//   3. http://localhost:5000  (last-resort dev default)
//
// ⚠️  Do NOT hardcode 127.0.0.1 or a port number anywhere else in the app.
//     Always import BASE_URL from this file instead.
// ---------------------------------------------------------------

const BASE_URL =
  process.env.REACT_APP_SERVER_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://localhost:5000';

export default BASE_URL;