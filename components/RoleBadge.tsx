"use client";

type Role = "D" | "SB" | "BB";

const STYLES: Record<Role, { bg: string; text: string; title: string }> = {
  D: {
    bg: "bg-chip",
    text: "text-bg",
    title: "Dealer",
  },
  SB: {
    bg: "bg-amber-300",
    text: "text-bg",
    title: "Small blind",
  },
  BB: {
    bg: "bg-sky-300",
    text: "text-bg",
    title: "Big blind",
  },
};

interface Props {
  role: Role;
  size?: "sm" | "md";
}

export default function RoleBadge({ role, size = "md" }: Props) {
  const s = STYLES[role];
  const dims =
    size === "sm"
      ? "h-5 min-w-[20px] px-1.5 text-[10px]"
      : "h-6 min-w-[24px] px-2 text-[11px]";
  return (
    <span
      title={s.title}
      className={`inline-flex items-center justify-center rounded-full font-extrabold tracking-wider ${dims} ${s.bg} ${s.text}`}
    >
      {role}
    </span>
  );
}
