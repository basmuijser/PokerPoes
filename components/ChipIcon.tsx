"use client";

// Per-seat chip palette. Inspired by casino denominations.
const PALETTE = [
  { outer: "#dc2626", inner: "#7f1d1d", segment: "#fef2f2" }, // seat 0 — red
  { outer: "#2563eb", inner: "#1e3a8a", segment: "#eff6ff" }, // seat 1 — blue
  { outer: "#16a34a", inner: "#14532d", segment: "#ecfdf5" }, // seat 2 — green
  { outer: "#9333ea", inner: "#581c87", segment: "#faf5ff" }, // seat 3 — purple
  { outer: "#ea580c", inner: "#7c2d12", segment: "#fff7ed" }, // seat 4 — orange
  { outer: "#db2777", inner: "#831843", segment: "#fdf2f8" }, // seat 5 — pink
  { outer: "#0d9488", inner: "#134e4a", segment: "#f0fdfa" }, // seat 6 — teal
  { outer: "#ca8a04", inner: "#713f12", segment: "#fefce8" }, // seat 7 — yellow
];

function formatChipAmount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

interface Props {
  amount: number;
  seatIndex: number;
  size?: number;
}

export default function ChipIcon({ amount, seatIndex, size = 36 }: Props) {
  const color = PALETTE[((seatIndex % PALETTE.length) + PALETTE.length) % PALETTE.length];
  const label = formatChipAmount(amount);
  // Smaller font for long numbers so they still fit.
  const fontSize = label.length <= 2 ? 13 : label.length === 3 ? 11 : label.length === 4 ? 9 : 7.5;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))" }}
      aria-label={`${label} chip`}
    >
      <defs>
        <radialGradient id={`chipBg-${seatIndex}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={color.outer} stopOpacity="1" />
          <stop offset="100%" stopColor={color.inner} stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Outer disc */}
      <circle
        cx="20"
        cy="20"
        r="17"
        fill={`url(#chipBg-${seatIndex})`}
        stroke="#0a0a0a"
        strokeWidth="1"
      />

      {/* Alternating segmented edge — dashed stroke creates the chip dashes */}
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke={color.segment}
        strokeWidth="3.4"
        strokeDasharray="3.5 3.4"
        strokeLinecap="butt"
        opacity="0.92"
      />

      {/* Inner darker disc with subtle inset highlight */}
      <circle
        cx="20"
        cy="20"
        r="11"
        fill={color.inner}
        stroke="#0a0a0a"
        strokeWidth="0.6"
      />
      <circle
        cx="20"
        cy="18"
        r="10"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.6"
      />

      {/* Center amount */}
      <text
        x="20"
        y="20"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={900}
        fill="#ffffff"
        style={{ letterSpacing: "-0.3px" }}
      >
        {label}
      </text>
    </svg>
  );
}
