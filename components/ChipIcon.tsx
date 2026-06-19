"use client";

import { useId } from "react";

// Standard real-world poker chip color conventions.
// Brackets are sorted descending so the first one whose `min` is ≤ the bet
// amount wins. So a bet of 7 lands in the 5-red bracket, a bet of 12 in 10-blue,
// a bet of 150 in 100-black, and so on.
const VALUE_BRACKETS = [
  // value ≥ 1000 → gold/yellow
  { min: 1000, name: "gold",   outer: "#facc15", inner: "#854d0e", segment: "#1a1a1a", text: "#1a1a1a" },
  // value ≥ 500  → purple
  { min: 500,  name: "purple", outer: "#9333ea", inner: "#581c87", segment: "#f5e8ff", text: "#ffffff" },
  // value ≥ 100  → black
  { min: 100,  name: "black",  outer: "#1f2937", inner: "#0a0a0a", segment: "#e5e7eb", text: "#ffffff" },
  // value ≥ 25   → green
  { min: 25,   name: "green",  outer: "#16a34a", inner: "#14532d", segment: "#ecfdf5", text: "#ffffff" },
  // value ≥ 10   → blue
  { min: 10,   name: "blue",   outer: "#2563eb", inner: "#1e3a8a", segment: "#eff6ff", text: "#ffffff" },
  // value ≥ 5    → red
  { min: 5,    name: "red",    outer: "#dc2626", inner: "#7f1d1d", segment: "#fef2f2", text: "#ffffff" },
  // value ≥ 1    → white
  { min: 1,    name: "white",  outer: "#f5f5f5", inner: "#a3a3a3", segment: "#171717", text: "#171717" },
];

function paletteForAmount(amount: number) {
  for (const b of VALUE_BRACKETS) if (amount >= b.min) return b;
  return VALUE_BRACKETS[VALUE_BRACKETS.length - 1];
}

function formatChipAmount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

interface Props {
  amount: number;
  size?: number;
}

export default function ChipIcon({ amount, size = 36 }: Props) {
  const reactId = useId().replace(/[:]/g, "");
  const palette = paletteForAmount(amount);
  const label = formatChipAmount(amount);
  // Smaller font for long numbers so they still fit.
  const fontSize =
    label.length <= 2 ? 13 : label.length === 3 ? 11 : label.length === 4 ? 9 : 7.5;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))" }}
      aria-label={`${label} chip`}
    >
      <defs>
        <radialGradient
          id={`chipBg-${reactId}`}
          cx="35%"
          cy="30%"
          r="80%"
        >
          <stop offset="0%" stopColor={palette.outer} stopOpacity="1" />
          <stop offset="100%" stopColor={palette.inner} stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Outer disc */}
      <circle
        cx="20"
        cy="20"
        r="17"
        fill={`url(#chipBg-${reactId})`}
        stroke="#0a0a0a"
        strokeWidth="1"
      />

      {/* Alternating segmented edge — dashed stroke creates the chip dashes */}
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke={palette.segment}
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
        fill={palette.inner}
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
        fill={palette.text}
        style={{ letterSpacing: "-0.3px" }}
      >
        {label}
      </text>
    </svg>
  );
}
