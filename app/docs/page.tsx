import React from "react";
import Link from "next/link";
import LandingLayout from "@/components/shared/LandingLayout";
import {
  Zap,
  LayoutDashboard,
  Scissors,
  Share2,
  Bot,
  Wallet,
  Settings,
  ArrowRight,
  Play,
  BookOpen,
  ChevronRight,
} from "lucide-react";

// ─── Section data ─────────────────────────────────────────────────────────────

const sections = [
  {
    id: "getting-started",
    icon: <Zap className="w-5 h-5" />,
    title: "Getting Started",
    color: "brand",
    items: [
      {
        heading: "Create your account",
        body: "Head to the landing page and click Create Account in the top-right corner. You can sign up with Google, email/password, or a BNB wallet. Wallet accounts are fully anonymous — no personal info required.",
      },
      {
        heading: "Connect your wallet on the landing page",
        body: "If you already have an account linked to a wallet, clicking Connect Wallet on the landing page signs you in and takes you straight to your dashboard. If your wallet has no account yet, you'll see a notification asking you to create one first.",
      },
      {
        heading: "Onboarding",
        body: "After creating an email/Google account you'll be guided through a short onboarding — pick a username and optionally connect your social platforms. Wallet accounts skip onboarding and land directly on the dashboard.",
      },
    ],
  },
  {
    id: "dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    title: "Dashboard",
    color: "blue",
    items: [
      {
        heading: "Overview",
        body: "The dashboard is your home base. It shows your recent projects, clip stats, earnings, platform distribution, and AI insights — all in one view.",
      },
      {
        heading: "Processing queue",
        body: "While a video is being processed you're automatically redirected to the processing view at /dashboard/processing. A live progress bar tracks each pipeline stage — fetching info, downloading, uploading, and clipping.",
      },
      {
        heading: "Stats & earnings",
        body: "Track total clips created, platform reach, and revenue over time. The revenue chart and earnings card update as your clips are distributed across connected platforms.",
      },
    ],
  },
  {
    id: "create-clips",
    icon: <Scissors className="w-5 h-5" />,
    title: "Creating Clips",
    color: "brand",
    items: [
      {
        heading: "Paste a URL",
        body: "Paste any YouTube, TikTok, or Vimeo URL into the input on the landing page or the Create Clips page, then hit Clip Now. The AI engine fetches the video and finds the highest-retention moments automatically.",
      },
      {
        heading: "Supported platforms",
        body: "YouTube (full videos and Shorts), TikTok, and Vimeo are currently supported as sources. Output clips are optimised for TikTok, Instagram Reels, and YouTube Shorts.",
      },
      {
        heading: "YouTube import pipeline",
        body: "YouTube imports run a 5-step pipeline: fetching metadata → downloading → uploading to storage → queuing for AI analysis → generating clips. A progress panel tracks each step in real time.",
      },
      {
        heading: "Clip style",
        body: "The default style is viral — the AI targets high-energy, hook-first moments. More style options (educational, cinematic, podcast) are coming soon.",
      },
    ],
  },
  {
    id: "projects",
    icon: <Play className="w-5 h-5" />,
    title: "Projects",
    color: "purple",
    items: [
      {
        heading: "What is a project?",
        body: "Every video you submit becomes a project. A project holds the source video, all generated clips, and metadata like title, duration, and processing status.",
      },
      {
        heading: "Browsing your clips",
        body: "Navigate to Projects in the sidebar to see all your projects as cards. Click into any project to view the full clip grid — preview, download, or publish clips from there.",
      },
      {
        heading: "AI Projects",
        body: "The AI Projects section surfaces clips that have been fully processed and are ready to publish. You can tip-unlock premium clips, view performance estimates, and queue them for posting.",
      },
    ],
  },
  {
    id: "platforms",
    icon: <Share2 className="w-5 h-5" />,
    title: "Platforms",
    color: "pink",
    items: [
      {
        heading: "Connect a platform",
        body: "Go to Platforms in the sidebar and click Connect on any card. You'll be redirected to the platform's OAuth flow. Once authorised, your account is linked and clips can be posted directly.",
      },
      {
        heading: "Supported platforms",
        body: "TikTok, Instagram, YouTube, and Twitter/X are currently supported. More platforms are planned.",
      },
      {
        heading: "OAuth callback",
        body: "After authorising on the platform's website you'll be redirected back to /platforms/callback, which completes the connection and returns you to the Platforms page.",
      },
    ],
  },
  {
    id: "agent-marketplace",
    icon: <Bot className="w-5 h-5" />,
    title: "Agent Marketplace",
    color: "yellow",
    items: [
      {
        heading: "What are AI Agents?",
        body: "Agents are specialised AI workers you can hire for specific tasks — uploading files directly, scheduling posts, generating captions, and more. Each agent has its own pricing tier and capability set.",
      },
      {
        heading: "Hiring an agent",
        body: "Browse the marketplace, click Hire on any agent card, and confirm the job details in the modal. The agent starts working immediately and you can track its status from the dashboard.",
      },
      {
        heading: "When to use an agent",
        body: "If the YouTube downloader is temporarily unavailable or you want to upload a local video file, agents are the best alternative. You can drag and drop a file directly to an agent.",
      },
    ],
  },
  {
    id: "wallet",
    icon: <Wallet className="w-5 h-5" />,
    title: "BNB Wallet",
    color: "brand",
    items: [
      {
        heading: "Supported wallets",
        body: "MetaMask, Binance Wallet, Trust Wallet, and any EIP-1193 injected provider are supported. The app connects to BNB Smart Chain (BSC Testnet by default, Mainnet in production).",
      },
      {
        heading: "Wallet-based login",
        body: "Click Connect Wallet anywhere in the app. You'll be asked to sign a one-time challenge message — this proves wallet ownership without sharing any private keys. No password is ever stored.",
      },
      {
        heading: "Anonymous accounts",
        body: "Wallet accounts are fully anonymous. No email, no name, no personal data required. Your BNB address is the only identifier.",
      },
      {
        heading: "Tip-unlocking clips",
        body: "Some premium AI clips can be unlocked by sending a small BNB tip directly from your connected wallet. The transaction is confirmed on-chain and the clip is immediately available.",
      },
    ],
  },
  {
    id: "settings",
    icon: <Settings className="w-5 h-5" />,
    title: "Settings",
    color: "gray",
    items: [
      {
        heading: "Profile",
        body: "Update your username, profile picture, and niche from the Settings page at /settings.",
      },
      {
        heading: "Connected accounts",
        body: "Manage your linked social platforms, disconnect accounts, and review OAuth permissions.",
      },
      {
        heading: "Logout",
        body: "Click your avatar in the top-right navbar and select Log out. This ends your session and, if you used a wallet, revokes the in-browser wallet connection.",
      },
    ],
  },
];

