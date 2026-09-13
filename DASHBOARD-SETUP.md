## What is live now

- Discord OAuth login/session (api/discord-oauth.js, self-issued session cookie)
- Railway Postgres shared with the Bound bot for all live data and settings
- Discord server permission checking
- Bound-installed server detection via `bound_guild_activation`
- Existing `guild_settings.prefix` read/write
- Verification status from `verify_settings`
- Safety config/cases from `safety_guilds` + `safety_cases`
- Active cage counts from `ownership_cages`
- Active guild gag counts from `bdsm_active_gags`
- Global Bonds circulation from `user_balances`
- Recent guild game activity from `game_activity_history`

## Deliberately not writable yet

The old dashboard UI displayed demo controls for economy enabled, starting wallet, daily reward, level system, log channel and timezone. Those columns do not exist in the current `guild_settings` schema. They are now disabled instead of pretending a save worked.

The next database/dashboard pass should add dedicated configuration tables/columns for those features and update the bot to consume them.

