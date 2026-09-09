import React from "react";
import { User as UserIcon, Loader2, ArrowRight } from "lucide-react";

interface ProfileSetupFormProps {
  username: string;
  setUsername: (value: string) => void;
  niche: string;
  setNiche: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProfileSetupForm({
  username,
  setUsername,
  niche,
  setNiche,
  loading,
  onSubmit,
}: ProfileSetupFormProps) {
  return (
    <div className="bg-[#0C1712]/90 backdrop-blur-md rounded-[20px] p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.5)] border border-[#1A2D23] relative overflow-hidden">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-[8px] bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
          <UserIcon className="w-5 h-5" />
        </div>
        <h2 className="text-[18px] font-bold text-white tracking-tight">Basic Information</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-[18px]">
        <div>
          <label className="block text-[13px] font-medium text-[#c1c9c6] mb-2">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#131A17] border border-[#1E2A24] text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-[#161F1A] transition-colors placeholder-[#3A4A43]"
            placeholder="e.g. alexrivera"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#c1c9c6] mb-2">Creator Type</label>
          <div className="relative">
            <select
              required
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full bg-[#131A17] border border-[#1E2A24] text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-[#161F1A] appearance-none transition-colors [&>option]:text-black"
            >
              <option value="" disabled className="text-gray-500">
                Select your niche
              </option>
              <option value="gaming">Gaming</option>
              <option value="podcast">Podcast</option>
              <option value="vlog">Vlog & Lifestyle</option>
              <option value="educational">Educational</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#5A6F65]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 mt-[8px] transition-all"
        >
          {loading ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : (
            <>
              Continue to step 2 <ArrowRight className="w-[18px] h-[18px]" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
