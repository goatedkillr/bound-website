import { supabase } from './supabase-client.js';

// Deliberately plain: one logo, one line, one button. Password/username
// accounts still exist (see account-ui.js inside the dashboard, under
// Account) for people who want a faster return visit later - but the very
// first thing a new visitor sees should be as simple as the tagline itself.
function style() {
  if (document.getElementById('boundWelcomeAuthStyle')) return;
  const s = document.createElement('style');
  s.id = 'boundWelcomeAuthStyle';
  s.textContent = `
.bound-welcome-auth{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:rgba(5,4,7,.78);backdrop-filter:blur(18px);opacity:0;transition:opacity .24s ease}
.bound-welcome-auth.show{opacity:1}
.bound-welcome-card{width:min(420px,100%);text-align:center;position:relative;padding:44px 34px 34px;border:1px solid rgba(255,255,255,.1);border-radius:26px;background:linear-gradient(150deg,rgba(24,19,28,.99),rgba(10,8,13,.995));box-shadow:0 40px 120px rgba(0,0,0,.55)}
.bound-welcome-close{position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);color:#a99fab;font-size:17px;cursor:pointer}
.bound-welcome-close:hover{color:#fff;background:rgba(255,255,255,.08)}
.bound-welcome-mark{width:54px;height:54px;border-radius:16px;margin:0 auto;object-fit:cover}
.bound-welcome-card h2{font:700 clamp(26px,5vw,32px)/1.06 'Space Grotesk',Inter,sans-serif;margin:18px 0 10px;letter-spacing:-.02em}
.bound-welcome-card h2 span{color:#f06cc3}
.bound-welcome-card>p{color:#978c99;font-size:12px;line-height:1.65;margin:0 auto 26px;max-width:320px}
.bound-auth-discord,.bound-auth-skip{width:100%;border-radius:12px;padding:13px;border:0;font:800 11px Inter,sans-serif;cursor:pointer}
.bound-auth-discord{background:#5865f2;color:white;display:flex;align-items:center;justify-content:center;gap:9px}
.bound-auth-discord:disabled{opacity:.6;cursor:wait}
.bound-auth-skip{background:transparent;color:#776e7a;margin-top:11px}
.bound-auth-message{min-height:16px;margin-top:12px;font-size:9px;color:#f4a2b3}
.bound-welcome-live{display:flex;gap:7px;align-items:center;justify-content:center;margin-top:22px;color:#7cdca9;font-size:8px;font-weight:700}
.bound-welcome-live i{width:6px;height:6px;border-radius:50%;background:#79e3ae;box-shadow:0 0 12px rgba(121,227,174,.75)}
@media(max-width:480px){.bound-welcome-auth{padding:12px}.bound-welcome-card{padding:36px 22px 26px}}
`;
  document.head.appendChild(s);
}

async function discordSignin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { scopes: 'identify guilds', redirectTo: `${location.origin}/dashboard.html` },
  });
  if (error) throw error;
}

function closeModal(modal) {
  modal.classList.remove('show');
  sessionStorage.setItem('bound_welcome_closed', '1');
  setTimeout(() => modal.remove(), 250);
}

async function mount() {
  if (location.pathname && !location.pathname.endsWith('/') && !location.pathname.endsWith('/index.html')) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  if (sessionStorage.getItem('bound_welcome_closed') === '1') return;
  style();

  const modal = document.createElement('div');
  modal.className = 'bound-welcome-auth';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Welcome to Bound');
  modal.innerHTML = `<div class="bound-welcome-card">
    <button class="bound-welcome-close" id="boundWelcomeClose" aria-label="Continue to Bound website">×</button>
    <img class="bound-welcome-mark" src="bound-logo.png" alt="Bound">
    <h2>Discord, <span>but closer.</span></h2>
    <p>Sign in with Discord to bring your profile, relationships and server access with you.</p>
    <button class="bound-auth-discord" id="boundWelcomeSignin">Continue with Discord</button>
    <div class="bound-auth-message" id="boundWelcomeMessage"></div>
    <button class="bound-auth-skip" data-close-welcome>Explore the website first</button>
    <div class="bound-welcome-live"><i></i> Bound network online</div>
  </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));

  document.getElementById('boundWelcomeClose')?.addEventListener('click', () => closeModal(modal));
  modal.querySelectorAll('[data-close-welcome]').forEach(x => x.addEventListener('click', () => closeModal(modal)));
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { closeModal(modal); document.removeEventListener('keydown', onKey); }
  });

  document.getElementById('boundWelcomeSignin')?.addEventListener('click', async () => {
    const btn = document.getElementById('boundWelcomeSignin');
    const msg = document.getElementById('boundWelcomeMessage');
    btn.disabled = true;
    btn.textContent = 'Opening Discord…';
    try {
      await discordSignin();
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'Continue with Discord';
      if (msg) msg.textContent = error?.message || 'Could not start Discord sign-in.';
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
