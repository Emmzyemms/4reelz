"use client";

import React, { useEffect, useState } from "react";
import {
  X, Wallet, Download, Loader2,
  CheckCircle, AlertCircle, ExternalLink,
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { useToast } from "@/components/shared/ToastProvider";
import {
  getClipInfo,
  getClipDownloadUrl,
  buildBnbTip,
  submitBnbTip,
  type ClipInfo,
} from "@/lib/queries";
import { markUnlocked } from "@/lib/tipUnlockStore";
import { bscscanTxUrl, truncateAddress } from "@/lib/bnbWallet";

interface TipModalProps {
  clipId: string;
  clipTitle: string;
  onClose: () => void;
  onDownloadReady: (downloadUrl: string) => void;
}

type Step =
  | "loading"     // fetching clip info
  | "info"        // showing clip + tip details to the user
  | "building"    // POST /bnb/tips/build
  | "signing"     // MetaMask confirmation dialog open
  | "submitting"  // POST /bnb/tips/submit (notify backend of tx hash)
  | "confirming"  // polling download endpoint until backend confirms tip
  | "success"     // tip confirmed — triggering download
  | "error";

// ─── Tip confirmation poller ──────────────────────────────────────────────────
// After the tip is submitted, the backend needs a moment to index the BNB tx.
// Poll GET /clips/:id/download?senderAddress=0x… until it returns 200 or a
// non-402 error.

async function waitForDownload(
  clipId: string,
  senderAddress: string,
  maxAttempts = 20,
  delayMs = 2500,
): Promise<string> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { downloadUrl } = await getClipDownloadUrl(clipId, senderAddress);
      if (downloadUrl) return downloadUrl;
    } catch (err: any) {
      const status = err?.response?.status;
      // 402 = tip not confirmed yet — keep polling
      if (status === 402 && i < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
    if (i < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    "Payment confirmation is taking longer than expected. Your tip was sent — try downloading again in a moment.",
  );
}

// ─── Error translation ────────────────────────────────────────────────────────

function translateError(err: any): string {
  const status = err?.response?.status;
  const raw: string =
    err?.response?.data?.message || err?.message || "Something went wrong.";

  if (status === 503)
    return "The server is starting up. Please wait a moment and try again.";
  if (
    raw.toLowerCase().includes("user rejected") ||
    raw.toLowerCase().includes("user denied") ||
    (err?.code === 4001)
  )
    return "You rejected the transaction in your wallet.";
  if (raw.toLowerCase().includes("insufficient funds"))
    return "Insufficient BNB balance. You need at least 0.001 BNB plus gas fees.";
  if (raw.toLowerCase().includes("no wallet") || raw.toLowerCase().includes("not connected"))
    return "Please connect your BNB wallet first.";
  return raw;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TipModal({
  clipId,
  clipTitle,
  onClose,
  onDownloadReady,
}: TipModalProps) {
  const { address, connect } = useWallet();
  const { toast } = useToast();

  const [step, setStep]         = useState<Step>("loading");
  const [info, setInfo]         = useState<ClipInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash]     = useState<string | null>(null);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Load clip info
  useEffect(() => {
    getClipInfo(clipId)
      .then((data) => { setInfo(data); setStep("info"); })
      .catch((err) => {
        setErrorMsg(err?.response?.data?.message || "Could not load clip info.");
        setStep("error");
      });
  }, [clipId]);

  const tipRequired = !!(info?.tippingEnabled || info?.owner?.bnbAddress);

  // ── Main action handler ───────────────────────────────────────────────────
  const handleAction = async () => {
    if (!info) return;

    // Need a wallet to proceed
    if (!address) {
      await connect();
      return;
    }

    // Free download (creator has no wallet)
    if (!tipRequired) {
      setStep("building");
      try {
        const { downloadUrl } = await getClipDownloadUrl(clipId);
        onDownloadReady(downloadUrl);
        onClose();
      } catch (err: any) {
        setErrorMsg(translateError(err));
        setStep("error");
      }
      return;
    }

    // ── BNB Tip → broadcast → confirm → download ──────────────────────────
    try {
      // 1. Build unsigned tx params from backend
      setStep("building");
      let txParams: Awaited<ReturnType<typeof buildBnbTip>>;
      try {
        txParams = await buildBnbTip(parseInt(clipId), "0.001", address);
      } catch (firstErr: any) {
        if (firstErr?.response?.status === 503) {
          await new Promise((r) => setTimeout(r, 4000));
          txParams = await buildBnbTip(parseInt(clipId), "0.001", address);
        } else {
          throw firstErr;
        }
      }

      // 2. Send transaction via MetaMask (signs + broadcasts in one step)
      setStep("signing");
      const provider = (window as any).ethereum;
      if (!provider) throw new Error("No Ethereum wallet detected.");

      const hash: string = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: txParams.to,
            value: txParams.value,
            gas: txParams.gas,
            data: txParams.data ?? "0x",
          },
        ],
      });

      setTxHash(hash);

      // 3. Notify backend of the transaction hash
      setStep("submitting");
      await submitBnbTip(parseInt(clipId), hash, address);

      // 4. Poll until backend confirms the tip on-chain
      setStep("confirming");
      const downloadUrl = await waitForDownload(clipId, address);

      // 5. Persist the unlock in localStorage
      markUnlocked(clipId, address);

      // 6. Done!
      setStep("success");
      toast("Tip sent! Starting your download…", "success");
      await new Promise((r) => setTimeout(r, 1200));
      onDownloadReady(downloadUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(translateError(err));
      setStep("error");
    }
  };

  // ── Labels & derived state ─────────────────────────────────────────────────
  const stepLabel: Record<Step, string> = {
    loading:    "Loading…",
    info:       tipRequired ? "Tip to download" : "Free download",
    building:   "Building transaction…",
    signing:    "Confirm in MetaMask…",
    submitting: "Recording on backend…",
    confirming: "Confirming on BNB Chain…",
    success:    "Tip confirmed!",
    error:      "Something went wrong",
  };

  const isWorking = ["building", "signing", "submitting", "confirming", "success"].includes(step);
  const isBusy    = isWorking || step === "loading";

  const PROGRESS_STEPS: { id: Step; label: string }[] = [
    { id: "building",   label: "Build transaction"   },
    { id: "signing",    label: "Confirm in MetaMask" },
    { id: "submitting", label: "Record tip"          },
    { id: "confirming", label: "Confirm on BNB Chain"},
    { id: "success",    label: "Download ready"      },
  ];
  const currentProgressIdx = PROGRESS_STEPS.findIndex((s) => s.id === step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={!isBusy ? onClose : undefined}
    >
      <div
        className="relative w-full max-w-sm bg-[#0B100E] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,229,143,0.10)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="space-y-0.5 min-w-0">
            <p className="text-white text-[14px] font-extrabold truncate max-w-[220px]">
              {clipTitle}
            </p>
            <p className="text-[#5A6F65] text-[11px] font-medium">{stepLabel[step]}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#5A6F65] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">

          {/* Loading skeleton */}
          {step === "loading" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          )}

          {/* Clip info card */}
          {(step === "info" || isWorking) && info && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-brand shrink-0" />
                <p className="text-[11px] font-bold text-[#5A6F65] uppercase tracking-widest">
                  Creator wallet
                </p>
              </div>

              {info.owner.bnbAddress ? (
                <p
                  className="text-[11px] font-mono text-brand break-all leading-relaxed cursor-pointer hover:text-white transition-colors"
                  title={info.owner.bnbAddress}
                  onClick={() =>
                    navigator.clipboard
                      ?.writeText(info.owner.bnbAddress!)
                      .catch(() => {})
                  }
                >
                  {truncateAddress(info.owner.bnbAddress, 10, 8)}
                  <span className="ml-1 text-[9px] text-[#3A4A43]">(click to copy)</span>
                </p>
              ) : (
                <p className="text-[12px] text-[#3A4A43]">
                  No wallet connected — download is free.
                </p>
              )}

              {tipRequired && (
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] text-[#5A6F65] font-medium">Tip amount</span>
                  <span className="text-[14px] font-extrabold text-brand">0.001 BNB</span>
                </div>
              )}
            </div>
          )}

          {/* Your wallet */}
          {(step === "info" || isWorking) && address && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span className="text-[10px] text-[#5A6F65] font-medium">Your wallet:</span>
              <span className="text-[10px] font-mono text-white">{truncateAddress(address)}</span>
            </div>
          )}

          {/* Progress steps */}
          {isWorking && (
            <div className="space-y-2 pt-1">
              {PROGRESS_STEPS.map((s, idx) => {
                const isDone    = idx < currentProgressIdx;
                const isCurrent = idx === currentProgressIdx;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all
                      ${isDone    ? "bg-brand"           : ""}
                      ${isCurrent ? "bg-brand/20 border border-brand" : ""}
                      ${!isDone && !isCurrent ? "bg-white/5 border border-white/10" : ""}
                    `}>
                      {isDone && <CheckCircle className="w-3 h-3 text-black" />}
                      {isCurrent && <Loader2 className="w-3 h-3 text-brand animate-spin" />}
                    </div>
                    <span className={`text-[12px] font-medium transition-colors
                      ${isDone    ? "text-brand"          : ""}
                      ${isCurrent ? "text-white font-bold" : ""}
                      ${!isDone && !isCurrent ? "text-[#3A4A43]" : ""}
                    `}>
                      {s.label}
                    </span>
                    {isCurrent && s.id === "confirming" && (
                      <span className="text-[10px] text-[#5A6F65] ml-auto">
                        waiting for BNB Chain…
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TX hash link during confirming / success */}
          {txHash && (step === "confirming" || step === "success") && (
            <a
              href={bscscanTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-brand hover:underline font-mono"
            >
              <ExternalLink className="w-3 h-3" />
              View on BscScan
            </a>
          )}

          {/* Success state */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <div className="absolute inset-0 blur-xl rounded-full bg-brand/30 animate-pulse" />
                <div className="relative w-14 h-14 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-brand" />
                </div>
              </div>
              <p className="text-white font-bold text-[14px]">Tip confirmed!</p>
              <p className="text-[#5A6F65] text-[12px] text-center">
                Your download is starting…
              </p>
            </div>
          )}

          {/* Error state */}
          {step === "error" && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-400 leading-relaxed">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(step === "info" || step === "error") && (
          <div className="px-6 pb-6 flex gap-3">
            {step === "error" ? (
              <>
                <button
                  onClick={() => { setStep("info"); setErrorMsg(""); }}
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
              </>
            ) : (
              <button
                onClick={handleAction}
                className="flex-1 py-3.5 rounded-2xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-colors"
              >
                {!address ? (
                  <>
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </>
                ) : !tipRequired ? (
                  <>
                    <Download className="w-4 h-4" />
                    Download Free
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Tip 0.001 BNB &amp; Download
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
