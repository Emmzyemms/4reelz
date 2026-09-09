"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle, AlertCircle, Clock,
  Play, Download, ExternalLink, Zap,
} from "lucide-react";
import Image from "next/image";
import { saveActiveJob } from "@/lib/processingStore";
import { getAgentJob } from "@/lib/queries";
import type { AgentJob } from "@/lib/queries";
import { bscscanTxUrl } from "@/lib/bnbWallet";
import { triggerDownload } from "@/lib/download";

interface AgentJobStatusProps {
  jobId: string;
  txHash?: string | null;
  onComplete?: (job: AgentJob) => void;
  /** Called when the component navigates away (so HireModal can close itself) */
  onNavigate?: () => void;
}

const POLL_INTERVAL_MS = 10000; // poll every 10s as per backend spec
const FALLBACK_IMG = "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Status normalisation helper ──────────────────────────────────────────────
// The backend may return uppercase status strings (e.g. "PENDING", "COMPLETED").
// Normalise to lowercase so STATUS_CONFIG lookup always works.
function normaliseStatus(
  raw: string | undefined
): "queued" | "processing" | "completed" | "failed" {
  const map: Record<string, "queued" | "processing" | "completed" | "failed"> = {
    pending:    "queued",
    queued:     "queued",
    processing: "processing",
    in_progress:"processing",
    completed:  "completed",
    done:       "completed",
    failed:     "failed",
    error:      "failed",
    refunded:   "failed",
  };
  return map[(raw ?? "").toLowerCase()] ?? "queued";
}

const STATUS_CONFIG = {
  queued: {
    icon: Clock,
    label: "Queued",
    color: "text-[#5A6F65]",
    bg: "bg-white/5 border-white/10",
    spin: false,
  },
  processing: {
    icon: Loader2,
    label: "Processing…",
    color: "text-brand",
    bg: "bg-brand/10 border-brand/20",
    spin: true,
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "text-brand",
    bg: "bg-brand/10 border-brand/20",
    spin: false,
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/5 border-red-500/20",
    spin: false,
  },
} as const;

export default function AgentJobStatus({
  jobId,
  txHash,
  onComplete,
  onNavigate,
}: AgentJobStatusProps) {
  const [job, setJob] = useState<AgentJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const isDoneRef = useRef(false);
  const router = useRouter();

  const fetchJob = useCallback(async () => {
    try {
      const raw = await getAgentJob(jobId);
      const data: AgentJob = { ...raw, status: normaliseStatus(raw.status) };
      setJob(data);

      // When the backend starts processing and returns a videoId, hand off
      // to the SSE processing page — that's where the AI progress animation lives.
      if (data.videoId && (data.status === "processing" || data.status === "queued")) {
        isDoneRef.current = true; // stop polling — we're navigating away
        saveActiveJob(data.videoId); // persist so the processing page can recover
        onNavigate?.();             // close the modal
        router.push(`/dashboard/processing?videoId=${data.videoId}`);
        return;
      }

      if (data.status === "completed" || data.status === "failed") {
        isDoneRef.current = true;
        onComplete?.(data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not fetch job status.");
    }
  }, [jobId, onComplete, onNavigate, router]);

  // Poll on a stable interval — stops itself once a terminal state is reached.
  // We do NOT put job.status in the dep array; isDoneRef handles early exit.
  useEffect(() => {
    isDoneRef.current = false;
    fetchJob(); // immediate first fetch
    const timer = setInterval(() => {
      if (isDoneRef.current) {
        clearInterval(timer);
        return;
      }
      fetchJob();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchJob]); // fetchJob is stable (memoised with useCallback)

  const handleDownload = async (clipUrl: string, title: string) => {
    if (downloading) return;
    setDownloading(clipUrl);
    try {
      await triggerDownload(clipUrl, title);
    } finally {
      setDownloading(null);
    }
  };

  if (error) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20 mt-4">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <p className="text-[12px] text-red-400">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[normaliseStatus(job.status)];
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-5 mt-4">
      {/* Status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.bg}`}>
        <StatusIcon className={`w-4 h-4 ${cfg.color} ${cfg.spin ? "animate-spin" : ""}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-bold ${cfg.color}`}>{cfg.label}</p>
          {job.status === "processing" && (
            <p className="text-[11px] text-[#5A6F65]">AI is analysing and clipping your video…</p>
          )}
          {job.status === "failed" && job.error && (
            <p className="text-[11px] text-red-400">{job.error}</p>
          )}
        </div>
        {/* Refresh button for terminal states */}
        {(job.status === "completed" || job.status === "failed") && (
          <button
            onClick={fetchJob}
            className="text-[10px] text-[#5A6F65] hover:text-white transition-colors font-medium"
          >
            Refresh
          </button>
        )}
      </div>

      {/* TX hash link */}
      {(txHash || job.txHash) && (
        <a
          href={bscscanTxUrl((txHash || job.txHash)!)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] font-mono text-[#5A6F65] hover:text-brand transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View payment on BscScan
        </a>
      )}

      {/* Clips grid */}
      {job.status === "completed" && job.clips && job.clips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand" />
            <p className="text-[13px] font-extrabold text-white">
              {job.clips.length} clip{job.clips.length !== 1 ? "s" : ""} generated
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
            {job.clips.map((clip) => {
              const score = clip.viralScore ?? 0;
              const scoreKey = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
              const SCORE_COLORS = {
                high: "text-brand bg-brand/10 border-brand/20",
                medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
                low: "text-[#5A6F65] bg-white/5 border-white/10",
              };

              return (
                <div
                  key={clip.id}
                  className="bg-[#0B100E] border border-white/5 rounded-[16px] overflow-hidden hover:border-brand/20 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-[#060A08] overflow-hidden">
                    <Image
                      src={clip.thumbnail || FALLBACK_IMG}
                      alt={clip.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                      }}
                    />
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-[9px] font-black text-white">
                      {typeof clip.duration === "number"
                        ? formatDuration(clip.duration)
                        : "00:00"}
                    </div>
                    {/* Play overlay */}
                    {clip.clipUrl && (
                      <a
                        href={clip.clipUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </a>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <p className="text-[12px] font-bold text-white truncate">{clip.title}</p>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${SCORE_COLORS[scoreKey]}`}>
                        <Zap className="w-2.5 h-2.5" />
                        {score}
                      </div>
                      <span className="text-[9px] font-bold text-[#3A4A43] uppercase tracking-widest">
                        {clip.platform}
                      </span>
                    </div>
                    {clip.clipUrl && (
                      <button
                        onClick={() => handleDownload(clip.clipUrl!, clip.title)}
                        disabled={downloading === clip.clipUrl}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-brand hover:text-white transition-colors disabled:opacity-50 py-1"
                      >
                        {downloading === clip.clipUrl ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        {downloading === clip.clipUrl ? "Downloading…" : "Download"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty completed state */}
      {job.status === "completed" && (!job.clips || job.clips.length === 0) && (
        <p className="text-[12px] text-[#5A6F65] text-center py-4">
          Job completed but no clips were returned. Please try again.
        </p>
      )}
    </div>
  );
}
