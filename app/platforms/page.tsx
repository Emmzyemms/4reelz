import React, { Suspense } from "react";
import PlatformsContent from "@/components/platforms/PlatformsContent";
import { Loader2 } from "lucide-react";

export default function PlatformsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    }>
      <PlatformsContent />
    </Suspense>
  );
}
