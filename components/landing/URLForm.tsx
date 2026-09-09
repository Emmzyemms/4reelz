"use client";

import React, { useState } from "react";
import { Loader2, Link2, AlertCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { saveActiveJob } from "@/lib/processingStore";
import { useYouTubeImport, isYouTubeUrl } from "@/lib/useYouTubeImport";
import WalletButton from "@/components/shared/WalletButton";

export default function URLForm() {
  const router = useRouter();
  const [url,   setUrl]   = useState("");
  const [error, setError] = useState("");

  const { state: ytState, run: runYouTube, reset: resetYouTube } = useYouTubeImport();
  const ytBusy  = ["fetching-info", "downloading", "uploading"].includes(ytState.phase);
  const anyBusy = ytBusy;

  const isSupported = (val: string): boolean => {
    try {
      const { hostname } = new URL(val);
      const host = hostname.replace("www.", "");
      if (host === "youtube.com" || host === "youtu.be") return true;
      if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") return true;
      if (host === "vimeo.com") return true;
      return false;
    } catch { return false; }
  };

  const handleURLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (anyBusy) return;

    const trimmed = url.trim();
    if (!trimmed) return;

    if (!isSupported(trimmed)) {
      setError("Only YouTube, TikTok, and Vimeo URLs are supported.");
      return;
    }

    setError("");
    resetYouTube();

    // ── YouTube: 5-step pipeline ───────────────────────────────────────────
    if (isYouTubeUrl(trimmed)) {
      // Landing page has no platform selector — default to tiktok
      const videoId = await runYouTube(trimmed, "tiktok");
      if (videoId) router.push(`/dashboard/processing?videoId=${videoId}`);
      // errors surface via ytState.error panel below
      return;
    }

    // ── TikTok / Vimeo: existing from-url path (unchanged) ────────────────
    try {
      const response = await apiClient.post("/videos/from-url", {
        url:             trimmed,
        targetPlatforms: ["tiktok", "instagram"],
        style:           "viral",
      });
      const data    = response.data;
      const videoId = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
      if (!videoId) throw new Error("Failed to get video ID from response.");
      saveActiveJob(String(videoId));
      router.push(`/dashboard/processing?videoId=${videoId}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("Too many requests. Please wait a moment and try again.");
        return;
      }
      const message = err.response?.data?.message ?? "Something went wrong. Please try again.";
      setError(Array.isArray(message) ? message[0] : message);
    }
  };

  // Show the YouTube panel whenever the hook has left idle/done
  const showYtPanel = ytState.phase !== "idle" && ytState.phase !== "done";

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleURLSubmit} className="flex gap-4 w-full">
        <div className="relative flex-1 max-w-[340px] group">
          <label htmlFor="video-url" className="sr-only">Video URL</label>
          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-brand transition-colors" />
          <input
            id="video-url"
            type="url"
            placeholder="Paste YouTube, TikTok or Vimeo URL"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); resetYouTube(); }}
            disabled={anyBusy}
            className={`w-full bg-[#1A221E]/60 border ${
              error ? "border-red-500/50" : "border-[#2A3B34]"
            } rounded-[14px] py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand/50 focus:bg-[#1A221E] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        </div>

        <button
          type="submit"
          disabled={anyBusy || !url.trim()}
          className="bg-brand hover:bg-brand-hover text-black px-8 py-3.5 rounded-[14px] font-bold text-sm tracking-wide transition-all disabled:opacity-70 flex items-center justify-center gap-2 min-w-[130px] shadow-[0_0_15px_rgba(0,229,143,0.2)]"
        >
          {anyBusy
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing</>
            : "Clip Now"}
        </button>

        <WalletButton />
      </form>

      {/* Generic error (TikTok / Vimeo) */}
      {error && (
        <p className="text-red-500 text-xs ml-1">{error}</p>
      )}

      {/* YouTube import progress / error panel */}
      {showYtPanel && (
        <div className={`rounded-2xl border px-4 py-3 space-y-2 transition-all ${
          ytState.phase === "error"
            ? "bg-red-500/5 border-red-500/20"
            : "bg-brand/5 border-brand/20"
        }`}>
          {ytState.phase === "error" ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-xs text-red-400 font-medium leading-relaxed">
                  {ytState.error}
                </p>
                {ytState.error?.toLowerCase().includes("temporarily unavailable") ||
                 ytState.error?.toLowerCase().includes("upload") ? (
                  <p className="text-[10px] text-[#5A6F65] leading-relaxed">
                    You can also{" "}
                    <a href="/agent-marketplace" className="text-brand underline underline-offset-2 hover:text-white transition-colors">
                      hire an AI agent
                    </a>{" "}
                    and upload your video file directly.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Play className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="text-xs font-bold text-white truncate">
                    {ytState.videoTitle ?? "YouTube Import"}
                  </span>
                </div>
                <span className="text-xs font-black text-brand shrink-0">
                  {ytState.progress >= 0 ? `${ytState.progress}%` : "…"}
                </span>
              </div>

              <div className="h-1.5 bg-[#0B100E] rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(0,229,143,0.4)]"
                  style={{
                    width:   ytState.progress >= 0 ? `${ytState.progress}%` : "100%",
                    opacity: ytState.progress <  0 ? 0.35 : 1,
                  }}
                />
              </div>

              <p className="text-[10px] font-medium text-[#5A6F65]">{ytState.label}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
