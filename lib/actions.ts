"use client";

import { getSupabase } from "./supabase";
import type {
  BettingRound,
  Game,
  Player,
  PlayerActionSnapshot,
  Pot,
} from "./types";
import {
  calculateSidePots,
  computeBlindSeats,
  findNextToAct,
  hasAnyAllIn,
  isBettingRoundComplete,
  isHandOver,
  pickRandomDealer,
  rotateDealer,
  sortBySeat,
} from "./poker";

// ────────────────────────────── helpers ───────────────────────────────

async function getPot(gameId: string): Promise<Pot | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("pot")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();
  return (data as Pot) ?? null;
}

async function bumpPot(gameId: string, delta: number) {
  const supabase = getSupabase();
  const pot = await getPot(gameId);
  if (pot) {
    await supabase
      .from("pot")
      .update({ amount: Math.max(0, pot.amount + delta) })
      .eq("id", pot.id);
  } else {
    await supabase
      .from("pot")
      .insert({ game_id: gameId, amount: Math.max(0, delta) });
  }
}

async function setPotAmount(gameId: string, amount: number) {
  const supabase = getSupabase();
  const pot = await getPot(gameId);
  if (pot) {
    await supabase
      .from("pot")
      .update({ amount: Math.max(0, amount) })
      .eq("id", pot.id);
  } else {
    await supabase
      .from("pot")
      .insert({ game_id: gameId, amount: Math.max(0, amount) });
  }
}

async function refreshSidePots(gameId: string, players: Player[]) {
  const supabase = getSupabase();
  await supabase.from("side_pots").delete().eq("game_id", gameId);
  if (!hasAnyAllIn(players)) return;
  const pots = calculateSidePots(players);
  if (pots.length === 0) return;
  await supabase.from("side_pots").insert(
    pots.map((p, i) => ({
      game_id: gameId,
      pot_index: i,
      amount: p.amount,
      eligible_player_ids: p.eligible_player_ids,
    })),
  );
}

// ────────────────────────────── seating ───────────────────────────────

export async function setSeatOrder(playerId: string, seatOrder: number) {
  const supabase = getSupabase();
  await supabase
    .from("players")
    .update({ seat_order: seatOrder })
    .eq("id", playerId);
}

// Assigns seat_order 0..n-1 in the order given.
export async function reseatAll(playerIds: string[]) {
  const supabase = getSupabase();
  await Promise.all(
    playerIds.map((id, i) =>
      supabase.from("players").update({ seat_order: i }).eq("id", id),
    ),
  );
}

// ────────────────────────────── start game ────────────────────────────

export async function startGame(game: Game, players: Player[]) {
  const supabase = getSupabase();

  // Ensure every player has a seat_order.
  const sorted = sortBySeat(players);
  if (sorted.some((p) => p.seat_order === null)) {
    await reseatAll(sorted.map((p) => p.id));
    for (let i = 0; i < sorted.length; i++) sorted[i].seat_order = i;
  }

  // Only players with chips > 0 are eligible to be dealer/SB/BB. At the very
  // first hand everyone has starting_chips so this is the same as `seats`,
  // but guarding here keeps startGame consistent with nextHand/beginHand.
  const playableSeats = sorted
    .filter((p) => p.chips > 0)
    .map((p) => p.seat_order!) as number[];
  if (playableSeats.length < 2) {
    throw new Error("Niet genoeg spelers met fiches om te starten.");
  }
  const dealerSeat = pickRandomDealer(playableSeats);

  await supabase
    .from("games")
    .update({ game_phase: "active", current_dealer_index: dealerSeat })
    .eq("id", game.id);

  await beginHand({ ...game, current_dealer_index: dealerSeat, current_hand: 0 }, sorted, /*newDealer*/ dealerSeat);
}

// ────────────────────────────── new hand ──────────────────────────────

