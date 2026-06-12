"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";

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
        isTurn
          ? "border-feltLight shadow-glow"
          : "border-white/5"
      } ${dim ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-chip">
              {player.name}
            </span>
            {player.is_dealer && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-felt/40 text-[9px] font-bold text-feltLight">
                D
              </span>
            )}
            {player.is_small_blind && (
              <span className="flex h-4 items-center justify-center rounded-full bg-felt/30 px-1.5 text-[9px] font-bold text-feltLight">
                SB
              </span>
            )}
            {player.is_big_blind && (
              <span className="flex h-4 items-center justify-center rounded-full bg-felt/30 px-1.5 text-[9px] font-bold text-feltLight">
                BB
              </span>
            )}
            {player.hand_status === "all-in" && (
              <span className="flex h-4 items-center justify-center rounded-full bg-danger/20 px-1.5 text-[9px] font-bold text-danger">
                ALL-IN
              </span>
            )}
            {player.hand_status === "folded" && (
              <span className="flex h-4 items-center justify-center rounded-full bg-white/5 px-1.5 text-[9px] font-bold text-muted">
                FOLD
              </span>
            )}
          </div>
          <div className="mt-0.5">
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
          {player.current_bet > 0 && (
            <div className="mt-0.5 text-[10px] text-muted">
              Bet: {player.current_bet.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
