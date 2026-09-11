"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import ProcessingHeader from "@/components/dashboard/ProcessingHeader";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getProjectsData } from "@/lib/queries";
import apiClient from "@/lib/apiClient";
import { loadActiveJob, saveActiveJob, clearActiveJob } from "@/lib/processingStore";
import { Sparkles, Clock, RefreshCw, Zap, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Strategy ─────────────────────────────────────────────────────────────────
// 1. Primary:  SSE via /api/sse/events/processing-progress/:videoId
//    - Dedicated streaming proxy that pipes bytes without buffering
//    - Gives real-time progress from the backend AI engine
// 2. Fallback: Poll GET /videos/:id every 4 s
//    - Kicks in automatically if SSE fails / drops after 10 s of silence
//    - Checks clipsCount / status field on the video object
// Both paths prefetch clips into React Query cache and navigate instantly.
//
// Persistence (refresh / leave-and-come-back):
//  - videoId is stored in localStorage (via processingStore) by CreateClipsForm /
//    URLForm before navigating here.
//  - On mount, if the URL has no videoId we fall back to the stored job so a
//    refresh or direct visit to /dashboard/processing re-attaches automatically.
//  - startedAt is also persisted so elapsed-time estimates stay correct after reload.
//  - The store entry is cleared only on success or on an unrecoverable error,
//    so closing the tab mid-job and reopening it still reconnects.

const SSE_SILENCE_TIMEOUT = 10_000;  // switch to poll if no SSE event in 10 s
const POLL_INTERVAL       = 4_000;   // poll every 4 s
const MAX_WAIT_MS         = 15 * 60 * 1000; // 15 min hard cap (up from 10 — long videos need more time)

type Status = "analyzing" | "processing" | "done" | "completed" | "failed" | "error";

function ProcessingContent() {
  const [progress,   setProgress]   = useState(0);
  const [statusMsg,  setStatusMsg]  = useState(() => {
    // If we're resuming a stored job show a reconnecting message instantly
    const job = loadActiveJob();
    const elapsed = job ? Math.round((Date.now() - job.startedAt) / 1000) : 0;
    return elapsed > 5 ? "Reconnecting to AI engine…" : "Connecting to AI engine…";
  });
  const [clipsFound, setClipsFound] = useState<number | null>(null);
  const [isDone,     setIsDone]     = useState(false);
  const [hasError,   setHasError]   = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [mode,       setMode]       = useState<"sse" | "polling">("sse");

  const searchParams = useSearchParams();
  const router       = useRouter();
  const queryClient  = useQueryClient();

  // ── Resolve videoId ────────────────────────────────────────────────────────
  // Priority: URL param → localStorage store (refresh / leave-and-return)
  // If neither exists we redirect to dashboard.
  const paramId = searchParams.get("videoId");
  const storedJob = loadActiveJob();
  const videoId   = (paramId && paramId !== "undefined") ? paramId : storedJob?.videoId ?? null;

  // If we recovered the videoId from the store but the URL doesn't have it,
  // rewrite the URL so the user can share/bookmark it and so refreshes work.
  useEffect(() => {
    if (!paramId || paramId === "undefined") {
      if (videoId) {
        router.replace(`/dashboard/processing?videoId=${videoId}`);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigated      = useRef(false);
  // Restore startedAt from the store so elapsed-time estimates survive a refresh
  const startedAt      = useRef(storedJob?.startedAt ?? Date.now());
  // Track the highest progress value seen from SSE so polling never goes backwards
  const lastSseProgress = useRef(0);
  const esRef          = useRef<EventSource | null>(null);
  const pollRef        = useRef<NodeJS.Timeout | null>(null);
  const silenceRef     = useRef<NodeJS.Timeout | null>(null);
  const usingPoll      = useRef(false);

  useEffect(() => {
    if (!videoId || videoId === "undefined") {
      setStatusMsg("No active job found — redirecting…");
      setTimeout(() => router.push("/dashboard"), 3000);
      return;
    }

    // Ensure the store is up-to-date (covers the refresh case where the URL
    // param is present but the store was cleared, e.g. user copied the URL)
    saveActiveJob(videoId);

    // ── Shared finish handler ──────────────────────────────────────────────
    const finish = async (vid: string) => {
      if (navigated.current) return;
      navigated.current = true;

      esRef.current?.close();
      if (pollRef.current)   clearInterval(pollRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);

      // Job done — remove the persisted entry so a fresh visit starts clean
      clearActiveJob();

      setIsDone(true);
      setProgress(100);
      setStatusMsg("All clips generated! Loading your clips…");

      try {
        const clips = await getProjectsData(vid);
        queryClient.setQueryData(["projectsData", vid], clips);
      } catch { /* non-fatal */ }

      // Always invalidate — even if clip prefetch failed the sidebar must update.
      // This runs outside the try block so a getProjectsData failure can't prevent it.
      queryClient.invalidateQueries({ queryKey: ["sidebarClipCount"] });

      router.push(`/projects?videoId=${vid}`);
    };

    const failWith = (msg: string) => {
      esRef.current?.close();
      if (pollRef.current)    clearInterval(pollRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);
      // Clear the store on unrecoverable failure so the user can start fresh
      clearActiveJob();
      setHasError(true);
      setErrorMsg(msg);
    };

    // ── Polling fallback ───────────────────────────────────────────────────
    const startPolling = () => {
      if (usingPoll.current) return;
      usingPoll.current = true;
      setMode("polling");

      const poll = async () => {
        if (navigated.current) return;
        if (Date.now() - startedAt.current > MAX_WAIT_MS) {
          failWith("Processing is taking longer than expected. Check your Projects page in a few minutes.");
          return;
        }
        try {
          const res   = await apiClient.get(`/videos/${videoId}`);
          const video = res.data;
          const status: string = (video.status ?? "processing").toLowerCase();

          if (status === "failed" || status === "error") {
            failWith(video.errorMessage || "Generation failed. Please try again.");
            return;
          }

          // Animate progress based on elapsed time — but never go below what
          // SSE already reported. This prevents the bar jumping backwards when
          // we switch from SSE to polling mid-job.
          const elapsed = (Date.now() - startedAt.current) / 1000;
          if (status === "analyzing") {
            setStatusMsg("Analyzing video retention patterns…");
            const estimate = Math.min(25, Math.round(elapsed * 0.6));
            if (estimate > lastSseProgress.current) setProgress(estimate);
          } else if (status === "processing") {
            setStatusMsg("AI is generating viral clips…");
            const estimate = Math.min(98, 25 + Math.round(elapsed * 0.4));
            if (estimate > lastSseProgress.current) setProgress(estimate);
          }

          const clips = video.clips ?? [];
          const count = typeof video.clipsCount === "number"
            ? video.clipsCount
            : clips.length;

          if (count > 0) setClipsFound(count);

          // Accept any completion-like status string the backend may use —
          // don't require clipsCount > 0 because clips may still be committing
          // to the database at the exact moment we poll.
          const DONE_STATUSES = ["done", "completed", "complete", "finished", "success"];
          const isDoneStatus  = DONE_STATUSES.includes(status?.toLowerCase?.() ?? "");
          const hasClips      = count > 0;

          if (isDoneStatus || hasClips) {
            await finish(videoId);
          }
        } catch (e: any) {
          console.warn("[poll] transient error, retrying:", e?.message);
        }
      };

      poll(); // immediate first check
      pollRef.current = setInterval(poll, POLL_INTERVAL);
    };

    // ── SSE primary ────────────────────────────────────────────────────────
    const connectSSE = () => {
      const url = `/api/sse/events/processing-progress/${videoId}`;
      const es = new EventSource(url);
      esRef.current = es;

      // Silence watchdog — if no event arrives in SSE_SILENCE_TIMEOUT, fall back
      const resetSilence = () => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = setTimeout(() => {
        console.warn("[sse] silence timeout — switching to polling");
          es.close();
          startPolling();
        }, SSE_SILENCE_TIMEOUT);
      };
      resetSilence();

      es.onopen = () => {
        setStatusMsg("AI engine connected — analyzing your video…");
        resetSilence();
      };

      es.onmessage = (event) => {
        resetSilence();
        try {
          const data = JSON.parse(event.data);

          if (typeof data.progress === "number") {
            setProgress(data.progress);
            // Track highest SSE progress so polling never goes backwards
            if (data.progress > lastSseProgress.current) {
              lastSseProgress.current = data.progress;
            }
          }
          if (typeof data.clipsFound === "number") {
            setClipsFound(data.clipsFound);
          } else if (Array.isArray(data.clips) && data.clips.length > 0) {
            setClipsFound(data.clips.length);
          }

          const status: string = (data.status ?? "").toLowerCase();

          if (status === "failed" || status === "error") {
            failWith(
              data.message && !data.message.toLowerCase().includes("status code")
                ? data.message
                : "Generation failed. Please try again."
            );
            return;
          }

          if (data.message) setStatusMsg(data.message);

          // Accept any completion-like status string, progress=100, or clips attached
          const DONE_STATUSES = ["done", "completed", "complete", "finished", "success"];
          const hasCompletionClips =
            (typeof data.clipsFound === "number" && data.clipsFound > 0) ||
            (Array.isArray(data.clips) && data.clips.length > 0);

          if (DONE_STATUSES.includes(status) || data.progress >= 100 || hasCompletionClips) {
            finish(videoId);
          }
        } catch (e) {
          console.warn("[sse] parse error:", e);
        }
      };

      es.onerror = () => {
        // onerror fires both on connection failures AND when the server closes
        // the stream normally (readyState === CLOSED after the backend finishes).
        // Do ONE immediate poll first — if the backend already finished and the
        // stream just closed cleanly, the poll will see status:"done" and call
        // finish() right away, so the user sees 100% instantly instead of
        // waiting for the first 4-second polling tick.
        console.warn("[sse] stream closed/error — immediate check then polling");
        es.close();
        esRef.current = null;
        if (silenceRef.current) clearTimeout(silenceRef.current);
        if (navigated.current) return;

        // Immediate one-shot check before handing off to interval polling
        (async () => {
          try {
            const res   = await apiClient.get(`/videos/${videoId}`);
            const video = res.data;
            const status = (video.status ?? "").toLowerCase();
            const clips  = video.clips ?? [];
            const count  = typeof video.clipsCount === "number" ? video.clipsCount : clips.length;
            const DONE   = ["done", "completed", "complete", "finished", "success"];
            if (DONE.includes(status) || count > 0) {
              await finish(videoId);
              return;
            }
          } catch { /* ignore — fall through to normal polling */ }
          startPolling();
        })();
      };
    };

    connectSSE();

    return () => {
      esRef.current?.close();
      if (pollRef.current)    clearInterval(pollRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);
    };
  }, [videoId, router, queryClient]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
      {/* Icon */}
      <div className="flex flex-col items-center text-center space-y-6 mb-12">
        <div className="relative">
          <div className={`absolute inset-0 blur-2xl rounded-full animate-pulse ${isDone ? "bg-brand/30" : "bg-[#00FF85]/20"}`} />
          <div className="relative w-24 h-24 rounded-full bg-[#101614] border border-[#00FF85]/30 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,255,133,0.1)]">
            {isDone ? (
              <CheckCircle2 className="w-10 h-10 text-brand" />
            ) : hasError ? (
              <AlertCircle className="w-10 h-10 text-red-400" />
            ) : (
              <Sparkles className="w-10 h-10 text-[#00FF85] drop-shadow-[0_0_10px_rgba(0,255,133,0.5)]" />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {isDone
              ? "Clips are ready!"
              : hasError
              ? "Generation failed"
              : "AI is finding viral moments…"}
          </h1>
          <p className={`text-lg md:text-xl max-w-2xl mx-auto font-medium ${hasError ? "text-red-400" : "text-gray-400"}`}>
            {hasError ? errorMsg : statusMsg}
          </p>
          {/* Show polling indicator unobtrusively */}
          {mode === "polling" && !isDone && !hasError && (
            <p className="text-[11px] text-[#3A4A43] font-medium">
              Checking for updates every {POLL_INTERVAL / 1000}s…
            </p>
          )}
        </div>
      </div>

      {/* Progress card */}
      <div className="w-full max-w-4xl bg-[#0A0F0D] border border-white/5 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 border border-[#00FF85]/10 rounded-[32px] pointer-events-none group-hover:border-[#00FF85]/20 transition-colors" />

        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[#111815] border border-white/5 flex items-center justify-center">
                <RefreshCw className={`w-3.5 h-3.5 text-[#00FF85] ${!isDone && !hasError ? "animate-spin" : ""}`} />
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                {mode === "sse" ? "Live Stream" : "Polling"}
              </span>
            </div>
            <span className="text-3xl font-black text-[#00FF85]">{progress}%</span>
          </div>

          <div className="relative h-4 w-full bg-[#111815] rounded-full overflow-hidden border border-white/5">
            <div
              className="absolute top-0 left-0 h-full bg-[#00FF85] rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(0,255,133,0.4)]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-gray-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              <span>
                {isDone
                  ? "Processing complete"
                  : progress > 0
                  ? `~${Math.max(1, Math.round((100 - progress) * 0.5))}s remaining`
                  : "Estimating time…"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className={`w-2 h-2 rounded-full ${hasError ? "bg-red-400" : "bg-[#00FF85] animate-pulse"} shadow-[0_0_8px_#00FF85]`} />
              <span className="text-gray-300">{hasError ? "Error" : "GPU Accelerated"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mt-6">
        <div className="bg-[#0A0F0D] border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center space-y-2 group hover:border-[#00FF85]/20 transition-all">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Moments Found</span>
          <span className="text-3xl font-extrabold text-white">
            {clipsFound !== null ? clipsFound : "…"}
          </span>
        </div>
        <div className="bg-[#0A0F0D] border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center space-y-2 group hover:border-[#00FF85]/20 transition-all">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Input Quality</span>
          <span className="text-3xl font-extrabold text-white">HD</span>
          <span className="text-gray-500 text-xs font-bold">Auto-detected</span>
        </div>
        <div className="bg-[#0A0F0D] border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center space-y-2 group hover:border-[#00FF85]/20 transition-all">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">AI Throughput</span>
          <span className="text-3xl font-extrabold text-white">2.5x</span>
          <span className="text-[#00FF85] text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 fill-current" /> Turbo
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-12 flex flex-col items-center space-y-4">
        {isDone ? (
          <button
            onClick={() => router.push(`/projects?videoId=${videoId}`)}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-brand hover:bg-brand-hover text-black font-bold text-sm transition-all active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            View My Clips
          </button>
        ) : hasError ? (
          <>
            <button
              onClick={() => router.push("/clips")}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-brand hover:bg-brand-hover text-black font-bold text-sm transition-all active:scale-[0.98]"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full border border-white/10 bg-[#0A0F0D] hover:bg-[#111815] hover:border-white/20 text-gray-300 font-bold text-sm transition-all active:scale-[0.98]"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full border border-white/10 bg-[#0A0F0D] hover:bg-[#111815] hover:border-white/20 text-gray-300 font-bold text-sm transition-all active:scale-[0.98]"
            >
              Go to Dashboard
            </button>
            <p className="text-gray-500 text-xs text-center max-w-sm leading-relaxed">
              Processing continues in the background — you can safely leave this page and come back anytime.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ProcessingPage() {
  return (
    <DashboardLayout showHeader={false}>
      <ProcessingHeader />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-white">
            <RefreshCw className="w-6 h-6 animate-spin text-brand" />
          </div>
        }
      >
        <ProcessingContent />
      </Suspense>

      <footer className="w-full flex flex-col md:flex-row items-center justify-between px-10 py-8 border-t border-white/5 mt-auto bg-transparent relative z-10 gap-4">
        <p className="text-gray-500 text-xs font-medium">© 2024 4Reelzclip. All rights reserved.</p>
        <div className="flex items-center gap-8">
          <Link href="/privacy" className="text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors">Privacy Policy</Link>
          <Link href="/terms"   className="text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </DashboardLayout>
  );
}
