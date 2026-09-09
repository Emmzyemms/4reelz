"use client";

import React from "react";
import { Bell, Menu } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function DashboardHeader({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const firstName = user?.username || user?.profile?.username || user?.fullName?.split(" ")[0] || "there";

  return (
    <header className="w-full border-b border-white/[0.03]">
      <div className="max-w-[1400px] mx-auto flex justify-between items-center py-6 lg:py-8 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-[#8e9895] hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="space-y-0.5 sm:space-y-1">
            <h1 className="text-[24px] sm:text-[32px] font-extrabold tracking-tight text-white leading-tight">
              Welcome back, {firstName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-11 h-11 rounded-xl bg-[#111111] border border-white/5 flex items-center justify-center text-[#8e9895] hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>

          <Link
            href="/clips"
            className="bg-brand hover:bg-brand-hover text-black px-6 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,229,143,0.15)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)] active:scale-[0.97]"
          >
            New Clip
          </Link>
        </div>
      </div>
    </header>
  );
}
