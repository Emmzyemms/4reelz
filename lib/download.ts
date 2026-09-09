/**
 * download.ts
 *
 * Single place that knows how to turn a Cloudinary (or any CDN) URL into a
 * browser Save-dialog download.
 *
 * Usage:
 *   import { triggerDownload } from "@/lib/download";
 *   triggerDownload(downloadUrl, "my-clip.mp4");
 *
 * How it works:
 *   1. If the URL is already same-origin (e.g. a blob: or /api/ URL) the
 *      browser `download` attribute works natively — we use it directly.
 *   2. If the URL is cross-origin (Cloudinary, S3, etc.) we route it through
 *      our own /api/download proxy which adds Content-Disposition: attachment,
 *      making the browser always show a Save dialog.
 */

function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const { origin } = new URL(url, window.location.href);
    return origin === window.location.origin;
  } catch {
    return false;
  }
}

function buildProxyUrl(remoteUrl: string, filename: string): string {
  const params = new URLSearchParams({
    url:      remoteUrl,
    filename: filename.endsWith(".mp4") ? filename : `${filename}.mp4`,
  });
  return `/api/download?${params.toString()}`;
}

/**
 * Trigger a browser file-save for `url`.
 *
 * @param url      - The file URL (Cloudinary, S3, blob:, etc.)
 * @param filename - Desired filename shown in the Save dialog (without extension
 *                   is fine — .mp4 is appended automatically for cross-origin URLs)
 */
export function triggerDownload(url: string, filename: string): void {
  if (!url) return;

  const href = isSameOrigin(url) ? url : buildProxyUrl(url, filename);

  const a = document.createElement("a");
  a.href     = href;
  a.download = filename.endsWith(".mp4") ? filename : `${filename}.mp4`;
  // target/_blank not needed — the proxy returns inline to the same tab
  // which is cleaner UX (no flash of a new tab)
  document.body.appendChild(a);
  a.click();
  // Clean up immediately — the browser has already queued the navigation
  document.body.removeChild(a);
}
