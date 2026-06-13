"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";
import RoleBadge from "./RoleBadge";

interface Props {
  player: Player;
  moneyMode: boolean;
  chipValue: number;
  isTurn: boolean;
}

export default function OtherPlayer({
  player,
  moneyMode,
  chipValue,
  isTurn,
}: Props) {
  const dim = player.hand_status === "folded";
  return (
    <div
      className={`rounded-xl border bg-panel p-3 transition-shadow ${
        isTurn ? "border-feltLight shadow-glow" : "border-white/5"
      } ${dim ? "opacity-50" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-chip">
            {player.name}
          </span>
          {player.is_dealer && <RoleBadge role="D" size="sm" />}
          {player.is_small_blind && <RoleBadge role="SB" size="sm" />}
          {player.is_big_blind && <RoleBadge role="BB" size="sm" />}
          {player.hand_status === "all-in" && (
            <span className="inline-flex h-5 items-center justify-center rounded-full bg-danger/20 px-1.5 text-[10px] font-bold tracking-wider text-danger">
              ALL-IN
            </span>
          )}
          {player.hand_status === "folded" && (
            <span className="inline-flex h-5 items-center justify-center rounded-full bg-white/5 px-1.5 text-[10px] font-bold tracking-wider text-muted">
              FOLD
            </span>
          )}
        </div>
        <div className="mt-1">
          <AnimatedNumber
            value={player.chips}
            className="text-xl font-bold tracking-tight text-chip"
          />
          {moneyMode && (
            <span className="ml-1 text-[10px] text-muted">
              €{(player.chips * chipValue).toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] text-muted">
          Ingezet: {player.current_bet.toLocaleString()} fiches
        </div>
      </div>
    </div>
  );
}
