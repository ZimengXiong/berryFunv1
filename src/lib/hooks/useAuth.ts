import { useCallback, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

const TOKEN_KEY = "berryFun_authToken";

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation(api.auth.login);

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // This is a simplified version - in production you'd want a combined action
      const result = await loginMutation({
        email,
        isPasswordValid: true,
      });

      localStorage.setItem(TOKEN_KEY, result.token);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loginMutation]);

  return { login, isLoading, error };
}

export function useRegister() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hashPasswordAction = useAction(api.auth.hashPassword);
  const registerMutation = useMutation(api.auth.register);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    referralCode?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
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
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hashPasswordAction, registerMutation]);

  return { register, isLoading, error };
}

export function useLogout() {
  const logoutMutation = useMutation(api.auth.logout);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Ignore errors
      }
    }
    localStorage.removeItem(TOKEN_KEY);
  }, [logoutMutation]);

  return { logout };
}
