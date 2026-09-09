import React from "react";
import Link from "next/link";

interface LogoProps {
  variant?: "simple" | "full";
  className?: string;
}

export default function Logo({ variant = "full", className = "" }: LogoProps) {
  if (variant === "simple") {
    return (
      <div className={`w-8 h-8 bg-[#00FF85] rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,255,133,0.3)] ${className}`}>
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h10" />
          <path d="M7 16h10" />
        </svg>
      </div>
    );
  }

  return (
    <Link href="/" className={`flex items-center gap-3 text-[19px] font-extrabold tracking-tight text-white hover:opacity-80 transition-opacity ${className}`}>
      <div className="w-[30px] h-[30px] bg-brand rounded-[8px] flex items-center justify-center text-black text-[16px]">
        ⚡
      </div>
      4Reelz
    </Link>
  );
}
