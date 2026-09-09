/**
 * processingStore
 *
 * Persists the active video-processing job in localStorage so that:
 *  - A page refresh re-attaches to the same SSE/polling loop
 *  - Navigating away and back shows a "Resume" banner
 *  - The backend job is NEVER re-triggered; the UI simply reconnects to watch it
 *
 * Shape stored in localStorage key "clp_active_job":
 * {
 *   videoId: string
 *   startedAt: number   // epoch ms — used to estimate elapsed time
 * }
 */

const KEY = "clp_active_job";

export interface ActiveJob {
  videoId: string;
  startedAt: number;
}

/** Persist a new job. Call this right before router.push("/processing"). */
export function saveActiveJob(videoId: string): void {
  if (typeof window === "undefined") return;
  const job: ActiveJob = { videoId, startedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(job));
  } catch {
    // Storage quota exceeded or private browsing — degrade gracefully
  }
}

/** Read back the persisted job (null if nothing stored). */
export function loadActiveJob(): ActiveJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as ActiveJob;
    // Basic sanity — must have a real videoId
    if (!job?.videoId || job.videoId === "undefined") return null;
    return job;
  } catch {
    return null;
  }
}

/** Remove the job once it completes, errors, or is explicitly dismissed. */
export function clearActiveJob(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
