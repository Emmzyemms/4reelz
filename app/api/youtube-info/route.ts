import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/youtube-info?videoId=<id>
 *
 * Resolves a YouTube stream URL entirely server-side using youtubei.js
 * (InnerTube). The Next.js server makes the InnerTube call; the browser then
 * downloads the signed CDN URL directly (user's IP, never blocked).
 *
 * Client strategy:
 *   1. WEB  — produces muxed progressive MP4s, easiest to download.
 *   2. IOS  — widely supported fallback; also returns muxed streams.
 *   3. ANDROID — last resort; usually has the widest format coverage.
 *
 * Returns: { title, downloadUrl, thumbnail, durationSeconds, fileSizeBytes, quality }
 */

const PREFERRED_QUALITIES = ["720p", "480p", "360p", "240p", "144p"];

/** Pick the best progressive (muxed) format from a formats array. */
function pickBestFormat(formats: any[]): any | null {
  // Try preferred quality ladder first
  for (const quality of PREFERRED_QUALITIES) {
    const match = formats.find(
      (f: any) =>
        f.quality_label === quality &&
        (f.mime_type?.includes("video/mp4") || f.mime_type?.includes("video/webm")) &&
        f.url
    );
    if (match) return match;
  }
  // Any progressive format with a URL
  return formats.find(
    (f: any) =>
      (f.mime_type?.includes("video/mp4") || f.mime_type?.includes("video/webm")) &&
      f.url
  ) ?? null;
}

async function resolveWithClient(
  videoId: string,
  client: "WEB" | "IOS" | "ANDROID"
): Promise<{
  title: string;
  downloadUrl: string;
  thumbnail: string;
  durationSeconds: number;
  fileSizeBytes: number | null;
  quality: string;
} | null> {
  const { Innertube, ClientType } = await import("youtubei.js");

  const clientTypeMap: Record<"WEB" | "IOS" | "ANDROID", any> = {
    WEB:     ClientType.WEB,
    IOS:     ClientType.IOS,
    ANDROID: ClientType.ANDROID,
  };

  const yt = await Innertube.create({
    client_type: clientTypeMap[client],
    cache: undefined,
  });

  const info = await yt.getBasicInfo(videoId, { client });

  const title: string =
    (info.basic_info?.title as string | undefined) ?? `YouTube video ${videoId}`;
  const thumbnail: string =
    (info.basic_info?.thumbnail?.[0]?.url as string | undefined) ?? "";
  const durationSeconds: number =
    (info.basic_info?.duration as number | undefined) ?? 0;

  // Progressive (muxed) formats — prefer these because one download = video+audio
  const progressive = info.streaming_data?.formats ?? [];
  let chosen = pickBestFormat(progressive);

  // Adaptive video-only formats as last resort
  if (!chosen) {
    const adaptive = info.streaming_data?.adaptive_formats ?? [];
    chosen = adaptive.find((f: any) => f.mime_type?.includes("video/mp4") && f.url) ?? null;
  }

  if (!chosen?.url) return null;

  return {
    title,
    downloadUrl:   chosen.url as string,
    thumbnail,
    durationSeconds,
    fileSizeBytes: (chosen.content_length as number | undefined) ?? null,
    quality:       (chosen.quality_label as string | undefined) ?? "unknown",
  };
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId")?.trim();

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Missing or invalid videoId parameter." },
      { status: 400 }
    );
  }

  const clients: Array<"WEB" | "IOS" | "ANDROID"> = ["WEB", "IOS", "ANDROID"];
  let lastError = "Unknown error";

  for (const client of clients) {
    try {
      console.log(`[youtube-info] trying client=${client} for ${videoId}`);
      const result = await resolveWithClient(videoId, client);

      if (result) {
        console.log(`[youtube-info] success client=${client} quality=${result.quality}`);
        return NextResponse.json(result);
      }

      // Got a response but no usable format — try next client
      console.warn(`[youtube-info] client=${client} returned no formats, trying next`);
      lastError = "No downloadable format found";
    } catch (err: any) {
      const msg: string = err?.message ?? "Unknown error";
      console.warn(`[youtube-info] client=${client} error: ${msg}`);
      lastError = msg;

      // Hard errors — no point retrying with another client
      if (
        msg.includes("VIDEO_UNAVAILABLE") ||
        msg.includes("not available") ||
        msg.includes("UNPLAYABLE")
      ) {
        return NextResponse.json(
          { error: "This video is unavailable or private." },
          { status: 404 }
        );
      }
      if (msg.includes("LOGIN_REQUIRED") || msg.includes("age")) {
        return NextResponse.json(
          { error: "This video requires sign-in or is age-restricted." },
          { status: 403 }
        );
      }
      // Otherwise keep trying next client
    }
  }

  // All three clients exhausted
  console.error(`[youtube-info] all clients failed for ${videoId}: ${lastError}`);
  return NextResponse.json(
    { error: "No downloadable format available for this video. Try uploading the file directly." },
    { status: 422 }
  );
}
