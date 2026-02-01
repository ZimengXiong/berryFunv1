import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

interface User {
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  isReturning: boolean;
  siblingGroupId?: string;
  referralCode?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

interface AuthContextType {
  user: User | null;
  userId: string | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referralCode?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "berryFun_authToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);

  const sessionData = useQuery(
    api.auth.validateSession,
    token ? { token } : "skip"
  );

  const hashPasswordAction = useAction(api.auth.hashPassword);
  const registerMutation = useMutation(api.auth.register);
  const loginAction = useAction(api.auth.loginWithPassword);
  const logoutMutation = useMutation(api.auth.logout);

  useEffect(() => {
    if (token && sessionData === null) {
      // Session invalid, clear token
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
    setIsLoading(false);
  }, [token, sessionData]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginAction({
      email,
      password,
    });

    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
  }, [loginAction]);

  const register = useCallback(async (data: RegisterData) => {
    const passwordHash = await hashPasswordAction({ password: data.password });

    const result = await registerMutation({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      referralCode: data.referralCode,
    });

    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
  }, [registerMutation, hashPasswordAction]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Ignore errors on logout
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, [token, logoutMutation]);

  const value: AuthContextType = {
    user: sessionData?.user ?? null,
    userId: sessionData?.userId ?? null,
    token,
    isLoading,
    isAuthenticated: !!sessionData?.user,
    isAdmin: sessionData?.user?.role === "admin",
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
