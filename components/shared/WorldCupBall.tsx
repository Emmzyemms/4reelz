"use client";

import React from "react";

interface WorldCupBallProps {
  size?: number;
  className?: string;
}

/**
 * Animated World Cup–style football (soccer ball) used as a loading indicator.
 * Pure SVG + CSS animation — no external dependencies.
 */
export default function WorldCupBall({ size = 80, className = "" }: WorldCupBallProps) {
  return (
    <div
      className={`relative flex flex-col items-center gap-6 ${className}`}
      style={{ width: size, height: size + 40 }}
    >
      {/* ── Bouncing ball ── */}
      <div
        className="relative"
        style={{
          width: size,
          height: size,
          animation: "ball-bounce 0.75s ease-in-out infinite alternate",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          style={{ animation: "ball-spin 1.5s linear infinite" }}
        >
          <defs>
            <clipPath id="ball-clip">
              <circle cx="50" cy="50" r="48" />
            </clipPath>
            <radialGradient id="ball-shine" cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Base white ball */}
          <circle cx="50" cy="50" r="48" fill="#f0f0f0" />

          {/* ── Classic black pentagon patches ── */}
          <g clipPath="url(#ball-clip)" fill="#111111">
            {/* Centre pentagon */}
            <polygon points="50,28 63,38 58,54 42,54 37,38" />

            {/* Top-left patch */}
            <polygon points="22,18 34,15 38,28 26,36 16,28" />

            {/* Top-right patch */}
            <polygon points="78,18 84,28 74,36 62,28 66,15" />

            {/* Bottom-left patch */}
            <polygon points="16,66 26,58 38,66 34,80 20,80" />

            {/* Bottom-right patch */}
            <polygon points="84,66 80,80 66,80 62,66 74,58" />

            {/* Top patch */}
            <polygon points="50,6 60,10 63,24 50,28 37,24 40,10" />

            {/* Bottom patch */}
            <polygon points="50,94 40,90 37,76 50,72 63,76 60,90" />
          </g>

          {/* Brand-colour glow ring */}
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="#00E58F"
            strokeWidth="2.5"
            strokeOpacity="0.6"
          />

          {/* Shine overlay */}
          <circle cx="50" cy="50" r="48" fill="url(#ball-shine)" />
        </svg>
      </div>

      {/* ── Shadow that squishes as ball bounces ── */}
      <div
        style={{
          width: size * 0.55,
          height: 8,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(0,229,143,0.25) 0%, transparent 70%)",
          animation: "shadow-pulse 0.75s ease-in-out infinite alternate",
          marginTop: -10,
        }}
      />

      {/* ── Keyframes injected as a style tag ── */}
      <style>{`
        @keyframes ball-bounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-24px); }
        }
        @keyframes ball-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shadow-pulse {
          from { transform: scaleX(1);   opacity: 0.6; }
          to   { transform: scaleX(0.5); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
