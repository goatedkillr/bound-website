(() => {
  if(!document.querySelector('link[href="reach.css"]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='reach.css';document.head.appendChild(css);
  }
  if(!document.getElementById('boundReach')){
    const hero=document.querySelector('.hero');
    if(hero){
      const section=document.createElement('section');
      section.className='reach-strip container';
      section.id='boundReach';
      section.innerHTML=`<div class="reach-shell"><div class="reach-top"><div><span class="reach-kicker reach-live">LIVE BOUND REACH</span><h3 id="reachHeadline">The Bound network is growing every day.</h3></div><p>Real numbers from Bound's live ecosystem — people, communities and connections already using the systems behind the bot.</p></div><div class="reach-grid"><article class="reach-card"><small>PEOPLE REACHED</small><b id="reachUsers">—</b><span>Discord users seen by Bound</span></article><article class="reach-card"><small>COMMUNITIES</small><b id="reachServers">—</b><span>servers connected to Bound</span></article><article class="reach-card"><small>ACTIVE BONDS</small><b id="reachRelationships">—</b><span>accepted ownership relationships</span></article><article class="reach-card"><small>FACTIONS</small><b id="reachFactions">—</b><span>communities in the faction network</span></article></div></div>`;
      hero.insertAdjacentElement('afterend',section);
    }
  }

  const fmt=n=>new Intl.NumberFormat('en-GB').format(Number(n||0));
  const compact=n=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(Number(n||0));
  const animate=(el,target)=>{
    if(!el||!Number.isFinite(Number(target)))return;
    const end=Number(target),duration=950,t0=performance.now();
    const step=now=>{const p=Math.min(1,(now-t0)/duration),e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(end*e));if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  };

  async function load(){
    const wrap=document.getElementById('boundReach');
    if(!wrap)return;
    try{
      const r=await fetch('/api/reach');
      const d=await r.json();
      if(!r.ok)throw new Error('Reach unavailable');
      const total=Number(d.users);
      if(Number.isFinite(total)){
        const headline=document.getElementById('reachHeadline');
        if(headline) headline.innerHTML=`Already reaching <strong>${compact(total)}+</strong> people through Bound.`;
        animate(document.getElementById('reachUsers'),d.users);
        animate(document.getElementById('reachServers'),d.servers);
        animate(document.getElementById('reachRelationships'),d.relationships);
        animate(document.getElementById('reachFactions'),d.factions);
        wrap.classList.add('loaded');
      }
    }catch(error){console.warn('Bound reach stats unavailable',error)}
  }
  load();
})();