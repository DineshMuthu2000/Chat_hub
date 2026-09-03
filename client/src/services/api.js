const API_BASE = '/api';

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
