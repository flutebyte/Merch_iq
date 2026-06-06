import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('inv_token') || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inv_user')); } catch { return null; }
  });

  const login = useCallback((tokenValue, userData, brandData) => {
    localStorage.setItem('inv_token', tokenValue);
    localStorage.setItem('inv_user', JSON.stringify(userData));
    if (brandData) localStorage.setItem('inv_brand', JSON.stringify(brandData));
    setToken(tokenValue);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('inv_token');
    localStorage.removeItem('inv_user');
    localStorage.removeItem('inv_brand');
    localStorage.removeItem('inv_appStage');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
