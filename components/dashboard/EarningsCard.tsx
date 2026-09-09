"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, CheckCircle2, ArrowUpRight, Loader2 } from "lucide-react";
import { getEarningsData } from "@/lib/queries";

export default function EarningsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["earningsData"],
    queryFn: getEarningsData,
  });

  const totalBnb = data?.totalBnb ?? data?.totalXlm ?? "0";
  const tipCount = data?.tipCount || 0;
  const recentTips = data?.recentTips || [];
  
  // Generate mock earnings data for the graph (7 days)
  const earningsGraphData = React.useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const currentTotal = parseFloat(totalBnb);
    // Create a realistic growth curve ending at currentTotal
    return days.map((day, i) => {
      const progress = i / (days.length - 1);
      const value = currentTotal * progress * 0.8; // Slight curve
      return { day, value: value.toFixed(4) };
    });
  }, [totalBnb]);

  if (isLoading) {
    return (
      <div className="bg-[#0A0F0D] border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }

  const formatBnb = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num.toFixed(4);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-[#0A0F0D] border border-white/5 rounded-2xl p-6 hover:border-brand/20 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Earnings</h3>
            <p className="text-xs text-[#5A6F65]">BNB tip earnings</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#00E58F] text-xs font-bold">
          <TrendingUp className="w-3 h-3" />
          <span>+12.5%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#0B100E] border border-white/5 rounded-xl p-4">
          <p className="text-[#5A6F65] text-xs font-bold uppercase tracking-wider mb-1">Total Earnings</p>
          <p className="text-2xl font-extrabold text-white">
            {formatBnb(totalBnb)} <span className="text-sm font-bold text-[#5A6F65]">BNB</span>
          </p>
        </div>
        <div className="bg-[#0B100E] border border-white/5 rounded-xl p-4">
          <p className="text-[#5A6F65] text-xs font-bold uppercase tracking-wider mb-1">Total Tips</p>
          <p className="text-2xl font-extrabold text-white">{tipCount}</p>
        </div>
      </div>

      {/* Earnings Graph */}
      <div className="bg-[#0B100E] border border-white/5 rounded-xl p-4 mb-6">
        <p className="text-[#5A6F65] text-xs font-bold uppercase tracking-wider mb-4">Earnings This Week</p>
        <div className="relative h-24">
          <svg className="w-full h-full" viewBox="0 0 280 96" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="0" x2="280" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="48" x2="280" y2="48" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="96" x2="280" y2="96" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            
            {/* Area fill */}
            <path
              d={`M0,96 L0,${96 - (parseFloat(earningsGraphData[0].value) / (parseFloat(totalBnb) || 1) * 80)} ${earningsGraphData.map((d, i) => {
                const x = (i / (earningsGraphData.length - 1)) * 280;
                const y = 96 - (parseFloat(d.value) / (parseFloat(totalBnb) || 1) * 80);
                return `L${x},${y}`;
              }).join(' ')} L280,96 Z`}
              fill="url(#gradient)"
              opacity="0.3"
            />
            
            {/* Line */}
            <path
              d={`M0,${96 - (parseFloat(earningsGraphData[0].value) / (parseFloat(totalBnb) || 1) * 80)} ${earningsGraphData.map((d, i) => {
                const x = (i / (earningsGraphData.length - 1)) * 280;
                const y = 96 - (parseFloat(d.value) / (parseFloat(totalBnb) || 1) * 80);
                return `L${x},${y}`;
              }).join(' ')}`}
              fill="none"
              stroke="#00E58F"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00E58F" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#00E58F" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Day labels */}
          <div className="flex justify-between mt-2">
            {earningsGraphData.map((d, i) => (
              <span key={d.day} className="text-[10px] text-[#5A6F65] font-medium">
                {d.day}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Tips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#5A6F65] uppercase tracking-wider">Recent Tips</p>
          {recentTips.length > 0 && (
            <span className="text-xs text-[#5A6F65]">{recentTips.length} tips</span>
          )}
        </div>

        {recentTips.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[#5A6F65] text-sm">No tips received yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTips.slice(0, 3).map((tip: any) => (
              <div
                key={tip.id}
                className="flex items-center justify-between p-3 bg-[#0B100E] border border-white/5 rounded-lg hover:border-brand/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-brand" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {formatAddress(tip.senderAddress)}
                    </p>
                    <p className="text-[10px] text-[#5A6F65]">{formatDate(tip.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-brand">+{formatBnb(tip.amount)} BNB</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Link */}
      {recentTips.length > 3 && (
        <button className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-bold text-[#5A6F65] hover:text-brand transition-colors py-2">
          View all tips
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
