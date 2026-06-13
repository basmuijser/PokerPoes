"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";

interface Props {
  player: Player;
  isMe: boolean;
  isTurn: boolean;
  moneyMode: boolean;
  chipValue: number;
}

function RoleDot({ role }: { role: "D" | "SB" | "BB" }) {
  const styles =
    role === "D"
      ? { bg: "#ffffff", color: "#0a0a0a" }
      : role === "SB"
        ? { bg: "#f59e0b", color: "#0a0a0a" }
        : { bg: "#3b82f6", color: "#ffffff" };
  return (
    <span
      style={{ background: styles.bg, color: styles.color }}
      className="absolute -right-1 -top-1 z-10 flex h-5 min-w-[22px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold tracking-tight shadow"
    >
      {role}
    </span>
  );
}

export default function PlayerBubble({
  player,
  isMe,
  isTurn,
  moneyMode,
  chipValue,
}: Props) {
  const folded = player.hand_status === "folded";
  const allIn = player.hand_status === "all-in";

  const role = player.is_dealer
    ? "D"
    : player.is_small_blind
      ? "SB"
      : player.is_big_blind
        ? "BB"
        : null;

  const baseClass = isMe
    ? "px-3 py-2 min-w-[100px]"
    : "px-2 py-1.5 min-w-[78px]";

  const bgStyle: React.CSSProperties = isMe
    ? {
        background: "linear-gradient(135deg, #14532d 0%, #0f3d22 100%)",
        border: `2px solid ${isTurn ? "#86efac" : "#22c55e"}`,
        boxShadow: isTurn
          ? "0 0 0 2px rgba(34,197,94,0.35), 0 0 22px rgba(34,197,94,0.55)"
          : "0 0 14px rgba(34,197,94,0.25)",
      }
    : {
        background: "#1f2937",
        border: `1px solid ${isTurn ? "#22c55e" : "#374151"}`,
        boxShadow: isTurn
          ? "0 0 0 2px rgba(34,197,94,0.35), 0 0 18px rgba(34,197,94,0.45)"
          : undefined,
      };

  const chipColor = isMe ? "#86efac" : "#e5e7eb";

  return (
    <div
      style={{ ...bgStyle, opacity: folded ? 0.35 : 1 }}
      className={`relative rounded-2xl text-center transition-shadow ${baseClass}`}
    >
      {role && <RoleDot role={role} />}
      <div
        className={`truncate font-semibold ${
          isMe ? "text-sm text-white" : "text-[11px] text-white/90"
        }`}
        style={{ maxWidth: isMe ? 96 : 74 }}
      >
        {player.name}
      </div>
      <div
        style={{ color: chipColor }}
        className={isMe ? "text-2xl font-extrabold leading-none" : "text-base font-bold leading-none"}
      >
        <AnimatedNumber value={player.chips} className="tabular-nums" />
      </div>
      {moneyMode && (
        <div className="text-[9px] text-white/50">
          €{(player.chips * chipValue).toFixed(2)}
        </div>
      )}
      {(folded || allIn) && (
        <div
          className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
            allIn ? "bg-red-500/30 text-red-200" : "bg-white/10 text-white/60"
          }`}
        >
          {allIn ? "ALL-IN" : "FOLD"}
        </div>
      )}
    </div>
  );
}
