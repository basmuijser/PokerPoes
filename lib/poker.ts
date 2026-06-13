import type { Player } from "./types";

export interface SidePot {
  amount: number;
  eligible_player_ids: string[];
}

// ────────────────────────────── ordering ──────────────────────────────

export function sortBySeat(players: Player[]): Player[] {
  // Drop anyone without a seat_order — they can't participate in a hand.
  return players
    .filter((p) => p.seat_order !== null && p.seat_order !== undefined)
    .slice()
    .sort((a, b) => (a.seat_order as number) - (b.seat_order as number));
}

// Returns players ordered clockwise starting one seat AFTER `fromSeat`.
// `fromSeat` doesn't have to be the seat of a current player — if the
// seat number doesn't match anyone (e.g. someone left), we still produce
// a sensible clockwise order by inserting the cursor at the smallest seat
// > fromSeat and treating the seat just before that as the cursor.
export function clockwiseAfter(players: Player[], fromSeat: number): Player[] {
  const sorted = sortBySeat(players);
  const n = sorted.length;
  if (n === 0) return [];

  const exact = sorted.findIndex((p) => p.seat_order === fromSeat);
  if (exact !== -1) {
    return [...sorted.slice(exact + 1), ...sorted.slice(0, exact + 1)];
  }
  // Cursor sits "between" seats — find the next seat strictly greater than fromSeat,
  // then place the first slice starting there.
  const next = sorted.findIndex((p) => (p.seat_order as number) > fromSeat);
  if (next === -1) {
    // fromSeat is past the highest seat → cursor wraps; start from seat 0.
    return sorted;
  }
  return [...sorted.slice(next), ...sorted.slice(0, next)];
}

// Seat to pass to `findNextToAct` so that the FIRST player it returns is
// the small-blind player. This is the seat directly before SB clockwise:
//   • Non-heads-up: SB sits one seat left of the dealer → returns the dealer seat.
//   • Heads-up:     SB == dealer            → returns the BB (other) seat.
export function seatBeforeSmallBlind(
  seats: number[],
  smallBlindSeat: number,
): number {
  const n = seats.length;
  if (n === 0) return 0;
  const idx = seats.indexOf(smallBlindSeat);
  if (idx === -1) return seats[n - 1];
  return seats[(idx - 1 + n) % n];
}

// ────────────────────────────── turn logic ────────────────────────────

// Next active player to act, walking clockwise from `fromSeat` (exclusive).
// Active = not folded and not all-in. Returns null if betting round is complete.
// Always walks exactly one seat at a time; folded/all-in players are the only
// reason to skip a seat.
export function findNextToAct(
  players: Player[],
  currentHighestBet: number,
  fromSeat: number,
): Player | null {
  const ordered = clockwiseAfter(players, fromSeat);
  for (const p of ordered) {
    if (p.hand_status === "folded") continue;
    if (p.hand_status === "all-in") continue;
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
// Pre-flop (round 1):  SB acts first → start "from" the seat before SB.
// Subsequent rounds:   action begins left of DEALER → start "from" dealer seat.
export function firstActorSeat(
  roundNumber: number,
  seats: number[],
  dealerSeat: number,
  smallBlindSeat: number,
): number {
  return roundNumber === 1
    ? seatBeforeSmallBlind(seats, smallBlindSeat)
    : dealerSeat;
}
