"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Video, 
  Share2, 
  Settings, 
  X,
  LogOut,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/shared/Logo";
import UserAvatar from "@/components/shared/UserAvatar";
import apiClient from "@/lib/apiClient";
import { truncateAddress } from "@/lib/bnbWallet";

// Fetch total clip count — reuses the same cache key as the dashboard query
// so no extra network request is made when the dashboard has already loaded.
async function fetchClipCount(): Promise<number> {
  try {
    const res = await apiClient.get("/clips?page=1&limit=1");
    // Backend returns { data: [...], total, page, limit } or plain array
    if (typeof res.data.total === "number") return res.data.total;
    if (Array.isArray(res.data)) return res.data.length;
    if (Array.isArray(res.data.data)) return res.data.total ?? res.data.data.length;
    return 0;
  } catch {
    return 0;
  }
}

const staticMenuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "ai-projects", label: "AI Projects", icon: Sparkles, href: "/ai-projects" },
  { id: "agent-marketplace", label: "Agent Marketplace", icon: ShoppingBag, href: "/agent-marketplace" },
  // "projects" is injected conditionally below when the user has clips
  { id: "platforms", label: "Platforms", icon: Share2, href: "/platforms" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

const projectsItem = { id: "projects", label: "Projects", icon: Video, href: "/projects" };

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: clipCount = 0 } = useQuery({
    queryKey: ["sidebarClipCount"],
    queryFn: fetchClipCount,
    // Only run when a session exists — avoids a 401 during the auth check on mount
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const hasClips = clipCount > 0;

  // Build the final menu — inject Projects right after AI Projects when user has clips
  const menuItems = hasClips
    ? [
        staticMenuItems[0], // Dashboard
        staticMenuItems[1], // AI Projects
        staticMenuItems[2], // Agent Marketplace
        projectsItem,       // Projects  ← only shown when clips exist
        staticMenuItems[3], // Platforms
        staticMenuItems[4], // Settings
      ]
    : staticMenuItems;

  return (
    <aside className={`fixed top-0 left-0 h-screen w-[280px] bg-[#080C0B] border-r border-white/5 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-8 flex items-center justify-between">
        <Logo />
        <button 
          onClick={onClose}
          className="lg:hidden p-2 -mr-2 text-[#5A6F65] hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-brand/10 text-brand font-bold" 
                  : "text-[#8e9895] hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-brand" : "text-[#4A5D54] group-hover:text-white"}`} />
              <span className="text-[14px]">{item.label}</span>
              {item.id === "projects" && hasClips && (
                <span className="ml-auto px-1.5 py-0.5 rounded-md bg-brand/15 text-brand text-[9px] font-black tracking-wider">
                  {clipCount > 99 ? "99+" : clipCount}
                </span>
              )}
              {isActive && item.id !== "projects" && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(0,229,143,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-6 border-t border-white/5 bg-[#080C0B]/50">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-white truncate">
              {user?.username || user?.profile?.username || user?.fullName || (user?.bnbAddress ? "Wallet User" : "User")}
            </div>
            <div className="text-[11px] text-[#5A6F65] truncate font-mono tracking-wide">
              {user?.email
                ? user.email
                : user?.bnbAddress
                  ? truncateAddress(user.bnbAddress)
                  : ""}
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="p-2 text-[#5A6F65] hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10 group/logout relative"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 text-white text-[10px] rounded opacity-0 group-hover/logout:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
