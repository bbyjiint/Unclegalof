import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { api, auth } from "../lib/api";
import type { AuthUser } from "../types";

type LoginInput = {
  username: string;
  password: string;
};

type SignupInput = {
  fullName: string;
  username: string;
  password: string;
  phone?: string;
  role: "OWNER" | "SALES";
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => auth.getUser());
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((token: string, nextUser: AuthUser) => {
    auth.setToken(token);
    auth.setUser(nextUser);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    api.clearAuthToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = auth.getToken();

    if (!token) {
      clearSession();
      return;
    }

    try {
      const response = await api.me();
      auth.setUser(response.user);
      setUser(response.user);
    } catch {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    void (async () => {
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.login(input);
    persistSession(response.token, response.user);
    return response.user;
  }, [persistSession]);

  const signup = useCallback(async (input: SignupInput) => {
    const response = await api.register(input);
    persistSession(response.token, response.user);
    return response.user;
  }, [persistSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    signup,
    logout,
    refreshUser,
  }), [user, loading, login, signup, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
