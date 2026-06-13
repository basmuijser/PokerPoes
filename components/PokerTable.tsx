"use client";

import type { Player } from "@/lib/types";
import AnimatedNumber from "./AnimatedNumber";
import PlayerBubble from "./PlayerBubble";

interface Props {
  me: Player;
  others: Player[]; // already ordered clockwise from self
  potAmount: number;
  currentTurnPlayerId: string | null;
  moneyMode: boolean;
  chipValue: number;
}

// (x%, y%) positions in the table container; index 0 = self (bottom),
// index 1..n-1 = others in clockwise order from self.
const POSITIONS: Record<number, [number, number][]> = {
  2: [
    [50, 90],
    [50, 10],
  ],
  3: [
    [50, 90],
    [14, 30],
    [86, 30],
  ],
  4: [
    [50, 90],
    [8, 50],
    [50, 10],
    [92, 50],
  ],
  5: [
    [50, 90],
    [10, 64],
    [16, 22],
    [84, 22],
    [90, 64],
  ],
  6: [
    [50, 90],
    [10, 64],
    [16, 22],
    [50, 8],
    [84, 22],
    [90, 64],
  ],
  7: [
    [50, 90],
    [10, 70],
    [6, 42],
    [22, 12],
    [78, 12],
    [94, 42],
    [90, 70],
  ],
  8: [
    [50, 90],
    [12, 72],
    [6, 44],
    [22, 12],
    [50, 6],
    [78, 12],
    [94, 44],
    [88, 72],
  ],
};

export default function PokerTable({
  me,
  others,
  potAmount,
  currentTurnPlayerId,
  moneyMode,
  chipValue,
}: Props) {
  const n = Math.max(2, Math.min(8, 1 + others.length));
  const positions = POSITIONS[n] ?? POSITIONS[8];
  const seats = [me, ...others.slice(0, n - 1)].map((p, i) => ({
    player: p,
    x: positions[i][0],
    y: positions[i][1],
  }));

  return (
    <div className="relative flex flex-1 items-center justify-center px-3 py-2">
      <div
        className="relative"
        style={{
          width: "100%",
          maxWidth: 400,
          aspectRatio: "4 / 5",
        }}
      >
        {/* Oval felt */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: "50% / 50%",
            background:
              "radial-gradient(ellipse at center, #1e8a48 0%, #14642f 60%, #0e4422 100%)",
            border: "10px solid #0a2e16",
            boxShadow:
              "0 0 0 1px rgba(34,197,94,0.25), 0 0 40px rgba(34,197,94,0.18), inset 0 0 60px rgba(0,0,0,0.45)",
          }}
        />

        {/* Pot at center */}
        <div
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          aria-label="Pot"
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 70%, #b45309 100%)",
                border: "2px solid #422006",
              }}
            >
              <span className="text-[10px] font-black text-amber-950">$</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-200/85">
              Pot
            </div>
            <AnimatedNumber
              value={potAmount}
              className="text-lg font-extrabold leading-tight text-white tabular-nums"
            />
            {moneyMode && (
              <div className="text-[10px] text-yellow-100/70">
                €{(potAmount * chipValue).toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Bet chips on the felt, between each player and the center */}
        {seats.map(({ player, x, y }) => {
          if (player.current_bet <= 0) return null;
          const cx = 50 + (x - 50) * 0.55;
          const cy = 50 + (y - 50) * 0.55;
          return (
            <div
              key={`bet-${player.id}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300 bg-yellow-500/15 px-2 py-0.5 text-[10px] font-extrabold text-yellow-100 shadow tabular-nums backdrop-blur"
              style={{ left: `${cx}%`, top: `${cy}%` }}
            >
              {player.current_bet.toLocaleString()}
            </div>
          );
        })}

        {/* Player bubbles */}
        {seats.map(({ player, x, y }) => (
          <div
            key={player.id}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlayerBubble
              player={player}
              isMe={player.id === me.id}
              isTurn={currentTurnPlayerId === player.id}
              moneyMode={moneyMode}
              chipValue={chipValue}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
