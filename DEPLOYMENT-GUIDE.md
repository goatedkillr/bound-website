# Bound Website — Full Setup, Hosting, Domain & Dashboard Guide

## What you have now

The site package is a working front-end website:

- `index.html` — public Bound website
- `dashboard.html` — custom Bound dashboard
- `styles.css` / `script.js` — public website styling and interactions
- `dashboard.css` / `dashboard.js` — dashboard styling and interactions

You can upload this as a static site immediately. The dashboard currently uses demo data. To show real Discord users, guilds, tickets, economy, moderation and safety data, connect the front end to your API/Supabase after deployment.

---

# Part 1 — Put the website online with Vercel

## Easiest option: Vercel Drop

1. Go to Vercel and create/sign in to an account.
2. Open Vercel Drop.
3. Drag the **contents of the `bound-site` folder** or the provided zip into the upload area.
4. Give the project a name such as `bound-society`.
5. Deploy it.
6. Vercel gives you a temporary address similar to:
   `https://bound-society.vercel.app`
7. Open that URL and test the homepage and Dashboard button.

This is enough to make the site publicly accessible before you own a domain.

## Better long-term option: GitHub + Vercel

Use this once you want easy updates.

1. Create a GitHub repository, for example `bound-website`.
2. Upload all files from the `bound-site` folder into that repository.
3. In Vercel select **Add New → Project**.
4. Import the GitHub repository.
5. Because this is plain HTML/CSS/JS, you do not need a framework build command.
6. Deploy.
7. Every future push to the production branch can redeploy the site automatically.

---

# Part 2 — Buy a custom domain

You can buy a domain from a registrar such as Cloudflare Registrar, Namecheap, Porkbun, GoDaddy, or directly from Vercel.

Examples for the Bound brand might be:

- `boundbot.app`
- `boundbot.co.uk`
- `boundsociety.co.uk`
- `bound-society.com`

Availability changes constantly, so check the registrar before deciding.

You only need to purchase the **domain registration**. You do not need to buy traditional shared web hosting if Vercel hosts the site.

---

# Part 3 — Connect a domain you bought elsewhere to Vercel

Assume you bought `example.com`.

1. Open the Bound project in Vercel.
2. Open **Settings → Domains**.
3. Add:
   - `example.com`
   - `www.example.com`
4. Vercel will tell you exactly which DNS records your domain needs.
5. Open the DNS settings at the company where you bought the domain.
6. Copy the records Vercel shows into that DNS panel.

A typical arrangement is:

- root/apex `example.com` → A record
- `www.example.com` → CNAME record

**Use the exact values Vercel shows in your project rather than relying on a value copied from an old tutorial.**

7. Return to Vercel and wait for the domain to show as configured.
8. Choose either the root domain or `www` as the primary domain and redirect the other one to it.
9. Vercel provisions HTTPS/SSL for the connected domain automatically once DNS is correct.

Your live URLs can then be:

- `https://example.com` — public Bound site
- `https://example.com/dashboard.html` — dashboard with the current static structure

Later, if the project is moved to a framework such as Next.js, we can make the dashboard URL cleaner, such as `https://dashboard.example.com` or `https://example.com/dashboard`.

---

# Part 4 — Recommended domain layout for Bound

A clean production arrangement would be:

- `boundbot.com` — public marketing site
- `dashboard.boundbot.com` — authenticated dashboard
- `docs.boundbot.com` — documentation (optional)
- `status.boundbot.com` — status page (optional)

You can also keep everything under one domain initially to keep deployment simple.

---

# Part 5 — Make the dashboard actually log users in with Discord

The safest route with your existing stack is Discord OAuth through Supabase Auth.

## A. Create/configure your Discord application

1. Open the Discord Developer Portal.
2. Open the Discord application used for the Bound web login, or create one if you want web auth separated from the bot app.
3. Go to OAuth2.
4. Keep the Client ID.
5. Create/copy the Client Secret.
6. Do **not** put the client secret into public JavaScript or GitHub.

## B. Enable Discord in Supabase Auth

1. Open your Supabase project.
2. Go to **Authentication → Sign In / Providers**.
3. Open Discord.
4. Supabase shows a callback URL similar to:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
5. Add that exact callback URL to the Discord application's OAuth2 redirect list.
6. Put the Discord Client ID and Client Secret into the Discord provider settings in Supabase.
7. Enable the provider.

## C. Configure Supabase site redirects

In **Authentication → URL Configuration**:

- Site URL: your production website, e.g. `https://boundbot.com`
- Add allowed redirect URLs for the dashboard/login flow.
- While developing locally, add your localhost URL as well.

## D. Front-end login flow

The browser is allowed to contain:

- your Supabase project URL
- your Supabase **publishable/anon** key

The browser must never contain:

- `SUPABASE_SERVICE_ROLE_KEY`
- Discord bot token
- Discord Client Secret
- database admin credentials

On login, call Supabase Auth with Discord as the provider. After Discord and Supabase complete OAuth, redirect the user to the dashboard.

---

# Part 6 — Getting a user's Discord servers into the dashboard

Authentication alone tells you who the user is. A management dashboard also needs to determine which Discord guilds they are allowed to configure.

Recommended architecture:

1. User signs in with Discord.
2. Your backend identifies their Discord user ID.
3. Backend obtains/validates the guilds they can manage.
4. Backend checks that Bound is installed in those guilds.
5. Dashboard only shows guilds where the user has the permissions you require.
6. Dashboard requests settings from your backend/Supabase.
7. Any change is sent to an authenticated server endpoint.
8. The server validates permission again before writing it.

Never trust a guild ID or `isAdmin=true` value sent from browser JavaScript without verifying it server-side.

---

# Part 7 — Connect the dashboard to your existing Supabase data

Your current dashboard panels can map to tables/services such as:

- server configuration
- tickets
- staff statistics
- moderation actions
- safety flags
- cages/isolation state
- data deletion requests
- economy balances and transactions
- shop configuration
- ownership/profile configuration
- audit events

Use Supabase Row Level Security for client-readable information. Anything privileged should go through your API/Edge Function using the service role key on the server only.

A good pattern is:

Browser → authenticated API/Edge Function → permission check → Supabase → response

rather than exposing unrestricted update access directly from the browser.

---

# Part 8 — Connect the website to the running Discord bot

The dashboard and bot should share configuration through your backend/database.

Example:

1. Admin changes `economy_enabled` in the dashboard.
2. Dashboard sends an authenticated update to your API.
3. API checks the user can manage that guild.
4. API saves the setting in Supabase.
5. Bound reads that setting when a command runs (or refreshes its settings cache).
6. `/work`, `/fish`, `/heist`, etc. immediately obey that guild's current configuration.

This avoids trying to communicate directly from a visitor's browser to the Discord bot process.

---

# Part 9 — Production security checklist

- Never commit the Discord bot token.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in HTML/JS.
- Keep Discord Client Secret server-side/Supabase-side.
- Enable RLS on user-facing Supabase tables.
- Validate the signed-in user's Discord ID on the server.
- Check guild permissions on every privileged change.
- Protect safety/moderation endpoints separately from ordinary profile endpoints.
- Log dashboard changes to the audit system.
- Use HTTPS only in production.
- Keep your domain/DNS registrar account protected with 2FA.
- Back up important Supabase data before major schema changes.

---

# Part 10 — Updating the website later

If using Vercel Drop:

- redeploy the updated folder/zip manually.

If using GitHub + Vercel:

1. edit the site locally,
2. commit,
3. push to GitHub,
4. Vercel automatically builds/deploys the new version.

GitHub + Vercel is the recommended setup once the site becomes the real Bound production dashboard.
