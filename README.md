# Bound Website + Dashboard

This package contains the Bound landing website and a custom dashboard concept.

## Files
- `index.html` — public landing page
- `styles.css` — landing page styles
- `script.js` — landing page interactions
- `dashboard.html` — Bound Control Centre dashboard
- `dashboard.css` — dashboard design
- `dashboard.js` — dashboard navigation and demo interactions

## Run locally
You can double-click `index.html`, but using a local server is better:

```bash
npx serve .
```

Then open the local address shown in the terminal. The Dashboard button on the landing page opens `dashboard.html`.

## Important
The dashboard in this package is the finished front-end design. The displayed figures are demo data. Before production, connect it to Discord login and your Supabase data/API. Never put the Discord bot token or the Supabase service-role key in browser JavaScript.

## Live Bound links

- Add Bound: https://discord.com/oauth2/authorize?client_id=1537633630384300113
- Bound Society: https://discord.gg/NVseqMDNRd
- Dashboard: `/dashboard.html`

External Discord buttons in `index.html` are already wired to these destinations.
