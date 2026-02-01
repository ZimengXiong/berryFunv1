import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "../../convex/_generated/api";

interface User {
  id: string;
  email?: string;
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
  image?: string;
}

interface AuthContextType {
  user: User | null;
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (provider: "google") => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const { signIn, signOut } = useAuthActions();
  const currentUser = useQuery(api.users.currentUser);

  const handleSignIn = async (provider: "google") => {
    await signIn(provider);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const user: User | null = currentUser ? {
    id: currentUser.id,
    email: currentUser.email ?? undefined,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    role: currentUser.role as "user" | "admin",
    isReturning: currentUser.isReturning,
    siblingGroupId: currentUser.siblingGroupId,
    referralCode: currentUser.referralCode,
    phone: currentUser.phone,
    address: currentUser.address,
    image: currentUser.image,
  } : null;

  const value: AuthContextType = {
    user,
    userId: currentUser?.id ?? null,
    isLoading: false,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === "admin",
    signIn: handleSignIn,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthProviderLoading({ children }: { children: ReactNode }) {
  const { signIn, signOut } = useAuthActions();

  const handleSignIn = async (provider: "google") => {
    await signIn(provider);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const value: AuthContextType = {
    user: null,
    userId: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthProviderUnauthenticated({ children }: { children: ReactNode }) {
  const { signIn, signOut } = useAuthActions();

  const handleSignIn = async (provider: "google") => {
    await signIn(provider);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const value: AuthContextType = {
    user: null,
    userId: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <AuthProviderLoading>{children}</AuthProviderLoading>
      </AuthLoading>
      <Unauthenticated>
        <AuthProviderUnauthenticated>{children}</AuthProviderUnauthenticated>
      </Unauthenticated>
      <Authenticated>
        <AuthProviderInner>{children}</AuthProviderInner>
      </Authenticated>
    </>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
