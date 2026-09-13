# Bound Website + Dashboard

This package contains the live Bound landing website and dashboard.

## Files
- `index.html` — public landing page
- `styles.css` — landing page styles
- `script.js` — landing page interactions
- `dashboard.html` — Bound Control Centre dashboard
- `dashboard.css` — dashboard design
- `dashboard.js` — dashboard navigation and live interactions
- `api/` — authenticated Vercel Functions backed by Railway Postgres

## Run locally
You can double-click `index.html`, but using a local server is better:

```bash
npx serve .
```

Then open the local address shown in the terminal. The Dashboard button on the landing page opens `dashboard.html`.

## Production architecture

- Vercel serves the static site and server-side API functions.
- Supabase Auth owns Discord login and sessions.
- Railway Postgres is the shared source of truth for the website and Bound bot.
- Every privileged API request re-checks the signed-in user and Discord guild permissions server-side.

Set `DATABASE_URL` in Vercel to Railway's public Postgres URL. Keep it, the Discord client secret, bot token, and Supabase Auth service-role key out of browser JavaScript and GitHub. See `.env.example` and `README-DASHBOARD-FIRST.md`.

## Live Bound links

- Add Bound: https://discord.com/oauth2/authorize?client_id=1537633630384300113
- Bound Society: https://discord.gg/NVseqMDNRd
- Dashboard: `/dashboard.html`

External Discord buttons in `index.html` are already wired to these destinations.
