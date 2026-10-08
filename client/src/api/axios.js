// client/src/api/axios.js
import axios from 'axios';

// In local dev, Vite's dev-server proxy (see vite.config.js) forwards
// "/api" to the backend, so a relative path works fine. That proxy does
// NOT exist once the frontend is built and deployed as a static site - the
// static host has no idea what "/api" is supposed to point to, which is
// why login (and everything else) silently fails after deploying to
// Render. Set VITE_API_URL to your backend's full URL in the frontend's
// environment (e.g. https://rekker-hr-api.onrender.com/api) to fix it.
// Be forgiving about how the variable was typed: with or without a
// trailing slash, with or without the /api suffix, all resolve correctly.
const rawUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseURL = rawUrl ? (rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`) : '/api';

const api = axios.create({
  baseURL,
});

// The backend's origin with no /api suffix - e.g. for building a link to
// an uploaded file (/uploads/xyz.pdf) or the payroll Excel export, which
// are served directly by the backend, not proxied through "/api".
export const apiOrigin = baseURL.replace(/\/api\/?$/, '');

// Turns a backend-relative path (as stored in the DB, e.g. "/uploads/x.pdf")
// into a full URL that works both in local dev (proxied) and once deployed.
export const resolveFileUrl = (path) => (path?.startsWith('http') ? path : `${apiOrigin}${path}`);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rekker-hr-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rekker-hr-token');
      localStorage.removeItem('rekker-hr-user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;