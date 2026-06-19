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
  const allIn = player.hand_status === "all-in";
  // A player is "sitting out" when they have 0 chips AND aren't currently
  // all-in in this hand. (Mid-hand all-in players also have chips=0 but they
  // still belong to the hand — we show them as ALL-IN, not GEEN FICHES.)
  const sittingOut = player.chips === 0 && !allIn;
  const folded = player.hand_status === "folded" && !sittingOut;

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

  // Self vs other — fill and border identify "you" (light/white border on the
  // green gradient); turn state is layered on top via the animated keyframe.
  const bgStyle: React.CSSProperties = isMe
    ? {
        background: "linear-gradient(135deg, #14532d 0%, #0f3d22 100%)",
        border: "2px solid #e5e7eb",
      }
    : {
        background: "#1f2937",
        border: "1px solid #374151",
      };

  const opacity = sittingOut ? 0.55 : folded ? 0.35 : 1;
  const chipColor = isMe ? "#86efac" : "#e5e7eb";

  // Whose turn it is gets the pulsing green glow on top of whatever bubble
  // style they already have (self or other).
  const turnClass = isTurn ? "animate-turnPulse" : "";

  return (
    <div
      style={{ ...bgStyle, opacity }}
      className={`relative rounded-2xl text-center transition-shadow ${baseClass} ${turnClass}`}
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
        className={
          isMe
            ? "text-2xl font-extrabold leading-none"
            : "text-base font-bold leading-none"
        }
      >
        <AnimatedNumber value={player.chips} className="tabular-nums" />
      </div>
      {moneyMode && (
        <div className="text-[9px] text-white/50">
          €{(player.chips * chipValue).toFixed(2)}
        </div>
      )}
      {sittingOut && (
        <div className="mt-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-200">
          GEEN FICHES
        </div>
      )}
      {!sittingOut && allIn && (
        <div className="mt-1 rounded-full bg-red-500/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-red-200">
          ALL-IN
        </div>
      )}
      {!sittingOut && folded && (
        <div className="mt-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white/60">
          FOLD
        </div>
      )}
    </div>
  );
}
