"use client";

import { useState } from "react";

interface Props {
  currentHighestBet: number;
  myCurrentBet: number;
  myChips: number;
  bigBlind: number;
  onCancel: () => void;
  onConfirm: (raiseTo: number) => void;
}

export default function RaiseModal({
  currentHighestBet,
  myCurrentBet,
  myChips,
  bigBlind,
  onCancel,
  onConfirm,
}: Props) {
  const minRaise = currentHighestBet + 1;
  const maxRaise = myCurrentBet + myChips;
  const [value, setValue] = useState<string>("");

  const n = Math.floor(Number(value) || 0);
  const valid = value.trim() !== "" && n >= minRaise && n <= maxRaise;
  const additional = Math.max(0, n - myCurrentBet);

  function bump(by: number) {
    const current = Number(value) || 0;
    const next = Math.min(maxRaise, Math.max(minRaise, current + by));
    setValue(String(next));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-5 animate-fadeIn">
        <div className="text-lg font-bold">Raise to…</div>
        <p className="mt-1 text-xs text-muted">
          Min {minRaise.toLocaleString()} · Max {maxRaise.toLocaleString()} (all-in)
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => bump(-bigBlind)}
            className="h-12 w-12 rounded-xl bg-panelAlt text-lg font-bold text-chip transition hover:bg-white/10 active:scale-95"
          >
            −
          </button>
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={minRaise}
            max={maxRaise}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 flex-1 rounded-xl border border-white/10 bg-panelAlt px-4 text-center text-xl font-bold outline-none focus:border-feltLight"
          />
          <button
            onClick={() => bump(bigBlind)}
            className="h-12 w-12 rounded-xl bg-panelAlt text-lg font-bold text-chip transition hover:bg-white/10 active:scale-95"
          >
            +
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Quick label="Min" onClick={() => setValue(String(minRaise))} />
          <Quick
            label="2×"
            onClick={() =>
              setValue(String(Math.min(maxRaise, currentHighestBet * 2)))
            }
          />
          <Quick label="All-in" onClick={() => setValue(String(maxRaise))} />
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          You'll put in {additional.toLocaleString()} more chip
          {additional === 1 ? "" : "s"}.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-panelAlt text-sm font-semibold text-chip transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onConfirm(n)}
            disabled={!valid}
            className="h-11 flex-1 rounded-xl bg-felt text-sm font-bold text-chip transition hover:bg-feltLight disabled:opacity-50"
          >
            Raise
          </button>
        </div>
      </div>
    </div>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-10 rounded-lg border border-white/10 bg-panelAlt text-xs font-semibold text-chip transition hover:bg-white/10"
    >
      {label}
    </button>
  );
}
