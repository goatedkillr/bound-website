import { supabase, authReady } from './supabase-client.js';

// Make the homepage feel like a returning dashboard rather than a fresh login.
// This is only presentation: the dashboard still verifies the live session and
// Discord permissions before exposing any server data.
const dashboardLinks = [...document.querySelectorAll('[data-dashboard-link]')];

function paintDashboardLink(session) {
  dashboardLinks.forEach((link) => {
    link.textContent = session?.user ? 'Continue' : 'Dashboard';
    link.setAttribute('aria-label', session?.user ? 'Continue to your Bound dashboard' : 'Open Bound dashboard');
  });
}

paintDashboardLink(await authReady.catch(() => null));

supabase.auth.onAuthStateChange((_event, nextSession) => paintDashboardLink(nextSession));

