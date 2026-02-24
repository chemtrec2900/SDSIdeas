import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, setToken } from '../services/api';

interface User {
  id: string;
  email: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
  accountName?: string;
  accountNumber?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithMicrosoft: () => void;
  loginWithToken: (token: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    if (res.token) {
      setToken(res.token);
      setUser(res.user);
    } else {
      const u = await api.auth.me();
      setUser(u);
    }
  };

  const loginWithMicrosoft = () => {
    window.location.assign(api.auth.microsoftStartUrl());
  };

  const loginWithToken = async (token: string) => {
    setToken(token);
    const u = await api.auth.me();
    setUser(u);
  };

  const register = async (email: string, password: string) => {
    const res = await api.auth.register(email, password);
    if (res.token) {
      setToken(res.token);
      setUser(res.user);
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setToken(null);
    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    await api.auth.forgotPassword(email);
  };

  const resetPassword = async (token: string, password: string) => {
    await api.auth.resetPassword(token, password);
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginWithMicrosoft, loginWithToken, register, logout, forgotPassword, resetPassword, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
