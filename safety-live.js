// Fills the homepage safety section's live stat strip (Safety Team size,
// cases reviewed) from the public /api/safety-stats endpoint. Mirrors
// reach.js's count-up animation so the two live stat strips on the page feel
// like one consistent system rather than two different features bolted on.
(() => {
  const fmt = n => new Intl.NumberFormat('en-GB').format(Number(n || 0));

  const animate = (el, target) => {
    if (!el || !Number.isFinite(Number(target))) return;
    const end = Number(target), duration = 900, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(end * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  async function load() {
    const wrap = document.getElementById('safetyLive');
    if (!wrap) return;
    try {
      const r = await fetch('/api/safety-stats');
      const d = await r.json();
      if (!r.ok) throw new Error('Safety stats unavailable');
      if (Number.isFinite(Number(d.team_count))) animate(document.getElementById('safetyTeamCount'), d.team_count);
      if (Number.isFinite(Number(d.cases_reviewed))) animate(document.getElementById('safetyReviewedCount'), d.cases_reviewed);
    } catch (error) {
      console.warn('Bound safety stats unavailable', error);
    }
  }

  load();
})();
