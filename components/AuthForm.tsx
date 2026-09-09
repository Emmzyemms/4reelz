"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { z } from "zod";
import apiClient from "@/lib/apiClient";
import WalletButton from "@/components/shared/WalletButton";

// ─── Validation ───────────────────────────────────────────────────────────────

const emailAuthSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters").optional(),
});

// ─── Icons ────────────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.26.68 3.01.68.75 0 1.95-.79 3.38-.68 1.48.06 2.62.66 3.32 1.65-2.85 1.76-2.38 5.48.51 6.64-.67 1.75-1.53 3.5-2.22 4.68zm-5.28-14.8c-.1-1.55 1.25-3.05 2.81-3.23.23 1.66-1.28 3.16-2.81 3.23z"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

interface AuthFormProps {
  mode?: "login" | "signup";
}

export default function AuthForm({ mode = "login" }: AuthFormProps) {
  const { setUser } = useAuth();

  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const shakeCard = () => {
    const card = document.getElementById("auth-card");
    if (card) {
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
    }
  };

  // ── BNB wallet connect handler ────────────────────────────────────────────

  /**
   * Fired by WalletButton once the user connects their BNB wallet.
   *
   * Flow:
   *   1. GET /auth/bnb/challenge  → { nonce, message }
   *   2. Sign message via MetaMask (personal_sign)
   *   3. POST /auth/bnb/login { bnbAddress, nonce, signature }
   *      → creates account if none exists (login-or-signup)
   */
  const handleWalletConnect = async (address: string) => {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      // 1. Get challenge
      setInfo("Generating challenge…");
      const challengeRes = await apiClient.get("/auth/bnb/challenge", {
        params: { bnbAddress: address },
      });
      // Backend returns { challenge, message, expiresIn }
      // - challenge: the full string to sign (contains the nonce inline)
      // - message: human-readable label ("Sign this challenge…")
      const { challenge } = challengeRes.data;

      if (!challenge) {
        throw new Error("Failed to get a valid challenge from the server.");
      }

      // Extract nonce from challenge string:
      // "ClipsCash BNB auth nonce: <uuid>\nbnbAddress: ...\n..."
      const nonceMatch = challenge.match(/nonce:\s*(\S+)/i);
      const nonce = nonceMatch?.[1] ?? null;
      if (!nonce) {
        throw new Error("Could not parse nonce from challenge. Please try again.");
      }

      // 2. Sign the full challenge string with MetaMask
      setInfo("Please sign the message in your wallet…");
      const { signAuthMessage } = await import("@/lib/bnbWallet");
      const signature = await signAuthMessage(challenge, address);

      // 3. Login or signup
      setInfo("Authenticating…");
      const loginRes = await apiClient.post("/auth/bnb/login", {
        bnbAddress: address,
        nonce,
        signature,
      });

      // Re-fetch /users/me to confirm the session cookie is readable before
      // navigating. Email login does the same thing — without this the guard
      // in AuthProvider can see user=null on the dashboard route and bounce
      // back to /login before the cookie propagates.
      setInfo("Loading your account…");
      const { data: user } = await apiClient.get("/users/me");

      // Push to destination — AuthProvider's effect handles the actual
      // router.push *after* user state commits, so no race condition.
      const destination = loginRes.data.redirect ?? "/dashboard";
      setUser(user, destination);
    } catch (err: any) {
      console.error("BNB wallet auth error:", err);
      const backendMessage =
        err.response?.data?.message || err.response?.data?.error;
      let message = backendMessage || err.message || "Wallet authentication failed";
      if (Array.isArray(message)) message = message[0];
      if (err.response?.status === 409) {
        message =
          "This wallet is already registered with a different account.";
      }
      setError(message);
      setInfo("");
      shakeCard();
    } finally {
      setLoading(false);
    }
  };

  // ── Email / password submit ───────────────────────────────────────────────

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const validationResult = emailAuthSchema.safeParse({
        email,
        password,
        fullName: currentMode === "signup" ? fullName : undefined,
      });

      if (!validationResult.success) {
        throw new Error(validationResult.error.issues[0].message);
      }

      if (currentMode === "login") {
        await apiClient.post("/auths/login", { email, password });
      } else {
        await apiClient.post("/auths/signup", { fullName, email, password });
      }

      const { data: user } = await apiClient.get("/users/me");

      if (currentMode === "login") {
        setUser(user, "/dashboard");
      } else {
        setUser(user, "/onboarding");
      }
    } catch (err: any) {
      if (err.response?.status === 400) {
        console.error("Auth validation error:", err.response.data);
      }
      let message =
        err.response?.data?.message || err.message || "An error occurred";
      if (Array.isArray(message)) message = message[0];
      if (err.response?.status === 409) {
        message =
          "This email is already registered. Try logging in instead.";
      }
      setError(message);
      shakeCard();
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      id="auth-card"
      className="w-[440px] bg-[#0E1512]/80 backdrop-blur-md rounded-[20px] p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.5)] border border-[#1E2A24] relative overflow-hidden"
    >
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-brand/10 rounded-full blur-[60px] pointer-events-none" />

      <h2 className="text-[28px] text-white font-bold tracking-tight mb-1">
        {currentMode === "login" ? "Welcome back" : "Create an account"}
      </h2>
      <p className="text-[#8e9895] mb-8 text-[15px]">
        {currentMode === "login"
          ? "Log in to start creating viral content"
          : "Sign up to start creating viral content"}
      </p>

      <div className="space-y-[14px] mb-8">
        <div className="relative group">
          <button
            type="button"
            onClick={() => {
              window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auths/google`;
            }}
            className="w-full flex items-center justify-center gap-3 bg-[#17201C] hover:bg-[#1E2B24] border border-[#233129] hover:border-brand/30 text-white py-3.5 rounded-[12px] font-medium transition-all text-[14px] active:scale-[0.98]"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        {/* BNB Wallet connect */}
        <WalletButton
          onConnect={handleWalletConnect}
          className="w-full flex items-center justify-center gap-3 bg-[#17201C] hover:bg-[#1E2B24] border border-[#233129] hover:border-brand/30 text-white py-3.5 rounded-[12px] font-medium transition-all text-[14px] active:scale-[0.98] disabled:opacity-60"
          showAddress={false}
        />

        {info && (
          <p className="text-brand text-[12px] text-center animate-pulse font-medium">
            {info}
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-[1px] bg-[#1E2A24]" />
          <span className="text-[#3A4A43] text-[12px] font-medium">or</span>
          <div className="flex-1 h-[1px] bg-[#1E2A24]" />
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        {currentMode === "signup" && (
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-[#111A16] border border-[#1E2A24] text-white placeholder-[#3A4A43] rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:border-brand/50 transition-colors"
          />
        )}
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#111A16] border border-[#1E2A24] text-white placeholder-[#3A4A43] rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:border-brand/50 transition-colors"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#111A16] border border-[#1E2A24] text-white placeholder-[#3A4A43] rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:border-brand/50 transition-colors"
        />

        {error && (
          <p className="text-red-400 text-[13px] text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all disabled:opacity-70 mt-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-black" />
          ) : currentMode === "login" ? (
            "Sign In"
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-[#5A6F65] mt-6">
        {currentMode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => { setCurrentMode("signup"); setError(""); }}
              className="text-brand hover:underline font-medium"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => { setCurrentMode("login"); setError(""); }}
              className="text-brand hover:underline font-medium"
            >
              Log in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
