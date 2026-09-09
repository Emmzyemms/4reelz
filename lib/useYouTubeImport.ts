"use client";

import { useState, useCallback } from "react";
import { saveActiveJob } from "@/lib/processingStore";
import apiClient from "@/lib/apiClient";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";

// ─── Types ────────────────────────────────────────────────────────────────────

export type YouTubeImportPhase =
  | "idle"
  | "fetching-info"  // getting video metadata from yt.lemnoslife.com
  | "downloading"    // downloading video in browser
  | "uploading"      // uploading to backend
  | "done"
  | "error";

export interface YouTubeImportState {
  phase:         YouTubeImportPhase;
  /** 0–100 during downloading/uploading; -1 = indeterminate */
  progress:      number;
  label:         string;
  error:         string | null;
  videoTitle:    string | null;
  videoId:       string | null;
  cloudinaryUrl: string | null;
}

export type YouTubeImportResult =
  | { videoId: string; cloudinaryUrl: string; error?: never }
  | { error: string; videoId?: never; cloudinaryUrl?: never };

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function extractYouTubeId(url: string): string | null {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    const host = hostname.replace("www.", "");
    if (host === "youtu.be") {
      const id = pathname.slice(1).split("?")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com") {
      const v = searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const match = pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
  } catch { /* invalid URL */ }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return host === "youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

// ─── Resolve video stream URL via Next.js /api/youtube-info ──────────────────
//
// WHY a Next.js route instead of the Render backend?
//   YouTube's InnerTube API does not send CORS headers, so it cannot be called
//   from browser JS directly. The Next.js route runs on Vercel (or locally),
//   calls InnerTube server-side with youtubei.js, and returns the signed CDN URL.
//   The Render backend is never involved in the YouTube resolution at all —
//   this is what stops the "server IP blocked" problem completely.
//
// WHY not call the CDN URL directly from the browser?
//   The signed googlevideo.com URLs DO have CORS headers, so the XHR download
//   below works fine. However, the InnerTube API call to GET the URL does not
//   — hence the Next.js intermediary for step 1 only.

// Sentinel error class so callers can skip the /videos/from-url fallback when
// the info step itself fails — re-trying via the Render backend would hit the
// same "server IP blocked" problem and just add more confusion.
export class YouTubeInfoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeInfoUnavailableError";
  }
}

async function getYouTubeInfo(videoId: string): Promise<{
  title: string;
  downloadUrl: string;
  thumbnail: string;
  durationSeconds: number;
  fileSizeBytes: number | null;
  quality: string;
}> {
  // Call our own Next.js API route — no Render backend involved
  const res = await fetch(`/api/youtube-info?videoId=${encodeURIComponent(videoId)}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg: string = data?.error ?? `HTTP ${res.status}`;

    if (res.status === 403) {
      throw new YouTubeInfoUnavailableError(
        "This video is private or age-restricted. Try a public video, or upload the file directly."
      );
    }
    if (res.status === 404 || res.status === 422) {
      throw new YouTubeInfoUnavailableError(
        "YouTube video not found or unavailable. Please check the URL, or upload the video file directly."
      );
    }
    // 500 / 502 / network failure
    throw new YouTubeInfoUnavailableError(
      msg.includes("unavailable") || msg.includes("private")
        ? msg
        : "Could not resolve video info. Please try again, or upload your video file directly."
    );
  }

  if (!data?.downloadUrl) {
    throw new YouTubeInfoUnavailableError(
      "No downloadable format found for this video. " +
      "Please try again or upload your video file directly."
    );
  }

  return {
    title:           data.title           || `YouTube video ${videoId}`,
    downloadUrl:     data.downloadUrl,
    thumbnail:       data.thumbnail       || "",
    durationSeconds: data.durationSeconds || 0,
    fileSizeBytes:   data.fileSizeBytes   ?? null,
    quality:         data.quality         || "unknown",
  };
}

// ─── Download video in browser with progress ─────────────────────────────────
//
// The signed googlevideo.com CDN URLs from InnerTube have CORS headers, so the
// browser can fetch them directly. However, if the browser blocks the request
// (e.g. mixed-content or cookie policy), we fall through to the Next.js
// /api/youtube-dl proxy route as a seamless fallback.

function buildDownloadUrl(rawUrl: string): string {
  // Route through our Next.js proxy to avoid any CORS edge cases
  return `/api/youtube-dl?url=${encodeURIComponent(rawUrl)}`;
}

function downloadVideo(
  url: string,
  filename: string,
  onProgress: (pct: number) => void
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Always proxy through Next.js — keeps CORS clean and adds the size cap
    const proxyUrl = buildDownloadUrl(url);
    const xhr = new XMLHttpRequest();
    xhr.open("GET", proxyUrl, true);
    xhr.responseType = "blob";

    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      } else {
        onProgress(-1); // Indeterminate
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response as Blob;
        resolve(new File([blob], filename, { type: "video/mp4" }));
      } else {
        // Parse error message from the proxy JSON response
        let msg = `Download failed (${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.error) msg = parsed.error;
        } catch { /* keep default */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during download"));
    xhr.onabort = () => reject(new Error("Download was cancelled"));

    xhr.send();
  });
}

