"use client";

interface Props {
  canCheck: boolean;
  callAmount: number;
  canRaise: boolean;
  canUndo: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: () => void;
  onUndo: () => void;
}

export default function ActionBar({
  canCheck,
  callAmount,
  canRaise,
  canUndo,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onUndo,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-bg/95 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
      <div className="mx-auto max-w-2xl">
        {canUndo && (
          <div className="mb-2 flex justify-end">
            <button
              onClick={onUndo}
              className="rounded-lg border border-white/10 bg-panel px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted transition hover:bg-panelAlt hover:text-chip"
            >
              ↶ Undo
            </button>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={onFold}
            className="h-14 rounded-2xl bg-danger/85 text-sm font-bold uppercase tracking-wider text-chip transition hover:bg-danger active:scale-[0.98]"
          >
            Fold
          </button>
          {canCheck ? (
            <button
              onClick={onCheck}
              className="h-14 rounded-2xl bg-panelAlt text-sm font-bold uppercase tracking-wider text-chip transition hover:bg-white/15 active:scale-[0.98]"
            >
              Check
            </button>
          ) : (
            <button
              onClick={onCall}
              className="h-14 rounded-2xl bg-felt text-sm font-bold uppercase tracking-wider text-chip transition hover:bg-feltLight active:scale-[0.98]"
            >
              Call
              <div className="text-[10px] font-medium text-chip/80">
                {callAmount.toLocaleString()}
              </div>
            </button>
          )}
          <button
            onClick={onRaise}
            disabled={!canRaise}
            className="col-span-2 h-14 rounded-2xl bg-feltLight text-sm font-bold uppercase tracking-wider text-chip shadow-glow transition hover:bg-felt active:scale-[0.98] disabled:opacity-40"
          >
            Raise
          </button>
        </div>
      </div>
    </div>
  );
}
