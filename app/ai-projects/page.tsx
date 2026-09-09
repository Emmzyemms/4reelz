"use client";

import React, { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/apiClient";
import DashboardLayout from "@/components/shared/DashboardLayout";
import AIProjectsContent from "@/components/ai-projects/AIProjectsContent";
import { Loader2 } from "lucide-react";

// AI-powered platform suggestion based on clip characteristics
function suggestPlatform(clip: any): string {
  const duration = clip.duration || 0;
  const score = clip.viralScore ?? clip.score ?? 0;
  
  // Short clips (< 30s) are perfect for TikTok
  if (duration < 30) return "TikTok";
  
  // Medium clips (30-60s) work well for YouTube Shorts
  if (duration >= 30 && duration < 60) return "YouTube Shorts";
  
  // Longer clips (60-120s) are good for Instagram Reels
  if (duration >= 60 && duration < 120) return "Instagram Reels";
  
  // High viral score clips are great for multiple platforms
  if (score >= 80) return "Multi-Platform";
  
  // Default to TikTok for most AI-generated clips
  return "TikTok";
}

async function getAllClips() {
  const response = await apiClient.get("/clips/feed?page=1&limit=100");
  const raw = response.data.data ?? (Array.isArray(response.data) ? response.data : []);

  if (raw.length > 0) {
    console.log("[feed] sample clip keys:", Object.keys(raw[0]));
    console.log("[feed] full first clip:", JSON.stringify(raw[0]));
  }

  // First pass — map what the feed gives us
  const clips: any[] = raw.map((clip: any) => {
    const score = clip.viralScore ?? clip.score ?? 0;
    const ownerObj = clip.owner ?? null;

    // Accept every field name the backend has ever used for the wallet address
    const creatorAddress =
      ownerObj?.bnbAddress ||
      ownerObj?.walletAddress ||
      ownerObj?.wallet ||
      clip.ownerWallet ||
      clip.creatorAddress ||
      clip.walletAddress ||
      clip.bnbAddress ||
      undefined;
    const creatorName =
      ownerObj?.username ||
      ownerObj?.name ||
      ownerObj?.fullName ||
      clip.creatorName ||
      clip.ownerName ||
      undefined;

    return {
      id: String(clip.id),
      title: clip.title || `Clip #${clip.id}`,
      thumbnail: clip.thumbnail || null,
      clipUrl: clip.clipUrl || null,
      score,
      scoreKey: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
      duration: clip.duration
        ? `${Math.floor(clip.duration / 60).toString().padStart(2, "0")}:${Math.floor(clip.duration % 60).toString().padStart(2, "0")}`
        : "00:00",
      platform: clip.platform || clip.suggestedPlatform || suggestPlatform(clip),
      createdAt: clip.createdAt || null,
      creatorAddress,
      creatorName,
      tippingEnabled: clip.tippingEnabled ?? (creatorAddress ? true : false),
    };
  });

  console.log("[feed] after first pass, clips missing address:",
    clips.filter((c) => !c.creatorAddress).map((c) => c.id)
  );

  // Second pass — fetch /clips/:id/info for every clip that still has no address.
  // Run all requests in parallel (batched at 10) and collect updated versions.
  const missingIdx = clips
    .map((c, i) => (!c.creatorAddress ? i : -1))
    .filter((i) => i !== -1);

  if (missingIdx.length > 0) {
    const BATCH = 10;
    for (let b = 0; b < missingIdx.length; b += BATCH) {
      const batchIdx = missingIdx.slice(b, b + BATCH);
      await Promise.all(
        batchIdx.map(async (idx) => {
          const clip = clips[idx];
          try {
            const res = await apiClient.get(`/clips/${clip.id}/info`);
            const info = res.data;
            const owner = info?.owner;
            console.log(`[feed] /clips/${clip.id}/info owner:`, JSON.stringify(owner));

            // Accept every field name the backend might use
            const addr =
              owner?.bnbAddress ||
              owner?.walletAddress ||
              owner?.wallet ||
              info?.creatorAddress ||
              info?.walletAddress ||
              undefined;

            if (addr) {
              clips[idx] = {
                ...clip,
                creatorAddress: addr,
                creatorName: owner?.username || owner?.name || owner?.fullName || clip.creatorName,
                tippingEnabled: info.tippingEnabled ?? true,
              };
            }
          } catch (e: any) {
            console.warn(`[feed] /clips/${clip.id}/info failed:`, e?.response?.status);
          }
        })
      );
    }
  }

  console.log("[feed] final clips with address:", clips.filter((c) => c.creatorAddress).length, "/", clips.length);

  // Return a new array so React Query always sees a fresh reference
  return [...clips];
}

function AIProjectsInner() {
  const { data: clips = [], isLoading } = useQuery({
    queryKey: ["aiProjects"],
    queryFn: getAllClips,
    staleTime: 0,          // always refetch — we need fresh /info data
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
          <p className="text-[#5A6F65] text-sm font-medium">Loading AI clips…</p>
        </div>
      </div>
    );
  }

  return <AIProjectsContent clips={clips} />;
}

export default function AIProjectsPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
          </div>
        }
      >
        <AIProjectsInner />
      </Suspense>
    </DashboardLayout>
  );
}
