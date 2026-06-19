"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";
import { saveIdentity } from "@/lib/storage";

function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Parse a free-form string into an integer, returning `fallback` for
// empty/invalid input. Used only when we actually need a number (live
// preview, blur defaults, submit) — onChange leaves the raw string alone
// so the user can fully clear the field while typing.
function toInt(s: string, fallback: number): number {
  if (s.trim() === "") return fallback;
  const n = Math.floor(Number(s));
  if (isNaN(n) || n < 0) return fallback;
  return n;
}

function toFloat(s: string, fallback: number): number {
  if (s.trim() === "") return fallback;
  const n = Number(s);
  if (isNaN(n) || n < 0) return fallback;
  return n;
}

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"fun" | "money">("fun");
  // Numeric form fields are stored as raw strings so the user can wipe them
  // clean. They're parsed to numbers on blur and on submit.
  const [startingChips, setStartingChips] = useState("1000");
  const [chipValue, setChipValue] = useState("0.1");
  const [smallBlind, setSmallBlind] = useState("10");
  const [bigBlind, setBigBlind] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sensible blur fallbacks. SB → 1, BB → 2× current SB (or 2 if SB is
  // also empty), starting chips → 1000, chip value → 0.1.
  //
  // We read from `e.target.value` rather than from the captured state so
  // these handlers never run against a stale closure when a user clears
  // the field and tabs out in the same tick.
  const blurStartingChips = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim() === "") setStartingChips("1000");
  };
  const blurChipValue = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim() === "") setChipValue("0.1");
  };
  const blurSmallBlind = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim() === "") setSmallBlind("1");
  };
  const blurBigBlind = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim() === "") {
      const sb = toInt(smallBlind, 1);
      setBigBlind(String(sb * 2));
    }
  };

  // Live numeric values for the money-mode preview text. These use the same
  // defaults the blur handlers would apply, so the preview matches what the
  // form will actually submit if the user leaves the field blank.
  const numStartingChips = toInt(startingChips, 1000);
  const numChipValue = toFloat(chipValue, 0.1);
  const numSmallBlind = toInt(smallBlind, 1);
  const numBigBlind = toInt(bigBlind, numSmallBlind * 2);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name");
    if (numSmallBlind <= 0 || numBigBlind <= 0)
      return setError("Blinds must be positive");
    if (numBigBlind <= numSmallBlind)
      return setError("Big blind must be larger than small blind");
    if (numStartingChips <= 0)
      return setError("Starting chips must be positive");
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
          chip_value: mode === "money" ? numChipValue : 0,
          starting_chips: numStartingChips,
          small_blind: numSmallBlind,
          big_blind: numBigBlind,
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
          chips: numStartingChips,
          total_buyins: numStartingChips,
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
            placeholder="Jouw naam"
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
            inputMode="numeric"
            min={1}
            value={startingChips}
            onChange={(e) => setStartingChips(e.target.value)}
            onBlur={blurStartingChips}
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
              inputMode="numeric"
              min={1}
              value={smallBlind}
              onChange={(e) => setSmallBlind(e.target.value)}
              onBlur={blurSmallBlind}
              className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
              Big blind
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={bigBlind}
              onChange={(e) => setBigBlind(e.target.value)}
              onBlur={blurBigBlind}
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
              inputMode="decimal"
              min={0}
              step={0.01}
              value={chipValue}
              onChange={(e) => setChipValue(e.target.value)}
              onBlur={blurChipValue}
              className="h-12 w-full rounded-xl border border-white/10 bg-panel px-4 text-base outline-none transition focus:border-feltLight"
            />
            <p className="mt-2 text-xs text-muted">
              Buy-in {numStartingChips.toLocaleString()} chips = €
              {(numStartingChips * numChipValue).toFixed(2)} · Blinds €
              {(numSmallBlind * numChipValue).toFixed(2)} / €
              {(numBigBlind * numChipValue).toFixed(2)}
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
