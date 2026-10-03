import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../services/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => { setToken(null); setUser(null); window.location.hash = '#/login'; }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, [logout]);

  const finish = (r) => { setToken(r.token); setUser(r.user); window.location.hash = '#/dashboard'; };
  const login = async (email, password) => finish(await api.login(email, password));
  const register = async (name, email, password) => finish(await api.register(name, email, password));

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
