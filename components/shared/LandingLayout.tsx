import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundGlow from "@/components/shared/BackgroundGlow";

interface LandingLayoutProps {
  children: React.ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden bg-[#050505]">
      <BackgroundGlow variant="landing" />
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex items-center z-10 relative">
        {children}
      </main>
      <Footer />
    </div>
  );
}
