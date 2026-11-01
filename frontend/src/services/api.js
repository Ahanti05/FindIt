import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('findit_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('findit_token');
      localStorage.removeItem('findit_user');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  updateProfile: (data) => api.patch('/auth/profile', data),
};

// ─── Lost Items ───────────────────────────────────────────────────────────────
export const lostApi = {
  getAll: (params) => api.get('/lost-items', { params }),
  getById: (id) => api.get(`/lost-items/${id}`),
  getMine: () => api.get('/lost-items/my'),
  create: (formData) => api.post('/lost-items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/lost-items/${id}`, data),
  delete: (id) => api.delete(`/lost-items/${id}`),
};

// ─── Found Items ──────────────────────────────────────────────────────────────
export const foundApi = {
  getAll: (params) => api.get('/found-items', { params }),
  getById: (id) => api.get(`/found-items/${id}`),
  getMine: () => api.get('/found-items/my'),
  create: (formData) => api.post('/found-items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/found-items/${id}`, data),
  delete: (id) => api.delete(`/found-items/${id}`),
};

// ─── Matches ──────────────────────────────────────────────────────────────────
export const matchApi = {
  getForLostItem: (itemId) => api.get(`/matches/lost/${itemId}`),
  getById: (matchId) => api.get(`/matches/${matchId}`),
  respond: (matchId, response) => api.patch(`/matches/${matchId}/respond`, { response }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifApi = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.patch('/notifications/read', { ids }),
};

// ─── Recovery ─────────────────────────────────────────────────────────────────
export const recoveryApi = {
  create: (formData) => api.post('/recovery', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getById: (id) => api.get(`/recovery/${id}`),
  review: (id, data) => api.patch(`/recovery/${id}/review`, data),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  detect: (imageUrl) => api.post('/ai/detect', { imageUrl }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getPending: (params) => api.get('/admin/pending', { params }),
  moderate: (itemType, itemId, data) => api.patch(`/admin/moderate/${itemType}/${itemId}`, data),
  getUsers: () => api.get('/admin/users'),
  toggleUser: (userId) => api.patch(`/admin/users/${userId}/toggle`),
};

export default api;
