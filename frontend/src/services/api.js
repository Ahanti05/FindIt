import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

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
    if (err.response?.status === 401 && localStorage.getItem('findit_token')) {
      localStorage.removeItem('findit_token');
      localStorage.removeItem('findit_user');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || fallback;

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  updateProfile: (data) => api.patch('/auth/profile', data, data instanceof FormData ? multipart : undefined),
  changePassword: (data) => api.patch('/auth/password', data),
};

// ─── Lost / Found items ───────────────────────────────────────────────────────
const itemApi = (base) => ({
  getAll: (params) => api.get(base, { params }),
  getById: (id) => api.get(`${base}/${id}`),
  getMine: () => api.get(`${base}/my`),
  create: (formData) => api.post(base, formData, multipart),
  update: (id, data) => api.patch(`${base}/${id}`, data),
  delete: (id) => api.delete(`${base}/${id}`),
  reprocess: (id) => api.post(`${base}/${id}/reprocess`),
  flag: (id, reason) => api.post(`${base}/${id}/flag`, { reason }),
});
export const lostApi = itemApi('/lost-items');
export const foundApi = {
  ...itemApi('/found-items'),
  // "This is mine" – opens a match with the finder for an owner who never filed a lost report
  claimMine: (id, description) => api.post(`/found-items/${id}/mine`, { description }),
};
export const itemsApi = (type) => (type === 'lost' ? lostApi : foundApi);

// ─── Matches & chat ───────────────────────────────────────────────────────────
export const matchApi = {
  mine: (params) => api.get('/matches/mine', { params }),
  forItem: (type, itemId) => api.get(`/matches/item/${type}/${itemId}`),
  getById: (matchId) => api.get(`/matches/${matchId}`),
  respond: (matchId, response) => api.patch(`/matches/${matchId}/respond`, { response }),
  messages: (matchId) => api.get(`/matches/${matchId}/messages`),
  send: (matchId, body) => api.post(`/matches/${matchId}/messages`, { body }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifApi = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.patch('/notifications/read', { ids }),
};

// ─── Recovery ─────────────────────────────────────────────────────────────────
export const recoveryApi = {
  create: (formData) => api.post('/recovery', formData, multipart),
  mine: () => api.get('/recovery/mine'),
  getById: (id) => api.get(`/recovery/${id}`),
  review: (id, data) => api.patch(`/recovery/${id}/review`, data),
  complete: (id, code) => api.post(`/recovery/${id}/complete`, { code }),
  cancel: (id) => api.post(`/recovery/${id}/cancel`),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  status: () => api.get('/ai/status'),
  analyze: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/ai/analyze', fd, { ...multipart, timeout: 90000 });
  },
};

// ─── FindIt coins ─────────────────────────────────────────────────────────────
export const coinApi = {
  me: () => api.get('/coins/me'),
  leaderboard: () => api.get('/coins/leaderboard'),
};

// ─── Public ───────────────────────────────────────────────────────────────────
export const publicApi = {
  meta: () => api.get('/meta'),
  stats: () => api.get('/stats/public'),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/admin/stats', { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
  getPending: () => api.get('/admin/pending'),
  moderate: (itemType, itemId, data) => api.patch(`/admin/moderate/${itemType}/${itemId}`, data),
  getRecoveries: (status) => api.get('/admin/recoveries', { params: { status } }),
  getUsers: () => api.get('/admin/users'),
  toggleUser: (userId) => api.patch(`/admin/users/${userId}/toggle`),
  backfillAI: () => api.post('/admin/ai/backfill'),
};

export default api;
