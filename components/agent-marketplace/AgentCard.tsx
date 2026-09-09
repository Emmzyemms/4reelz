"use client";

import React from "react";
import { Star, Zap, CheckCircle2, Cpu, ExternalLink } from "lucide-react";
import type { Agent } from "@/lib/queries";
import { bscscanAddressUrl, truncateAddress } from "@/lib/bnbWallet";

interface AgentCardProps {
  agent: Agent;
  onHire: (agent: Agent) => void;
}

export default function AgentCard({ agent, onHire }: AgentCardProps) {
  const isActive = agent.status !== "inactive";

  const rating = agent.rating ?? 0;
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="group bg-[#0B100E] border border-white/5 rounded-[24px] overflow-hidden transition-all duration-500 hover:border-brand/40 hover:shadow-[0_0_40px_rgba(0,229,143,0.08)] hover:-translate-y-0.5 flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          {/* Agent avatar */}
          <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6 text-brand" />
          </div>

          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            isActive
              ? "bg-brand/10 border-brand/20 text-brand"
              : "bg-white/5 border-white/10 text-[#5A6F65]"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-brand animate-pulse" : "bg-[#5A6F65]"}`} />
            {isActive ? "Active" : "Offline"}
          </div>
        </div>

        {/* Name + description */}
        <h3 className="text-[16px] font-extrabold text-white mb-1.5 group-hover:text-brand transition-colors leading-tight">
          {agent.name}
        </h3>
        <p className="text-[12px] text-[#5A6F65] leading-relaxed line-clamp-2">
          {agent.description}
        </p>
      </div>

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="px-6 pb-4 flex flex-wrap gap-1.5">
          {agent.capabilities.slice(0, 4).map((cap) => (
            <span
              key={cap}
              className="text-[9px] font-bold uppercase tracking-widest bg-white/[0.03] border border-white/5 text-[#5A6F65] px-2 py-0.5 rounded-md"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="px-6 py-4 border-t border-white/[0.04] grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mb-0.5">
            Jobs Done
          </p>
          <p className="text-[18px] font-black text-white">
            {agent.jobsProcessed?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#5A6F65] uppercase tracking-widest mb-0.5">
            Rating
          </p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${
                  i <= fullStars
                    ? "text-brand fill-brand"
                    : i === fullStars + 1 && hasHalf
                    ? "text-brand fill-brand/50"
                    : "text-white/10 fill-white/5"
                }`}
              />
            ))}
            <span className="text-[11px] font-bold text-white ml-1">
              {rating > 0 ? rating.toFixed(1) : "New"}
            </span>
          </div>
        </div>
      </div>

      {/* Contract address */}
      {agent.contractAddress && (
        <div className="px-6 pb-4">
          <a
            href={bscscanAddressUrl(agent.contractAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[9px] font-mono text-[#5A6F65] hover:text-brand transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            {truncateAddress(agent.contractAddress, 8, 6)}
            <span className="text-[8px] text-[#3A4A43]">on BscScan</span>
          </a>
        </div>
      )}

      {/* Price + CTA */}
      <div className="px-6 pb-6 mt-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] font-bold text-[#5A6F65] uppercase tracking-widest">Price per job</p>
            <p className="text-[22px] font-black text-brand leading-tight">
              {agent.pricePerJobBNB}
              <span className="text-[12px] font-bold text-[#5A6F65] ml-1">BNB</span>
            </p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#5A6F65]">
            <Zap className="w-3 h-3 text-brand" />
            <span>Instant</span>
          </div>
        </div>

        <button
          onClick={() => onHire(agent)}
          disabled={!isActive}
          className="w-full py-3 rounded-[14px] bg-brand hover:bg-brand-hover disabled:bg-white/5 disabled:text-[#5A6F65] disabled:cursor-not-allowed text-black font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isActive ? `Hire for ${agent.pricePerJobBNB} BNB` : "Unavailable"}
        </button>
      </div>
    </div>
  );
}
