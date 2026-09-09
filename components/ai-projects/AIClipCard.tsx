"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, X, Volume2, VolumeX, Download, Lock, Unlock } from "lucide-react";
import TipModal from "./TipModal";
import { useWallet } from "@/components/WalletProvider";
import { isUnlocked } from "@/lib/tipUnlockStore";
import { getClipDownloadUrl } from "@/lib/queries";
import { triggerDownload } from "@/lib/download";
import { truncateAddress, bscscanAddressUrl } from "@/lib/bnbWallet";

interface AIClipCardProps {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  platform: string;
  createdAt: string | null;
  creatorAddress?: string;
  creatorName?: string;
  tippingEnabled?: boolean;
}

const FALLBACK =
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800";

// ── Video preview modal ────────────────────────────────────────────────────────

function PreviewModal({
  clipUrl,
  title,
  onClose,
}: {
  clipUrl: string;
  title: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Autoplay on open.
  // Browsers block autoplay with sound — start muted so the play() promise
  // resolves, then immediately unmute. The user hears sound from the first frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true; // must be muted for autoplay to be allowed
    video.play()
      .then(() => {
        video.muted = false; // unmute as soon as play is running
        setMuted(false);
        setPlaying(true);
      })
      .catch(() => {
        // Autoplay blocked entirely (rare) — stay muted and paused
        setPlaying(false);
      });
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    // Always set muted imperatively — React's muted prop is not reactive
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-auto max-w-[92vw] max-h-[92vh] bg-[#0B100E] rounded-[28px] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,229,143,0.12)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white hover:bg-black transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className="relative bg-black flex-1 flex items-center justify-center cursor-pointer"
          onClick={toggle}
        >
          {/* NOTE: muted prop intentionally omitted — we control it via ref imperatively */}
          <video
            ref={videoRef}
            src={clipUrl}
            className="max-w-full max-h-[72vh] object-contain"
            onTimeUpdate={() => {
              if (!videoRef.current) return;
              const { currentTime, duration } = videoRef.current;
              setProgress(duration ? (currentTime / duration) * 100 : 0);
            }}
            onEnded={() => setPlaying(false)}
            playsInline
          />
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
              playing ? "opacity-0 hover:opacity-100" : "opacity-100"
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
              {playing
                ? <Pause className="w-7 h-7 text-white fill-white" />
                : <Play className="w-7 h-7 text-white fill-white ml-1" />
              }
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-white font-bold text-[14px] truncate">{title}</p>
          <div
            className="h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden"
            onClick={(e) => {
              if (!videoRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              videoRef.current.currentTime =
                ((e.clientX - rect.left) / rect.width) * videoRef.current.duration;
            }}
          >
            <div
              className="h-full bg-brand rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-black hover:bg-brand-hover transition-colors"
            >
              {playing
                ? <Pause className="w-4 h-4 fill-black" />
                : <Play className="w-4 h-4 fill-black ml-0.5" />
              }
            </button>
            <button
              onClick={toggleMute}
              className="text-[#5A6F65] hover:text-white transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function AIClipCard({
  id,
  title,
  thumbnail,
  clipUrl,
  score,
  scoreKey,
  duration,
  platform,
  createdAt,
  creatorAddress,
  creatorName,
  tippingEnabled = false,
}: AIClipCardProps) {
  const { address } = useWallet();

  const [imgSrc, setImgSrc] = useState(thumbnail || FALLBACK);
  const [hovered, setHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  // true when this wallet has already tipped and unlocked this clip
  const [unlocked, setUnlocked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Check localStorage on mount and whenever the wallet address changes
  useEffect(() => {
    if (address && tippingEnabled) {
      setUnlocked(isUnlocked(id, address));
    }
  }, [id, address, tippingEnabled]);

  useEffect(() => {
    setImgSrc(thumbnail || FALLBACK);
  }, [thumbnail]);

  // Kick off a proxy-routed download so the browser shows a Save dialog
  // instead of opening the Cloudinary URL in a new tab.
  const doDownload = (downloadUrl: string) => triggerDownload(downloadUrl, title);

  // Called when the user clicks Download on an already-unlocked clip
  const handleDirectDownload = async () => {
    if (!address || downloading) return;
    setDownloading(true);
    try {
      const { downloadUrl } = await getClipDownloadUrl(id, address);
      doDownload(downloadUrl);
    } catch {
      // If for any reason the direct download fails, fall back to the tip modal
      setShowTipModal(true);
    } finally {
      setDownloading(false);
    }
  };

  // Called by TipModal once tip + download is confirmed
  const handleTipComplete = (downloadUrl: string) => {
    setUnlocked(true);
    doDownload(downloadUrl);
  };

  const timeAgo = (date: string | null) => {
    if (!date) return null;
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <>
      {showPreview && clipUrl && (
        <PreviewModal
          clipUrl={clipUrl}
          title={title}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showTipModal && (
        <TipModal
          clipId={id}
          clipTitle={title}
          onClose={() => setShowTipModal(false)}
          onDownloadReady={handleTipComplete}
        />
      )}

      <div
        className={`group relative bg-[#0B100E] border rounded-[24px] overflow-hidden transition-all duration-500 ${
          hovered
            ? "border-brand/40 shadow-[0_0_40px_rgba(0,229,143,0.08)] -translate-y-0.5"
            : "border-white/5"
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Thumbnail */}
        <div
          className={`relative aspect-video overflow-hidden bg-[#060A08] ${clipUrl ? "cursor-pointer" : ""}`}
          onClick={() => clipUrl && setShowPreview(true)}
        >
          <Image
            src={imgSrc}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className={`object-cover transition-transform duration-700 ${hovered ? "scale-105" : "scale-100"}`}
            onError={() => setImgSrc(FALLBACK)}
          />

          <div className="absolute bottom-2.5 right-3 px-1.5 py-0.5 rounded-md bg-black/80 text-[9px] font-black text-white z-10">
            {duration}
          </div>

          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 z-10 ${
              hovered && clipUrl
                ? "opacity-100 bg-black/40 backdrop-blur-[2px]"
                : "opacity-0"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>

          {!clipUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
              <p className="text-[#5A6F65] text-[11px] font-medium">No preview</p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <h4 className="text-[13px] font-bold text-white truncate leading-tight group-hover:text-brand transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#3A4A43] uppercase tracking-widest bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/5">
                {platform}
              </span>
              {createdAt && (
                <span className="text-[10px] text-[#3A4A43] font-medium">
                  {timeAgo(createdAt)}
                </span>
              )}
            </div>
          </div>

          {/* Creator wallet address */}
          <div className="flex items-start gap-2 pt-2 border-t border-white/[0.04]">
            <div className="w-6 h-6 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[8px] font-bold text-brand">C</span>
            </div>
            <div className="flex-1 min-w-0">
              {creatorAddress ? (
                <>
                  <p className="text-[9px] font-bold text-[#5A6F65] uppercase tracking-widest mb-0.5">
                    Creator wallet
                  </p>
                  <a
                    href={bscscanAddressUrl(creatorAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-brand font-mono leading-relaxed hover:text-white transition-colors"
                    title={creatorAddress}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateAddress(creatorAddress, 8, 6)}
                  </a>
                </>
              ) : (
                <p className="text-[10px] text-[#3A4A43] font-medium">No wallet linked</p>
              )}
            </div>
            {tippingEnabled && creatorAddress && (
              <div className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md border mt-0.5 ${
                unlocked
                  ? "bg-brand/10 border-brand/20"
                  : "bg-white/5 border-white/10"
              }`}>
                {unlocked
                  ? <Unlock className="w-2.5 h-2.5 text-brand" />
                  : <Lock className="w-2.5 h-2.5 text-[#5A6F65]" />
                }
                <span className={`text-[8px] font-black uppercase tracking-wide ${unlocked ? "text-brand" : "text-[#5A6F65]"}`}>
                  {unlocked ? "Unlocked" : "Tip"}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            className="flex items-center justify-between pt-1 border-t border-white/[0.04]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Already unlocked — direct download, no tip needed */}
            {tippingEnabled && unlocked ? (
              <button
                onClick={handleDirectDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 text-[11px] font-bold text-brand hover:text-[#00e58f] transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <Download className="w-3 h-3 animate-bounce" />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3" />
                    Download
                  </>
                )}
              </button>
            ) : (
              /* Tip required or free */
              <button
                onClick={() => setShowTipModal(true)}
                className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${
                  tippingEnabled
                    ? "text-brand hover:text-[#00e58f]"
                    : "text-[#5A6F65] hover:text-white"
                }`}
              >
                {tippingEnabled ? (
                  <>
                    <Lock className="w-3 h-3" />
                    Tip-to-Save
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    Download
                  </>
                )}
              </button>
            )}

            {/* Unlocked badge */}
            {tippingEnabled && unlocked && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand/10 border border-brand/20">
                <Unlock className="w-2.5 h-2.5 text-brand" />
                <span className="text-[8px] font-black text-brand uppercase tracking-wide">Unlocked</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
