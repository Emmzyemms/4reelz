"use client";

/**
 * WalletButton
 *
 * Connects / disconnects a BNB wallet using the local WalletProvider state.
 * No API calls — wallet linking to the backend account is handled separately
 * (e.g. on the login page via AuthForm).
 */

import React from "react";
import { Loader2, Wallet, AlertCircle } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { truncateAddress } from "@/lib/bnbWallet";

interface WalletButtonProps {
  className?: string;
  compact?: boolean;
  /** Whether to show the address when connected (default: true) */
  showAddress?: boolean;
  /** Called with the BNB address immediately after a successful wallet connect (login page use) */
  onConnect?: (address: string) => void;
}

export default function WalletButton({
  className,
  compact = false,
  showAddress = true,
  onConnect,
}: WalletButtonProps) {
  const { address, isConnecting, isWrongNetwork, connect, disconnect } = useWallet();

  const handleConnect = async () => {
    try {
      await connect();
    } catch {
      // WalletProvider.connect() already swallows user-rejection errors
      // and sets error state. Any other error is also already handled there.
      return;
    }
    // WalletProvider updates `address` state asynchronously after connect(),
    // so read the live address directly from the EIP-1193 provider instead of
    // relying on the React state having already re-rendered.
    if (onConnect) {
      const { getConnectedAddress } = await import("@/lib/bnbWallet");
      const addr = await getConnectedAddress().catch(() => null);
      if (addr) onConnect(addr);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const busy = isConnecting;

  // ── Wrong network warning ────────────────────────────────────────────────
  if (address && isWrongNetwork) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        className={
          className ??
          "flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all font-bold text-sm"
        }
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        {!compact && <span>Wrong Network</span>}
      </button>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  if (address && showAddress) {
    return (
      <button
        type="button"
        onClick={handleDisconnect}
        title={address}
        className={
          className ??
          "flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] bg-brand/10 border border-brand/30 text-brand hover:bg-brand/20 transition-all font-bold text-sm"
        }
      >
        <Wallet className="w-4 h-4 shrink-0" />
        {!compact && (
          <span className="tabular-nums">{truncateAddress(address)}</span>
        )}
      </button>
    );
  }

  // ── Not connected ────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={busy}
      className={
        className ??
        "flex items-center justify-center gap-2 px-5 py-3 rounded-[14px] bg-[#1A221E]/60 border border-[#2A3B34] text-white hover:border-brand/50 hover:bg-[#1A221E] transition-all font-bold text-sm disabled:opacity-60"
      }
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4 text-brand" />
      )}
      {!compact && (busy ? "Connecting…" : "Connect Wallet")}
    </button>
  );
}
