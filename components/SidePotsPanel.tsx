"use client";

import type { Player, SidePotRow } from "@/lib/types";

interface Props {
  sidePots: SidePotRow[];
  players: Player[];
  moneyMode: boolean;
  chipValue: number;
}

export default function SidePotsPanel({
  sidePots,
  players,
  moneyMode,
  chipValue,
}: Props) {
  if (sidePots.length === 0) return null;
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  return (
    <div className="rounded-2xl border border-feltDark/60 bg-feltDark/20 p-4 animate-fadeIn">
      <div className="text-xs font-semibold uppercase tracking-widest text-feltLight">
        Side pots
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {sidePots.map((sp, i) => (
          <div
            key={sp.id}
            className={`flex items-center justify-between gap-2 rounded-xl bg-bg/50 px-3 py-2 ${
              sp.awarded_player_id ? "opacity-50" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs text-muted">
                {i === 0 ? "Main pot" : `Side pot ${i}`}
              </div>
              <div className="truncate text-xs text-muted">
                Eligible:{" "}
                <span className="text-chip">
                  {sp.eligible_player_ids
                    .map((id) => nameById.get(id) ?? "?")
                    .join(", ")}
                </span>
              </div>
              {sp.awarded_player_id && (
                <div className="text-xs text-feltLight">
                  Won by {nameById.get(sp.awarded_player_id) ?? "?"}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tracking-tight text-chip">
                {sp.amount.toLocaleString()}
              </div>
              {moneyMode && (
                <div className="text-[10px] text-muted">
                  €{(sp.amount * chipValue).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