export async function beginHand(
  game: Game,
  players: Player[],
  dealerSeat: number,
) {
  const supabase = getSupabase();
  const sorted = sortBySeat(players);
  const seats = sorted.map((p) => p.seat_order!) as number[];

  // Only players with chips > 0 participate. SB/BB are computed from the
  // playable seats so a 0-chip player can never be assigned a blind they
  // can't pay (Fix 4).
  const playableSorted = sorted.filter((p) => p.chips > 0);
  const playableSeats = playableSorted.map((p) => p.seat_order!) as number[];
  if (playableSeats.length < 2) {
    throw new Error("Niet genoeg spelers met fiches voor een nieuwe hand.");
  }

  // If the incoming dealerSeat happens to be a sat-out player, rotate forward
  // through the full seats list until we land on a playable seat.
  let effectiveDealerSeat = dealerSeat;
  if (!playableSeats.includes(effectiveDealerSeat)) {
    const startIdx = seats.indexOf(effectiveDealerSeat);
    for (let i = 1; i <= seats.length; i++) {
      const candidate = seats[((startIdx >= 0 ? startIdx : 0) + i) % seats.length];
      if (playableSeats.includes(candidate)) {
        effectiveDealerSeat = candidate;
        break;
      }
    }
  }

  const { smallBlindSeat, bigBlindSeat } = computeBlindSeats(
    playableSeats,
    effectiveDealerSeat,
  );

  // Reset hand-level player state. Players with 0 chips are immediately
  // folded for this hand so the turn logic / round-completion checks skip
  // them entirely. They'll be re-included on the next hand once the host
  // gives them a rebuy (chips > 0 again at the top of beginHand).
  await supabase
    .from("players")
    .update({
      current_bet: 0,
      total_hand_bet: 0,
      hand_status: "active",
      has_acted: false,
      is_dealer: false,
      is_small_blind: false,
      is_big_blind: false,
    })
    .eq("game_id", game.id)
    .gt("chips", 0);
  await supabase
    .from("players")
    .update({
      current_bet: 0,
      total_hand_bet: 0,
      hand_status: "folded",
      has_acted: false,
      is_dealer: false,
      is_small_blind: false,
      is_big_blind: false,
    })
    .eq("game_id", game.id)
    .eq("chips", 0);

  // Find seat→player
  const bySeat = new Map<number, Player>();
  for (const p of sorted) bySeat.set(p.seat_order!, p);

  const dealer = bySeat.get(effectiveDealerSeat)!;
  const sb = bySeat.get(smallBlindSeat)!;
  const bb = bySeat.get(bigBlindSeat)!;

  await supabase.from("players").update({ is_dealer: true }).eq("id", dealer.id);
  await supabase
    .from("players")
    .update({ is_small_blind: true })
    .eq("id", sb.id);
  await supabase.from("players").update({ is_big_blind: true }).eq("id", bb.id);

  const handNumber = (game.current_hand ?? 0) + 1;

  // Reset pot
  await setPotAmount(game.id, 0);
  // Clear side pots
  await supabase.from("side_pots").delete().eq("game_id", game.id);

  // Post blinds
  const sbAmount = Math.min(game.small_blind, sb.chips);
  const bbAmount = Math.min(game.big_blind, bb.chips);
  await postBlind(game.id, sb, sbAmount, /*round id assigned below*/ null);
  await postBlind(game.id, bb, bbAmount, null);
  await bumpPot(game.id, sbAmount + bbAmount);

  // Insert the first betting round
  const { data: round } = await supabase
    .from("betting_rounds")
    .insert({
      game_id: game.id,
      hand_number: handNumber,
      round_number: 1,
      current_highest_bet: bbAmount,
      last_aggressor_id: bb.id,
      status: "active",
    })
    .select()
    .single();

  // First to act: left of BB. Players with 0 chips are marked folded so
  // findNextToAct skips past them (Fix 4).
  const updatedPlayers: Player[] = sorted.map((p) => {
    if (p.id === sb.id)
      return {
        ...p,
        chips: p.chips - sbAmount,
        current_bet: sbAmount,
        total_hand_bet: sbAmount,
        hand_status: (p.chips - sbAmount === 0
          ? "all-in"
          : "active") as Player["hand_status"],
        has_acted: false,
      };
    if (p.id === bb.id)
      return {
        ...p,
        chips: p.chips - bbAmount,
        current_bet: bbAmount,
        total_hand_bet: bbAmount,
        hand_status: (p.chips - bbAmount === 0
          ? "all-in"
          : "active") as Player["hand_status"],
        has_acted: false,
      };
    return {
      ...p,
      current_bet: 0,
      total_hand_bet: 0,
      hand_status: (p.chips > 0 ? "active" : "folded") as Player["hand_status"],
      has_acted: false,
    };
  });

  // Pre-flop first-to-act (standard poker rules):
  //   3+ players: the seat LEFT OF BIG BLIND acts first → fromSeat = BB.
  //   Heads-up (n=2): SB (== dealer) acts first → fromSeat = BB
  //   (the only other player), which gives next = SB. Same expression for both.
  const next = findNextToAct(updatedPlayers, bbAmount, bigBlindSeat);

  await supabase
    .from("games")
    .update({
      current_hand: handNumber,
      current_round: 1,
      hand_state: "betting",
      current_turn_player_id: next?.id ?? null,
      current_dealer_index: effectiveDealerSeat,
    })
    .eq("id", game.id);
}

