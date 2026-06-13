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
import ActionBar from "@/components/ActionBar";
import RaiseModal from "@/components/RaiseModal";
import SidePotsPanel from "@/components/SidePotsPanel";
import WinnerAssign from "@/components/WinnerAssign";
import HandRankings from "@/components/HandRankings";
import PokerTable from "@/components/PokerTable";
import BottomGamePanel from "@/components/BottomGamePanel";

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
  const [showRankings, setShowRankings] = useState(false);
  const [dealToast, setDealToast] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const prevRoundRef = useRef<{ hand: number; round: number } | null>(null);

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

  // Safety net: if the tab was backgrounded, a realtime event may have been
  // dropped. Force a re-read on visibility change / focus so the local turn
  // pointer always matches the server.
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [refresh]);

  // Toast: a new betting round just started within the same hand.
  useEffect(() => {
    if (!game) return;
    const cur = { hand: game.current_hand, round: game.current_round };
    const prev = prevRoundRef.current;
    let cancel: number | null = null;
    if (
      prev &&
      cur.hand === prev.hand &&
      cur.round > prev.round &&
      game.hand_state === "betting"
    ) {
      setDealToast(true);
      cancel = window.setTimeout(() => setDealToast(false), 6000);
    }
    prevRoundRef.current = cur;
    return () => {
      if (cancel !== null) window.clearTimeout(cancel);
    };
  }, [game?.current_round, game?.current_hand, game?.hand_state]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (actionBusy) return;
    setActionError(null);
    if (!game || !me || !round || !pot) return;
    setActionBusy(true);
    try {
      const ctx = { game, players, round, pot };
      if (kind === "fold") await A.fold(ctx, me);
      if (kind === "check") await A.check(ctx, me);
      if (kind === "call") await A.call(ctx, me);
    } catch (e: any) {
      setActionError(e?.message ?? "Action failed");
      // Force a fresh read so the UI lines up with the server immediately.
      await refresh();
    } finally {
      setActionBusy(false);
    }
  }
  async function doRaise(amount: number) {
    if (actionBusy) return;
    setActionError(null);
    setRaiseOpen(false);
    if (!game || !me || !round || !pot) return;
    setActionBusy(true);
    try {
      await A.raise({ game, players, round, pot }, me, amount);
    } catch (e: any) {
      setActionError(e?.message ?? "Raise failed");
      await refresh();
    } finally {
      setActionBusy(false);
    }
  }
  async function doUndo() {
    if (actionBusy) return;
    setActionError(null);
    if (!game || !me || !round || !pot) return;
    setActionBusy(true);
    try {
      await A.undo({ game, players, round, pot }, me);
    } catch (e: any) {
      setActionError(e?.message ?? "Undo failed");
      await refresh();
    } finally {
      setActionBusy(false);
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

        <button
          onClick={() => setShowRankings(true)}
          aria-label="Show poker hand rankings"
          className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-panel text-base font-bold text-feltLight shadow-lg transition hover:bg-panelAlt active:scale-95"
        >
          ?
        </button>
        {showRankings && (
          <HandRankings onClose={() => setShowRankings(false)} />
        )}
      </main>
    );
  }

  // ─────────────────── Active: poker-table layout ───────────────────
  const turnPlayerName =
    players.find((p) => p.id === game.current_turn_player_id)?.name ?? "—";

  return (
    <main
      className="flex h-dvh flex-col"
      style={{ background: "#111827" }}
    >
      <TableHeader
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

      <div
        className="flex shrink-0 items-center justify-between px-4 py-1.5 text-[11px]"
        style={{ background: "#0d1117", borderBottom: "1px solid #1f2937" }}
      >
        <span className="font-semibold text-gray-400">
          Hand {game.current_hand || 1} · Round {game.current_round || 1}
        </span>
        <span className="font-bold tracking-wide">
          {game.hand_state === "betting" ? (
            isMyTurn ? (
              <span style={{ color: "#22c55e" }}>● Jouw beurt</span>
            ) : (
              <span className="text-gray-400">
                Beurt: <span className="text-white">{turnPlayerName}</span>
              </span>
            )
          ) : game.hand_state === "awaiting_winner" ? (
            <span style={{ color: "#f59e0b" }}>● Winnaar toewijzen</span>
          ) : (
            <span className="text-gray-400">Hand afgerond</span>
          )}
        </span>
      </div>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {me && (
          <PokerTable
            me={me}
            others={otherPlayers}
            potAmount={pot?.amount ?? 0}
            currentTurnPlayerId={game.current_turn_player_id}
            moneyMode={moneyMode}
            chipValue={chipValue}
          />
        )}

        {sidePots.length > 0 && (
          <div className="absolute inset-x-3 top-2 z-20 max-h-[42vh] overflow-y-auto">
            <SidePotsPanel
              sidePots={sidePots}
              players={players}
              moneyMode={moneyMode}
              chipValue={chipValue}
            />
          </div>
        )}

        <button
          onClick={() => setShowRankings(true)}
          aria-label="Show poker hand rankings"
          className="absolute bottom-3 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-yellow-200 shadow-lg transition active:scale-95"
          style={{
            background: "#0d1117",
            border: "1px solid #1f2937",
          }}
        >
          ?
        </button>
      </div>

      <BottomGamePanel me={me!} callAmount={callAmount}>
        {/* Betting */}
        {game.hand_state === "betting" && me?.hand_status === "active" && isMyTurn && round && (
          <ActionBar
            canCheck={canCheck && !actionBusy}
            callAmount={callAmount}
            canCall={!canCheck && !actionBusy}
            canRaise={canRaise && !actionBusy}
            onFold={() => takeAction("fold")}
            onCheck={() => takeAction("check")}
            onCall={() => takeAction("call")}
            onRaise={() => setRaiseOpen(true)}
          />
        )}
        {game.hand_state === "betting" && me?.hand_status === "active" && !isMyTurn && (
          <div
            className="flex h-14 items-center justify-center rounded-xl text-center text-xs text-gray-400"
            style={{ background: "#0b1220", border: "1px solid #1f2937" }}
          >
            Wachten op {turnPlayerName}…
          </div>
        )}
        {game.hand_state === "betting" && me?.hand_status === "folded" && (
          <div
            className="flex h-14 items-center justify-center rounded-xl text-center text-xs text-gray-400"
            style={{ background: "#0b1220", border: "1px solid #1f2937" }}
          >
            Je hebt gefold — wachten tot de volgende hand.
          </div>
        )}
        {game.hand_state === "betting" && me?.hand_status === "all-in" && (
          <div
            className="flex h-14 items-center justify-center rounded-xl text-center text-xs text-red-300"
            style={{ background: "#190f10", border: "1px solid #7f1d1d" }}
          >
            All-in — wachten tot de hand klaar is.
          </div>
        )}

        {/* Awaiting winner */}
        {game.hand_state === "awaiting_winner" && isHost && (
          <div className="max-h-[42vh] overflow-y-auto">
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
          <div
            className="flex h-14 items-center justify-center rounded-xl text-center text-xs text-gray-400"
            style={{ background: "#0b1220", border: "1px solid #1f2937" }}
          >
            Banker wijst de winnaar toe…
          </div>
        )}

        {/* Between hands */}
        {game.hand_state === "awaiting_start" &&
          game.game_phase === "active" &&
          isHost && (
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  await A.nextHand(game, players);
                }}
                className="flex h-14 items-center justify-center rounded-xl text-sm font-bold uppercase tracking-widest"
                style={{
                  background: "#22c55e",
                  color: "#052e16",
                  border: "1px solid #16a34a",
                }}
              >
                New Round
              </button>
              <details
                className="rounded-xl px-3 py-2 text-xs text-gray-400"
                style={{ background: "#0b1220", border: "1px solid #1f2937" }}
              >
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                  Rebuys
                </summary>
                <div className="mt-2 flex flex-col gap-1.5">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      style={{ background: "#111827" }}
                    >
                      <span className="truncate text-xs text-white">
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold tabular-nums text-white">
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
                          className="h-7 w-7 rounded-md text-xs font-bold"
                          style={{ background: "#14532d", color: "#22c55e" }}
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
                          className="h-7 w-7 rounded-md text-xs font-bold text-gray-300"
                          style={{ background: "#1f2937" }}
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
            <div
              className="flex h-14 items-center justify-center rounded-xl text-center text-xs text-gray-400"
              style={{ background: "#0b1220", border: "1px solid #1f2937" }}
            >
              Wachten op de banker voor de volgende hand…
            </div>
          )}

        {/* Host can end-hand while betting — small secondary link */}
        {game.hand_state === "betting" && isHost && (
          <button
            onClick={() => setConfirmEndHand(true)}
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-300"
          >
            End hand &amp; assign winner →
          </button>
        )}

        {/* Undo (appears for the last actor until the next player acts) */}
        {canUndo && (
          <button
            onClick={doUndo}
            className="mt-2 self-end rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition hover:text-white"
            style={{ background: "#0b1220", border: "1px solid #1f2937" }}
          >
            ↶ Undo
          </button>
        )}
      </BottomGamePanel>

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
        <div
          className="fixed bottom-44 left-1/2 z-40 -translate-x-1/2 rounded-lg px-4 py-2 text-xs animate-fadeIn"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#fca5a5",
          }}
        >
          {actionError}
        </div>
      )}

      {dealToast && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4 animate-fadeIn">
          <div
            className="pointer-events-auto rounded-xl px-5 py-3 text-sm font-semibold text-white backdrop-blur"
            style={{
              background: "rgba(34,197,94,0.92)",
              border: "1px solid rgba(134,239,172,0.7)",
              boxShadow: "0 8px 32px rgba(34,197,94,0.35)",
            }}
          >
            🃏 Nieuwe kaarten mogen gedeald worden
          </div>
        </div>
      )}

      {showRankings && <HandRankings onClose={() => setShowRankings(false)} />}
    </main>
  );
}

// ────────────────────────────── shared bits ───────────────────────────

// Used by the lobby and other phases that scroll within `<main>`.
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

// Compact, non-sticky variant used by the table layout (full-height main).
function TableHeader({
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
    <header
      className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5"
      style={{ background: "#0d1117", borderBottom: "1px solid #1f2937" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-black tracking-tight text-white">
          ♠ PokerPoes
        </span>
        <button
          onClick={onCopy}
          title="Copy invite link"
          className="rounded-md px-2 py-0.5 font-mono text-sm font-bold tracking-[0.25em] transition"
          style={{
            background: "#111827",
            border: "1px solid #1f2937",
            color: "#86efac",
          }}
        >
          {code}
        </button>
        {copied && (
          <span className="text-[10px] font-semibold text-green-300 animate-fadeIn">
            Link copied
          </span>
        )}
      </div>
      {isHost && (
        <button
          onClick={onEnd}
          className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#ef4444",
          }}
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
