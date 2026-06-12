-- PokerPoes v2 — full betting engine
-- Run this AFTER migrations.sql in the Supabase SQL editor.

-- ───────────────────────── games: betting state ─────────────────────────

alter table public.games add column if not exists current_dealer_index integer;
alter table public.games add column if not exists current_round         integer not null default 0;
alter table public.games add column if not exists current_hand          integer not null default 0;
alter table public.games add column if not exists game_phase            text    not null default 'lobby'
  check (game_phase in ('lobby','active','ended'));
alter table public.games add column if not exists hand_state            text    not null default 'awaiting_start'
  check (hand_state in ('awaiting_start','betting','awaiting_winner'));
alter table public.games add column if not exists current_turn_player_id uuid;
alter table public.games add column if not exists small_blind           integer not null default 10;
alter table public.games add column if not exists big_blind             integer not null default 20;

-- Migrate any pre-existing rows from the v1 `status` field
update public.games set game_phase = 'ended'  where status = 'ended'  and game_phase = 'lobby';
update public.games set game_phase = 'active' where status = 'active' and game_phase = 'lobby';

-- ───────────────────────── players: per-hand state ──────────────────────

alter table public.players add column if not exists seat_order      integer;
alter table public.players add column if not exists current_bet     integer not null default 0;
alter table public.players add column if not exists total_hand_bet  integer not null default 0;
alter table public.players add column if not exists hand_status     text    not null default 'active'
  check (hand_status in ('active','folded','all-in'));
alter table public.players add column if not exists has_acted       boolean not null default false;
alter table public.players add column if not exists is_dealer       boolean not null default false;
alter table public.players add column if not exists is_small_blind  boolean not null default false;
alter table public.players add column if not exists is_big_blind    boolean not null default false;

-- ───────────────────────── new tables ──────────────────────────────────

create table if not exists public.betting_rounds (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.games(id) on delete cascade,
  hand_number         integer not null default 1,
  round_number        integer not null,
  current_highest_bet integer not null default 0,
  last_aggressor_id   uuid,
  status              text not null default 'active' check (status in ('active','complete')),
  created_at          timestamptz not null default now()
);

create table if not exists public.player_actions (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games(id) on delete cascade,
  betting_round_id  uuid not null references public.betting_rounds(id) on delete cascade,
  player_id         uuid not null references public.players(id) on delete cascade,
  action            text not null check (action in ('fold','check','call','raise','post_blind')),
  amount            integer not null default 0,
  snapshot          jsonb,
  undone            boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists public.side_pots (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.games(id) on delete cascade,
  pot_index           integer not null,
  amount              integer not null,
  eligible_player_ids uuid[] not null,
  awarded_player_id   uuid,
  created_at          timestamptz not null default now()
);

create index if not exists betting_rounds_game_id_idx on public.betting_rounds(game_id);
create index if not exists player_actions_round_idx   on public.player_actions(betting_round_id);
create index if not exists player_actions_game_idx    on public.player_actions(game_id);
create index if not exists side_pots_game_idx         on public.side_pots(game_id);

-- ───────────────────────── RLS ─────────────────────────────────────────

alter table public.betting_rounds enable row level security;
alter table public.player_actions enable row level security;
alter table public.side_pots      enable row level security;

drop policy if exists "br_public_all" on public.betting_rounds;
drop policy if exists "pa_public_all" on public.player_actions;
drop policy if exists "sp_public_all" on public.side_pots;

create policy "br_public_all" on public.betting_rounds for all using (true) with check (true);
create policy "pa_public_all" on public.player_actions for all using (true) with check (true);
create policy "sp_public_all" on public.side_pots      for all using (true) with check (true);

-- ───────────────────────── realtime ────────────────────────────────────

alter publication supabase_realtime add table public.betting_rounds;
alter publication supabase_realtime add table public.player_actions;
alter publication supabase_realtime add table public.side_pots;
