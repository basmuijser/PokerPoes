"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";
import RoleBadge from "./RoleBadge";

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
        isMyTurn ? "border-feltLight shadow-glow" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-chip/80">
            {player.name}
          </span>
          {player.is_dealer && <RoleBadge role="D" />}
          {player.is_small_blind && <RoleBadge role="SB" />}
          {player.is_big_blind && <RoleBadge role="BB" />}
          {player.hand_status === "all-in" && (
            <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
              ALL-IN
            </span>
          )}
          {player.hand_status === "folded" && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              FOLDED
            </span>
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
          Jouw fiches
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

      <div className="mt-3 flex flex-col gap-1 rounded-xl bg-bg/50 px-3 py-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted">Ingezet deze ronde</span>
          <span className="font-semibold text-chip">
            {player.current_bet.toLocaleString()} fiches
            {moneyMode && (
              <span className="ml-1 text-muted">
                · €{(player.current_bet * chipValue).toFixed(2)}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-muted">
          <span>Ingezet deze hand</span>
          <span>
            {player.total_hand_bet.toLocaleString()} fiches
            {moneyMode &&
              ` · €${(player.total_hand_bet * chipValue).toFixed(2)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
