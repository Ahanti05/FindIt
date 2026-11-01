import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('findit_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('findit_token');
    if (!token) { setLoading(false); return; }

    authApi.getMe()
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('findit_token');
        localStorage.removeItem('findit_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for global logout events (from interceptor)
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('findit_token', data.token);
    localStorage.setItem('findit_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (formData) => {
    const { data } = await authApi.register(formData);
    localStorage.setItem('findit_token', data.token);
    localStorage.setItem('findit_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('findit_token');
    localStorage.removeItem('findit_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('findit_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