async function postBlind(
  gameId: string,
  player: Player,
  amount: number,
  roundId: string | null,
) {
  const supabase = getSupabase();
  const newChips = player.chips - amount;
  const allIn = newChips === 0;
  await supabase
    .from("players")
    .update({
      chips: newChips,
      current_bet: amount,
      total_hand_bet: amount,
      hand_status: allIn ? "all-in" : "active",
      has_acted: false,
    })
    .eq("id", player.id);
  if (roundId) {
    await supabase.from("player_actions").insert({
      game_id: gameId,
      betting_round_id: roundId,
      player_id: player.id,
      action: "post_blind",
      amount,
    });
  }
}

// ────────────────────────────── actions ───────────────────────────────

interface ActionContext {
  game: Game;
  round: BettingRound;
  players: Player[]; // current full snapshot
  pot: Pot | null;
}

// Re-read the authoritative turn pointer from Supabase right before any
// chip-moving write. If it no longer points at this player (a stale UI, a
// dup-click after the turn advanced, or two devices racing) we abort.
async function assertActorsTurn(
  gameId: string,
  expectedPlayerId: string,
): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("current_turn_player_id, hand_state")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error("Kon de beurt niet verifiëren — probeer opnieuw.");
  if (!data) throw new Error("Game niet gevonden.");
  if (data.hand_state !== "betting") {
    throw new Error("De beurt is voorbij — wacht op de bank.");
  }
  if (data.current_turn_player_id !== expectedPlayerId) {
    throw new Error("Het is niet meer jouw beurt.");
  }
}

export async function fold(ctx: ActionContext, player: Player) {
  await assertActorsTurn(ctx.game.id, player.id);
  await applyAction(ctx, player, "fold", 0);
}

export async function check(ctx: ActionContext, player: Player) {
  await assertActorsTurn(ctx.game.id, player.id);
  // Validate: can only check if no outstanding bet to call
  if (ctx.round.current_highest_bet > player.current_bet) {
    throw new Error("Cannot check — there is a bet to call.");
  }
  await applyAction(ctx, player, "check", 0);
}

export async function call(ctx: ActionContext, player: Player) {
  await assertActorsTurn(ctx.game.id, player.id);
  const need = Math.max(0, ctx.round.current_highest_bet - player.current_bet);
  const actual = Math.min(need, player.chips);
  await applyAction(ctx, player, "call", actual);
}

export async function raise(
  ctx: ActionContext,
  player: Player,
  raiseTo: number,
) {
  await assertActorsTurn(ctx.game.id, player.id);
  const minRaise = ctx.round.current_highest_bet + 1;
  if (raiseTo < minRaise) {
    throw new Error(`Minimum raise is ${minRaise}`);
  }
  const additional = raiseTo - player.current_bet;
  if (additional <= 0)
    throw new Error("Raise must be higher than your current bet.");
  if (additional > player.chips) throw new Error("Not enough chips.");
  await applyAction(ctx, player, "raise", additional, raiseTo);
}

