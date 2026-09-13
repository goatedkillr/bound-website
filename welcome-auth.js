import { authReady } from './auth-client.js';

// Make the homepage feel like a returning dashboard rather than a fresh login.
// This is only presentation: the dashboard still verifies the live session and
// Discord permissions before exposing any server data.
const dashboardLinks = [...document.querySelectorAll('[data-dashboard-link]')];

function paintDashboardLink(signedIn) {
  dashboardLinks.forEach((link) => {
    link.textContent = signedIn ? 'Continue' : 'Dashboard';
    link.setAttribute('aria-label', signedIn ? 'Continue to your Bound dashboard' : 'Open Bound dashboard');
  });
}

paintDashboardLink(await authReady.catch(() => false));

