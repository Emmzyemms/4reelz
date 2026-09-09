import React from "react";
import AuthForm from "@/components/AuthForm";
import URLForm from "@/components/landing/URLForm";
import LandingLayout from "@/components/shared/LandingLayout";

export default function LoginPage() {
  return (
    <LandingLayout>
      <div className="w-full flex flex-col lg:flex-row justify-between gap-16 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 mt-[-40px]">
        {/* Left side */}
        <div className="flex-1 space-y-4 max-w-[580px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/[0.12] border border-brand/20 text-brand text-[11px] font-bold tracking-[0.1em] uppercase">
            <span className="w-2 h-2 rounded-full bg-brand" style={{ boxShadow: "0 0 10px #00E58F" }} />
            AI CLIPPING V1.0 IS LIVE
          </div>
          
          <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight">
            Turn 1 long<br/>video into <span className="text-brand">100+</span><br/>
            <span className="text-brand">viral clips</span>
          </h1>
          
          <p className="text-[#a1a1aa] text-lg max-w-[400px] leading-[1.6]">
            Preview, pick, post & mint — our AI-powered engine finds the high-retention moments for your viral growth across TikTok, Reels, and Shorts.
          </p>

          <URLForm />
        </div>

        {/* Right side - Login Modal */}
        <div className="w-full max-w-[340px] flex justify-end">
          <AuthForm mode="login" />
        </div>
      </div>
    </LandingLayout>
  );
}
