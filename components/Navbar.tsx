"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { LogOut, Bell, Zap, Menu } from "lucide-react";
import Logo from "@/components/shared/Logo";
import UserAvatar from "@/components/shared/UserAvatar";
import { truncateAddress } from "@/lib/bnbWallet";

interface NavbarProps {
  variant?: "landing" | "dashboard";
  sticky?: boolean;
}

export default function Navbar({ variant = "landing", sticky = false }: NavbarProps) {
  const { user, setUser, logout } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const landingLinks = [
    { label: "Pricing",  href: "#",    disabled: true  },
    { label: "Showcase", href: "#",    disabled: true  },
    { label: "Docs",     href: "/docs", disabled: false },
  ];

  const dashboardLinks = [
    { label: "Dashboard",    href: "/dashboard", disabled: false },
    { label: "Create Clips", href: "/clips",     disabled: false },
  ];

  const isDashboard = variant === "dashboard" || !!user;

  return (
    <nav className={`w-full z-50 transition-all duration-300 ${
      sticky ? "sticky top-0 bg-[#080C0B]/80 backdrop-blur-xl border-b border-white/[0.05]" : "relative border-b border-[#1A2620]"
    }`}>
      <header className="w-full max-w-7xl mx-auto px-6 py-[22px] flex justify-between items-center z-10 relative">
        <Logo />
        
        {/* Center Navigation */}
        <div className="hidden lg:flex items-center gap-10">
          {(isDashboard ? dashboardLinks : landingLinks).map((link) => {
            const isActive = pathname === link.href;
            const isDisabled = "disabled" in link && link.disabled;
            if (isDisabled) {
              return (
                <span
                  key={link.label}
                  className="text-[13px] font-bold uppercase tracking-wider py-1 text-[#2A3B34] cursor-not-allowed select-none flex items-center gap-1.5"
                  title="Coming soon"
                >
                  {link.label}
                  <span className="text-[8px] font-black text-[#2A3B34] bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-full uppercase tracking-widest leading-none normal-case">
                    Soon
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`text-[13px] font-bold uppercase tracking-wider relative py-1 transition-all duration-300 ${
                  isActive ? "text-white" : "text-[#5A6F65] hover:text-white"
                }`}
              >
                {link.label}
                {isActive && (
                  <div className="absolute -bottom-5 left-0 right-0 h-0.5 bg-brand shadow-[0_0_10px_rgba(0,229,143,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          {!user ? (
            <>
              <Link 
                href="/signup"
                className="bg-brand hover:bg-brand-hover text-black px-6 py-2.5 rounded-full text-[14px] font-bold transition-all shadow-[0_0_15px_rgba(0,229,143,0.15)] hover:shadow-[0_0_25px_rgba(0,229,143,0.3)] transform hover:-translate-y-0.5 inline-block"
              >
                Create account
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 text-brand text-[13px] font-bold hover:bg-brand/20 transition-all">
                  <Zap className="w-4 h-4 fill-brand" />
                  <span>Upgrade</span>
                </button>
                
                <button className="p-2.5 rounded-full bg-white/[0.03] border border-white/5 text-[#5A6F65] hover:text-white transition-all relative group">
                  <Bell className="w-5 h-5" />
                  <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand rounded-full border-2 border-[#050505]" />
                </button>
              </div>

              <div className="relative flex items-center gap-3 pl-4 border-l border-white/10" ref={dropdownRef}>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[13px] font-bold text-white leading-none mb-1">
                    {user?.username || user?.profile?.username || user?.fullName || (user?.bnbAddress ? "Wallet User" : "User")}
                  </span>
                  <span className="text-[11px] font-medium text-brand/80 font-mono tracking-wide">
                    {user?.email
                      ? user.email
                      : user?.bnbAddress
                        ? truncateAddress(user.bnbAddress)
                        : "Pro Creator"}
                  </span>
                </div>
                <button onClick={() => setDropdownOpen(!dropdownOpen)}>
                  <UserAvatar user={user} className="hover:border-brand/40 transition-colors cursor-pointer group" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-4 w-48 bg-[#131A17] border border-[#1E2A24] rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-[14px] text-white hover:bg-[#1A221E] transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-[#8e9895]" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <button className="lg:hidden text-[#5A6F65] hover:text-white transition-colors">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>
    </nav>
  );
}
