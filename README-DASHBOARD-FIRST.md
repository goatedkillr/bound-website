# Bound dashboard – stable live build

This package is designed for the production Vercel + Railway setup. Discord OAuth is handled directly by the site (`api/discord-oauth.js`) - there is no external identity provider.

## Required Vercel environment variables

- `DATABASE_URL` — Railway Postgres public connection URL. This is the website and bot's shared data source of truth.
- `SESSION_SECRET` — signs the site's own session cookie (`server/auth.js`). Generate once, store as Sensitive; rotating it signs every active session out.
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` — back the whole Discord OAuth flow: login, callback and silent token refresh.

Store secrets as Sensitive values in Vercel and never put them in GitHub or browser code. Railway's `*.railway.internal` hostname cannot be used from Vercel; use `DATABASE_PUBLIC_URL` from the Railway Postgres service as Vercel's `DATABASE_URL`.

## Required Discord application setup
In the Discord Developer Portal, add `https://<your-domain>/api/discord-oauth?action=callback` to the application's OAuth2 redirect list (plus any Vercel preview URL used for testing).

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
