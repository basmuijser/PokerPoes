-- PokerPoes schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ───────────────────────────── tables ─────────────────────────────

create table if not exists public.games (
  id              uuid primary key default gen_random_uuid(),
  room_code       text not null unique,
  mode            text not null check (mode in ('fun','money')),
  chip_value      numeric not null default 0,
  starting_chips  integer not null default 1000,
  status          text not null default 'active' check (status in ('active','ended')),
  created_at      timestamptz not null default now()
);

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  name          text not null,
  chips         integer not null default 0,
  total_buyins  integer not null default 0,
  is_host       boolean not null default false,
  joined_at     timestamptz not null default now()
);

create table if not exists public.pot (
  id       uuid primary key default gen_random_uuid(),
  game_id  uuid not null unique references public.games(id) on delete cascade,
  amount   integer not null default 0
);

create index if not exists players_game_id_idx on public.players(game_id);
create index if not exists games_room_code_idx on public.games(room_code);

-- ───────────────────────────── RLS ────────────────────────────────
-- No authentication: anyone with the room code can read/write.
-- Access control is the secrecy of the room code.

alter table public.games   enable row level security;
alter table public.players enable row level security;
alter table public.pot     enable row level security;

drop policy if exists "games_public_all"   on public.games;
drop policy if exists "players_public_all" on public.players;
drop policy if exists "pot_public_all"     on public.pot;

create policy "games_public_all"   on public.games   for all using (true) with check (true);
create policy "players_public_all" on public.players for all using (true) with check (true);
create policy "pot_public_all"     on public.pot     for all using (true) with check (true);

-- ───────────────────────────── realtime ───────────────────────────

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.pot;
