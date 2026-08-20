(() => {
  const fmt=n=>new Intl.NumberFormat('en-GB').format(Number(n||0));
  const compact=n=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(Number(n||0));
  const animate=(el,target)=>{
    if(!el||!Number.isFinite(Number(target)))return;
    const end=Number(target),start=0,duration=950,t0=performance.now();
    const step=now=>{const p=Math.min(1,(now-t0)/duration),e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(start+(end-start)*e));if(p<1)requestAnimationFrame(step)};
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();