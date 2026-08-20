# Bound dashboard – stable live build

This package is designed for the existing Vercel + Supabase + Fly.io setup.

## Required Vercel environment variable
- `SUPABASE_SERVICE_ROLE_KEY` — service-role/secret key from the same Supabase project as Bound. Never put this value in GitHub.

## Required Supabase auth setup
Discord provider enabled with the Bound Discord application. The production site/dashboard URL must be allowed in Authentication > URL Configuration.

## Live now
- Discord OAuth session
- Discord avatar/name
- manageable guild selector
- server-side Manage Server/Administrator re-check
- Bound activation detection
- real guild prefix read/write
- verification presence
- safety cases/counts
- active cages
- active gags
- global Nugs circulation
- recent game activity

## Deliberately not writable yet
Controls that have no backing configuration column/table remain disabled rather than pretending to save: economy enable/start reward, level system, default log channel, etc.
