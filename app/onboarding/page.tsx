"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import OnboardingHero from "@/components/onboarding/OnboardingHero";
import ProfileSetupForm from "@/components/onboarding/ProfileSetupForm";
import SocialConnectPreview from "@/components/onboarding/SocialConnectPreview";
import SocialConnectStep from "@/components/onboarding/SocialConnectStep";
import apiClient from "@/lib/apiClient";
import { Wallet, Loader2 } from "lucide-react";
import { connectWallet, signAuthMessage } from "@/lib/bnbWallet";

// ─── Inner component (uses useSearchParams — must be inside Suspense) ─────────

function OnboardingInner() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Present when the user arrived from the wallet connect flow
  const walletAddress = searchParams.get("wallet");
  // Show the wallet registration form only when ?wallet= is set AND there's no session yet
  const isWalletSignup = !!walletAddress && !user;

  const [loading, setLoading] = useState(false);

  // Normal onboarding state (used after a session exists)
  const [username, setUsername] = useState(user?.profile?.username ?? "");
  const [niche, setNiche] = useState(user?.profile?.niche ?? "");

  // Wallet signup form state
  const [walletError, setWalletError] = useState("");

  const step = !user?.onboardingStep || user.onboardingStep === 1 ? 1 : 2;

  // ── Wallet signup: anonymous — no fullName needed, goes straight to dashboard ──

  const handleWalletSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError("");
    setLoading(true);

    try {
      // 0. Ensure we have a live address from the wallet
      let signupAddress = walletAddress?.trim() ?? "";
      try {
        const { getConnectedAddress } = await import("@/lib/bnbWallet");
        const live = await getConnectedAddress();
        if (live) signupAddress = live;
      } catch {
        // fall back to URL param
      }

      if (!signupAddress) {
        throw new Error("No wallet address found. Please connect your wallet.");
      }

      // 1. Get BNB challenge from backend
      const challengeRes = await apiClient.get("/auth/bnb/challenge", {
        params: { bnbAddress: signupAddress },
      });
      // Backend returns { challenge, message, expiresIn }
      // - challenge: the full string to sign (contains the nonce inline)
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

      // 2. Sign the full challenge string
      const signature = await signAuthMessage(challenge, signupAddress);

      // 3. Create the account
      const { data: signupRes } = await apiClient.post("/auth/bnb/login", {
        bnbAddress: signupAddress,
        nonce,
        signature,
      });

      const newUser = signupRes.user || signupRes;
      if (!newUser || !newUser.id) {
        throw new Error("Signup successful but user data is missing.");
      }

      // Wallet accounts go straight to dashboard.
      // Pass the destination to setUser so AuthProvider navigates after
      // state commits — no race condition, no hard refresh needed.
      const destination = signupRes.redirect ?? "/dashboard";
      setUser(newUser, destination);
    } catch (err: any) {
      console.error("BNB wallet onboarding error:", err);
      const backendMessage = err.response?.data?.message || err.response?.data?.error;
      const message = backendMessage || err.message || "Registration failed";
      setWalletError(Array.isArray(message) ? message[0] : message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: save username ──────────────────────────────────────────────────

  const completeStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await apiClient.patch("/users/me", { username });
      setUser({
        ...data,
        onboardingStep: 2,
        profile: { ...data.profile, username, niche },
      });
    } catch {
      setUser({
        ...user,
        onboardingStep: 2,
        profile: { ...user.profile, username, niche },
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: social connect / finish ───────────────────────────────────────

  const completeStep2 = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setUser({ ...user, onboardingStep: 3 }, "/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden bg-[#080C0B]">
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.07] rounded-full blur-[120px] pointer-events-none translate-x-1/3" />

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex items-center z-10 relative">

        {/* ── A: Wallet signup — no session yet ─────────────────────────── */}
        {isWalletSignup && (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-16 lg:gap-8 mt-[-20px]">
            <OnboardingHero />

            <div className="w-full max-w-[440px] bg-[#0E1512]/80 backdrop-blur-md rounded-[20px] p-[38px] border border-[#1E2A24] shadow-[0_4px_40px_rgba(0,0,0,0.5)]">
              {/* Wallet badge */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <p className="text-white font-bold text-[15px] leading-tight">Wallet connected</p>
                  <p className="text-[#5A6F65] text-[12px] font-mono">
                    {walletAddress!.slice(0, 8)}…{walletAddress!.slice(-6)}
                  </p>
                </div>
              </div>

              <h2 className="text-[22px] text-white font-bold tracking-tight mb-1">
                Create your account
              </h2>
              <p className="text-[#8e9895] text-[14px] mb-8">
                Your wallet is connected. Click below to create your anonymous account — no personal info required.
              </p>

              <form onSubmit={handleWalletSignup} className="space-y-4">
                {walletError && (
                  <p className="text-red-400 text-[13px] text-center">{walletError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all disabled:opacity-70 mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : "Create Account & Go to Dashboard"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full text-center text-[13px] text-[#5A6F65] hover:text-white transition-colors"
                >
                  ← Back to login
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── B: Step 1 — profile setup (username + niche) ──────────────── */}
        {!isWalletSignup && step === 1 && (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-16 lg:gap-8 mt-[-20px]">
            <OnboardingHero />
            <div className="w-full max-w-[440px] flex flex-col gap-6">
              <ProfileSetupForm
                username={username}
                setUsername={setUsername}
                niche={niche}
                setNiche={setNiche}
                loading={loading}
                onSubmit={completeStep1}
              />
              <SocialConnectPreview />
            </div>
          </div>
        )}

        {/* ── C: Step 2 — social connections ────────────────────────────── */}
        {!isWalletSignup && step === 2 && (
          <SocialConnectStep onComplete={completeStep2} />
        )}

      </main>
    </div>
  );
}

// ─── Page export (Suspense required for useSearchParams) ──────────────────────

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
