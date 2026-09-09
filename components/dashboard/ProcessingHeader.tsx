"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/shared/Logo";
import UserAvatar from "@/components/shared/UserAvatar";

export default function ProcessingHeader() {
  const { user } = useAuth();

  return (
    <header className="w-full flex items-center justify-between px-6 py-5 bg-transparent border-b border-white/5 relative z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Logo variant="simple" />
        <span className="text-white font-bold text-xl tracking-tight">ClipCash AI</span>
      </div>

      {/* Nav */}
      <nav className="hidden md:flex items-center gap-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
          Dashboard
        </Link>
        <Link href="/clips" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
          My Clips
        </Link>
        <Link href="/projects" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
          Projects
        </Link>
      </nav>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <UserAvatar user={user} size="sm" />
      </div>
    </header>
  );
}
