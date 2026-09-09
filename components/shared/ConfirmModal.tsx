"use client";

import React, { useEffect } from "react";
import { X, AlertCircle, Trash2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "info";
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  loading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-md bg-[#0E1512] border border-white/5 rounded-[32px] p-8 shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* subtle glow */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] pointer-events-none ${variant === 'danger' ? 'bg-red-500/10' : 'bg-brand/10'}`} />

        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-brand/10 text-brand'}`}>
            {variant === 'danger' ? <Trash2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[#5A6F65] leading-relaxed">{message}</p>
          </div>

          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
                variant === 'danger' 
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20' 
                  : 'bg-brand text-black hover:bg-brand-hover shadow-[0_0_20px_rgba(0,229,143,0.3)]'
              }`}
            >
              {loading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
