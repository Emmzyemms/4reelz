"use client";

import React from "react";
import ClipCard from "./ClipCard";
import { ListFilter, ChevronDown } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
}

interface ClipGridProps {
  clips: Clip[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export default function ClipGrid({
  clips,
  selectedIds,
  onSelect,
  onSelectAll,
  onDelete,
}: ClipGridProps) {
  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center space-y-4">
        <p className="text-[#5A6F65] text-[16px] font-medium">No clips yet.</p>
        <p className="text-[#3A4A43] text-[13px]">Upload a video to start generating clips.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-4">
            <h2 className="text-[36px] font-black text-white tracking-tight leading-none">
              {clips.length} clip{clips.length !== 1 ? "s" : ""}
            </h2>
            <div className="px-2.5 py-1 rounded-md bg-brand/10 border border-brand/20 text-brand text-[10px] font-black tracking-widest leading-none">
              READY
            </div>
          </div>
          <p className="text-[14px] font-medium text-[#5A6F65]">
            AI-generated clips ready to preview and post
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black border border-white/10 text-white font-black text-[14px] transition-all hover:bg-zinc-900 active:scale-[0.98]"
          >
            {selectedIds.length === clips.length ? "Deselect All" : "Select All"}
          </button>
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black border border-white/10 text-white font-black text-[14px] transition-all hover:bg-zinc-900 active:scale-[0.98]">
            <ListFilter className="w-4 h-4 text-[#5A6F65]" />
            <span>Newest First</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5A6F65]" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            {...clip}
            isSelected={selectedIds.includes(clip.id)}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
