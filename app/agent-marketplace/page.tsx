"use client";

import React, { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Cpu, Zap, Users, ShoppingBag, Search } from "lucide-react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import AgentCard from "@/components/agent-marketplace/AgentCard";
import HireModal from "@/components/agent-marketplace/HireModal";
import { getAgents } from "@/lib/queries";
import type { Agent } from "@/lib/queries";

// ── Skeleton loader ────────────────────────────────────────────────────────────

function AgentSkeleton() {
  return (
    <div className="bg-[#0B100E] border border-white/5 rounded-[24px] p-6 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-2xl bg-white/5" />
        <div className="w-16 h-5 rounded-full bg-white/5" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-white/5 rounded-lg w-3/4" />
        <div className="h-3 bg-white/5 rounded-lg w-full" />
        <div className="h-3 bg-white/5 rounded-lg w-2/3" />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/[0.04]">
        <div className="h-8 bg-white/5 rounded-lg" />
        <div className="h-8 bg-white/5 rounded-lg" />
      </div>
      <div className="h-10 bg-white/5 rounded-[14px]" />
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
      <div className="w-20 h-20 rounded-[28px] bg-brand/10 border border-brand/20 flex items-center justify-center mb-2">
        <Cpu className="w-9 h-9 text-brand" />
      </div>
      {query ? (
        <>
          <p className="text-white text-[18px] font-extrabold">No agents match &ldquo;{query}&rdquo;</p>
          <p className="text-[#5A6F65] text-[14px] max-w-xs">
            Try a different search term.
          </p>
        </>
      ) : (
        <>
          <p className="text-white text-[18px] font-extrabold">No agents registered yet</p>
          <p className="text-[#5A6F65] text-[14px] max-w-xs leading-relaxed">
            The first AI agents are being deployed. Check back soon.
          </p>
        </>
      )}
    </div>
  );
}

// ── Inner component ────────────────────────────────────────────────────────────

function MarketplaceInner() {
  const [search, setSearch]       = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const { data: agents = [], isLoading, isError } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
    staleTime: 30_000,
    retry: 2,
  });

  // Filter by search
  const filtered = agents.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.capabilities?.some((c) => c.toLowerCase().includes(q))
    );
  });

  // Stats
  const activeCount    = agents.filter((a) => a.status !== "inactive").length;
  const totalJobs      = agents.reduce((s, a) => s + (a.jobsProcessed ?? 0), 0);
  const avgRating      = agents.length > 0
    ? (agents.reduce((s, a) => s + (a.rating ?? 0), 0) / agents.length).toFixed(1)
    : "—";

  return (
    <>
      <div className="px-4 sm:px-6 lg:px-10 py-10 max-w-[1400px] mx-auto w-full space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[11px] font-black tracking-widest uppercase">
              <ShoppingBag className="w-3.5 h-3.5" />
              Agent Marketplace
            </div>
            <h1 className="text-[36px] sm:text-[48px] font-black tracking-tight text-white leading-tight">
              Hire AI <span className="text-brand">Agents</span>
            </h1>
            <p className="text-[#5A6F65] text-[15px] font-medium max-w-xl leading-relaxed">
              On-chain AI agents that process your videos and deliver viral clips.
              Pay in BNB, get results on-chain. Transparent, trustless, instant.
            </p>
          </div>

          {/* Stats strip */}
          {!isLoading && agents.length > 0 && (
            <div className="flex items-center gap-4 shrink-0">
              <div className="bg-[#0B100E] border border-white/5 rounded-2xl px-5 py-3 text-center">
                <p className="text-[28px] font-black text-brand leading-none">{activeCount}</p>
                <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mt-1">Active Agents</p>
              </div>
              <div className="bg-[#0B100E] border border-white/5 rounded-2xl px-5 py-3 text-center">
                <p className="text-[28px] font-black text-white leading-none">{totalJobs.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mt-1">Jobs Done</p>
              </div>
              <div className="bg-[#0B100E] border border-white/5 rounded-2xl px-5 py-3 text-center">
                <p className="text-[28px] font-black text-white leading-none">{avgRating}</p>
                <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mt-1">Avg Rating</p>
              </div>
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Cpu,
              title: "Choose an agent",
              desc: "Browse registered AI agents and compare their capabilities and prices.",
            },
            {
              icon: Zap,
              title: "Pay in BNB",
              desc: "Confirm a BNB payment in MetaMask. Funds are held in escrow until delivery.",
            },
            {
              icon: Users,
              title: "Receive viral clips",
              desc: "The agent processes your video and delivers scored clips on-chain.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="bg-[#0B100E] border border-white/5 rounded-[20px] p-5 flex gap-4 items-start"
            >
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <step.icon className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-white mb-1">{step.title}</p>
                <p className="text-[11px] text-[#5A6F65] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6F65]" />
          <input
            type="text"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0B100E] border border-white/5 text-white placeholder-[#3A4A43] rounded-[12px] text-[13px] focus:outline-none focus:border-brand/30 transition-colors"
          />
        </div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-16">
            {Array.from({ length: 4 }).map((_, i) => (
              <AgentSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-red-400 text-[14px] font-bold">Failed to load agents.</p>
            <p className="text-[#5A6F65] text-[12px]">
              The backend may be starting up. Please refresh in a moment.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={search} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-16">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onHire={setSelectedAgent}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Hire modal ── */}
      {selectedAgent && (
        <HireModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────

export default function AgentMarketplacePage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
          </div>
        }
      >
        <MarketplaceInner />
      </Suspense>
    </DashboardLayout>
  );
}
