"use client";

/**
 * BNB Smart Chain wallet integration
 *
 * This module provides a thin, framework-agnostic EVM wallet layer that works
 * with MetaMask, Binance Wallet, Trust Wallet, and any EIP-1193 provider.
 *
 * It is intentionally minimal — no wagmi hooks are used here so this module
 * can be imported in both client components and utility code without needing
 * a wagmi provider in scope. The WalletProvider component wraps wagmi and
 * calls these helpers as needed.
 */

// ─── Chain configuration ──────────────────────────────────────────────────────

/** BSC Mainnet chainId = 56, BSC Testnet chainId = 97 */
export const BNB_CHAIN_ID =
  process.env.NEXT_PUBLIC_BNB_CHAIN_ID === "56" ? 56 : 97;

export const BNB_CHAIN_CONFIG = {
  mainnet: {
    chainId: "0x38", // 56
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed1.binance.org/"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  testnet: {
    chainId: "0x61", // 97
    chainName: "BNB Smart Chain Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrls: [
      process.env.NEXT_PUBLIC_BNB_RPC_URL ||
        "https://data-seed-prebsc-1-s1.binance.org:8545/",
      "https://bsc-testnet-rpc.publicnode.com",
      "https://bsc-testnet.nodereal.io/v1/165ac1f6afbd4c8b9ee6e9b9e0c8f3e8",
    ],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
} as const;

export const ACTIVE_CHAIN =
  BNB_CHAIN_ID === 56 ? BNB_CHAIN_CONFIG.mainnet : BNB_CHAIN_CONFIG.testnet;

export const BSCSCAN_BASE =
  BNB_CHAIN_ID === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com";

// ─── Provider helpers ─────────────────────────────────────────────────────────

/** Returns the window.ethereum provider (MetaMask / Binance Wallet / etc.) */
function getProvider(): any {
  if (typeof window === "undefined") return null;

  // Prefer Binance Chain Wallet when available, fall back to MetaMask
  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;

  // If there are multiple injected providers, prefer Binance Wallet
  if (ethereum.providers?.length) {
    const bnbWallet = ethereum.providers.find(
      (p: any) => p.isBinanceChainWallet || p.isBinanceSmartChain
    );
    if (bnbWallet) return bnbWallet;
    return ethereum.providers[0];
  }

  return ethereum;
}

/**
 * Requests the user to switch to BSC. If the chain is not added yet,
 * attempts to add it first.
 */
async function ensureBscChain(provider: any): Promise<void> {
  const target = "0x" + BNB_CHAIN_ID.toString(16);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target }],
    });
  } catch (switchErr: any) {
    // 4902 = chain not added to wallet
    if (switchErr?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [ACTIVE_CHAIN],
      });
    } else {
      throw switchErr;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prompts the user to connect their wallet.
 * Returns the connected EVM address (0x…).
 */
export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No Ethereum wallet detected. Please install MetaMask or Binance Wallet."
    );
  }

  // Request accounts
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned. Did you reject the connection?");
  }

  // Ensure we're on BSC
  await ensureBscChain(provider);

  return accounts[0].toLowerCase();
}

/**
 * Returns the currently connected address without opening a modal.
 * Returns null if no wallet is connected.
 */
export async function getConnectedAddress(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts: string[] = await provider.request({ method: "eth_accounts" });
    return accounts?.[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/**
 * Signs a plain-text message with the connected wallet.
 * Returns the hex signature string (0x…).
 * Used for challenge-based authentication.
 */
export async function signAuthMessage(
  message: string,
  address: string
): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet connected.");

  // personal_sign takes message as hex or UTF-8 string
  const msgHex =
    "0x" +
    Array.from(new TextEncoder().encode(message))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const signature: string = await provider.request({
    method: "personal_sign",
    params: [msgHex, address],
  });

  return signature;
}

/**
 * Disconnects the wallet by clearing local state.
 * Note: EIP-1193 providers do not have a programmatic disconnect method —
 * we can only clear our cached state.
 */
export async function disconnectWallet(): Promise<void> {
  // Clear cached address from localStorage (done in WalletProvider)
  // Some wallets support wallet_revokePermissions:
  const provider = getProvider();
  if (provider?.request) {
    try {
      await provider.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Ignore — not all wallets support this
    }
  }
}

/**
 * Subscribes to account change events from the wallet.
 * Returns an unsubscribe function.
 */
export function onAccountChanged(
  cb: (address: string | null) => void
): () => void {
  const provider = getProvider();
  if (!provider) return () => {};

  const handler = (accounts: string[]) => {
    cb(accounts?.[0]?.toLowerCase() ?? null);
  };

  provider.on("accountsChanged", handler);
  return () => provider.removeListener?.("accountsChanged", handler);
}

/**
 * Subscribes to chain change events from the wallet.
 * Returns an unsubscribe function.
 */
export function onChainChanged(cb: (chainId: number) => void): () => void {
  const provider = getProvider();
  if (!provider) return () => {};

  const handler = (chainIdHex: string) => {
    cb(parseInt(chainIdHex, 16));
  };

  provider.on("chainChanged", handler);
  return () => provider.removeListener?.("chainChanged", handler);
}

/**
 * Returns a BscScan URL for a given transaction hash.
 */
export function bscscanTxUrl(txHash: string): string {
  return `${BSCSCAN_BASE}/tx/${txHash}`;
}

/**
 * Returns a BscScan URL for a given address.
 */
export function bscscanAddressUrl(address: string): string {
  return `${BSCSCAN_BASE}/address/${address}`;
}

/**
 * Truncates a BNB/EVM address for display.
 * e.g. "0x1234…abcd"
 */
export function truncateAddress(address: string, front = 6, back = 4): string {
  if (!address || address.length < front + back + 2) return address;
  return `${address.slice(0, front)}…${address.slice(-back)}`;
}
