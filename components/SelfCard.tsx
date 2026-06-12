"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";

interface Props {
  player: Player;
  moneyMode: boolean;
  chipValue: number;
  isMyTurn: boolean;
}

export default function SelfCard({
  player,
  moneyMode,
  chipValue,
  isMyTurn,
}: Props) {
  return (
    <div
      className={`relative rounded-3xl border bg-gradient-to-br from-panelAlt to-panel p-6 transition-shadow ${
        isMyTurn
          ? "border-feltLight shadow-glow"
          : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-chip/80">
            {player.name}
          </span>
          {player.is_dealer && <Pill label="D" tone="muted" />}
          {player.is_small_blind && <Pill label="SB" tone="muted" />}
          {player.is_big_blind && <Pill label="BB" tone="muted" />}
          {player.hand_status === "all-in" && (
            <Pill label="ALL-IN" tone="warn" />
          )}
          {player.hand_status === "folded" && (
            <Pill label="FOLDED" tone="dim" />
          )}
        </div>
        {isMyTurn && (
          <span className="rounded-full bg-felt px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-chip animate-fadeIn">
            Your turn
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Your chips
        </div>
        <AnimatedNumber
          value={player.chips}
          className="block text-5xl font-extrabold tracking-tight text-chip"
        />
        {moneyMode && (
          <div className="mt-1 text-sm text-muted">
            €{(player.chips * chipValue).toFixed(2)}
          </div>
        )}
      </div>

      {(player.current_bet > 0 || player.total_hand_bet > 0) && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-bg/50 px-3 py-2 text-xs">
          <span className="text-muted">
            In this round:{" "}
            <span className="font-semibold text-chip">
              {player.current_bet.toLocaleString()}
            </span>
          </span>
          <span className="text-muted">
            This hand:{" "}
            <span className="font-semibold text-chip">
              {player.total_hand_bet.toLocaleString()}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "muted" | "warn" | "dim";
}) {
  const cls =
    tone === "warn"
      ? "bg-danger/20 text-danger"
      : tone === "dim"
        ? "bg-white/5 text-muted"
        : "bg-felt/30 text-feltLight";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
