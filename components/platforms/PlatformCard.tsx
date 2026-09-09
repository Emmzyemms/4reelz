"use client";

import React, { useState } from "react";
import { LucideIcon, CheckCircle2, Settings, Loader2, Unlink } from "lucide-react";
import apiClient from "@/lib/apiClient";

interface PlatformCardProps {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | LucideIcon;
  status: "ACTIVE" | "NOT LINKED" | "LINKED";
  ctaText: string;
  username?: string;
  variant?: "vertical" | "horizontal";
  onDisconnected?: (platformKey: string) => void;
}

export default function PlatformCard({ name, description, icon: Icon, status, ctaText, username, variant = "vertical", onDisconnected }: PlatformCardProps) {
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const isActive = status === "ACTIVE" || status === "LINKED";

  // Normalised platform key: "X / Twitter" → "x", "TikTok" → "tiktok"
  const platformKey = name.toLowerCase().split(" / ")[0].replace(/\s+/g, "");

  const handleConnect = async () => {
    if (isActive) return;
    setLoading(true);
    setConnectError(null);
    try {
      const response = await apiClient.get(`/platforms/connect/${platformKey}`);
      const { url } = response.data;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setConnectError("No redirect URL returned. Please try again.");
        console.error(`[PlatformCard] /platforms/connect/${platformKey} returned no URL:`, response.data);
      }
    } catch (error: any) {
      const httpStatus = error?.response?.status;
      // Surface the actual backend message so it's visible in dev
      const backendMessage = error?.response?.data?.message
        ?? error?.response?.data?.error
        ?? null;
      console.error(
        `[PlatformCard] GET /platforms/connect/${platformKey} → ${httpStatus ?? "network error"}`,
        backendMessage ?? error
      );
      if (httpStatus === 401) {
        setConnectError("You need to be logged in to connect a platform.");
      } else if (httpStatus === 400) {
        setConnectError(backendMessage ?? "This platform is not supported yet.");
      } else if (httpStatus === 500) {
        setConnectError(
          backendMessage
            ? `Server error: ${backendMessage}`
            : "Server error connecting to platform. Please try again later."
        );
      } else if (!httpStatus) {
        setConnectError("Network error — could not reach the server.");
      } else {
        setConnectError(backendMessage ?? "Failed to connect. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setDisconnecting(true);
    setConfirmDisconnect(false);
    setConnectError(null);
    try {
      // Backend is case-insensitive but docs show uppercase — send uppercase to be safe
      const response = await apiClient.delete(`/platforms/${platformKey.toUpperCase()}`);
      console.log(`[PlatformCard] DELETE /platforms/${platformKey.toUpperCase()} →`, response.status, response.data);
      onDisconnected?.(platformKey);
    } catch (error: any) {
      const httpStatus = error?.response?.status;
      const backendMessage = error?.response?.data?.message ?? error?.response?.data?.error ?? null;
      console.error(`[PlatformCard] DELETE /platforms/${platformKey.toUpperCase()} → ${httpStatus}`, backendMessage ?? error);
      if (httpStatus === 404) {
        // Backend says not found — it's already disconnected, treat as success
        onDisconnected?.(platformKey);
      } else {
        setConnectError(backendMessage ?? "Failed to disconnect. Please try again.");
      }
    } finally {
      setDisconnecting(false);
    }
  };

  if (variant === "horizontal") {
    return (
      <div className="flex flex-col gap-2">
        <div className="bg-[#111111]/40 backdrop-blur-md border border-white/[0.03] rounded-[24px] p-6 flex items-center justify-between group hover:border-brand/20 transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-white/5 flex items-center justify-center text-[#5A6F65] group-hover:text-brand transition-colors">
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h4 className="text-[17px] font-bold text-white tracking-tight">{name}</h4>
              <p className="text-[13px] text-[#5A6F65] font-medium">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isActive ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {status}
                </div>
                {username && (
                  <div className="text-[13px] font-mono text-[#3A4A43] bg-white/[0.02] px-2 py-0.5 rounded-lg border border-white/[0.03]">
                    {username}
                  </div>
                )}
                {confirmDisconnect ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-400 font-medium">Disconnect?</span>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDisconnect(false)}
                      className="px-3 py-1 rounded-lg border border-white/10 text-[#5A6F65] text-[11px] font-bold hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center gap-1.5 text-[11px] text-[#5A6F65] hover:text-red-400 transition-colors font-medium border border-white/5 hover:border-red-400/30 px-3 py-1.5 rounded-xl disabled:opacity-50"
                  >
                    <Unlink className="w-3 h-3" />
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl border border-white/10 text-white font-bold text-[13px] hover:bg-white/[0.05] transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : ctaText}
              </button>
            )}
          </div>
        </div>
        {connectError && (
          <p className="text-red-400 text-[12px] text-center px-2">{connectError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-[#111111]/40 backdrop-blur-md border border-white/[0.03] rounded-[24px] p-8 flex flex-col gap-8 group hover:border-brand/20 transition-all duration-300 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="w-16 h-16 rounded-[22px] bg-[#1A1A1A] border border-white/5 flex items-center justify-center text-[#5A6F65] group-hover:text-brand transition-all duration-500 shadow-inner">
            <Icon className="w-8 h-8" />
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.12em] ${
            isActive
              ? "bg-brand/10 text-brand border border-brand/20 shadow-[0_0_10px_rgba(0,229,143,0.15)]"
              : "bg-white/[0.03] text-[#5A6F65] border border-white/5"
          }`}>
            {status}
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="text-[20px] font-bold text-white tracking-tight">{name}</h4>
          <p className="text-[14px] text-[#5A6F65] font-medium leading-relaxed">{username || description}</p>
        </div>

        {/* Primary CTA */}
        {!isActive ? (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2.5 bg-brand hover:bg-brand-hover text-black shadow-[0_0_20px_rgba(0,229,143,0.2)] hover:shadow-[0_0_35px_rgba(0,229,143,0.35)] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : ctaText}
          </button>
        ) : confirmDisconnect ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-red-400 text-center font-medium">
              Disconnect {name}? This will stop auto-posting.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-[13px] hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-[#5A6F65] font-bold text-[13px] hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex-1 py-3.5 rounded-xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 bg-transparent border border-white/10 text-[#5A6F65] hover:text-red-400 hover:border-red-400/20 active:scale-[0.98] disabled:opacity-50"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
            <button
              className="flex-1 py-3.5 rounded-xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 bg-transparent border border-white/10 text-white hover:bg-white/[0.05] active:scale-[0.98]"
            >
              <Settings className="w-4 h-4 text-[#5A6F65]" />
              Manage
            </button>
          </div>
        )}
      </div>
      {connectError && (
        <p className="text-red-400 text-[12px] text-center px-2">{connectError}</p>
      )}
    </div>
  );
}
