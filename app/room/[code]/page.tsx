"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";
import { loadIdentity, saveIdentity } from "@/lib/storage";
import type {
  BettingRound,
  Game,
  Player,
  PlayerActionRow,
  Pot,
  SidePotRow,
} from "@/lib/types";
import { sortBySeat } from "@/lib/poker";
import * as A from "@/lib/actions";
import SeatList from "@/components/SeatList";
import SelfCard from "@/components/SelfCard";
import OtherPlayer from "@/components/OtherPlayer";
import ActionBar from "@/components/ActionBar";
import RaiseModal from "@/components/RaiseModal";
import SidePotsPanel from "@/components/SidePotsPanel";
import WinnerAssign from "@/components/WinnerAssign";
import AnimatedNumber from "@/components/AnimatedNumber";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code as string) ?? "";

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pot, setPot] = useState<Pot | null>(null);
  const [round, setRound] = useState<BettingRound | null>(null);
  const [sidePots, setSidePots] = useState<SidePotRow[]>([]);
  const [lastAction, setLastAction] = useState<PlayerActionRow | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmEndHand, setConfirmEndHand] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [chipPrompt, setChipPrompt] = useState<null | {
    title: string;
    placeholder: string;
    defaultValue?: number;
    onConfirm: (n: number) => void;
  }>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    const { data: g } = await supabase
      .from("games")
      .select("*")
      .eq("room_code", code)
      .maybeSingle();
    if (!g) {
      setError("Room not found");
      setLoading(false);
      return;
    }
    setGame(g as Game);
    const { data: ps } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", g.id);
    const sorted = sortBySeat((ps ?? []) as Player[]);
    setPlayers(sorted);

    const { data: p } = await supabase
      .from("pot")
      .select("*")
      .eq("game_id", g.id)
      .maybeSingle();
    setPot((p ?? null) as Pot | null);

    const { data: r } = await supabase
      .from("betting_rounds")
      .select("*")
      .eq("game_id", g.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    setRound(((r ?? [])[0] as BettingRound) ?? null);

    const { data: sps } = await supabase
      .from("side_pots")
      .select("*")
      .eq("game_id", g.id)
      .order("pot_index", { ascending: true });
    setSidePots((sps ?? []) as SidePotRow[]);

    // Latest non-undone, non-blind action across all rounds in current hand
    const { data: la } = await supabase
      .from("player_actions")
      .select("*")
      .eq("game_id", g.id)
      .eq("undone", false)
      .neq("action", "post_blind")
      .order("created_at", { ascending: false })
      .limit(1);
    setLastAction(((la ?? [])[0] as PlayerActionRow) ?? null);

    setLoading(false);
  }, [code]);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setError(
        "Supabase env vars missing. Copy .env.example to .env.local and fill them in.",
      );
      setLoading(false);
      return;
    }
    const id = loadIdentity(code);
    if (id) {
      setMeId(id.playerId);
      setIsHost(id.isHost);
    } else {
      setNeedsJoin(true);
    }
    refresh();
  }, [code, refresh]);

  // realtime
  useEffect(() => {
    if (!game) return;
    const supabase = getSupabase();
    const ch = supabase
      .channel(`game:${game.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${game.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pot", filter: `game_id=eq.${game.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "betting_rounds", filter: `game_id=eq.${game.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_actions", filter: `game_id=eq.${game.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "side_pots", filter: `game_id=eq.${game.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [game?.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.game_phase === "ended") router.replace(`/room/${code}/end`);
  }, [game?.game_phase, code, router]);

  const me = useMemo(
    () => players.find((p) => p.id === meId) ?? null,
    [players, meId],
  );
  const otherPlayers = useMemo(() => {
    if (!me) return players;
    const idx = players.findIndex((p) => p.id === me.id);
    if (idx === -1) return players;
    return [...players.slice(idx + 1), ...players.slice(0, idx)];
  }, [players, me]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        Loading…
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
        <a href="/" className="mt-6 text-sm text-muted underline">
          Go home
        </a>
      </main>
    );
  }
  if (needsJoin && game) {
    return (
      <JoinInline
        code={code}
        game={game}
        onJoined={(playerId, name) => {
          saveIdentity(code, { playerId, isHost: false, name });
          setMeId(playerId);
          setIsHost(false);
          setNeedsJoin(false);
          refresh();
        }}
      />
    );
  }
  if (!game) return null;

  const moneyMode = game.mode === "money";
  const chipValue = game.chip_value ?? 0;
  const isMyTurn =
    game.hand_state === "betting" &&
    game.current_turn_player_id === meId &&
    !!me &&
    me.hand_status === "active";
  const callAmount = me && round
    ? Math.max(0, round.current_highest_bet - me.current_bet)
    : 0;
  const canCheck = !!round && me ? me.current_bet >= round.current_highest_bet : false;
  const canRaise = !!round && me ? me.chips > callAmount : false;
  const canUndo =
    !!lastAction &&
    !!me &&
    lastAction.player_id === me.id &&
    lastAction.betting_round_id === round?.id;

  async function takeAction(kind: "fold" | "check" | "call") {
    setActionError(null);
    if (!game || !me || !round || !pot) return;
    try {
      const ctx = { game, players, round, pot };
      if (kind === "fold") await A.fold(ctx, me);
      if (kind === "check") await A.check(ctx, me);
      if (kind === "call") await A.call(ctx, me);
    } catch (e: any) {
      setActionError(e?.message ?? "Action failed");
    }
  }
  async function doRaise(amount: number) {
    setActionError(null);
    setRaiseOpen(false);
    if (!game || !me || !round || !pot) return;
    try {
      await A.raise({ game, players, round, pot }, me, amount);
    } catch (e: any) {
      setActionError(e?.message ?? "Raise failed");
    }
  }
  async function doUndo() {
    setActionError(null);
    if (!game || !me || !round || !pot) return;
    try {
      await A.undo({ game, players, round, pot }, me);
    } catch (e: any) {
      setActionError(e?.message ?? "Undo failed");
    }
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${code}`
      : "";

  // ─────────────────── Lobby ───────────────────
  if (game.game_phase === "lobby") {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <Header
          code={code}
          isHost={isHost}
          copied={copied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          onEnd={() => setConfirmEnd(true)}
        />

        <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-muted">
          {isHost ? "Set seating order" : "Waiting for the banker"} ·{" "}
          {players.length}/8
        </div>

        <SeatList
          players={players}
          meId={meId}
          isHost={isHost}
          canEdit
          onMove={async (id, dir) => {
            const idx = players.findIndex((p) => p.id === id);
            if (idx === -1) return;
            const j = dir === "up" ? idx - 1 : idx + 1;
            if (j < 0 || j >= players.length) return;
            const next = [...players];
            [next[idx], next[j]] = [next[j], next[idx]];
            await A.reseatAll(next.map((p) => p.id));
          }}
        />

        {isHost && (
          <>
            <div className="mt-6 rounded-2xl border border-white/5 bg-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted">
                Banker controls
              </div>
              <p className="mt-1 text-xs text-muted">
                Adjust chips before starting — useful for late joiners or
                fixing typos.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-panelAlt px-3 py-2"
                  >
                    <span className="truncate text-sm">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {p.chips.toLocaleString()}
                      </span>
                      <button
                        onClick={() =>
                          setChipPrompt({
                            title: `Add chips to ${p.name}`,
                            placeholder: "Chips",
                            defaultValue: game.starting_chips,
                            onConfirm: async (n) => {
                              const supabase = getSupabase();
                              await supabase
                                .from("players")
                                .update({
                                  chips: p.chips + n,
                                  total_buyins: p.total_buyins + n,
                                })
                                .eq("id", p.id);
                            },
                          })
                        }
                        className="h-8 w-8 rounded-lg bg-felt text-sm font-bold text-chip transition hover:bg-feltLight"
                      >
                        +
                      </button>
                      <button
                        onClick={() =>
                          setChipPrompt({
                            title: `Remove chips from ${p.name}`,
                            placeholder: "Chips",
                            onConfirm: async (n) => {
                              const supabase = getSupabase();
                              await supabase
                                .from("players")
                                .update({
                                  chips: Math.max(0, p.chips - n),
                                })
                                .eq("id", p.id);
                            },
                          })
                        }
                        className="h-8 w-8 rounded-lg bg-panel text-sm font-bold text-chip transition hover:bg-white/10"
                      >
                        −
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={players.length < 2}
              onClick={async () => {
                await A.startGame(game, players);
              }}
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-felt text-base font-bold text-chip shadow-glow transition hover:bg-feltLight active:scale-[0.98] disabled:opacity-40"
            >
              {players.length < 2
                ? "Need at least 2 players"
                : "Start Game"}
            </button>
          </>
        )}

        {!isHost && (
          <div className="mt-6 rounded-2xl border border-white/5 bg-panel p-4 text-center text-sm text-muted">
            The banker will start the game shortly.
          </div>
        )}

        {chipPrompt && (
          <NumberPrompt
            title={chipPrompt.title}
            placeholder={chipPrompt.placeholder}
            defaultValue={chipPrompt.defaultValue}
            onCancel={() => setChipPrompt(null)}
            onConfirm={(n) => {
              chipPrompt.onConfirm(n);
              setChipPrompt(null);
            }}
          />
        )}
        {confirmEnd && (
          <ConfirmModal
            title="End the game?"
            body="This locks the room and moves everyone to the settlement screen."
            confirmLabel="End game"
            danger
            onCancel={() => setConfirmEnd(false)}
            onConfirm={async () => {
              setConfirmEnd(false);
              await A.endGame(game);
            }}
          />
        )}
      </main>
    );
  }

  // ─────────────────── Active: betting / awaiting winner / awaiting start ──
  return (
    <main className="mx-auto max-w-2xl px-4 pb-36 pt-4">
      <Header
        code={code}
        isHost={isHost}
        copied={copied}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        onEnd={() => setConfirmEnd(true)}
      />

      <div className="mt-3 mb-3 flex items-center justify-between text-xs text-muted">
        <span>
          Hand {game.current_hand} · Round {game.current_round || 1}
        </span>
        <span>
          {game.hand_state === "betting"
            ? game.current_turn_player_id === meId
              ? "Your turn"
              : `Turn: ${players.find((p) => p.id === game.current_turn_player_id)?.name ?? "—"}`
            : game.hand_state === "awaiting_winner"
              ? "Awaiting winner"
              : "Hand ended"}
        </span>
      </div>

      {me && (
        <SelfCard
          player={me}
          moneyMode={moneyMode}
          chipValue={chipValue}
          isMyTurn={isMyTurn}
        />
      )}

      {/* Pot */}
      <div className="mt-4 rounded-2xl border border-felt/40 bg-gradient-to-br from-feltDark/40 to-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-feltLight">
              Pot
            </div>
            <AnimatedNumber
              value={pot?.amount ?? 0}
              className="block text-3xl font-extrabold tracking-tight text-chip"
            />
            {moneyMode && (
              <div className="text-xs text-muted">
                €{((pot?.amount ?? 0) * chipValue).toFixed(2)}
              </div>
            )}
          </div>
          {round && game.hand_state === "betting" && (
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Current bet
              </div>
              <div className="text-lg font-bold">
                {round.current_highest_bet.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {sidePots.length > 0 && (
        <div className="mt-3">
          <SidePotsPanel
            sidePots={sidePots}
            players={players}
            moneyMode={moneyMode}
            chipValue={chipValue}
          />
        </div>
      )}

      {/* Other players */}
      <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Other players
      </div>
      <div className="grid grid-cols-2 gap-2">
        {otherPlayers.map((p) => (
          <OtherPlayer
            key={p.id}
            player={p}
            moneyMode={moneyMode}
            chipValue={chipValue}
            isTurn={game.current_turn_player_id === p.id}
          />
        ))}
      </div>

      {/* Awaiting winner — host controls */}
      {game.hand_state === "awaiting_winner" && isHost && (
        <div className="mt-6">
          <WinnerAssign
            players={players}
            potAmount={pot?.amount ?? 0}
            sidePots={sidePots}
            moneyMode={moneyMode}
            chipValue={chipValue}
            onAwardMain={async (w) => {
              await A.awardMainPot(game, w);
            }}
            onAwardSide={async (id, w, amt) => {
              await A.awardSidePot(game, id, w, amt);
              await A.finalizeSidePots(game);
            }}
          />
        </div>
      )}
      {game.hand_state === "awaiting_winner" && !isHost && (
        <div className="mt-6 rounded-2xl border border-white/5 bg-panel p-4 text-center text-sm text-muted">
          Waiting for the banker to assign the winner.
        </div>
      )}

      {/* Between hands */}
      {game.hand_state === "awaiting_start" &&
        game.game_phase === "active" &&
        isHost && (
          <div className="mt-6 space-y-3">
            <button
              onClick={async () => {
                await A.nextHand(game, players);
              }}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-felt text-base font-bold text-chip shadow-glow transition hover:bg-feltLight active:scale-[0.98]"
            >
              New Round
            </button>

            <details className="rounded-2xl border border-white/5 bg-panel p-4 text-sm text-muted">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">
                Adjust chips (rebuys)
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-panelAlt px-3 py-2"
                  >
                    <span className="truncate text-sm text-chip">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-chip">
                        {p.chips.toLocaleString()}
                      </span>
                      <button
                        onClick={() =>
                          setChipPrompt({
                            title: `Rebuy for ${p.name}`,
                            placeholder: "Chips",
                            defaultValue: game.starting_chips,
                            onConfirm: async (n) => {
                              const supabase = getSupabase();
                              await supabase
                                .from("players")
                                .update({
                                  chips: p.chips + n,
                                  total_buyins: p.total_buyins + n,
                                })
                                .eq("id", p.id);
                            },
                          })
                        }
                        className="h-8 w-8 rounded-lg bg-felt text-sm font-bold text-chip transition hover:bg-feltLight"
                      >
                        +
                      </button>
                      <button
                        onClick={() =>
                          setChipPrompt({
                            title: `Remove chips from ${p.name}`,
                            placeholder: "Chips",
                            onConfirm: async (n) => {
                              const supabase = getSupabase();
                              await supabase
                                .from("players")
                                .update({
                                  chips: Math.max(0, p.chips - n),
                                })
                                .eq("id", p.id);
                            },
                          })
                        }
                        className="h-8 w-8 rounded-lg bg-panel text-sm font-bold text-chip transition hover:bg-white/10"
                      >
                        −
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      {game.hand_state === "awaiting_start" &&
        game.game_phase === "active" &&
        !isHost && (
          <div className="mt-6 rounded-2xl border border-white/5 bg-panel p-4 text-center text-sm text-muted">
            Waiting for the banker to start the next hand.
          </div>
        )}

      {/* Host: end hand button while betting */}
      {game.hand_state === "betting" && isHost && (
        <div className="mt-6">
          <button
            onClick={() => setConfirmEndHand(true)}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-panel text-sm font-semibold uppercase tracking-widest text-muted transition hover:bg-panelAlt hover:text-chip"
          >
            End hand & assign winner
          </button>
        </div>
      )}

      {/* Folded message */}
      {me?.hand_status === "folded" && game.hand_state === "betting" && (
        <div className="mt-4 rounded-xl border border-white/5 bg-panel p-3 text-center text-xs text-muted">
          You folded this hand. Watching until next round.
        </div>
      )}

      {/* Action bar */}
      {isMyTurn && round && me && (
        <ActionBar
          canCheck={canCheck}
          callAmount={callAmount}
          canRaise={canRaise}
          canUndo={false /* undo shows after action, not before */}
          onFold={() => takeAction("fold")}
          onCheck={() => takeAction("check")}
          onCall={() => takeAction("call")}
          onRaise={() => setRaiseOpen(true)}
          onUndo={() => {}}
        />
      )}
      {!isMyTurn && canUndo && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-bg/95 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl justify-end">
            <button
              onClick={doUndo}
              className="rounded-lg border border-white/10 bg-panel px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted transition hover:bg-panelAlt hover:text-chip"
            >
              ↶ Undo my action
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {raiseOpen && me && round && (
        <RaiseModal
          currentHighestBet={round.current_highest_bet}
          myCurrentBet={me.current_bet}
          myChips={me.chips}
          bigBlind={game.big_blind}
          onCancel={() => setRaiseOpen(false)}
          onConfirm={(n) => doRaise(n)}
        />
      )}
      {chipPrompt && (
        <NumberPrompt
          title={chipPrompt.title}
          placeholder={chipPrompt.placeholder}
          defaultValue={chipPrompt.defaultValue}
          onCancel={() => setChipPrompt(null)}
          onConfirm={(n) => {
            chipPrompt.onConfirm(n);
            setChipPrompt(null);
          }}
        />
      )}
      {confirmEnd && (
        <ConfirmModal
          title="End the game?"
          body="This will lock chip counts and show the settlement screen for everyone."
          confirmLabel="End game"
          danger
          onCancel={() => setConfirmEnd(false)}
          onConfirm={async () => {
            setConfirmEnd(false);
            await A.endGame(game);
          }}
        />
      )}
      {confirmEndHand && (
        <ConfirmModal
          title="End this hand?"
          body="Use this when you've decided on a winner outside the app (e.g. showdown). You'll then assign each pot."
          confirmLabel="End hand"
          onCancel={() => setConfirmEndHand(false)}
          onConfirm={async () => {
            setConfirmEndHand(false);
            await A.endHandToAwaitWinner(game, players);
          }}
        />
      )}

      {actionError && (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-danger/40 bg-danger/15 px-4 py-2 text-xs text-danger animate-fadeIn">
          {actionError}
        </div>
      )}
    </main>
  );
}

// ────────────────────────────── shared bits ───────────────────────────

function Header({
  code,
  isHost,
  copied,
  onCopy,
  onEnd,
}: {
  code: string;
  isHost: boolean;
  copied: boolean;
  onCopy: () => void;
  onEnd: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-white/5 bg-bg/85 px-4 py-3 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <span className="text-base font-black tracking-tight">♠ PokerPoes</span>
        <button
          onClick={onCopy}
          className="rounded-lg bg-panel px-2.5 py-1 font-mono text-base font-bold tracking-[0.3em] text-feltLight transition hover:bg-panelAlt"
          title="Copy invite link"
        >
          {code}
        </button>
        {copied && (
          <span className="text-xs text-feltLight animate-fadeIn">
            Link copied
          </span>
        )}
      </div>
      {isHost && (
        <button
          onClick={onEnd}
          className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-danger transition hover:bg-danger/10"
        >
          End game
        </button>
      )}
    </header>
  );
}

function JoinInline({
  code,
  game,
  onJoined,
}: {
  code: string;
  game: Game;
  onJoined: (id: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name");
    if (game.game_phase !== "lobby")
      return setError("Game already started — ask the banker.");
    setLoading(true);
    const supabase = getSupabase();
    const { count } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("game_id", game.id);
    if ((count ?? 0) >= 8) {
      setError("Room is full (8 players max)");
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        name: name.trim(),
        chips: game.starting_chips,
        total_buyins: game.starting_chips,
        is_host: false,
        seat_order: count ?? 0,
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "Failed to join");
      setLoading(false);
      return;
    }
    onJoined(data.id, data.name);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6">
      <div className="mb-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">
          Room
        </div>
        <div className="font-mono text-3xl font-black tracking-[0.5em] text-feltLight">
          {code}
        </div>
      </div>
      <form onSubmit={join} className="w-full">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
          Your name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
        />
        {error && (
          <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-felt text-base font-bold text-chip shadow-glow transition hover:bg-feltLight active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Joining…" : "Join game"}
        </button>
      </form>
    </main>
  );
}

function NumberPrompt({
  title,
  placeholder,
  defaultValue,
  onCancel,
  onConfirm,
}: {
  title: string;
  placeholder: string;
  defaultValue?: number;
  onCancel: () => void;
  onConfirm: (n: number) => void;
}) {
  const [v, setV] = useState<string>(
    defaultValue !== undefined ? String(defaultValue) : "",
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-5 animate-fadeIn">
        <div className="text-lg font-bold">{title}</div>
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={1}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          className="mt-4 h-12 w-full rounded-xl border border-white/10 bg-panelAlt px-4 text-base outline-none focus:border-feltLight"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-panelAlt text-sm font-semibold text-chip transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const n = Math.max(0, Math.floor(Number(v) || 0));
              if (n > 0) onConfirm(n);
            }}
            className="h-11 flex-1 rounded-xl bg-felt text-sm font-bold text-chip transition hover:bg-feltLight"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-5 animate-fadeIn">
        <div className="text-lg font-bold">{title}</div>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-panelAlt text-sm font-semibold text-chip transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`h-11 flex-1 rounded-xl text-sm font-bold transition ${
              danger
                ? "bg-danger text-chip hover:opacity-90"
                : "bg-felt text-chip hover:bg-feltLight"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
