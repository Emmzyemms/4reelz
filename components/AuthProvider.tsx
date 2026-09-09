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
  /**
   * Call after login/signup.
   * - Pass `redirectTo` to have AuthProvider navigate *after* the user state
   *   has committed (avoids the race where the guard sees null+protected-path).
   * - Pass neither to let the guard handle routing automatically.
   */
  setUser: (user: User | null, redirectTo?: string | false) => void;
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
  // Pending destination set by setUser — AuthProvider pushes after state commits.
  const pendingRedirectRef = useRef<string | null>(null);
  // Set to true when a post-login navigation is in flight.
  // Prevents the guard from seeing user=null on the new route (while the
  // session cookie fetch is still in progress) and bouncing back to /login.
  const isNavigatingRef = useRef(false);
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

  // Navigation guard — runs whenever auth state or route changes.
  useEffect(() => {
    if (isLoading) return;

    // If setUser was called with an explicit destination, honour that and
    // clear the pending redirect so we don't loop.
    if (pendingRedirectRef.current !== null) {
      const dest = pendingRedirectRef.current;
      pendingRedirectRef.current = null;
      // "__suppress__" means caller wants no navigation at all
      if (dest !== "__suppress__") {
        router.push(dest);
      }
      return;
    }

    // If a post-login navigation is in flight and the user state hasn't
    // committed yet, don't redirect back to /login. The fetchUser on the
    // new route will resolve the user and clear this flag.
    if (isNavigatingRef.current) {
      if (user) {
        // User confirmed — safe to clear the in-flight flag
        isNavigatingRef.current = false;
      } else {
        // Still waiting for session to resolve — hold off
        return;
      }
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
   * setUser — called by login/signup handlers.
   *
   * @param newUser  The authenticated user (or null on logout).
   * @param redirectTo
   *   - A path string (e.g. "/dashboard"): AuthProvider will push to that path
   *     *after* the user state has committed, eliminating the race condition.
   *   - `false`: suppress all automatic navigation (caller handles it).
   *   - Omitted / undefined: let the navigation guard decide automatically.
   */
  const setUser = (newUser: User | null, redirectTo?: string | false) => {
    if (typeof redirectTo === "string") {
      // Store destination — the useEffect above will push once state commits.
      pendingRedirectRef.current = redirectTo;
      // Mark a navigation as in-flight so the guard doesn't redirect to /login
      // while the session cookie is still propagating on the destination route.
      isNavigatingRef.current = true;
    } else if (redirectTo === false) {
      // Caller is handling navigation; suppress the guard for this render.
      pendingRedirectRef.current = "__suppress__";
    }
    setUserState(newUser);
  };

  const logout = async () => {
    try {
      await apiClient.post("/auths/logout");
    } catch {
      // ignore
    } finally {
      try {
        await disconnectWallet();
      } catch {
        // ignore
      }
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
