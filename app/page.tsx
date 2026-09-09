import React from "react";
import Image from "next/image";
import AuthForm from "@/components/AuthForm";
import URLForm from "@/components/landing/URLForm";
import LandingLayout from "@/components/shared/LandingLayout";

export default function Home() {
  return (
    <LandingLayout>
      <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 mt-[-40px]">
        {/* Left side */}
        <div className="flex-1 space-y-8 max-w-[580px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/[0.12] border border-brand/20 text-brand text-[11px] font-bold tracking-[0.1em] uppercase">
            <span className="w-2 h-2 rounded-full bg-brand" style={{ boxShadow: "0 0 10px #00E58F" }} />
            AI CLIPPING V1.0 IS LIVE
          </div>
          
          <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight">
            Turn 1 long<br/>video into <span className="text-brand">100+</span><br/>
            <span className="text-brand">viral clips</span>
          </h1>
          
          <p className="text-[#a1a1aa] text-lg max-w-[500px] leading-[1.6]">
            Preview, pick, post & mint — our AI-powered engine finds the high-retention moments for your viral growth across TikTok, Reels, and Shorts.
          </p>

          <URLForm />

          <div className="flex items-center gap-4 text-sm text-[#71717A] pt-2">
            <div className="flex -space-x-2.5">
                <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-800 flex items-center justify-center text-[10px] overflow-hidden relative">
                  <Image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="user" fill sizes="36px" className="object-cover"/>
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-700 flex items-center justify-center text-[10px] overflow-hidden relative">
                  <Image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" alt="user" fill sizes="36px" className="object-cover"/>
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-600 flex items-center justify-center text-[10px] overflow-hidden relative">
                  <Image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jocelyn" alt="user" fill sizes="36px" className="object-cover"/>
                </div>
              </div>
            Joined by 10,000+ creators this month
          </div>
        </div>

        {/* Right side - Login Modal */}
        <div className="w-full max-w-[440px] flex justify-end">
          <AuthForm mode="signup" />
        </div>
      </div>
    </LandingLayout>
  );
}
