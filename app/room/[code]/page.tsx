"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";
import { loadIdentity, saveIdentity } from "@/lib/storage";
import { Game, Player, Pot } from "@/lib/types";
import PlayerCard from "@/components/PlayerCard";
import PotCard from "@/components/PotCard";
import { computeNetBalances, settle } from "@/lib/settlement";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code as string) ?? "";

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pot, setPot] = useState<Pot | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [chipPrompt, setChipPrompt] = useState<null | {
    title: string;
    placeholder: string;
    defaultValue?: number;
    onConfirm: (n: number) => void;
  }>(null);
  const channelRef = useRef<any>(null);

  const moneyMode = game?.mode === "money";
  const chipValue = game?.chip_value ?? 0;

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
      .eq("game_id", g.id)
      .order("joined_at", { ascending: true });
    setPlayers((ps ?? []) as Player[]);
    const { data: p } = await supabase
      .from("pot")
      .select("*")
      .eq("game_id", g.id)
      .maybeSingle();
    setPot((p ?? null) as Pot | null);
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

  useEffect(() => {
    if (!game) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`game:${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `game_id=eq.${game.id}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pot",
          filter: `game_id=eq.${game.id}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${game.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.status === "ended") {
      router.replace(`/room/${code}/end`);
    }
  }, [game?.status, code, router]);

  const me = useMemo(
    () => players.find((p) => p.id === meId) ?? null,
    [players, meId],
  );

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
        gameId={game.id}
        startingChips={game.starting_chips}
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

  async function adjustChips(player: Player, delta: number, asBuyin: boolean) {
    const supabase = getSupabase();
    const nextChips = Math.max(0, player.chips + delta);
    const nextBuyins = asBuyin
      ? player.total_buyins + delta
      : player.total_buyins;
    await supabase
      .from("players")
      .update({ chips: nextChips, total_buyins: nextBuyins })
      .eq("id", player.id);
  }

  async function setPotAmount(next: number) {
    if (!game) return;
    const supabase = getSupabase();
    if (pot) {
      await supabase
        .from("pot")
        .update({ amount: Math.max(0, next) })
        .eq("id", pot.id);
    } else {
      await supabase
        .from("pot")
        .insert({ game_id: game.id, amount: Math.max(0, next) });
    }
  }

  async function awardPotTo(player: Player) {
    if (!pot) return;
    const supabase = getSupabase();
    await supabase
      .from("players")
      .update({ chips: player.chips + pot.amount })
      .eq("id", player.id);
    await supabase.from("pot").update({ amount: 0 }).eq("id", pot.id);
  }

  async function endGame() {
    if (!game) return;
    const supabase = getSupabase();
    await supabase.from("games").update({ status: "ended" }).eq("id", game.id);
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${code}`
      : "";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-4">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-white/5 bg-bg/85 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-black tracking-tight">♠ PokerPoes</span>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
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
            onClick={() => setConfirmEnd(true)}
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-danger transition hover:bg-danger/10"
          >
            End game
          </button>
        )}
      </header>

      <div className="mb-4">
        {pot && (
          <PotCard
            amount={pot.amount}
            moneyMode={moneyMode}
            chipValue={chipValue}
            isHost={isHost}
            onAdd={() =>
              setChipPrompt({
                title: "Add chips to pot",
                placeholder: "Amount",
                onConfirm: (n) => setPotAmount((pot?.amount ?? 0) + n),
              })
            }
            onClear={() => setPotAmount(0)}
          />
        )}
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        Players ({players.length})
      </div>
      <div className="grid grid-cols-1 gap-3">
        {players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isHost={isHost}
            isMe={p.id === meId}
            moneyMode={moneyMode}
            chipValue={chipValue}
            canAward={isHost && (pot?.amount ?? 0) > 0}
            onAdd={() =>
              setChipPrompt({
                title: `Rebuy for ${p.name}`,
                placeholder: "Chips",
                defaultValue: game?.starting_chips,
                onConfirm: (n) => adjustChips(p, n, true),
              })
            }
            onSub={() =>
              setChipPrompt({
                title: `Remove chips from ${p.name}`,
                placeholder: "Chips",
                onConfirm: (n) => adjustChips(p, -n, false),
              })
            }
            onAward={() => awardPotTo(p)}
          />
        ))}
      </div>

      {!isHost && (
        <p className="mt-6 text-center text-xs text-muted">
          Only the banker ({players.find((p) => p.is_host)?.name ?? "host"}) can
          move chips.
        </p>
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
          onConfirm={() => {
            setConfirmEnd(false);
            endGame();
          }}
        />
      )}

      {moneyMode && me && (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/5 bg-bg/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between text-xs text-muted">
            <span>1 chip = €{chipValue.toFixed(2)}</span>
            <span>
              Net:{" "}
              <span
                className={
                  me.chips - me.total_buyins >= 0
                    ? "text-feltLight"
                    : "text-danger"
                }
              >
                {me.chips - me.total_buyins >= 0 ? "+" : ""}
                €
                {((me.chips - me.total_buyins) * chipValue).toFixed(2)}
              </span>
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

function JoinInline({
  code,
  gameId,
  startingChips,
  onJoined,
}: {
  code: string;
  gameId: string;
  startingChips: number;
  onJoined: (id: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name");
    setLoading(true);
    const supabase = getSupabase();
    const { data, error: err } = await supabase
      .from("players")
      .insert({
        game_id: gameId,
        name: name.trim(),
        chips: startingChips,
        total_buyins: startingChips,
        is_host: false,
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
