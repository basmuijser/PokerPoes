"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";
import { saveIdentity } from "@/lib/storage";

function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"fun" | "money">("fun");
  const [startingChips, setStartingChips] = useState(1000);
  const [chipValue, setChipValue] = useState(0.1);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name");
    if (smallBlind <= 0 || bigBlind <= 0)
      return setError("Blinds must be positive");
    if (bigBlind <= smallBlind)
      return setError("Big blind must be larger than small blind");
    if (!hasSupabaseEnv()) {
      return setError(
        "Supabase env vars missing. Copy .env.example to .env.local and fill them in.",
      );
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabase();
    try {
      let code = "";
      for (let i = 0; i < 5; i++) {
        const candidate = generateRoomCode();
        const { data: existing } = await supabase
          .from("games")
          .select("id")
          .eq("room_code", candidate)
          .maybeSingle();
        if (!existing) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error("Could not allocate room code");

      const { data: game, error: gerr } = await supabase
        .from("games")
        .insert({
          room_code: code,
          mode,
          chip_value: mode === "money" ? chipValue : 0,
          starting_chips: startingChips,
          small_blind: smallBlind,
          big_blind: bigBlind,
          game_phase: "lobby",
          hand_state: "awaiting_start",
        })
        .select()
        .single();
      if (gerr || !game) throw gerr ?? new Error("Failed to create game");

      const { data: player, error: perr } = await supabase
        .from("players")
        .insert({
          game_id: game.id,
          name: name.trim(),
          chips: startingChips,
          total_buyins: startingChips,
          is_host: true,
          seat_order: 0,
        })
        .select()
        .single();
      if (perr || !player) throw perr ?? new Error("Failed to create player");

      await supabase.from("pot").insert({ game_id: game.id, amount: 0 });

      saveIdentity(code, {
        playerId: player.id,
        isHost: true,
        name: player.name,
      });
      router.push(`/room/${code}`);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <Link
        href="/"
        className="mb-8 text-sm text-muted transition hover:text-chip"
      >
        ← Back
      </Link>
      <h1 className="text-3xl font-black tracking-tight">Create game</h1>
      <p className="mt-1 text-sm text-muted">
        You'll be the banker — only you can move chips.
      </p>

      <form onSubmit={onCreate} className="mt-8 flex flex-col gap-5">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Your name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Bas"
            className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("fun")}
              className={`h-12 rounded-xl border text-sm font-semibold transition ${
                mode === "fun"
                  ? "border-felt bg-felt/20 text-feltLight"
                  : "border-white/10 bg-panel text-chip/80"
              }`}
            >
              For fun
            </button>
            <button
              type="button"
              onClick={() => setMode("money")}
              className={`h-12 rounded-xl border text-sm font-semibold transition ${
                mode === "money"
                  ? "border-felt bg-felt/20 text-feltLight"
                  : "border-white/10 bg-panel text-chip/80"
              }`}
            >
              For money
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Starting chips
          </label>
          <input
            type="number"
            min={1}
            value={startingChips}
            onChange={(e) =>
              setStartingChips(Math.max(1, Number(e.target.value) || 0))
            }
            className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
              Small blind
            </label>
            <input
              type="number"
              min={1}
              value={smallBlind}
              onChange={(e) =>
                setSmallBlind(Math.max(1, Number(e.target.value) || 0))
              }
              className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
              Big blind
            </label>
            <input
              type="number"
              min={1}
              value={bigBlind}
              onChange={(e) =>
                setBigBlind(Math.max(1, Number(e.target.value) || 0))
              }
              className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
            />
          </div>
        </div>

        {mode === "money" && (
          <div className="animate-fadeIn">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
              Chip value (€ per chip)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={chipValue}
              onChange={(e) =>
                setChipValue(Math.max(0, Number(e.target.value) || 0))
              }
              className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
            />
            <p className="mt-2 text-xs text-muted">
              Buy-in {startingChips.toLocaleString()} chips = €
              {(startingChips * chipValue).toFixed(2)} · Blinds €
              {(smallBlind * chipValue).toFixed(2)} / €
              {(bigBlind * chipValue).toFixed(2)}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-14 items-center justify-center rounded-2xl bg-felt text-base font-bold text-chip shadow-glow transition hover:bg-feltLight active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create room"}
        </button>
      </form>
    </main>
  );
}
