"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export default function RevenueChart() {
  // Mock data for the curve
  const points = [
    { x: 0, y: 140 },
    { x: 100, y: 135 },
    { x: 200, y: 145 },
    { x: 300, y: 130 },
    { x: 400, y: 110 },
    { x: 500, y: 125 },
    { x: 600, y: 115 },
    { x: 700, y: 120 },
  ];

  // Helper to generate cubic bezier points for a smooth curve
  const generatePath = () => {
    let d = "M -50 200 "; // Start below for fill
    d += "L 0 140 ";
    
    // Simple smooth curve calculation
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += `S ${cx} ${p0.y}, ${p1.x} ${p1.y} `;
    }
    
    const last = points[points.length - 1];
    d += `L ${last.x + 50} 200 Z`; // Close path below
    return d;
  };

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <div className="bg-[#111111] border border-white/5 rounded-[24px] p-8 flex flex-col gap-8 h-full relative overflow-hidden group">
      <div className="flex items-center justify-between relative z-10">
        <h3 className="text-[18px] font-bold text-white tracking-tight">Revenue Trend</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-white/5 rounded-xl text-[13px] text-[#8e9895] hover:text-white transition-colors">
          Last 7 Days
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-[220px] relative mt-4">
        {/* SVG Chart */}
        <svg 
          viewBox="0 0 700 200" 
          className="w-full h-full overflow-visible drop-shadow-[0_0_20px_rgba(0,229,143,0.1)]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00ff9c" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00ff9c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff9c" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#00ff9c" stopOpacity="1" />
              <stop offset="100%" stopColor="#00ff9c" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          {/* Fill */}
          <path 
            d={generatePath()} 
            fill="url(#chartGradient)" 
            className="animate-pulse"
          />
          
          {/* Line */}
          <path 
            d={generatePath().split("Z")[0]} // Same path without closing
            fill="none" 
            stroke="url(#lineGradient)" 
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round" 
          />

          {/* Indicators for THU (Active) */}
          <circle cx="300" cy="130" r="6" fill="#00ff9c" className="animate-ping opacity-50" />
          <circle cx="300" cy="130" r="4" fill="#00ff9c" />
          <line x1="300" y1="130" x2="300" y2="200" stroke="#00ff9c" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
        </svg>

        {/* Labels */}
        <div className="flex justify-between w-full mt-6">
          {days.map((day, i) => (
            <span 
              key={day} 
              className={`text-[11px] font-bold tracking-wider ${day === "THU" ? "text-brand" : "text-[#4A5D54]"}`}
            >
              {day}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
