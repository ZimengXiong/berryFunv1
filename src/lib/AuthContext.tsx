import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  // Only query currentUser when authenticated
  const currentUser = useQuery(
    api.users.currentUser,
    isAuthenticated ? {} : "skip"
  );

  const handleSignIn = async (provider: "google") => {
    await signIn(provider, { redirectTo: "/" });
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

  // isLoading should be true until both auth state AND user data are resolved
  const isUserLoading = isLoading || (isAuthenticated && currentUser === undefined);

  const value: AuthContextType = {
    user,
    userId: currentUser?.id ?? null,
    isLoading: isUserLoading,
    isAuthenticated,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
