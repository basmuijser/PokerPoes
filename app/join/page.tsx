"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";
import { saveIdentity } from "@/lib/storage";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = params.get("code");
    if (c && /^\d{4}$/.test(c)) setCode(c);
  }, [params]);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(code)) return setError("Code must be 4 digits");
    if (!name.trim()) return setError("Enter your name");
    if (!hasSupabaseEnv()) {
      return setError(
        "Supabase env vars missing. Copy .env.example to .env.local and fill them in.",
      );
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabase();
    try {
      const { data: game, error: gerr } = await supabase
        .from("games")
        .select("*")
        .eq("room_code", code)
        .maybeSingle();
      if (gerr) throw gerr;
      if (!game) throw new Error("Room not found");
      if (game.status === "ended") throw new Error("This game has ended");
      if (game.game_phase && game.game_phase !== "lobby")
        throw new Error("Game already started — ask the banker to wait");

      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("game_id", game.id);
      if ((count ?? 0) >= 8)
        throw new Error("Room is full (8 players max)");

      const { data: player, error: perr } = await supabase
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
      if (perr || !player) throw perr ?? new Error("Failed to join");

      saveIdentity(code, {
        playerId: player.id,
        isHost: false,
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
      <h1 className="text-3xl font-black tracking-tight">Join game</h1>
      <p className="mt-1 text-sm text-muted">
        Enter the 4-digit code the banker shared.
      </p>

      <form onSubmit={onJoin} className="mt-8 flex flex-col gap-5">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Room code
          </label>
          <input
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="1234"
            className="h-16 w-full rounded-xl border border-white/10 bg-panel px-4 text-center text-3xl font-black tracking-[0.5em] outline-none transition focus:border-feltLight"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Your name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Finn"
            className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
          />
        </div>

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
          {loading ? "Joining…" : "Join room"}
        </button>
      </form>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
