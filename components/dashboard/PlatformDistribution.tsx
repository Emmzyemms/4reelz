"use client";

import React from "react";
import { MonitorPlay, Plus } from "lucide-react";

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const platforms = [
  { name: "YouTube Shorts", icon: YoutubeIcon, percentage: 45, color: "#FF0000", textColor: "text-red-500" },
  { name: "TikTok", icon: MonitorPlay, percentage: 32, color: "#EE1D52", textColor: "text-[#EE1D52]" },
  { name: "Instagram Reels", icon: InstagramIcon, percentage: 23, color: "#E1306C", textColor: "text-pink-500" },
];

export default function PlatformDistribution() {
  return (
    <div className="bg-[#111111] border border-white/5 rounded-[24px] p-8 flex flex-col gap-8 group">
      <h3 className="text-[18px] font-bold text-white tracking-tight">Distribution</h3>
      
      <div className="space-y-6">
        {platforms.map((platform) => (
          <div key={platform.name} className="flex items-center justify-between group/item">
            <div className="flex items-center gap-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.03]" 
                style={{ backgroundColor: `${platform.color}15` }}
              >
                <platform.icon className={`w-5 h-5 ${platform.textColor}`} />
              </div>
              <span className="text-[14px] font-medium text-white">{platform.name}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[14px] font-bold text-brand">{platform.percentage}%</span>
              <div className="w-24 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out" 
                  style={{ 
                    width: `${platform.percentage}%`, 
                    backgroundColor: platform.color,
                    boxShadow: `0 0 10px ${platform.color}50` 
                  }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-3.5 rounded-xl border border-white/5 text-[14px] font-bold text-white hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2">
        <Plus className="w-4 h-4 text-[#5A6F65]" />
        Connect New Platform
      </button>
    </div>
  );
}
