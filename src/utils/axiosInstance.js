// src/utils/axiosInstance.js
// NOTE: This instance reads the token lazily (per-request) via an interceptor,
// so it stays correct even after login/logout without needing a page reload.
import axios from 'axios';

const instance = axios.create({
  baseURL: (process.env.REACT_APP_BACKEND_URL || 'https://api.sosholife.com') + '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the latest token on every request
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'null' && token !== 'undefined') {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default instance;