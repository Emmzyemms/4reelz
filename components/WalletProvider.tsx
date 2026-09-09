"use client";

/**
 * WalletProvider (BNB Smart Chain)
 *
 * Wraps the app and exposes wallet state (address, loading, error)
 * plus connect / disconnect helpers via the useWallet() hook.
 *
 * Persists the connected address in localStorage so the UI survives
 * a page refresh without forcing the user to reconnect.
 *
 * Works with MetaMask, Binance Wallet, Trust Wallet, and any
 * EIP-1193 injected provider.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  connectWallet,
  disconnectWallet,
  getConnectedAddress,
  onAccountChanged,
  onChainChanged,
  BNB_CHAIN_ID,
} from "@/lib/bnbWallet";

const STORAGE_KEY = "clipcash_bnb_address";

interface WalletContextType {
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  chainId: null,
  isConnecting: false,
  error: null,
  isWrongNetwork: false,
  connect: async () => {},
  disconnect: async () => {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived: the wallet is connected but on the wrong chain
  const isWrongNetwork = address !== null && chainId !== null && chainId !== BNB_CHAIN_ID;

  // On mount: restore persisted address and subscribe to wallet events
  useEffect(() => {
    // Restore from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAddress(stored);

    // Verify the address is still connected (wallet may have been locked)
    getConnectedAddress().then((live) => {
      if (live) {
        setAddress(live);
        localStorage.setItem(STORAGE_KEY, live);
      } else if (stored) {
        // Wallet was disconnected externally — clear our state
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    // Listen for account changes (user switches account or disconnects in wallet)
    const unsubAccount = onAccountChanged((newAddress) => {
      if (newAddress) {
        setAddress(newAddress);
        localStorage.setItem(STORAGE_KEY, newAddress);
      } else {
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    // Listen for chain changes (user switches network in wallet)
    const unsubChain = onChainChanged((newChainId) => {
      setChainId(newChainId);
    });

    return () => {
      unsubAccount();
      unsubChain();
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      // User rejection — not a real error, just clear the loading state
      if (
        message.toLowerCase().includes("user rejected") ||
        message.toLowerCase().includes("user denied")
      ) {
        // Swallow silently
      } else {
        setError(message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    setChainId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnecting,
        error,
        isWrongNetwork,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
