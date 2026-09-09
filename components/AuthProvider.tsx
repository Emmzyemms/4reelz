"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  Suspense,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { disconnectWallet } from "@/lib/bnbWallet";

export interface User {
  id: string;
  email?: string;
  bnbAddress?: string;
  fullName: string;
  username?: string;
  picture?: string;
  onboardingStep: number;
  profile: {
    username?: string;
    niche?: string;
    socialsConnected?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  /** Call setUser after login/signup. Pass skipRedirect=true when you are
   *  handling navigation yourself (e.g. new signup → /onboarding). */
  setUser: (user: User | null, skipRedirect?: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // When AuthForm handles routing itself (e.g. new signup → /onboarding),
  // it passes skipRedirect=true so this effect doesn't fight it.
  const skipRedirectRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initial session check on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiClient.get("/users/me");
        setUserState(response.data);
      } catch (error: any) {
        const status = error.response?.status;
        if (status !== 401 && status !== 503) {
          console.error("Auth check failed:", error);
        }
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Navigation guard — runs whenever auth state or route changes
  useEffect(() => {
    if (isLoading) return;

    // If AuthForm explicitly handled routing, skip this effect once
    if (skipRedirectRef.current) {
      skipRedirectRef.current = false;
      return;
    }

    const guestPaths = ["/login", "/signup", "/"];
    const isGuestPath = guestPaths.includes(pathname);

    // Wallet signup: unauthenticated user at /onboarding?wallet= — allow through
    const isWalletOnboarding =
      pathname.startsWith("/onboarding") && !!searchParams.get("wallet");

    if (user) {
      // Logged-in user on a guest page → send to dashboard
      if (isGuestPath) {
        router.push("/dashboard");
      }
      // All other paths (including /onboarding): leave the user where they are
    } else {
      const protectedPaths = [
        "/dashboard",
        "/projects",
        "/ai-projects",
        "/agent-marketplace",
        "/my-projects",
        "/clips",
        "/platforms",
        "/onboarding",
        "/settings",
      ];
      const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
      if (isProtected && !isWalletOnboarding) {
        router.push("/login");
      }
    }
  }, [user, isLoading, pathname, searchParams, router]);

  /**
   * setUser — called by AuthForm after login or signup.
   * Pass skipRedirect=true when you are handling navigation yourself
   * (e.g. new signup → router.push("/onboarding")).
   */
  const setUser = (newUser: User | null, skipRedirect = false) => {
    if (skipRedirect) {
      skipRedirectRef.current = true;
    }
    setUserState(newUser);
  };

  const logout = async () => {
    try {
      await apiClient.post("/auths/logout");
    } catch {
      // ignore
    } finally {
      // Disconnect wallet so the address is cleared from localStorage.
      // This is a no-op if no wallet was connected (email users).
      try {
        await disconnectWallet();
      } catch {
        // ignore
      }
      // Clear the BNB wallet address from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("clipcash_bnb_address");
      }
      setUserState(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </Suspense>
  );
}
