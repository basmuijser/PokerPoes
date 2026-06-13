"use client";

interface Props {
  onClose: () => void;
}

const RANKINGS: { name: string; desc: string }[] = [
  {
    name: "Royal Flush",
    desc: "A, K, Q, J, 10 — all of the same suit. The unbeatable hand.",
  },
  {
    name: "Straight Flush",
    desc: "Five consecutive cards, all of the same suit.",
  },
  {
    name: "Four of a Kind",
    desc: "Four cards of the same rank, plus any fifth card.",
  },
  {
    name: "Full House",
    desc: "Three of a kind plus a pair.",
  },
  {
    name: "Flush",
    desc: "Any five cards of the same suit, not in sequence.",
  },
  {
    name: "Straight",
    desc: "Five consecutive cards of mixed suits.",
  },
  {
    name: "Three of a Kind",
    desc: "Three cards of the same rank, plus two unrelated cards.",
  },
  {
    name: "Two Pair",
    desc: "Two separate pairs, plus a fifth card.",
  },
  {
    name: "Pair",
    desc: "Two cards of the same rank, plus three unrelated cards.",
  },
  {
    name: "High Card",
    desc: "No combination — the highest single card plays.",
  },
];

export default function HandRankings({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90dvh] w-full max-w-md overflow-hidden rounded-3xl border border-felt/50 bg-bg shadow-glow"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-bg/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-feltLight">
              Reference
            </div>
            <h2 className="text-xl font-black tracking-tight">
              Poker hand rankings
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-panel text-base text-muted transition hover:bg-panelAlt hover:text-chip"
          >
            ✕
          </button>
        </header>

        <ol className="max-h-[calc(90dvh-80px)] overflow-y-auto px-2 py-3">
          {RANKINGS.map((r, i) => (
            <li
              key={r.name}
              className="flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-panel/60"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-felt text-xs font-bold text-chip">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-chip">{r.name}</div>
                <p className="mt-0.5 text-sm leading-snug text-muted">
                  {r.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
