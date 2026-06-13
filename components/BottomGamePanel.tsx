"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";

interface Props {
  me: Player;
  callAmount: number;
  children: React.ReactNode; // action grid or other contextual block
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-2 py-1"
      style={{ background: "#111827", border: "1px solid #1f2937" }}
    >
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="text-xs font-bold tabular-nums text-white">{value}</div>
    </div>
  );
}

export default function BottomGamePanel({ me, callAmount, children }: Props) {
  return (
    <div
      className="shrink-0 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2"
      style={{ background: "#0d1117", borderTop: "1px solid #1f2937" }}
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Jouw fiches
            </div>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber
                value={me.chips}
                className="text-2xl font-extrabold tabular-nums"
                format={(n) => n.toLocaleString()}
              />
              <span className="text-xs text-gray-400">fiches</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Pill
              label="Ronde"
              value={me.current_bet.toLocaleString()}
            />
            <Pill
              label="Hand"
              value={me.total_hand_bet.toLocaleString()}
            />
            <Pill label="To call" value={callAmount.toLocaleString()} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
