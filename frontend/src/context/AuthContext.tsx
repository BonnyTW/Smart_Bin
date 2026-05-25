import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, getRegistrationStatus, setAuthToken, clearAuthToken } from '../api';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  registrationOpen: boolean;
  refreshRegistrationStatus: () => Promise<void>;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('smartbin_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  const refreshRegistrationStatus = async () => {
    try {
      const status = await getRegistrationStatus();
      setRegistrationOpen(status.open);
    } catch {
      setRegistrationOpen(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await refreshRegistrationStatus();
      const stored = localStorage.getItem('smartbin_token');
      if (!stored) {
        setIsLoading(false);
        return;
      }
      setAuthToken(stored);
      try {
        const me = await getMe();
        setUser(me);
        setToken(stored);
      } catch {
        clearAuthToken();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('smartbin_token', newToken);
    setAuthToken(newToken);
    setToken(newToken);
    getMe().then(setUser).catch(() => logout());
    refreshRegistrationStatus();
  };

  const logout = () => {
    clearAuthToken();
    localStorage.removeItem('smartbin_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        registrationOpen,
        refreshRegistrationStatus,
        login,
        logout,
      }}
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
