"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/shared/DashboardLayout";
import SectionHeader from "@/components/platforms/SectionHeader";
import PlatformCard from "@/components/platforms/PlatformCard";
import HelpBanner from "@/components/platforms/HelpBanner";
import PlatformsFooter from "@/components/platforms/PlatformsFooter";
import { disconnectPlatform } from "@/lib/queries";
import apiClient from "@/lib/apiClient";
import { 
  InstagramIcon, 
  TikTokIcon, 
  YoutubeIcon, 
  TwitterIcon,
} from "@/components/shared/Icons";
import { 
  Share2, 
  Wallet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import WalletButton from "@/components/shared/WalletButton";

type ToastState = { type: "success" | "error"; message: string } | null;

export default function PlatformsContent() {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const { address, disconnect } = useWallet();
  const searchParams = useSearchParams();

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await apiClient.get('/platforms');
        // Backend returns { success, connected, platforms: string[], accountCount }
        setConnectedPlatforms(response.data.platforms || []);
      } catch (error) {
        console.error("Failed to fetch platforms:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlatforms();
  }, []);

  // Show feedback after OAuth callback redirect
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      showToast("success", "Platform connected successfully!");
    } else if (searchParams.get("error") === "true") {
      showToast("error", "Failed to connect platform. Please try again.");
    }
  }, [searchParams, showToast]);

  // Normalised comparison: "TikTok" → "tiktok", "X / Twitter" → "x"
  const isConnected = (name: string) => {
    const key = name.toLowerCase().split(" / ")[0].replace(/\s+/g, "");
    return connectedPlatforms.some(p => p.toLowerCase() === key);
  };

  const handleDisconnected = async (platformKey: string) => {
    try {
      await disconnectPlatform(platformKey);
      // Backend stores platforms in uppercase (e.g. "TIKTOK") — filter both ways
      setConnectedPlatforms(prev =>
        prev.filter(p => p.toLowerCase() !== platformKey.toLowerCase())
      );
      showToast("success", `${platformKey.charAt(0).toUpperCase() + platformKey.slice(1)} disconnected.`);
    } catch (error) {
      console.error("Failed to disconnect platform:", error);
      showToast("error", "Failed to disconnect platform. Please try again.");
    }
  };

  return (
    <DashboardLayout showHeader={false}>
      {/* In-app toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-right-5 fade-in duration-300 ${
          toast.type === "success"
            ? "bg-brand/10 border-brand/30 text-brand"
            : "bg-red-400/10 border-red-400/30 text-red-400"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="text-[13px] font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Top Navigation Bar removed */}

      <div className="px-4 sm:px-6 lg:px-10 py-12 space-y-16 max-w-[1400px] mx-auto w-full">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-[44px] sm:text-[56px] font-black tracking-tight text-white leading-tight">
            Connect <span className="text-brand">Accounts</span>
          </h1>
          <p className="text-[#5A6F65] text-[16px] sm:text-[18px] max-w-2xl font-medium leading-relaxed">Link your social media and Web3 wallets to start generating AI-powered clips and earning rewards automatically.</p>
        </div>

        {/* Social Platforms */}
        <section>
          <SectionHeader 
            title="Social Platforms" 
            icon={Share2} 
            label={`${connectedPlatforms.length} CONNECTED`} 
          />
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <PlatformCard 
                name="TikTok" 
                description="Manage your main TikTok video feed"
                icon={TikTokIcon} 
                status={isConnected("TikTok") ? "ACTIVE" : "NOT LINKED"} 
                ctaText="Connect Account"
                variant="vertical"
                onDisconnected={handleDisconnected}
              />
              <PlatformCard 
                name="Instagram" 
                description="Connect to sync Reels"
                icon={InstagramIcon} 
                status={isConnected("Instagram") ? "ACTIVE" : "NOT LINKED"} 
                ctaText="Connect Account"
                variant="vertical"
                onDisconnected={handleDisconnected}
              />
              <PlatformCard 
                name="YouTube" 
                description="Import and sync your long-form YouTube content"
                icon={YoutubeIcon} 
                status={isConnected("YouTube") ? "ACTIVE" : "NOT LINKED"} 
                ctaText="Connect Account"
                variant="vertical"
                onDisconnected={handleDisconnected}
              />
              <PlatformCard 
                name="X / Twitter" 
                description="Auto-post clips to X"
                icon={TwitterIcon} 
                status={isConnected("X / Twitter") ? "ACTIVE" : "NOT LINKED"} 
                ctaText="Connect Account"
                variant="vertical"
                onDisconnected={handleDisconnected}
              />
            </div>
          )}
        </section>

        {/* Web3 Wallets */}
        <section>
          <SectionHeader 
            title="Web3 Wallets" 
            icon={Wallet} 
            label={address ? "1 CONNECTED" : "REWARDS DESTINATION"}
          />
          <div className="bg-[#111111]/40 backdrop-blur-md border border-white/[0.03] rounded-[24px] p-6 flex items-center justify-between group hover:border-brand/20 transition-all duration-300 relative overflow-hidden">
            {/* subtle glow when connected */}
            {address && (
              <div className="absolute inset-0 bg-brand/[0.03] pointer-events-none" />
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-brand" />
              </div>
              <div>
                <p className="font-bold text-white text-[15px]">BNB Wallet</p>
                {address ? (
                  <p className="text-xs text-brand font-mono mt-0.5">
                    {address.slice(0, 8)}…{address.slice(-6)}
                  </p>
                ) : (
                  <p className="text-xs text-[#5A6F65] mt-0.5">MetaMask · Binance Wallet · Trust Wallet</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {address ? (
                <>
                  <div className="flex items-center gap-1.5 text-brand text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    CONNECTED
                  </div>
                  <button
                    onClick={disconnect}
                    className="text-xs text-[#5A6F65] hover:text-red-400 transition-colors font-medium border border-white/5 hover:border-red-400/30 px-3 py-1.5 rounded-xl"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <WalletButton className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 transition-all font-bold text-sm disabled:opacity-60" />
              )}
            </div>
          </div>
        </section>

        {/* Help Banner */}
        <HelpBanner />

        {/* Footer */}
        <PlatformsFooter />
      </div>
    </DashboardLayout>
  );
}
