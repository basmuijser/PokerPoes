"use client";

import { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";

interface Props {
  player: Player;
  isHost: boolean;
  isMe: boolean;
  moneyMode: boolean;
  chipValue: number;
  onAdd?: () => void;
  onSub?: () => void;
  onAward?: () => void;
  canAward?: boolean;
}

export default function PlayerCard({
  player,
  isHost,
  isMe,
  moneyMode,
  chipValue,
  onAdd,
  onSub,
  onAward,
  canAward,
}: Props) {
  return (
    <div
      className={`relative rounded-2xl border bg-panel p-5 transition-colors ${
        isMe
          ? "border-feltLight/60 shadow-glow"
          : "border-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold text-chip">
              {player.name}
            </span>
            {player.is_host && (
              <span className="rounded-full bg-felt/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-feltLight">
                Banker
              </span>
            )}
            {isMe && !player.is_host && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-chip/80">
                You
              </span>
            )}
          </div>
          <div className="mt-3">
            <AnimatedNumber
              value={player.chips}
              className="text-4xl font-extrabold tracking-tight text-chip"
            />
            {moneyMode && (
              <span className="ml-2 text-sm text-muted">
                €{(player.chips * chipValue).toFixed(2)}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted">
            Buy-ins: {player.total_buyins.toLocaleString()}
            {moneyMode &&
              ` · €${(player.total_buyins * chipValue).toFixed(2)}`}
          </div>
        </div>

        {isHost && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={onSub}
                className="h-9 w-9 rounded-lg bg-panelAlt text-xl font-bold text-chip transition hover:bg-white/10 active:scale-95"
                aria-label="Remove chips"
              >
                −
              </button>
              <button
                onClick={onAdd}
                className="h-9 w-9 rounded-lg bg-felt text-xl font-bold text-chip transition hover:bg-feltLight active:scale-95"
                aria-label="Rebuy"
              >
                +
              </button>
            </div>
            {canAward && (
              <button
                onClick={onAward}
                className="rounded-lg border border-felt/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-feltLight transition hover:bg-felt/20"
              >
                Award pot
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
