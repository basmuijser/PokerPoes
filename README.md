# PokerPoes

Real-time multiplayer poker chip tracker for 4–6 friends. One player creates a room (becomes the **banker**), the rest join via a 4-digit code or shareable link. Chip counts, the pot, and joins sync live across all devices via Supabase Realtime.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Supabase (Postgres + Realtime)
- Deployed on Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # paste your Supabase URL and anon key
npm run dev
```

Open <http://localhost:3000>.

## Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run, in order:
   - [`supabase/migrations.sql`](supabase/migrations.sql) — core tables (games, players, pot).
   - [`supabase/migrations_v2.sql`](supabase/migrations_v2.sql) — betting engine: extends `games`/`players` and adds `betting_rounds`, `player_actions`, `side_pots`. Enables Realtime on all new tables and RLS public read/write.
3. In **Project Settings → API**, copy the URL and `anon` public key into `.env.local`.

> No auth is used — the 4-digit room code is the access control. Keep codes secret to keep games private.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in [vercel.com/new](https://vercel.com/new).
3. In the project's **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

The shareable join link format is `https://your-domain/join?code=1234`.