async function applyAction(
  ctx: ActionContext,
  player: Player,
  action: "fold" | "check" | "call" | "raise",
  chipsAdded: number,
  raiseTo?: number,
) {
  const supabase = getSupabase();

  // Snapshot for undo
  const snapshot: PlayerActionSnapshot = {
    player: {
      chips: player.chips,
      current_bet: player.current_bet,
      total_hand_bet: player.total_hand_bet,
      hand_status: player.hand_status,
      has_acted: player.has_acted,
    },
    round: {
      current_highest_bet: ctx.round.current_highest_bet,
      last_aggressor_id: ctx.round.last_aggressor_id,
    },
    pot_amount: ctx.pot?.amount ?? 0,
  };

  // Build next player state
  let nextChips = player.chips;
  let nextCurrentBet = player.current_bet;
  let nextTotalHandBet = player.total_hand_bet;
  let nextHandStatus = player.hand_status;
  let nextHighest = ctx.round.current_highest_bet;
  let nextAggressorId = ctx.round.last_aggressor_id;
  let resetOthers = false;

  if (action === "fold") {
    nextHandStatus = "folded";
  } else if (action === "check") {
    // nothing
  } else if (action === "call") {
    nextChips = player.chips - chipsAdded;
    nextCurrentBet = player.current_bet + chipsAdded;
    nextTotalHandBet = player.total_hand_bet + chipsAdded;
    if (nextChips === 0) nextHandStatus = "all-in";
  } else if (action === "raise") {
    nextChips = player.chips - chipsAdded;
    nextCurrentBet = raiseTo!;
    nextTotalHandBet = player.total_hand_bet + chipsAdded;
    nextHighest = raiseTo!;
    nextAggressorId = player.id;
    resetOthers = true;
    if (nextChips === 0) nextHandStatus = "all-in";
  }

  await supabase
    .from("players")
    .update({
      chips: nextChips,
      current_bet: nextCurrentBet,
      total_hand_bet: nextTotalHandBet,
      hand_status: nextHandStatus,
      has_acted: true,
    })
    .eq("id", player.id);

  if (resetOthers) {
    await supabase
      .from("players")
      .update({ has_acted: false })
      .eq("game_id", ctx.game.id)
      .neq("id", player.id)
      .eq("hand_status", "active");
  }

  if (nextHighest !== ctx.round.current_highest_bet || nextAggressorId !== ctx.round.last_aggressor_id) {
    await supabase
      .from("betting_rounds")
      .update({
        current_highest_bet: nextHighest,
        last_aggressor_id: nextAggressorId,
      })
      .eq("id", ctx.round.id);
  }

  await supabase.from("player_actions").insert({
    game_id: ctx.game.id,
    betting_round_id: ctx.round.id,
    player_id: player.id,
    action,
    amount: action === "raise" ? raiseTo! : chipsAdded,
    snapshot,
  });

  if (chipsAdded > 0) await bumpPot(ctx.game.id, chipsAdded);

  // Compute next state
  const newPlayers: Player[] = ctx.players.map((p) => {
    if (p.id === player.id) {
      return {
        ...p,
        chips: nextChips,
        current_bet: nextCurrentBet,
        total_hand_bet: nextTotalHandBet,
        hand_status: nextHandStatus,
        has_acted: true,
      };
    }
    if (resetOthers && p.hand_status === "active") {
      return { ...p, has_acted: false };
    }
    return p;
  });
  const newRound: BettingRound = {
    ...ctx.round,
    current_highest_bet: nextHighest,
    last_aggressor_id: nextAggressorId,
  };

  if (player.seat_order === null || player.seat_order === undefined) {
    throw new Error(
      "Player has no seat_order. The game must be started before betting.",
    );
  }
  await advance(
    { ...ctx, players: newPlayers, round: newRound },
    player.seat_order,
    player.id,
  );
}

// ────────────────────────────── undo ──────────────────────────────────

