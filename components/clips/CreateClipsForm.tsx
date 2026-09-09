"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Link as LinkIcon,
  Upload,
  Sparkles,
  Check,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { saveActiveJob } from "@/lib/processingStore";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";

export default function CreateClipsForm() {
  const router       = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activePlatform, setActivePlatform] = useState("TikTok");
  const [autoGenerate,   setAutoGenerate]   = useState(true);
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  type UploadState = "idle" | "ready" | "uploading" | "processing";
  const [uploadState, setUploadState] = useState<UploadState>("idle");

  const anyBusy = loading;

  const platforms = [
    { name: "TikTok",    icon: "📱" },
    { name: "Instagram", icon: "📸" },
    { name: "YT Shorts", icon: "📺" },
  ];

  const platformToApiValue = (name: string): string => {
    if (name === "YT Shorts") return "youtube";
    return name.toLowerCase();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadState("ready");
      setError("");
    }
  };

  // ── File upload (primary) ──────────────────────────────────────────────────

  const handleUploadAndGenerate = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setUploadState("uploading");
    setError("");
    setUploadProgress(0);
    try {
      // ── Step 1: Upload directly to Cloudinary from the browser ────────────
      // This bypasses the Next.js proxy entirely, so Vercel's 4.5MB limit
      // never applies — files of any size go straight to Cloudinary's CDN.
      const cloudinaryResult = await uploadToCloudinary(selectedFile, (pct) => {
        setUploadProgress(pct);
      });

      // ── Step 2: Register the video with the backend ───────────────────────
      // The backend receives the Cloudinary URL + metadata (no raw file).
      // This is a tiny JSON request — no size issues.
      setUploadProgress(100);
      const response = await apiClient.post("/videos", {
        cloudinaryUrl: cloudinaryResult.secureUrl,
        publicId:      cloudinaryResult.publicId,
        title:         selectedFile.name.replace(/\.[^/.]+$/, ""),
        sourceType:    "upload",
        style:         "viral",
        duration:      cloudinaryResult.duration,
        bytes:         cloudinaryResult.bytes,
      });

      const data    = response.data;
      const videoId = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
      if (!videoId) throw new Error("Failed to get video ID from response.");

      setUploadState("processing");
      saveActiveJob(String(videoId));
      router.push(`/dashboard/processing?videoId=${videoId}`);
    } catch (err: any) {
      const status = err.response?.status;
      let msg: string = err.response?.data?.message ?? err.message ?? "Upload failed. Please try again.";
      if (Array.isArray(msg)) msg = (msg as string[])[0];
      if (status === 401)      msg = "Session expired — redirecting to login…";
      else if (status === 429) msg = "Upload limit reached. Please wait a moment.";
      else if (status === 400) msg = "Invalid file. Use MP4, MOV, AVI, WEBM or MPEG.";
      else if (status === 500) msg = "Server error during upload. Please try again shortly.";
      setError(msg);
      setUploadState(selectedFile ? "ready" : "idle");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const uploadButtonLabel = () => {
    if (uploadState === "uploading")
      return <><Loader2 className="w-5 h-5 animate-spin" />{uploadProgress > 0 ? `Uploading ${uploadProgress}%` : "Uploading…"}</>;
    if (uploadState === "processing")
      return <><Loader2 className="w-5 h-5 animate-spin" />Queuing for AI…</>;
    if (uploadState === "ready")
      return <><Sparkles className="w-5 h-5 fill-black" />Generate Clips</>;
    return <><Upload className="w-5 h-5" />Select a Video First</>;
  };

  return (
    <div className="w-full bg-[#080C0B]/80 backdrop-blur-3xl border border-brand/20 rounded-[32px] p-6 sm:p-10 shadow-[0_0_100px_rgba(0,229,143,0.03),inset_0_0_20px_rgba(0,229,143,0.05)] relative overflow-hidden group">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-brand/10 transition-all duration-700" />

      <div className="space-y-8">

        {/* ── PRIMARY: File upload ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-1">
            <label className="text-[13px] font-bold text-[#5A6F65] uppercase tracking-wider">
              Upload Video <span className="ml-2 text-brand text-[10px] px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 normal-case tracking-normal font-black">Recommended</span>
            </label>
            {selectedFile && (
              <button
                type="button"
                onClick={() => { setSelectedFile(null); setUploadState("idle"); setError(""); }}
                className="text-[11px] text-[#5A6F65] hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={`group/upload relative ${anyBusy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            onClick={() => { if (!anyBusy) fileInputRef.current?.click(); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("video/")) {
                setSelectedFile(file);
                setUploadState("ready");
                setError("");
              }
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="video/*"
            />
            <div className={`w-full border-2 border-dashed rounded-[24px] flex flex-col items-center justify-center gap-4 transition-all duration-500 overflow-hidden py-10 px-6
              ${selectedFile
                ? "border-brand/40 bg-brand/[0.03]"
                : "border-white/5 bg-white/[0.01] group-hover/upload:border-brand/20 group-hover/upload:bg-brand/[0.01]"
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-500 relative
                ${selectedFile ? "bg-brand/10 border-brand/30 scale-110" : "bg-[#0B100E] border-white/5 group-hover/upload:scale-110 group-hover/upload:border-brand/20"}`}
              >
                <div className="absolute inset-0 bg-brand/5 blur-xl group-hover/upload:bg-brand/10 transition-colors rounded-full" />
                {selectedFile
                  ? <Check  className="w-6 h-6 text-brand relative z-10" />
                  : <Upload className="w-6 h-6 text-[#5A6F65] group-hover/upload:text-brand relative z-10 transition-colors" />}
              </div>
              <div className="text-center space-y-1 relative z-10">
                <p className={`text-[16px] font-bold transition-colors ${selectedFile ? "text-brand" : "text-white group-hover/upload:text-brand"}`}>
                  {selectedFile ? selectedFile.name : "Click to upload or drag & drop"}
                </p>
                <p className="text-[12px] font-medium text-[#3A4A43]">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · ready`
                    : "MP4, MOV, WEBM, AVI · up to 2 GB"}
                </p>
              </div>
            </div>
          </div>

          {/* Upload progress bar */}
          {loading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-[12px] font-bold text-[#5A6F65]">
                <span>Uploading to Cloudinary…</span>
                <span className="text-brand">{uploadProgress >= 0 ? `${uploadProgress}%` : "…"}</span>
              </div>
              <div className="h-2 bg-[#0B100E] rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,229,143,0.4)]"
                  style={{
                    width:   uploadProgress >= 0 ? `${uploadProgress}%` : "100%",
                    opacity: uploadProgress < 0  ? 0.35 : 1,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#3A4A43] text-center">
                Uploading directly — do not close this tab
              </p>
            </div>
          )}
        </div>

        {/* ── SECONDARY: URL import — Coming soon ── */}
        <div className="border border-white/[0.04] rounded-[20px] overflow-hidden">
          <div className="w-full flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <LinkIcon className="w-4 h-4 text-[#3A4A43]" />
              <span className="text-[13px] font-bold text-[#3A4A43]">
                Import from URL
              </span>
              <span className="text-[10px] text-[#3A4A43] font-medium">YouTube · TikTok · Vimeo</span>
            </div>
            <span className="text-[10px] font-black text-[#5A6F65] bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-full uppercase tracking-widest">
              Coming soon
            </span>
          </div>
          <div className="px-5 pb-5 border-t border-white/[0.04]">
            <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-5 flex flex-col items-center gap-2 text-center">
              <LinkIcon className="w-5 h-5 text-[#2A3B34]" />
              <p className="text-[13px] font-bold text-[#3A4A43]">URL import coming soon</p>
              <p className="text-[11px] text-[#2A3B34] leading-relaxed max-w-xs">
                Direct import from YouTube, TikTok and Vimeo is being rolled out. Upload your video file in the meantime.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 text-red-400 text-[13px] bg-red-400/5 py-3 px-4 rounded-xl border border-red-400/15">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Platform + auto-generate toggle ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <label className="text-[13px] font-bold text-[#5A6F65] uppercase tracking-wider block ml-1">
              Target Platform
            </label>
            <div className="flex flex-wrap gap-2.5">
              {platforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => setActivePlatform(platform.name)}
                  className={`px-4 py-2 rounded-full border text-[13px] font-bold flex items-center gap-2 transition-all duration-200 ${
                    activePlatform === platform.name
                      ? "bg-brand/10 border-brand text-brand shadow-[0_0_12px_rgba(0,229,143,0.15)]"
                      : "bg-[#0B100E] border-white/5 text-[#5A6F65] hover:text-white hover:border-white/10"
                  }`}
                >
                  <span className={activePlatform === platform.name ? "opacity-100" : "opacity-40 grayscale"}>
                    {platform.icon}
                  </span>
                  {platform.name}
                  {activePlatform === platform.name && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0B100E]/50 border border-white/5 rounded-[20px] p-5 lg:min-w-[280px] flex items-center justify-between group/toggle hover:border-brand/20 transition-all">
            <div className="space-y-0.5">
              <p className="text-[13px] font-bold text-white group-hover/toggle:text-brand transition-colors">
                Auto-generate clips
              </p>
              <p className="text-[11px] font-medium text-[#5A6F65]">Extract 50–200 viral moments</p>
            </div>
            <button
              onClick={() => setAutoGenerate(!autoGenerate)}
              className={`w-11 h-6 rounded-full relative transition-all duration-300 shrink-0 ml-4 ${autoGenerate ? "bg-brand" : "bg-[#1A221E]"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${autoGenerate ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pt-5 border-t border-white/[0.03] flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5 text-[#5A6F65]">
            <Info className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium">
              Estimated processing: <span className="text-white">4–6 minutes</span>
            </span>
          </div>

          <button
            onClick={handleUploadAndGenerate}
            disabled={anyBusy || !selectedFile}
            className={`w-full sm:w-auto px-10 py-4 rounded-2xl text-[15px] font-black flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
              uploadState === "ready"
                ? "bg-brand hover:bg-brand-hover text-black shadow-[0_0_30px_rgba(0,229,143,0.3)] hover:shadow-[0_0_40px_rgba(0,229,143,0.5)]"
                : uploadState === "uploading" || uploadState === "processing"
                ? "bg-brand text-black opacity-80"
                : "bg-[#0B100E] border border-white/10 text-[#5A6F65] opacity-50"
            }`}
          >
            {uploadButtonLabel()}
          </button>
        </div>

      </div>
    </div>
  );
}
