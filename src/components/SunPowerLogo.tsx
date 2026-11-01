import React from "react";
import { cn } from "@/lib/utils";

interface SunPowerLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "dark" | "light" | "glass" | "bare";
  className?: string;
  showText?: boolean;
  titleClassName?: string;
  subtitleClassName?: string;
  subtitle?: string;
}

const SIZES = {
  xs: { box: "h-6 w-6 rounded-md", svg: 22, text: "text-xs", sub: "text-[9px]" },
  sm: { box: "h-8.5 w-8.5 rounded-lg", svg: 28, text: "text-sm", sub: "text-[10px]" },
  md: { box: "h-10 w-10 rounded-xl", svg: 36, text: "text-base", sub: "text-[10px]" },
  lg: { box: "h-12 w-12 rounded-xl", svg: 44, text: "text-lg", sub: "text-xs" },
  xl: { box: "h-16 w-16 rounded-2xl", svg: 58, text: "text-xl", sub: "text-sm" },
};

/**
 * Animated SunPower Brand Symbol
 * Features:
 * - 12 rotating solar rays with gradient glow (animate-sun-spin)
 * - Counter-rotating orbital telemetry ring (animate-sun-spin-reverse)
 * - Pulsing solar core with corona bloom (animate-sun-glow)
 * - Central 4-point solar photon flare (animate-sun-rays)
 */
export function SunPowerSymbol({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const s = SIZES[size] || SIZES.md;
  const rayAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <svg
      viewBox="0 0 32 32"
      width={s.svg}
      height={s.svg}
      className={cn("overflow-visible select-none shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SunPower animated solar emblem"
    >
      <defs>
        {/* Core Solar Gold Gradient */}
        <radialGradient id="sp-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="35%" stopColor="#fde047" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>

        {/* Outer Ray Gradient: Solar Gold transitioning into Emerald Energy */}
        <linearGradient id="sp-ray-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Concentric Telemetry Orbit Gradient */}
        <linearGradient id="sp-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.8" />
        </linearGradient>

        {/* Ambient Halo Glow */}
        <filter id="sp-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Layer 1: Ambient Corona Pulsing Halo */}
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="#f59e0b"
        opacity="0.18"
        className="animate-sun-glow origin-center"
      />

      {/* Layer 2: 12-Ray Rotating Solar Burst */}
      <g className="animate-sun-spin origin-center" style={{ transformOrigin: "16px 16px" }}>
        {rayAngles.map((angle) => (
          <path
            key={angle}
            d="M16 2.2 L17.3 6.8 L16 8.2 L14.7 6.8 Z"
            fill="url(#sp-ray-grad)"
            transform={`rotate(${angle} 16 16)`}
            className="transition-all"
          />
        ))}
      </g>

      {/* Layer 3: Counter-rotating orbital telemetry ring */}
      <circle
        cx="16"
        cy="16"
        r="8.8"
        stroke="url(#sp-ring-grad)"
        strokeWidth="1.1"
        strokeDasharray="2.8 2.2"
        fill="none"
        className="animate-sun-spin-reverse origin-center"
        style={{ transformOrigin: "16px 16px" }}
      />

      {/* Layer 4: Radiant Central Sun Disc */}
      <circle
        cx="16"
        cy="16"
        r="5.8"
        fill="url(#sp-core-glow)"
        filter="url(#sp-blur)"
        className="animate-sun-glow origin-center"
        style={{ transformOrigin: "16px 16px" }}
      />

      {/* Layer 5: Central 4-Point Photon Flare / Star burst */}
      <path
        d="M16 11.8 Q16 16 20.2 16 Q16 16 16 20.2 Q16 16 11.8 16 Q16 16 16 11.8 Z"
        fill="#ffffff"
        className="animate-sun-rays origin-center"
        style={{ transformOrigin: "16px 16px" }}
      />

      {/* Core pinpoint spark */}
      <circle cx="16" cy="16" r="1.3" fill="#fef08a" />
    </svg>
  );
}

/**
 * SunPower Logo badge container with animated symbol + optional typography
 */
export function SunPowerLogo({
  size = "md",
  variant = "light",
  className,
  showText = false,
  titleClassName,
  subtitleClassName,
  subtitle = "Solar Operations",
}: SunPowerLogoProps) {
  const s = SIZES[size] || SIZES.md;

  const badgeBg =
    variant === "bare"
      ? ""
      : variant === "dark"
      ? "bg-gradient-to-tr from-slate-950 via-emerald-950 to-slate-900 border border-emerald-500/30 shadow-md shadow-emerald-950/50"
      : variant === "glass"
      ? "bg-white/15 border border-white/25 shadow-inner backdrop-blur-md"
      : "bg-gradient-to-tr from-emerald-600 via-emerald-500 to-lime-400 text-slate-950 shadow-md";

  const symbol = (
    <div
      className={cn(
        "flex items-center justify-center transition-transform hover:scale-105",
        badgeBg,
        variant !== "bare" && s.box,
        className
      )}
    >
      <SunPowerSymbol size={size} />
    </div>
  );

  if (!showText) {
    return symbol;
  }

  return (
    <div className="flex items-center gap-3">
      {symbol}
      <div className="leading-tight">
        <p className={cn("font-extrabold tracking-tight", s.text, titleClassName || "text-slate-900")}>
          SunPower
        </p>
        {subtitle && (
          <p className={cn("font-medium", s.sub, subtitleClassName || "text-slate-400")}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default SunPowerLogo;

