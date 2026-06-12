"use client";

import type { Player } from "@/lib/types";

interface Props {
  players: Player[];
  meId: string | null;
  isHost: boolean;
  canEdit: boolean;
  onMove: (playerId: string, direction: "up" | "down") => void;
}

export default function SeatList({
  players,
  meId,
  isHost,
  canEdit,
  onMove,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 rounded-xl border bg-panel px-4 py-3 ${
            p.id === meId ? "border-feltLight/60" : "border-white/5"
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panelAlt text-xs font-bold text-muted">
            {i + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-chip">{p.name}</span>
              {p.is_host && (
                <span className="rounded-full bg-felt/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-feltLight">
                  Banker
                </span>
              )}
              {p.id === meId && !p.is_host && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-chip/80">
                  You
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              {p.chips.toLocaleString()} chips
            </div>
          </div>
          {canEdit && isHost && (
            <div className="flex gap-1">
              <button
                onClick={() => onMove(p.id, "up")}
                disabled={i === 0}
                className="h-9 w-9 rounded-lg bg-panelAlt text-base font-bold text-chip transition hover:bg-white/10 active:scale-95 disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => onMove(p.id, "down")}
                disabled={i === players.length - 1}
                className="h-9 w-9 rounded-lg bg-panelAlt text-base font-bold text-chip transition hover:bg-white/10 active:scale-95 disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
