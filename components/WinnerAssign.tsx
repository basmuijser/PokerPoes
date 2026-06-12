"use client";

import { useState } from "react";
import type { Player, SidePotRow } from "@/lib/types";

interface Props {
  players: Player[];
  potAmount: number;
  sidePots: SidePotRow[];
  moneyMode: boolean;
  chipValue: number;
  onAwardMain: (winner: Player) => Promise<void> | void;
  onAwardSide: (
    sidePotId: string,
    winner: Player,
    amount: number,
  ) => Promise<void> | void;
}

export default function WinnerAssign({
  players,
  potAmount,
  sidePots,
  moneyMode,
  chipValue,
  onAwardMain,
  onAwardSide,
}: Props) {
  const [busy, setBusy] = useState(false);
  const eligibleMain = players.filter((p) => p.hand_status !== "folded");

  async function awardMain(p: Player) {
    setBusy(true);
    await onAwardMain(p);
    setBusy(false);
  }
  async function awardSide(sp: SidePotRow, p: Player) {
    setBusy(true);
    await onAwardSide(sp.id, p, sp.amount);
    setBusy(false);
  }

  if (sidePots.length === 0) {
    return (
      <div className="rounded-2xl border border-feltLight/60 bg-felt/10 p-5 shadow-glow animate-fadeIn">
        <div className="text-xs font-semibold uppercase tracking-widest text-feltLight">
          Assign winner
        </div>
        <div className="mt-1 text-2xl font-extrabold tracking-tight">
          {potAmount.toLocaleString()} chips
          {moneyMode && (
            <span className="ml-2 text-sm font-medium text-muted">
              €{(potAmount * chipValue).toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {eligibleMain.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => awardMain(p)}
              className="flex h-12 items-center justify-between rounded-xl border border-white/10 bg-panel px-4 text-left text-sm font-semibold transition hover:border-feltLight hover:bg-felt/10 disabled:opacity-50"
            >
              <span>{p.name}</span>
              <span className="text-xs text-muted">
                wins {potAmount.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const unawarded = sidePots.filter((sp) => !sp.awarded_player_id);
  if (unawarded.length === 0) {
    return (
      <div className="rounded-2xl border border-feltLight/60 bg-felt/10 p-5 text-center animate-fadeIn">
        <p className="text-sm text-muted">
          All pots assigned. The banker can start a new round.
        </p>
      </div>
    );
  }
  const sp = unawarded[0];
  const eligible = players.filter((p) => sp.eligible_player_ids.includes(p.id));

  return (
    <div className="rounded-2xl border border-feltLight/60 bg-felt/10 p-5 shadow-glow animate-fadeIn">
      <div className="text-xs font-semibold uppercase tracking-widest text-feltLight">
        Assign{" "}
        {sp.pot_index === 0
          ? "main pot"
          : `side pot ${sp.pot_index}`}{" "}
        ({unawarded.length} left)
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">
        {sp.amount.toLocaleString()} chips
        {moneyMode && (
          <span className="ml-2 text-sm font-medium text-muted">
            €{(sp.amount * chipValue).toFixed(2)}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {eligible.map((p) => (
          <button
            key={p.id}
            disabled={busy}
            onClick={() => awardSide(sp, p)}
            className="flex h-12 items-center justify-between rounded-xl border border-white/10 bg-panel px-4 text-left text-sm font-semibold transition hover:border-feltLight hover:bg-felt/10 disabled:opacity-50"
          >
            <span>{p.name}</span>
            <span className="text-xs text-muted">
              wins {sp.amount.toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
