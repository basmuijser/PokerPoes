"use client";

interface Props {
  canCheck: boolean;
  callAmount: number;
  canCall: boolean;
  canRaise: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: () => void;
}

export default function ActionBar({
  canCheck,
  callAmount,
  canCall,
  canRaise,
  onFold,
  onCheck,
  onCall,
  onRaise,
}: Props) {
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-2">
      <button
        onClick={onFold}
        style={{
          background: "#2a1515",
          color: "#ef4444",
          border: "1px solid rgba(239,68,68,0.55)",
        }}
        className="flex h-14 items-center justify-center rounded-xl text-sm font-bold uppercase tracking-widest transition active:scale-[0.97]"
      >
        Fold
      </button>

      <button
        onClick={onCheck}
        disabled={!canCheck}
        style={{
          background: "#1f2937",
          color: canCheck ? "#d1d5db" : "#4b5563",
          border: "1px solid rgba(75,85,99,0.55)",
        }}
        className="flex h-14 items-center justify-center rounded-xl text-sm font-bold uppercase tracking-widest transition active:scale-[0.97] disabled:cursor-not-allowed"
      >
        Check
      </button>

      <button
        onClick={onCall}
        disabled={!canCall}
        style={{
          background: "#14532d",
          color: canCall ? "#22c55e" : "rgba(34,197,94,0.4)",
          border: "1px solid rgba(34,197,94,0.55)",
        }}
        className="flex h-14 flex-col items-center justify-center rounded-xl transition active:scale-[0.97] disabled:cursor-not-allowed"
      >
        <span className="text-sm font-bold uppercase tracking-widest leading-none">
          Call
        </span>
        <span className="mt-1 text-[10px] font-semibold leading-none tabular-nums opacity-90">
          {callAmount.toLocaleString()} fiches
        </span>
      </button>

      <button
        onClick={onRaise}
        disabled={!canRaise}
        style={{
          background: "#22c55e",
          color: "#052e16",
          border: "1px solid #16a34a",
        }}
        className="flex h-14 items-center justify-center rounded-xl text-sm font-bold uppercase tracking-widest transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Raise
      </button>
    </div>
  );
}
