import React from "react";
import Image from "next/image";
import { truncateAddress } from "@/lib/bnbWallet";

interface UserAvatarProps {
  user: any;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function UserAvatar({ user, size = "md", className = "" }: UserAvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  // Use bnbAddress as the final fallback seed so each wallet user gets a
  // unique deterministic avatar instead of everyone sharing "Guest".
  const seed =
    user?.fullName ||
    user?.username ||
    user?.profile?.username ||
    user?.email ||
    user?.bnbAddress ||
    "Guest";
  const avatarUrl = user?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

  return (
    <div className={`${sizeClasses[size]} rounded-full border border-white/10 overflow-hidden bg-zinc-800 relative ${className}`}>
      <Image 
        src={avatarUrl} 
        alt="User Avatar" 
        fill
        sizes="(max-width: 768px) 32px, 48px"
        className="object-cover" 
      />
    </div>
  );
}