export async function undo(ctx: ActionContext, player: Player) {
  const supabase = getSupabase();

  // The latest non-undone action for THIS player THIS round must be the last
  // non-undone action overall in this round.
  const { data: actions } = await supabase
    .from("player_actions")
    .select("*")
    .eq("betting_round_id", ctx.round.id)
    .eq("undone", false)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = actions?.[0];
  if (!last || last.player_id !== player.id) {
    throw new Error("Nothing to undo.");
  }
  if (last.action === "post_blind") {
    throw new Error("Blinds cannot be undone.");
  }
  const snap = last.snapshot as PlayerActionSnapshot | null;
  if (!snap) throw new Error("Action missing snapshot.");

  await supabase
    .from("player_actions")
    .update({ undone: true })
    .eq("id", last.id);

  await supabase
    .from("players")
    .update({
      chips: snap.player.chips,
      current_bet: snap.player.current_bet,
      total_hand_bet: snap.player.total_hand_bet,
      hand_status: snap.player.hand_status,
      has_acted: snap.player.has_acted,
    })
    .eq("id", player.id);

  // If the undone action was a raise, restore has_acted for everyone else
  // who was active. They had been "reset" by the raise — restore to true
  // (assuming they had already acted earlier in this round). To keep this
  // simple, we conservatively recompute has_acted from remaining player_actions.
  if (last.action === "raise") {
    const { data: kept } = await supabase
      .from("player_actions")
      .select("player_id, action")
      .eq("betting_round_id", ctx.round.id)
      .eq("undone", false);
    const actedSet = new Set<string>();
    for (const a of kept ?? []) {
      if (a.action !== "post_blind") actedSet.add(a.player_id as string);
    }
    await Promise.all(
      ctx.players
        .filter((p) => p.id !== player.id)
        .map((p) =>
          supabase
            .from("players")
            .update({ has_acted: actedSet.has(p.id) })
            .eq("id", p.id),
        ),
    );
  }

  await supabase
    .from("betting_rounds")
    .update({
      current_highest_bet: snap.round.current_highest_bet,
      last_aggressor_id: snap.round.last_aggressor_id,
    })
    .eq("id", ctx.round.id);

  await setPotAmount(ctx.game.id, snap.pot_amount);

  // Turn returns to this player
  await supabase
    .from("games")
    .update({ current_turn_player_id: player.id })
    .eq("id", ctx.game.id);
}

// ────────────────────────────── advance ───────────────────────────────

// Every turn-pointer write below is a compare-and-set: we only update the
// games row if `current_turn_player_id` still equals the actor's id. That way
// two devices that somehow both think it's their turn cannot both advance —
// the second one's update affects 0 rows and the action fails.

async function advance(
  ctx: ActionContext,
  fromSeat: number,
  actorId: string,
) {
  const supabase = getSupabase();

  // Side pots are recomputed whenever someone is all-in, so the host's winner
  // assignment screen sees them.
  if (hasAnyAllIn(ctx.players)) await refreshSidePots(ctx.game.id, ctx.players);

  // Hand has effectively ended: ≤1 player still in.
  if (isHandOver(ctx.players)) {
    await autoEndHand(ctx, actorId);
    return;
  }

  // Continue with next player as long as the betting round is NOT yet complete.
  // (This is the path that gives the remaining active players a chance to call
  // or raise after someone goes all-in — Fix 2.)
  if (!isBettingRoundComplete(ctx.players, ctx.round.current_highest_bet)) {
    const next = findNextToAct(
      ctx.players,
      ctx.round.current_highest_bet,
      fromSeat,
    );
    if (next) {
      const { data: casNext } = await supabase
        .from("games")
        .update({ current_turn_player_id: next.id })
        .eq("id", ctx.game.id)
        .eq("current_turn_player_id", actorId)
        .select("id");
      if (!casNext || casNext.length === 0) {
        throw new Error("Iemand anders heeft de beurt al verzet.");
      }
    }
    return;
  }

  // Round is complete. Per the spec (Fix 5b), we do NOT auto-start another
  // round — we lock all actions and let the host either rebuy/start a new
  // hand or, more commonly, assign the winner via the existing UI.
  await supabase
    .from("betting_rounds")
    .update({ status: "complete" })
    .eq("id", ctx.round.id);
  await refreshSidePots(ctx.game.id, ctx.players);

  const { data: casLock } = await supabase
    .from("games")
    .update({ hand_state: "awaiting_winner", current_turn_player_id: null })
    .eq("id", ctx.game.id)
    .eq("current_turn_player_id", actorId)
    .select("id");
  if (!casLock || casLock.length === 0) {
    throw new Error("Iemand anders heeft de beurt al verzet.");
  }
}

// ────────────────────────────── hand end ──────────────────────────────

