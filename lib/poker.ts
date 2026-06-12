import type { Player } from "./types";

export interface SidePot {
  amount: number;
  eligible_player_ids: string[];
}

// ────────────────────────────── ordering ──────────────────────────────

export function sortBySeat(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => (a.seat_order ?? 0) - (b.seat_order ?? 0),
  );
}

// Returns players ordered clockwise starting one seat AFTER `fromSeat`.
export function clockwiseAfter(players: Player[], fromSeat: number): Player[] {
  const sorted = sortBySeat(players);
  if (sorted.length === 0) return [];
  const idx = sorted.findIndex((p) => (p.seat_order ?? -1) === fromSeat);
  if (idx === -1) return sorted;
  return [...sorted.slice(idx + 1), ...sorted.slice(0, idx + 1)];
}

// ────────────────────────────── turn logic ────────────────────────────

// Next active player to act, walking clockwise from `fromSeat` (exclusive).
// Returns null if betting round is complete.
export function findNextToAct(
  players: Player[],
  currentHighestBet: number,
  fromSeat: number,
): Player | null {
  const ordered = clockwiseAfter(players, fromSeat);
  for (const p of ordered) {
    if (p.hand_status !== "active") continue;
    if (!p.has_acted || p.current_bet < currentHighestBet) return p;
  }
  return null;
}

export function isBettingRoundComplete(
  players: Player[],
  currentHighestBet: number,
): boolean {
  const actives = players.filter((p) => p.hand_status === "active");
  if (actives.length === 0) return true;
  for (const p of actives) {
    if (!p.has_acted) return false;
    if (p.current_bet < currentHighestBet) return false;
  }
  return true;
}

export function activeBettingPlayers(players: Player[]): Player[] {
  return players.filter((p) => p.hand_status === "active");
}

// Players still able to win the hand (haven't folded).
export function inHandPlayers(players: Player[]): Player[] {
  return players.filter((p) => p.hand_status !== "folded");
}

export function isHandOver(players: Player[]): boolean {
  return inHandPlayers(players).length <= 1;
}

// Returns true if no further betting is possible (≤1 in-hand player, or
// everyone still in is all-in).
export function noMoreBettingPossible(players: Player[]): boolean {
  const inHand = inHandPlayers(players);
  if (inHand.length <= 1) return true;
  return inHand.filter((p) => p.hand_status === "active").length <= 1;
}

// ────────────────────────────── side pots ─────────────────────────────

export function calculateSidePots(players: Player[]): SidePot[] {
  const nonFolded = players.filter((p) => p.hand_status !== "folded");
  if (nonFolded.length === 0) return [];

  const capsSet = new Set<number>(
    nonFolded.map((p) => p.total_hand_bet).filter((c) => c > 0),
  );
  const caps = Array.from(capsSet).sort((a, b) => a - b);
  if (caps.length === 0) return [];

  const pots: SidePot[] = [];
  let prev = 0;
  for (const cap of caps) {
    let amount = 0;
    for (const p of players) {
      amount +=
        Math.max(0, Math.min(p.total_hand_bet, cap) - Math.min(p.total_hand_bet, prev));
    }
    const eligible = players
      .filter((p) => p.hand_status !== "folded" && p.total_hand_bet >= cap)
      .map((p) => p.id);
    if (amount > 0) pots.push({ amount, eligible_player_ids: eligible });
    prev = cap;
  }
  return pots;
}

export function hasAnyAllIn(players: Player[]): boolean {
  return players.some((p) => p.hand_status === "all-in");
}

// ────────────────────────────── blinds ────────────────────────────────

export interface BlindSeats {
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
}

// `seats` is the sorted list of seat numbers in the game (clockwise).
export function computeBlindSeats(
  seats: number[],
  dealerSeat: number,
): BlindSeats {
  const n = seats.length;
  const idx = seats.indexOf(dealerSeat);
  if (idx === -1) {
    // dealer not found; fall back to first seat
    return {
      dealerSeat: seats[0],
      smallBlindSeat: seats[n >= 2 ? 1 : 0],
      bigBlindSeat: seats[n >= 3 ? 2 : (n >= 2 ? 0 : 0)],
    };
  }
  if (n === 2) {
    // Heads-up: dealer is SB, opponent is BB.
    return {
      dealerSeat,
      smallBlindSeat: dealerSeat,
      bigBlindSeat: seats[(idx + 1) % n],
    };
  }
  return {
    dealerSeat,
    smallBlindSeat: seats[(idx + 1) % n],
    bigBlindSeat: seats[(idx + 2) % n],
  };
}

export function rotateDealer(seats: number[], current: number | null): number {
  if (seats.length === 0) return 0;
  if (current === null) return seats[0];
  const idx = seats.indexOf(current);
  if (idx === -1) return seats[0];
  return seats[(idx + 1) % seats.length];
}

export function pickRandomDealer(seats: number[]): number {
  if (seats.length === 0) return 0;
  return seats[Math.floor(Math.random() * seats.length)];
}

// Seat from which to start `findNextToAct` for the first action of a betting round.
// First betting round: action begins LEFT OF BB → start "from" BB seat.
// Subsequent rounds: action begins LEFT OF DEALER → start "from" dealer seat.
export function firstActorSeat(
  roundNumber: number,
  dealerSeat: number,
  bigBlindSeat: number,
): number {
  return roundNumber === 1 ? bigBlindSeat : dealerSeat;
}