// ─── Upload to Cloudinary then register with backend ─────────────────────────
//
// Previously this sent the raw file through /api/proxy/videos (hitting Vercel's
// 4.5MB limit). Now the browser uploads directly to Cloudinary — no size cap —
// then tells the backend the Cloudinary URL so it can start AI processing.

async function uploadToBackend(
  file: File,
  title: string,
  onProgress: (pct: number) => void
): Promise<{ videoId: string; cloudinaryUrl: string }> {
  // Step 1: upload directly to Cloudinary from the browser
  const cloudinaryResult = await uploadToCloudinary(file, onProgress);

  // Step 2: register the video with the backend (tiny JSON, no proxy size issue)
  const response = await apiClient.post("/videos/register", {
    cloudinaryUrl: cloudinaryResult.secureUrl,
    publicId:      cloudinaryResult.publicId,
    title,
    sourceType:    "upload",
    style:         "viral",
    duration:      cloudinaryResult.duration,
    bytes:         cloudinaryResult.bytes,
  });

  const data = response.data;
  const videoId =
    data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId ?? null;
  const cloudinaryUrl =
    data?.video?.url ?? data?.url ?? data?.data?.url ?? data?.cloudinaryUrl
    ?? cloudinaryResult.secureUrl; // fall back to Cloudinary's own URL

  if (!videoId) {
    throw new Error("Upload succeeded but no video ID was returned.");
  }

  return { videoId: String(videoId), cloudinaryUrl };
}

// ─── Phase labels ─────────────────────────────────────────────────────────────

