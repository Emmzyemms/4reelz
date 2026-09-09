"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Play,
  Download,
  Check,
  Trash2,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Pause,
} from "lucide-react";
import { triggerDownload } from "@/lib/download";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClipCardProps {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800";

// ─── Video Preview Modal ──────────────────────────────────────────────────────

function VideoModal({
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
    // Do NOT autoplay — browsers block audio on autoplay without a user gesture.
    // User must press play so the browser allows sound.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play(); setPlaying(true); }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    setProgress(duration ? (currentTime / duration) * 100 : 0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    videoRef.current.currentTime =
      ((e.clientX - rect.left) / rect.width) * videoRef.current.duration;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-auto max-w-[90vw] max-h-[90vh] bg-[#0B100E] rounded-[24px] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,229,143,0.1)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={clipUrl}
            className="max-w-full max-h-[70vh] object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
            muted={muted}
            playsInline
            // No autoplay — requires user gesture so browser allows audio
          />
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            <div className={`w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl transition-opacity duration-200 ${playing ? "opacity-0 hover:opacity-100" : "opacity-100"}`}>
              {playing
                ? <Pause className="w-6 h-6 text-white fill-white" />
                : <Play className="w-6 h-6 text-white fill-white ml-1" />
              }
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <p className="text-white font-bold text-[14px] truncate">{title}</p>
          <div className="h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden" onClick={handleSeek}>
            <div className="h-full bg-brand rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-black hover:bg-brand-hover transition-colors"
            >
              {playing ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
            </button>
            <button
              onClick={() => { if (videoRef.current) { videoRef.current.muted = !muted; setMuted(!muted); } }}
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

// ─── ClipCard ──────────────────────────────────────────────────────────────────

export default function ClipCard({
  id,
  title: initialTitle,
  thumbnail,
  clipUrl,
  score,
  scoreKey,
  duration,
  isSelected,
  onSelect,
  onDelete,
}: ClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imgSrc, setImgSrc] = useState(thumbnail || FALLBACK_IMG);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { setImgSrc(thumbnail || FALLBACK_IMG); }, [thumbnail]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    setIsDeleting(true);
    try { await onDelete(id); } catch { /* parent handles */ } finally { setIsDeleting(false); }
  };

  const openPreview = (e: React.MouseEvent) => { e.stopPropagation(); if (clipUrl) setShowPreview(true); };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clipUrl) return;
    triggerDownload(clipUrl, initialTitle);
  };

  return (
    <>
      {showPreview && clipUrl && (
        <VideoModal clipUrl={clipUrl} title={initialTitle} onClose={() => setShowPreview(false)} />
      )}

      <div
        className={`group relative bg-[#0B100E] border rounded-[24px] overflow-hidden transition-all duration-500 ${
          isSelected
            ? "border-brand ring-1 ring-brand/20 shadow-[0_0_50px_rgba(0,229,143,0.15)]"
            : "border-white/5 hover:border-white/20"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={imgSrc}
            alt={initialTitle}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover"
            onError={() => setImgSrc(FALLBACK_IMG)}
          />

          {/* Selection checkbox */}
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(id); }}
            className={`absolute top-3 left-3 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer z-20 ${
              isSelected
                ? "bg-brand border-brand shadow-[0_0_15px_rgba(0,229,143,0.4)]"
                : "bg-black/40 border-white/20 hover:border-white/40 backdrop-blur-md"
            }`}
          >
            {isSelected && <Check className="w-3 h-3 text-black stroke-[4px]" />}
          </div>

          {/* Play overlay */}
          <div
            onClick={openPreview}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 z-10 ${
              isHovered && clipUrl
                ? "opacity-100 bg-black/40 backdrop-blur-[2px] cursor-pointer"
                : "opacity-0"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
              <Play className="w-4 h-4 text-white fill-white ml-1" />
            </div>
          </div>

          {/* Duration */}
          <div className="absolute bottom-2.5 right-3 px-1.5 py-0.5 rounded-md bg-black/80 text-[9px] font-black text-white z-20">
            {duration}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <h4 className="text-[13px] font-bold text-white truncate tracking-tight leading-tight">{initialTitle}</h4>
            <p className="text-[10px] font-medium text-[#5A6F65]">Perfect for TikTok & Reels</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={!clipUrl}
                className="text-[#5A6F65] hover:text-white transition-colors disabled:opacity-30"
                title={clipUrl ? "Download" : "No download available"}
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[#5A6F65] hover:text-red-500 transition-colors disabled:opacity-50"
                title="Delete"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            </div>

            <button
              onClick={openPreview}
              disabled={!clipUrl}
              className="text-[10px] font-black text-brand uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-30 disabled:no-underline"
              title={clipUrl ? "Preview clip" : "No preview available"}
            >
              PREVIEW <span className="text-[12px] leading-none mb-0.5">›</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