// ─── Color maps ───────────────────────────────────────────────────────────────

const iconBg: Record<string, string> = {
  brand:  "bg-brand/10 text-brand",
  blue:   "bg-blue-500/10 text-blue-400",
  purple: "bg-purple-500/10 text-purple-400",
  pink:   "bg-pink-500/10 text-pink-400",
  yellow: "bg-yellow-500/10 text-yellow-400",
  gray:   "bg-white/5 text-[#8e9895]",
};

const dotColor: Record<string, string> = {
  brand:  "bg-brand",
  blue:   "bg-blue-400",
  purple: "bg-purple-400",
  pink:   "bg-pink-400",
  yellow: "bg-yellow-400",
  gray:   "bg-[#5A6F65]",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <LandingLayout>
      <div className="w-full max-w-5xl mx-auto py-4 space-y-16">

        {/* Header */}
        <div className="space-y-4 border-b border-[#1A2620] pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/[0.12] border border-brand/20 text-brand text-[11px] font-bold tracking-[0.1em] uppercase">
            <BookOpen className="w-3.5 h-3.5" />
            Documentation
          </div>
          <h1 className="text-[52px] font-extrabold leading-[1.05] tracking-tight">
            How 4Reelzclip works
          </h1>
          <p className="text-[#a1a1aa] text-lg max-w-[620px] leading-[1.6]">
            Everything you need to know about turning long-form videos into viral short clips — from account setup to posting across platforms.
          </p>

          {/* Quick nav pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111815] border border-[#1E2A24] text-[12px] font-bold text-[#5A6F65] hover:text-white hover:border-brand/30 transition-all"
              >
                {s.title}
                <ChevronRight className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>

        {/* Quick start callout */}
        <div className="rounded-2xl bg-brand/5 border border-brand/20 p-6 flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-brand" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-white font-bold text-[15px]">Quick start</p>
            <p className="text-[#8e9895] text-[14px] leading-relaxed">
              Create an account → paste a video URL → hit <span className="text-white font-bold">Clip Now</span> → review your clips → connect a platform → post.
              The whole flow takes under 2 minutes.
            </p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-black px-5 py-2.5 rounded-full text-[13px] font-bold transition-all shadow-[0_0_15px_rgba(0,229,143,0.15)]"
          >
            Get started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.id} id={section.id} className="scroll-mt-8 space-y-6">
            {/* Section header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#1A2620]">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg[section.color]}`}>
                {section.icon}
              </div>
              <h2 className="text-[22px] font-bold text-white tracking-tight">{section.title}</h2>
            </div>

            {/* Items */}
            <div className="space-y-5 pl-2">
              {section.items.map((item) => (
                <div key={item.heading} className="flex gap-4">
                  <div className="mt-[9px] shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor[section.color]}`} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-bold text-[15px]">{item.heading}</p>
                    <p className="text-[#8e9895] text-[14px] leading-[1.7]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Navigation reference */}
        <div id="navigation" className="scroll-mt-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#1A2620]">
            <div className="w-9 h-9 rounded-xl bg-white/5 text-[#8e9895] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-[22px] font-bold text-white tracking-tight">Navigation reference</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { path: "/",                 label: "Landing page",       desc: "Paste a URL, connect wallet, or sign up" },
              { path: "/dashboard",        label: "Dashboard",          desc: "Stats, recent projects, earnings overview" },
              { path: "/clips",            label: "Create Clips",       desc: "Submit a new video URL for processing" },
              { path: "/projects",         label: "Projects",           desc: "Browse all your projects and generated clips" },
              { path: "/ai-projects",      label: "AI Projects",        desc: "Review AI-ready clips and unlock premium content" },
              { path: "/platforms",        label: "Platforms",          desc: "Connect and manage social media accounts" },
              { path: "/agent-marketplace",label: "Agent Marketplace",  desc: "Hire AI agents for specialised tasks" },
              { path: "/settings",         label: "Settings",           desc: "Profile, connected accounts, preferences" },
              { path: "/onboarding",       label: "Onboarding",         desc: "First-run setup for new email/Google accounts" },
            ].map((row) => (
              <div
                key={row.path}
                className="flex items-start gap-3 p-4 rounded-xl bg-[#0E1512]/60 border border-[#1E2A24] hover:border-brand/20 transition-all group"
              >
                <code className="shrink-0 text-brand text-[12px] font-mono bg-brand/5 px-2 py-0.5 rounded-md border border-brand/10 mt-0.5">
                  {row.path}
                </code>
                <div>
                  <p className="text-white text-[13px] font-bold leading-tight">{row.label}</p>
                  <p className="text-[#5A6F65] text-[12px] mt-0.5 leading-relaxed">{row.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="rounded-2xl bg-[#0E1512]/60 border border-[#1E2A24] p-8 text-center space-y-4">
          <p className="text-[#5A6F65] text-[13px] font-bold uppercase tracking-widest">Ready to clip?</p>
          <h3 className="text-[28px] font-extrabold text-white">Start turning videos into viral content</h3>
          <p className="text-[#8e9895] text-[14px] max-w-[420px] mx-auto leading-relaxed">
            No setup fees, no credit card required. Create an account with Google, email, or a BNB wallet in under 30 seconds.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-black px-6 py-3 rounded-full text-[14px] font-bold transition-all shadow-[0_0_20px_rgba(0,229,143,0.2)]"
            >
              Create account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#111815] border border-[#1E2A24] hover:border-brand/30 text-white px-6 py-3 rounded-full text-[14px] font-bold transition-all"
            >
              Log in
            </Link>
          </div>
        </div>

      </div>
    </LandingLayout>
  );
}
