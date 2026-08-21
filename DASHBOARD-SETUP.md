# Bound live dashboard setup

The dashboard is now coded to use the existing **React-api** Supabase project and Discord OAuth. The public Supabase project URL and publishable key are already in `dashboard-config.js`. No secret is committed.

## 1. Add the Vercel secret

In Vercel open **bound-website → Settings → Environment Variables** and add:

- `SUPABASE_SERVICE_ROLE_KEY` = the service-role/secret key from the React-api Supabase project.
- `DISCORD_BOT_TOKEN` = the Bound bot token. This is optional for dashboard access, but required for the one-time global-currency reward receipt DM. Keep it server-side only.

Optionally also add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the project already contains safe fallback values for those two.

Never put the service-role key in `dashboard.js`, `dashboard-config.js`, HTML, or a public GitHub commit.

## 2. Enable Discord in Supabase Auth

Open **Supabase → React-api → Authentication → Sign In / Providers → Discord**.

Enable Discord and enter the Discord Client ID and Client Secret for Bound.

Supabase will show a callback URL in this form:

`https://hpbqoochibnrxzxeuazb.supabase.co/auth/v1/callback`

Copy that exact callback URL into **Discord Developer Portal → Bound → OAuth2 → Redirects**.

## 3. Add your Vercel URL to Supabase

Open **Supabase → Authentication → URL Configuration**.

Set **Site URL** to your live Vercel/custom-domain URL. Add these redirect URLs while setting up:

- `https://YOUR-VERCEL-DOMAIN.vercel.app/dashboard.html`
- `https://YOUR-CUSTOM-DOMAIN/dashboard.html` once the custom domain exists

For local testing, add your local URL separately if needed.

## 4. Redeploy

Upload/commit every file in this package, including the new `api/` directory, `dashboard-config.js`, and `package.json`.

Vercel will create `/api/dashboard` as a serverless function automatically.

After adding or changing environment variables in Vercel, redeploy the latest deployment.

## 5. Test

1. Open `/dashboard.html`.
2. Click **Continue with Discord**.
3. Discord should request `identify` and `guilds` access.
4. The dashboard should show only servers where the logged-in user has **Manage Server**, **Administrator**, or owns the guild.
5. Servers found in `bound_guild_activation` appear as Bound-installed.
6. Choose a Bound server. Overview, safety counts, active cages/gags, verification state and global Nugs circulation will load from Supabase.
7. Go to **Server Settings**, change the command prefix, and save. This writes to the existing `guild_settings.prefix` row.
8. Run a prefix command in Discord to confirm the bot reads the same row.

## What is live now

- Supabase Discord login/session
- Discord server permission checking
- Bound-installed server detection via `bound_guild_activation`
- Existing `guild_settings.prefix` read/write
- Verification status from `verify_settings`
- Safety config/cases from `safety_guilds` + `safety_cases`
- Active cage counts from `ownership_cages`
- Active guild gag counts from `bdsm_active_gags`
- Global Nugs circulation from `user_balances`
- Recent guild game activity from `game_activity_history`

## Deliberately not writable yet

The old dashboard UI displayed demo controls for economy enabled, starting wallet, daily reward, level system, log channel and timezone. Those columns do not exist in the current `guild_settings` schema. They are now disabled instead of pretending a save worked.

The next database/dashboard pass should add dedicated configuration tables/columns for those features and update the bot to consume them.

