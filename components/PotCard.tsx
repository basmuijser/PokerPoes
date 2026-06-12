"use client";

import AnimatedNumber from "./AnimatedNumber";

interface Props {
  amount: number;
  moneyMode: boolean;
  chipValue: number;
  isHost: boolean;
  onAdd?: () => void;
  onClear?: () => void;
}

export default function PotCard({
  amount,
  moneyMode,
  chipValue,
  isHost,
  onAdd,
  onClear,
}: Props) {
  return (
    <div className="rounded-2xl border border-felt/40 bg-gradient-to-br from-feltDark/40 to-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-feltLight">
            Pot
          </div>
          <div className="mt-1">
            <AnimatedNumber
              value={amount}
              className="text-4xl font-extrabold tracking-tight text-chip"
            />
            {moneyMode && (
              <span className="ml-2 text-sm text-muted">
                €{(amount * chipValue).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        {isHost && (
          <div className="flex flex-col gap-2">
            <button
              onClick={onAdd}
              className="rounded-lg bg-felt px-3 py-2 text-sm font-semibold text-chip transition hover:bg-feltLight active:scale-95"
            >
              + Add to pot
            </button>
            {amount > 0 && (
              <button
                onClick={onClear}
                className="rounded-lg bg-panelAlt px-3 py-2 text-xs font-semibold text-muted transition hover:bg-white/10"
              >
                Clear pot
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
