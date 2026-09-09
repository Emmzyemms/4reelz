"use client";

// ─── Direct Cloudinary Upload ─────────────────────────────────────────────────
//
// Uploads a File directly from the browser to Cloudinary using an unsigned
// upload preset. This bypasses the Next.js proxy entirely, so Vercel's 4.5MB
// serverless body limit is never hit — even for multi-GB video files.
//
// Flow:
//   Browser → Cloudinary Upload API  (raw file, no size limit)
//   Browser → /api/proxy/videos/register  (just JSON: cloudinaryUrl + metadata)
//
// Required env vars (NEXT_PUBLIC_ so they are available in the browser):
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   — e.g. "mycloudname"
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET — unsigned preset name, e.g. "clipcash_videos"

export interface CloudinaryUploadResult {
  /** Full HTTPS URL to the uploaded asset */
  secureUrl: string;
  /** Cloudinary public_id, e.g. "clipcash_videos/abc123" */
  publicId: string;
  /** Original filename as reported by Cloudinary */
  originalFilename: string;
  /** Duration in seconds (for video assets) */
  duration: number | null;
  /** File size in bytes */
  bytes: number;
  /** Resource type — "video" | "image" | "raw" */
  resourceType: string;
}

/**
 * Upload a File directly to Cloudinary from the browser.
 *
 * @param file        The File object to upload (any type/size).
 * @param onProgress  Called with 0–100 as the upload progresses.
 * @returns           Cloudinary asset metadata including secureUrl.
 */
export function uploadToCloudinary(
  file: File,
  onProgress: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(
        new Error(
          "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and " +
          "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment variables."
        )
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    // Store all uploads in a dedicated folder for easy management
    formData.append("folder", "clipcash_videos");

    const xhr = new XMLHttpRequest();
    // resource_type=auto handles videos, images, and raw files without needing
    // separate endpoints — Cloudinary detects the type from the file content.
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      true
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      } else {
        onProgress(-1); // indeterminate
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            secureUrl:        data.secure_url,
            publicId:         data.public_id,
            originalFilename: data.original_filename ?? file.name,
            duration:         data.duration ?? null,
            bytes:            data.bytes ?? file.size,
            resourceType:     data.resource_type ?? "video",
          });
        } catch {
          reject(new Error("Could not parse Cloudinary response."));
        }
      } else {
        // Cloudinary returns error details in the response body
        let msg = `Cloudinary upload failed (${xhr.status}).`;
        try {
          const err = JSON.parse(xhr.responseText)?.error?.message;
          if (err) msg = err;
        } catch { /* keep default */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during Cloudinary upload."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));

    xhr.send(formData);
  });
}