function labelFor(phase: YouTubeImportPhase, progress: number): string {
  switch (phase) {
    case "fetching-info": return "Getting video info…";
    case "downloading":
      return progress >= 0
        ? `Downloading video… ${progress}%`
        : "Downloading video…";
    case "uploading":
      return `Uploading to Cloudinary… ${progress}%`;
    case "done":  return "Upload complete!";
    case "error": return "Import failed";
    default:      return "";
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL: YouTubeImportState = {
  phase:         "idle",
  progress:      0,
  label:         "",
  error:         null,
  videoTitle:    null,
  videoId:       null,
  cloudinaryUrl: null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useYouTubeImport
 *
 *   1. Extract video ID from URL
 *   2. Get YouTube info from backend /videos/youtube-info/{videoId}
 *   3. Download video in browser from the provided downloadUrl (user's IP)
 *   4. Upload file directly to Cloudinary, then register via POST /videos/register
 *   5. saveActiveJob + return { videoId, cloudinaryUrl }
 *
 * run() always returns the real error — never reads stale React state.
 */
export function useYouTubeImport() {
  const [state, setState] = useState<YouTubeImportState>(INITIAL);

  const set = useCallback(
    (patch: Partial<YouTubeImportState>) =>
      setState((prev) => ({ ...prev, ...patch })),
    []
  );

  const reset = useCallback(() => setState(INITIAL), []);

  const run = useCallback(
    async (url: string, targetPlatform: string): Promise<YouTubeImportResult> => {
      // ── Step 1: Extract video ID ────────────────────────────────────────
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        const error = "Could not extract a YouTube video ID from that URL.";
        set({ phase: "error", label: "Import failed", error });
        return { error };
      }

      try {
        // ── Step 2: Get YouTube info from backend ─────────────────────────
        set({ phase: "fetching-info", progress: 0, error: null, label: labelFor("fetching-info", 0) });
        
        const { downloadUrl, title: videoTitle } = await getYouTubeInfo(videoId);
        set({ videoTitle });

        // ── Step 3: Download video in browser ────────────────────────────
        set({ phase: "downloading", progress: 0, label: labelFor("downloading", 0) });
        
        const safeFilename = videoTitle.replace(/[^a-zA-Z0-9\s-_]/g, "").trim().substring(0, 100) + ".mp4";
        const file = await downloadVideo(
          downloadUrl,
          safeFilename,
          (pct) => set({ progress: pct, label: labelFor("downloading", pct) })
        );

        // ── Step 4: Upload to backend ────────────────────────────────────
        set({ phase: "uploading", progress: 0, label: labelFor("uploading", 0) });
        
        const uploadResult = await uploadToBackend(
          file,
          videoTitle,
          (pct) => set({ progress: pct, label: labelFor("uploading", pct) })
        );

        // ── Step 5: Done ─────────────────────────────────────────────────
        saveActiveJob(uploadResult.videoId);
        set({
          phase:         "done",
          progress:      100,
          label:         labelFor("done", 100),
          videoId:       uploadResult.videoId,
          cloudinaryUrl: uploadResult.cloudinaryUrl,
        });

        return uploadResult;

      } catch (err: any) {
        // ── If the youtube-info service itself is down, skip the fallback ─
        // (the backend is the common failure point; calling /videos/from-url
        // would just produce a second 500 and confuse the user further)
        if (err instanceof YouTubeInfoUnavailableError) {
          const friendly = err.message;
          set({ phase: "error", label: "Import failed", error: friendly });
          return { error: friendly };
        }

        // ── Fallback: Try backend download if browser download/info failed ─
        
        try {
          set({ phase: "fetching-info", progress: 0, label: "Processing video on server…" });
          
          const response = await apiClient.post("/videos/from-url", {
            url: url.trim(),
            targetPlatforms: [targetPlatform],
            style: "viral",
          });

          const data = response.data;
          const backendVideoId = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
          const cloudinaryUrl = data?.video?.url ?? data?.url ?? data?.data?.url ?? data?.cloudinaryUrl ?? null;

          if (!backendVideoId) {
            throw new Error("Backend download failed - no video ID returned.");
          }

          saveActiveJob(String(backendVideoId));
          set({
            phase:         "done",
            progress:      100,
            label:         labelFor("done", 100),
            videoId:       String(backendVideoId),
            cloudinaryUrl: cloudinaryUrl ?? "",
          });

          return { videoId: String(backendVideoId), cloudinaryUrl: cloudinaryUrl ?? "" };

        } catch (fallbackErr: any) {
          const status: number = (err as any)?.status ?? err?.response?.status ?? 0;
          const raw: string =
            err?.response?.data?.message ?? err?.message ?? "Import failed. Please try again.";
          const msg = Array.isArray(raw) ? raw[0] : raw;

          let friendly = msg;
          if (status === 401) {
            friendly = "Session expired — please log in and try again.";
          } else if (status === 403) {
            friendly = "This video is private or requires sign-in.";
          } else if (status === 404) {
            friendly = "Video not found or unavailable.";
          } else if (status === 422) {
            friendly = msg;
          } else if (status === 429) {
            friendly = "Too many requests — please wait a moment and try again.";
          } else if (msg.toLowerCase().includes("private") || msg.toLowerCase().includes("unavailable")) {
            friendly = "This video is private or unavailable. Try a public video.";
          } else if (msg.toLowerCase().includes("network error") || msg.toLowerCase().includes("failed to fetch")) {
            friendly = "Network error — please check your connection and try again.";
          } else if (msg.toLowerCase().includes("download")) {
            friendly = "Failed to download video from YouTube. The video might be region-restricted or unavailable.";
          } else {
            friendly = "Download failed. The video might be region-restricted or the service is temporarily unavailable.";
          }

          set({ phase: "error", label: "Import failed", error: friendly });
          return { error: friendly };
        }
      }
    },
    [set]
  );

  return { state, run, reset };
}