// If only one player remains in the hand, auto-award the entire pot.
// Gated by a CAS on `current_turn_player_id === actorId` so two devices can't
// both claim to be the actor that ended the hand.
async function autoEndHand(ctx: ActionContext, actorId: string) {
  const supabase = getSupabase();
  const remaining = ctx.players.filter((p) => p.hand_status !== "folded");
  if (remaining.length === 1) {
    // Claim the right to finalize. Only the row whose turn pointer still
    // matches the actor will be updated; anyone else loses the race.
    const { data: claim } = await supabase
      .from("games")
      .update({
        hand_state: "awaiting_start",
        current_turn_player_id: null,
      })
      .eq("id", ctx.game.id)
      .eq("current_turn_player_id", actorId)
      .select("id");
    if (!claim || claim.length === 0) {
      throw new Error("Iemand anders heeft de beurt al verzet.");
    }

    const winner = remaining[0];
    const pot = await getPot(ctx.game.id);
    const total = pot?.amount ?? 0;
    if (total > 0) {
      await supabase
        .from("players")
        .update({ chips: winner.chips + total })
        .eq("id", winner.id);
      await setPotAmount(ctx.game.id, 0);
    }
    await supabase.from("side_pots").delete().eq("game_id", ctx.game.id);
    await supabase
      .from("betting_rounds")
      .update({ status: "complete" })
      .eq("id", ctx.round.id);
  }
}

// Host explicitly ends the hand to go to winner assignment.
export async function endHandToAwaitWinner(game: Game, players: Player[]) {
  const supabase = getSupabase();
  await refreshSidePots(game.id, players);
  await supabase
    .from("betting_rounds")
    .update({ status: "complete" })
    .eq("game_id", game.id)
    .eq("status", "active");
  await supabase
    .from("games")
    .update({ hand_state: "awaiting_winner", current_turn_player_id: null })
    .eq("id", game.id);
}

// Host awards a single (main) pot to a winner. Used when no side pots exist.
export async function awardMainPot(game: Game, winner: Player) {
  const supabase = getSupabase();
  const pot = await getPot(game.id);
  const amount = pot?.amount ?? 0;
  if (amount > 0) {
    await supabase
      .from("players")
      .update({ chips: winner.chips + amount })
      .eq("id", winner.id);
    await setPotAmount(game.id, 0);
  }
  await supabase.from("side_pots").delete().eq("game_id", game.id);
  await supabase
    .from("games")
    .update({ hand_state: "awaiting_start" })
    .eq("id", game.id);
}

// Host awards a specific side pot to a winner. After ALL side pots are awarded,
// also award any leftover in the main `pot` table to ... well, since `pot.amount`
// already includes the side-pot totals, we zero it once all side pots are awarded.
export async function awardSidePot(
  game: Game,
  sidePotId: string,
  winner: Player,
  amount: number,
) {
  const supabase = getSupabase();
  await supabase
    .from("players")
    .update({ chips: winner.chips + amount })
    .eq("id", winner.id);
  await supabase
    .from("side_pots")
    .update({ awarded_player_id: winner.id })
    .eq("id", sidePotId);
}

export async function finalizeSidePots(game: Game) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("side_pots")
    .select("*")
    .eq("game_id", game.id);
  const allAwarded = (data ?? []).every((r: any) => r.awarded_player_id);
  if (allAwarded) {
    await supabase.from("side_pots").delete().eq("game_id", game.id);
    await setPotAmount(game.id, 0);
    await supabase
      .from("games")
      .update({ hand_state: "awaiting_start" })
      .eq("id", game.id);
  }
}

// ────────────────────────────── new round (next hand) ─────────────────

export async function nextHand(game: Game, players: Player[]) {
  const sorted = sortBySeat(players);
  const seats = sorted.map((p) => p.seat_order!) as number[];
  const playableSeats = sorted
    .filter((p) => p.chips > 0)
    .map((p) => p.seat_order!) as number[];
  if (playableSeats.length < 2) {
    throw new Error("Niet genoeg spelers met fiches voor een nieuwe hand.");
  }
  // Rotate dealer through ALL seats but stop on the first playable one.
  let newDealer = rotateDealer(seats, game.current_dealer_index);
  for (let i = 0; i < seats.length && !playableSeats.includes(newDealer); i++) {
    newDealer = rotateDealer(seats, newDealer);
  }
  await beginHand(game, sorted, newDealer);
}

// ────────────────────────────── end game ──────────────────────────────

export async function endGame(game: Game) {
  const supabase = getSupabase();
  await supabase
    .from("games")
    .update({ game_phase: "ended", status: "ended" })
    .eq("id", game.id);
}
