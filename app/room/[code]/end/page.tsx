"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";
import { Game, Player } from "@/lib/types";
import { computeNetBalances, settle } from "@/lib/settlement";
import { clearIdentity } from "@/lib/storage";

export default function EndPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!hasSupabaseEnv()) {
        setError("Supabase env vars missing.");
        setLoading(false);
        return;
      }
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
      setLoading(false);
    })();
  }, [code]);

  if (loading)
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        Loading…
      </main>
    );
  if (error || !game)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error ?? "Game not found"}
        </div>
      </main>
    );

  const money = game.mode === "money";
  const balances = computeNetBalances(players, game.chip_value, money).sort(
    (a, b) => b.net - a.net,
  );
  const transactions = settle(balances);

  const fmt = (n: number) =>
    money
      ? `${n >= 0 ? "+" : ""}€${n.toFixed(2)}`
      : `${n >= 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">
          Game over
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Settlement</h1>
        <div className="mt-2 font-mono text-sm tracking-[0.4em] text-feltLight">
          {code}
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Results
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-panel">
          {balances.map((b, i) => (
            <div
              key={b.playerId}
              className={`flex items-center justify-between px-4 py-3 ${
                i !== 0 ? "border-t border-white/5" : ""
              }`}
            >
              <span className="font-semibold">{b.name}</span>
              <span
                className={`font-bold ${b.net > 0 ? "text-feltLight" : b.net < 0 ? "text-danger" : "text-muted"}`}
              >
                {fmt(b.net)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Transfers ({transactions.length})
        </div>
        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-panel p-4 text-center text-sm text-muted">
            Everyone's even — no transfers needed.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-panel">
            {transactions.map((t, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-3 ${
                  i !== 0 ? "border-t border-white/5" : ""
                }`}
              >
                <span className="text-sm">
                  <span className="font-semibold text-danger">{t.from}</span>
                  <span className="text-muted"> pays </span>
                  <span className="font-semibold text-feltLight">{t.to}</span>
                </span>
                <span className="font-bold">
                  {money
                    ? `€${t.amount.toFixed(2)}`
                    : Math.round(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => {
          clearIdentity(code);
          router.push("/");
        }}
        className="mt-10 flex h-14 w-full items-center justify-center rounded-2xl bg-felt text-base font-bold text-chip shadow-glow transition hover:bg-feltLight active:scale-[0.98]"
      >
        New game
      </button>
    </main>
  );
}
