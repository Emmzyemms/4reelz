"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, TrendingUp, Clock, Zap } from "lucide-react";
import AIClipCard from "./AIClipCard";

interface Clip {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  platform: string;
  createdAt: string | null;
  creatorAddress?: string;
  creatorName?: string;
  tippingEnabled?: boolean;
}

interface AIProjectsContentProps {
  clips: Clip[];
}

const SORT_OPTIONS = [
  { key: "score", label: "Viral Score", icon: TrendingUp },
  { key: "newest", label: "Newest", icon: Clock },
  { key: "duration", label: "Duration", icon: Zap },
];

export default function AIProjectsContent({ clips }: AIProjectsContentProps) {
  const [sort, setSort] = useState("score");

  const filtered = useMemo(() => {
    let result = [...clips];

    // Sort only
    if (sort === "score") {
      result.sort((a, b) => b.score - a.score);
    } else if (sort === "newest") {
      result.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sort === "duration") {
      const toSecs = (d: string) => {
        const [m, s] = d.split(":").map(Number);
        return m * 60 + s;
      };
      result.sort((a, b) => toSecs(b.duration) - toSecs(a.duration));
    }

    return result;
  }, [clips, sort]);

  const highCount = clips.filter((c) => c.scoreKey === "high").length;
  const avgScore =
    clips.length > 0
      ? Math.round(clips.reduce((a, c) => a + c.score, 0) / clips.length)
      : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-10 max-w-[1400px] mx-auto w-full space-y-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[11px] font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Public Feed
          </div>
         
          <p className="text-[#5A6F65] text-[15px] font-medium max-w-lg leading-relaxed">
            Discover viral clips from creators around the world. Browse, preview, and tip to download.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="bg-[#0B100E] border border-white/5 rounded-2xl px-5 py-3 text-center">
            <p className="text-[28px] font-black text-white leading-none">{clips.length}</p>
            <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mt-1">Total Clips</p>
          </div>
          <div className="bg-[#0B100E] border border-white/5 rounded-2xl px-5 py-3 text-center">
            <p className="text-[28px] font-black text-brand leading-none">{highCount}</p>
            <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mt-1">High Viral</p>
          </div>
          <div className="bg-[#0B100E] border border-white/5 rounded-2xl px-5 py-3 text-center">
            <p className="text-[28px] font-black text-white leading-none">{avgScore}</p>
            <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mt-1">Avg Score</p>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2">
        {/* Sort */}
        {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
              sort === key
                ? "bg-white/10 border border-white/20 text-white"
                : "bg-[#0B100E] border border-white/8 text-[#5A6F65] hover:text-white hover:border-white/20"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>


      {/* ── Grid ── */}
      {clips.length === 0 ? (
        <EmptyState totalClips={clips.length} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-16">
          {filtered.map((clip) => (
            <AIClipCard key={clip.id} {...clip} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ totalClips }: { totalClips: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
      <div className="w-20 h-20 rounded-[28px] bg-brand/10 border border-brand/20 flex items-center justify-center mb-2">
        <Sparkles className="w-9 h-9 text-brand" />
      </div>
      {totalClips === 0 ? (
        <>
          <p className="text-white text-[18px] font-extrabold">No clips in the feed yet</p>
          <p className="text-[#5A6F65] text-[14px] font-medium max-w-xs leading-relaxed">
            Check back soon to discover viral clips from creators.
          </p>
        </>
      ) : null}
    </div>
  );
}
