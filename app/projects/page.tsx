"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectsData } from "@/lib/queries";
import ProjectsContent from "@/components/projects/ProjectsContent";
import WorldCupBall from "@/components/shared/WorldCupBall";
import { Loader2 } from "lucide-react";

function ProjectsInner() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId") ?? undefined;
  const queryClient = useQueryClient();

  // Check if the processing page already seeded the cache
  const cachedClips = queryClient.getQueryData<any[]>(["projectsData", videoId]);
  const hasCachedData = Array.isArray(cachedClips) && cachedClips.length > 0;

  const { data: clips = [], isLoading, isFetching } = useQuery({
    queryKey: ["projectsData", videoId],
    queryFn: () => getProjectsData(videoId),
    // If cache is already seeded, treat it as fresh — no refetch on mount
    staleTime: hasCachedData ? 30_000 : 2_000,
    // Poll only when we have a videoId but no clips yet
    refetchInterval: (query) => {
      if (!videoId) return false;
      const hasClips = Array.isArray(query.state.data) && query.state.data.length > 0;
      return hasClips ? false : 3_000;
    },
  });

  const stillGenerating = !!videoId && !isLoading && clips.length === 0;

  // Hard loading — only when there's no cache at all
  if (isLoading && !hasCachedData) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
          <p className="text-[#5A6F65] text-sm font-medium">Loading clips…</p>
        </div>
      </div>
    );
  }

  // Clips haven't arrived yet and we're actively polling
  if (stillGenerating) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="flex flex-col items-center gap-8 text-center">
          <WorldCupBall size={90} />
          <div className="space-y-2">
            <p className="text-white text-[20px] font-extrabold tracking-tight">
              AI is finishing up your clips…
            </p>
            <p className="text-[#5A6F65] text-[14px] font-medium max-w-xs mx-auto leading-relaxed">
              {isFetching ? "Checking now…" : "Checking every 3 seconds — they'll appear automatically."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-brand"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <ProjectsContent clips={clips} />;
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen bg-[#050505]">
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
        </div>
      }
    >
      <ProjectsInner />
    </Suspense>
  );
}
