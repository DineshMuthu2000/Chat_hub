// Resolve the backend API base URL.
// In production on Vercel, VITE_API_URL points to the Render backend (e.g.
// https://your-backend.onrender.com/api). Local dev falls back to '/api' (Vite proxy).
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const getApiBase = () => API_BASE;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const api = {
  // Auth
  anonymousJoin: () => fetch(`${API_BASE}/auth/anonymous-join`, { method: 'POST' }).then(r => r.json()),
  
  // Doubts
  getDoubts: (params = '') => fetch(`${API_BASE}/doubts?${params}`).then(r => r.json()),
  getDoubt: (id) => fetch(`${API_BASE}/doubts/${id}`).then(r => r.json()),
  createDoubt: (data) => fetch(`${API_BASE}/doubts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  
  // ... more API methods
};
