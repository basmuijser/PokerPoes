import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-10">
      <div className="mb-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-felt shadow-glow">
          <span className="text-3xl font-black tracking-tight">♠</span>
        </div>
        <h1 className="text-5xl font-black tracking-tight">PokerPoes</h1>
        <p className="mt-3 text-sm text-muted">
          Real-time chip tracking for friends.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/create"
          className="flex h-14 items-center justify-center rounded-2xl bg-felt text-base font-bold text-chip shadow-glow transition hover:bg-feltLight active:scale-[0.98]"
        >
          Create Game
        </Link>
        <Link
          href="/join"
          className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-panel text-base font-bold text-chip transition hover:bg-panelAlt active:scale-[0.98]"
        >
          Join Game
        </Link>
      </div>

      <p className="mt-12 text-center text-xs text-muted">
        2 to 8 players · No app install · No login
      </p>
    </main>
  );
}
