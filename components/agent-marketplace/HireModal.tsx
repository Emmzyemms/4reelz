"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Wallet, Link2, Loader2, CheckCircle,
  AlertCircle, ArrowRight, ExternalLink, Play,
} from "lucide-react";
import { BrowserProvider, Contract, parseEther } from "ethers";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";
import type { Agent, AgentJob } from "@/lib/queries";
import { truncateAddress, bscscanTxUrl, BNB_CHAIN_ID, ACTIVE_CHAIN } from "@/lib/bnbWallet";
import { useYouTubeImport, isYouTubeUrl } from "@/lib/useYouTubeImport";
import { saveActiveJob } from "@/lib/processingStore";
import apiClient from "@/lib/apiClient";
import AgentJobStatus from "./AgentJobStatus";

// ─── Contract constants ───────────────────────────────────────────────────────

const CONTRACT_ADDRESS = "0xFc6E3Ec48AB20fA72D88cb7c985d85E23971105A";

const CONTRACT_ABI = [
  "function createJob(string videoUrl, string style) payable returns (uint256)",
  "event JobCreated(uint256 indexed jobId, address indexed client, string videoUrl, string style)",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface HireModalProps {
  agent: Agent;
  onClose: () => void;
}

type Step =
  | "form"          // user fills in videoUrl + style
  | "confirm"       // user reviews before paying
  | "downloading"   // browser downloads + uploads video → gets Cloudinary URL
  | "switching"     // switching MetaMask to BSC Testnet
  | "paying"        // MetaMask confirmation dialog open
  | "confirming"    // tx submitted, waiting for block confirmation
  | "polling"       // tx confirmed, backend is picking up the event
  | "job"           // backend has a jobId — show live status
  | "error";

const STYLE_OPTIONS = [
  { value: "viral",        label: "Viral Clips",         desc: "Optimised for maximum reach" },
  { value: "educational",  label: "Educational",          desc: "Clear, structured breakdowns" },
  { value: "podcast",      label: "Podcast Highlights",   desc: "Best moments from long-form audio/video" },
  { value: "shorts",       label: "YouTube Shorts",       desc: "Vertical, hook-first format" },
];

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HireModal({ agent, onClose }: HireModalProps) {
  const router = useRouter();
  const { address, connect } = useWallet();
  const { user } = useAuth();

  const [step, setStep]         = useState<Step>("form");
  const [videoUrl, setVideoUrl] = useState("");
  const [style, setStyle]       = useState("viral");
  const [urlError, setUrlError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash]     = useState<string | null>(null);
  const [jobId, setJobId]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"url" | "file">("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  // Upload progress for direct file uploads (0–100, -1 = indeterminate)
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadLabel, setUploadLabel]       = useState<string>("");

  const { state: ytState, run: runYouTube, reset: resetYouTube } = useYouTubeImport();
  const ytBusy = ["fetching-info", "downloading", "uploading"].includes(ytState.phase);

  // ── Form step ──────────────────────────────────────────────────────────────
  const handleFormSubmit = () => {
    setUrlError("");
    if (inputMode === "url") {
      if (!videoUrl.trim()) { setUrlError("Please enter a video URL."); return; }
      if (!isValidUrl(videoUrl)) { setUrlError("Please enter a valid https:// URL."); return; }
    } else {
      if (!videoFile) { setUrlError("Please select a video file."); return; }
    }
    setStep("confirm");
  };

  // ── Main flow ──────────────────────────────────────────────────────────────
  // Order: switch network → pay on-chain → confirm tx → download/upload → update job → poll backend
  const handleHire = async () => {
    if (!address) { await connect(); return; }
    if (!user) {
      setErrorMsg("You must be logged in to hire an agent. Please log in first.");
      setStep("error");
      return;
    }

    setLoading(true);

    try {
      // ── 1. Switch MetaMask to BSC Testnet ───────────────────────────────
      setStep("switching");
      const provider = (window as any).ethereum;
      if (!provider) throw new Error("No Ethereum wallet detected. Please install MetaMask.");

      const targetHex = "0x" + BNB_CHAIN_ID.toString(16);
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetHex }],
        });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [ACTIVE_CHAIN],
          });
        } else {
          throw switchErr;
        }
      }

      // ── 2. Build ethers signer ───────────────────────────────────────────
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      // ── 3. Verify network ────────────────────────────────────────────────
      const network = await ethersProvider.getNetwork();
      if (Number(network.chainId) !== BNB_CHAIN_ID) {
        throw new Error(
          `Wrong network. Expected chainId ${BNB_CHAIN_ID} (BSC Testnet) but got ${network.chainId}. Please switch in MetaMask.`
        );
      }

      // ── 4. Pre-flight balance check ──────────────────────────────────────
      const priceWei  = parseEther(agent.pricePerJobBNB);
      if (priceWei === BigInt(0)) {
        throw new Error(
          "Invalid payment amount: agent price is 0. The contract requires a non-zero payment."
        );
      }
      const GAS_BUFFER = parseEther("0.005");
      const balance    = await ethersProvider.getBalance(address);
      if (balance < priceWei + GAS_BUFFER) {
        const have = (Number(balance)               / 1e18).toFixed(6);
        const need = (Number(priceWei + GAS_BUFFER) / 1e18).toFixed(6);
        throw new Error(
          `Insufficient balance. You have ${have} tBNB but need at least ${need} tBNB (job price + gas).`
        );
      }

      // ── 5. Call createJob with original URL (will be updated after download)
      setStep("paying");
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createJob(
        inputMode === "file" ? "file_upload_pending" : videoUrl.trim(),
        style,
        { value: priceWei }
      );

      setTxHash(tx.hash);

      // ── 6. Wait for block confirmation ───────────────────────────────────
      setStep("confirming");
      const receipt = await tx.wait(1);

      // ── 7. Extract jobId from JobCreated event ───────────────────────────
      let onChainJobId: string | null = null;
      if (receipt?.logs) {
        const iface = contract.interface;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === "JobCreated") {
              onChainJobId = parsed.args[0].toString();
              break;
            }
          } catch {
            // Not our event — skip
          }
        }
      }

      // ── 8. Download video and upload to get Cloudinary URL ───────────────
      setStep("downloading");
      resetYouTube();
      
      let videoIdResult: string | null = null;
      
      // ── File upload: upload directly to backend with XHR progress tracking
      if (inputMode === "file" && videoFile) {
        setUploadProgress(0);
        setUploadLabel("Uploading video…");

        videoIdResult = await new Promise<string | null>((resolve, reject) => {
          const formData = new FormData();
          formData.append("file", videoFile);
          formData.append("title", videoFile.name);
          formData.append("sourceType", "upload");
          formData.append("style", style);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/proxy/videos", true);
          xhr.withCredentials = true;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(pct);
              setUploadLabel(`Uploading… ${pct}%`);
            } else {
              setUploadProgress(-1);
              setUploadLabel("Uploading video…");
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                const vid =
                  data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId ?? null;
                if (!vid) {
                  reject(new Error("Upload succeeded but no video ID was returned."));
                } else {
                  setUploadLabel("Upload complete!");
                  resolve(String(vid));
                }
              } catch {
                reject(new Error("Could not parse upload response."));
              }
            } else {
              let msg = `Upload failed (${xhr.status}).`;
              try {
                const raw = JSON.parse(xhr.responseText)?.message;
                msg = Array.isArray(raw) ? raw[0] : raw ?? msg;
              } catch { /* keep default */ }
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => reject(new Error("Network error while uploading video."));
          xhr.onabort = () => reject(new Error("Upload was cancelled."));
          xhr.send(formData);
        });
        
        if (videoIdResult) {
          saveActiveJob(String(videoIdResult));
          // Redirect to processing page to see AI clipping progress
          onClose();
          router.push(`/dashboard/processing?videoId=${videoIdResult}`);
          return; // Exit early - no need to poll backend for agent job
        }
      }
      // YouTube: use browser-side download
      else if (isYouTubeUrl(videoUrl)) {
        const result = await runYouTube(videoUrl, "youtube");
        videoIdResult = result?.videoId ?? null;
        
        if (videoIdResult) {
          saveActiveJob(String(videoIdResult));
          onClose();
          router.push(`/dashboard/processing?videoId=${videoIdResult}`);
          return;
        }
      } 
      // TikTok / Vimeo: use backend from-url endpoint
      else {
        const response = await apiClient.post("/videos/from-url", {
          url: videoUrl.trim(),
          targetPlatforms: ["youtube"],
          style: "viral",
        });
        const data = response.data;
        videoIdResult = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId ?? null;
        
        if (videoIdResult) {
          saveActiveJob(String(videoIdResult));
          onClose();
          router.push(`/dashboard/processing?videoId=${videoIdResult}`);
          return;
        }
      }
      
      if (!videoIdResult) {
        throw new Error("Failed to process video. Please try again.");
      }

      // ── 9. Update job with Cloudinary URL (backend endpoint needed) ───────
      // TODO: Call PATCH /api/jobs/:jobId with { videoUrl: cloudinaryUrl }
      // This backend endpoint is required to update the job's video URL
      // from the placeholder to the actual Cloudinary URL after upload
      
      // ── 10. Poll backend until it picks up the JobCreated event ──────────
      setStep("polling");
      const { getAgentJobs } = await import("@/lib/queries");
      let backendJobId: string | null = null;

      for (let i = 0; i < 18; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const jobs = await getAgentJobs();
          const match = jobs.find(
            (j) =>
              j.txHash === tx.hash ||
              j.contractJobId === onChainJobId ||
              j.contractJobId === tx.hash
          );
          if (match) {
            backendJobId = match.id;
            break;
          }
        } catch {
          // Backend may be waking up — keep polling
        }
      }

      if (!backendJobId) {
        throw new Error(
          `Payment confirmed on BSC (txHash: ${tx.hash.slice(0, 10)}…) but the backend hasn't registered the job yet. The agent will pick it up within 60 seconds. You can check /agent/jobs in a moment.`
        );
      }

      setJobId(backendJobId);
      setStep("job");
    } catch (err: any) {
      const raw = err?.response?.data?.message || err?.message || "Something went wrong.";
      const msg = Array.isArray(raw) ? raw[0] : String(raw);

      // User cancelled MetaMask — silently go back to confirm
      if (
        err?.code === 4001 ||
        err?.code === "ACTION_REJECTED" ||
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("user denied")
      ) {
        setStep("confirm");
        setLoading(false);
        return;
      }

      setErrorMsg(msg);
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // ── Keyboard close ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !["downloading", "switching", "paying", "confirming", "polling"].includes(step)
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, step]);

  const isLocked = ["downloading", "switching", "paying", "confirming", "polling"].includes(step);

  // ── Step label ─────────────────────────────────────────────────────────────
  const stepLabel: Record<Step, string> = {
    form:        "Upload your video",
    confirm:     "Review & confirm",
    downloading: "Downloading video…",
    switching:   "Switching to BSC Testnet…",
    paying:      "Confirm in MetaMask…",
    confirming:  "Waiting for block confirmation…",
    polling:     "Registering job on backend…",
    job:         "Job submitted — live status",
    error:       "Something went wrong",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={!isLocked ? onClose : undefined}
    >
      <div
        className="relative w-full max-w-lg bg-[#0B100E] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,229,143,0.10)] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-white text-[15px] font-extrabold truncate max-w-[280px]">
              Hire: {agent.name}
            </p>
            <p className="text-[#5A6F65] text-[11px] font-medium">{stepLabel[step]}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLocked}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#5A6F65] hover:text-white transition-colors disabled:opacity-30 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 space-y-5">

          {/* ── STEP: form ── */}
          {step === "form" && (
            <div className="space-y-4">
              {address ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/5 border border-brand/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className="text-[10px] text-[#5A6F65]">Wallet:</span>
                  <span className="text-[10px] font-mono text-brand">{truncateAddress(address)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[12px] text-[#5A6F65]">No wallet connected</span>
                  <button onClick={connect} className="text-[11px] font-bold text-brand hover:text-white transition-colors">Connect</button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#5A6F65] uppercase tracking-widest flex items-center gap-1.5">
                  <Link2 className="w-3 h-3" />
                  Video Source
                </label>

                {/* Tab row */}
                <div className="flex gap-2 p-1 bg-[#111A16] rounded-xl border border-[#1E2A24]">
                  <button
                    onClick={() => setInputMode("file")}
                    className={`flex-1 py-2 px-3 rounded-lg text-[12px] font-medium transition-all ${
                      inputMode === "file"
                        ? "bg-brand/20 text-white"
                        : "text-[#5A6F65] hover:text-white"
                    }`}
                  >
                    Upload File
                  </button>
                  {/* URL tab — disabled, coming soon */}
                  <div className="flex-1 py-2 px-3 rounded-lg text-[12px] font-medium text-[#2A3B34] flex items-center justify-center gap-1.5 cursor-not-allowed select-none">
                    URL
                    <span className="text-[9px] font-black text-[#2A3B34] bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-full uppercase tracking-widest leading-none">
                      Soon
                    </span>
                  </div>
                </div>

                {/* File upload (always shown — URL tab is disabled) */}
                <div className="relative">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      setUrlError("");
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className={`w-full bg-[#111A16] border border-dashed ${
                    videoFile ? "border-brand/50" : "border-[#1E2A24]"
                  } rounded-[12px] px-4 py-6 text-center transition-colors`}>
                    {videoFile ? (
                      <div className="space-y-1">
                        <p className="text-[13px] font-medium text-brand">{videoFile.name}</p>
                        <p className="text-[11px] text-[#5A6F65]">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB · ready</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[13px] font-medium text-white">Click to upload video</p>
                        <p className="text-[11px] text-[#5A6F65]">MP4, MOV, WebM · max 500 MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {urlError && <p className="text-[11px] text-red-400">{urlError}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#5A6F65] uppercase tracking-widest">Clip Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStyle(opt.value)}
                      className={`text-left p-3 rounded-[12px] border transition-all ${
                        style === opt.value
                          ? "bg-brand/10 border-brand/30 text-white"
                          : "bg-white/[0.02] border-white/[0.05] text-[#5A6F65] hover:border-white/20"
                      }`}
                    >
                      <p className="text-[12px] font-bold">{opt.label}</p>
                      <p className="text-[10px] text-[#3A4A43] mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: confirm ── */}
          {step === "confirm" && (
            <div className="space-y-4">
              {/* Flow explanation */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-400 leading-relaxed">
                  Clicking <strong>Pay &amp; Hire</strong> opens MetaMask to process payment first. Once the transaction is confirmed, your video will be downloaded and queued for the agent.
                </p>
              </div>

              {/* Wrong network warning */}
              {(() => {
                const currentChain = (window as any).ethereum?.chainId;
                const expectedHex  = "0x" + BNB_CHAIN_ID.toString(16);
                return currentChain && currentChain !== expectedHex ? (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-yellow-400/5 border border-yellow-400/20">
                    <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-yellow-400 leading-relaxed">
                      MetaMask is on the wrong network. It will automatically switch to <strong>BSC Testnet (chainId {BNB_CHAIN_ID})</strong> when you click Pay.
                    </p>
                  </div>
                ) : null;
              })()}

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-bold text-[#5A6F65] uppercase tracking-widest">Order Summary</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#5A6F65]">Agent</span>
                    <span className="text-white font-bold">{agent.name}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#5A6F65]">Style</span>
                    <span className="text-white font-bold capitalize">{style}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#5A6F65]">Video Source</span>
                    <span className="text-brand font-mono text-[10px] truncate max-w-[180px]">
                      {inputMode === "file" ? (videoFile?.name || "File upload") : videoUrl}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#5A6F65]">Contract</span>
                    <a
                      href={`https://testnet.bscscan.com/address/${CONTRACT_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand font-mono text-[10px] hover:underline flex items-center gap-1"
                    >
                      {truncateAddress(CONTRACT_ADDRESS, 8, 6)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <span className="text-[12px] text-white font-bold">Total</span>
                  <span className="text-[20px] font-black text-brand">
                    {agent.pricePerJobBNB}
                    <span className="text-[12px] font-bold text-[#5A6F65] ml-1">tBNB</span>
                  </span>
                </div>
              </div>

              {address && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  <span className="text-[10px] text-[#5A6F65]">Paying from:</span>
                  <span className="text-[10px] font-mono text-white">{truncateAddress(address)}</span>
                </div>
              )}

              <p className="text-[11px] text-[#5A6F65] leading-relaxed">
                Clicking &quot;Pay &amp; Hire&quot; will call <strong className="text-white">createJob()</strong> on the escrow contract. The BNB is locked until clips are delivered or the job is refunded.
              </p>
            </div>
          )}

          {/* ── STEP: downloading ── */}
          {step === "downloading" && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="relative">
                <div className="absolute inset-0 blur-xl rounded-full bg-brand/20 animate-pulse" />
                <div className="relative w-16 h-16 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-brand animate-spin" />
                </div>
              </div>

              {/* File upload mode */}
              {inputMode === "file" ? (
                <div className="w-full space-y-4 text-center">
                  <div className="space-y-1">
                    <p className="text-white font-bold text-[14px]">
                      {uploadLabel || "Uploading video…"}
                    </p>
                    <p className="text-[#5A6F65] text-[11px]">
                      {videoFile?.name && (
                        <span className="truncate block max-w-xs mx-auto">{videoFile.name}</span>
                      )}
                      Payment confirmed — uploading your file to the AI agent
                    </p>
                  </div>
                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-[12px] font-bold text-[#5A6F65]">
                      <span>Uploading file</span>
                      <span className="text-brand">
                        {uploadProgress >= 0 ? `${uploadProgress}%` : "…"}
                      </span>
                    </div>
                    <div className="h-2 bg-[#0B100E] rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-brand rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,229,143,0.4)]"
                        style={{
                          width: uploadProgress >= 0 ? `${uploadProgress}%` : "100%",
                          opacity: uploadProgress < 0 ? 0.35 : 1,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* YouTube / URL mode */
                <div className="text-center space-y-1">
                  <p className="text-white font-bold text-[14px]">
                    {ytState.phase === "fetching-info" && "Getting video info…"}
                    {ytState.phase === "downloading"   && "Downloading video…"}
                    {ytState.phase === "uploading"     && "Uploading to server…"}
                    {!ytBusy && "Preparing video…"}
                  </p>
                  <p className="text-[#5A6F65] text-[11px] max-w-xs text-center">
                    {ytState.phase === "fetching-info" && "Getting video metadata from YouTube"}
                    {ytState.phase === "downloading"   && "Downloading video to your browser"}
                    {ytState.phase === "uploading"     && "Uploading to ClipsCash — almost ready"}
                    {!ytBusy                           && "Payment confirmed — preparing your video"}
                  </p>
                </div>
              )}

              {/* YouTube progress bar */}
              {inputMode === "url" && ytState.phase !== "idle" && ytState.phase !== "done" && ytState.phase !== "error" && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-[12px] font-bold text-[#5A6F65]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{ytState.label}</span>
                    </div>
                    <span className="text-brand">{ytState.progress >= 0 ? `${ytState.progress}%` : "…"}</span>
                  </div>
                  <div className="h-2 bg-[#0B100E] rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,229,143,0.4)]"
                      style={{
                        width: ytState.progress >= 0 ? `${ytState.progress}%` : "100%",
                        opacity: ytState.progress < 0 ? 0.35 : 1,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* YouTube error */}
              {inputMode === "url" && ytState.phase === "error" && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-[12px] text-red-400 leading-relaxed">{ytState.error}</p>
                    <p className="text-[11px] text-[#5A6F65]">
                      Try switching to{" "}
                      <button
                        onClick={() => { setStep("form"); setInputMode("file"); resetYouTube(); }}
                        className="text-brand underline underline-offset-2 hover:text-white transition-colors"
                      >
                        Upload File
                      </button>{" "}
                      to upload your video directly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: switching / paying / confirming / polling ── */}
          {["switching", "paying", "confirming", "polling"].includes(step) && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="relative">
                <div className="absolute inset-0 blur-xl rounded-full bg-brand/20 animate-pulse" />
                <div className="relative w-16 h-16 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center">
                  {step === "paying"
                    ? <Wallet className="w-7 h-7 text-brand animate-bounce" />
                    : <Loader2 className="w-7 h-7 text-brand animate-spin" />
                  }
                </div>
              </div>



              <div className="text-center space-y-1">
                <p className="text-white font-bold text-[14px]">
                  {step === "switching"  && "Switching network…"}
                  {step === "paying"     && "Confirm in MetaMask"}
                  {step === "confirming" && "Waiting for confirmation…"}
                  {step === "polling"    && "Registering job on backend…"}
                </p>
                <p className="text-[#5A6F65] text-[11px] max-w-xs text-center">
                  {step === "switching"  && "Adding BSC Testnet to MetaMask if needed."}
                  {step === "paying"     && "Review the transaction and click Confirm. Do not close this window."}
                  {step === "confirming" && "Transaction submitted. Waiting for 1 block confirmation on BSC Testnet."}
                  {step === "polling"    && "Transaction confirmed. The backend is detecting the JobCreated event (up to 60s)."}
                </p>
              </div>

              {txHash && (
                <a
                  href={bscscanTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-mono text-brand hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on BscScan
                </a>
              )}
            </div>
          )}

          {/* ── STEP: job ── */}
          {step === "job" && jobId && (
            <AgentJobStatus jobId={jobId} txHash={txHash} onNavigate={onClose} />
          )}

          {/* ── STEP: error ── */}
          {step === "error" && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2 min-w-0">
                <p className="text-[12px] text-red-400 leading-relaxed">{errorMsg}</p>
                {txHash && (
                  <a
                    href={bscscanTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono text-brand hover:underline"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    View tx on BscScan
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-6 pb-6 pt-4 border-t border-white/[0.04] shrink-0">
          {step === "form" && (
            <button
              onClick={handleFormSubmit}
              disabled={inputMode === "url" ? !videoUrl.trim() : !videoFile}
              className="w-full py-3.5 rounded-2xl bg-brand hover:bg-brand-hover disabled:bg-white/5 disabled:text-[#5A6F65] disabled:cursor-not-allowed text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === "confirm" && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep("form")}
                className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-[13px] font-bold text-white hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleHire}
                disabled={!address}
                className="flex-2 flex-grow py-3 rounded-2xl bg-brand hover:bg-brand-hover disabled:bg-white/5 disabled:text-[#5A6F65] disabled:cursor-not-allowed text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-colors"
              >
                {!address ? (
                  <><Wallet className="w-4 h-4" /> Connect Wallet First</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Pay {agent.pricePerJobBNB} tBNB &amp; Hire</>
                )}
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep("form");
                  setErrorMsg("");
                  setTxHash(null);
                  setCloudinaryUrl(null);
                  setUploadProgress(0);
                  setUploadLabel("");
                  resetYouTube();
                }}
                className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-[13px] font-bold text-white hover:bg-white/10 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[13px] text-[#5A6F65] hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === "job" && (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-[13px] font-bold text-white hover:bg-white/10 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
