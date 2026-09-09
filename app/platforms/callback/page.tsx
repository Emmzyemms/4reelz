"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const status = searchParams.get("status") ?? "error";
      const projectId = searchParams.get("projectId") ?? "";
      const platform = searchParams.get("platform") ?? "";
      const socialAccountIds = searchParams.get("socialAccountIds") ?? "";
      const error = searchParams.get("error") ?? undefined;

      try {
        await apiClient.post("/platforms/callback", {
          status,
          projectId,
          platform,
          socialAccountIds,
          error,
        });
        router.push("/platforms?connected=true");
      } catch (err) {
        console.error("Platform callback failed:", err);
        router.push("/platforms?error=true");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#080C0B] flex flex-col items-center justify-center text-white p-6">
      <div className="w-full max-w-md bg-[#0E1512] border border-white/5 rounded-[32px] p-10 flex flex-col items-center text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Connecting Account</h1>
          <p className="text-[#5A6F65]">Please wait while we sync your social profile...</p>
        </div>
      </div>
    </div>
  );
}

export default function PlatformCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080C0B] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}