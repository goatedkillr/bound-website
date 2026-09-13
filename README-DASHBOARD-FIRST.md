# Bound dashboard – stable live build

This package is designed for the production Vercel + Supabase Auth + Railway setup.

## Required Vercel environment variables

- `DATABASE_URL` — Railway Postgres public connection URL. This is the website and bot's shared data source of truth.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` — Supabase Auth project values.
- `SUPABASE_SERVICE_ROLE_KEY` — used only by authenticated account email/password administration.
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` — used for Discord provider-token refresh.

Store secrets as Sensitive values in Vercel and never put them in GitHub or browser code. Railway's `*.railway.internal` hostname cannot be used from Vercel; use `DATABASE_PUBLIC_URL` from the Railway Postgres service as Vercel's `DATABASE_URL`.

## Required Supabase auth setup
Discord provider enabled with the Bound Discord application. The production site/dashboard URL must be allowed in Authentication > URL Configuration.

## Live now
- Discord OAuth session
- Railway-backed dashboard, profile, safety, faction, ticket, and account data
- Discord avatar/name
- manageable guild selector
- server-side Manage Server/Administrator re-check
- Bound activation detection
- real guild prefix read/write
- verification presence
- safety cases/counts
- active cages
- active gags
- global Bonds circulation
- recent game activity

## Deliberately not writable yet
Controls that have no backing configuration column/table remain disabled rather than pretending to save: economy enable/start reward, level system, default log channel, etc.
