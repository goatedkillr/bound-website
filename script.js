const navToggle=document.querySelector('.nav-toggle');
const navLinks=document.querySelector('.nav-links');
navToggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));

// Private/custom server builds now live inside the authenticated dashboard,
// where they feel like part of the Bound product instead of a detached
// marketing block on the homepage.
document.querySelector('.custom-section')?.remove();
document.querySelectorAll('a[href="#custom"]').forEach(a=>{
  a.setAttribute('href','dashboard.html#private');
  if(a.textContent?.trim()==='Custom')a.textContent='Private Builds';
});

// Small feature teasers sit directly under the hero so visitors immediately
// see what makes Bound different without having to scroll through a wall of copy.
if(!document.getElementById('boundFeatureTeasers')){
  const hero=document.querySelector('.hero');
  if(hero){
    const teaser=document.createElement('section');
    teaser.id='boundFeatureTeasers';
    teaser.className='bound-teasers container reveal';
    teaser.innerHTML=`
      <div class="bound-teaser-head"><span class="eyebrow">A QUICK LOOK INSIDE BOUND</span><p>Profiles social systems safety factions and private server tooling all connect to the same Bound identity.</p></div>
      <div class="bound-teaser-grid">
        <a href="dashboard.html" class="bound-teaser-card"><span class="bound-teaser-tag">PROFILE</span><strong>Your whole Bound identity</strong><small>Owners subs RP stats achievements privacy and more in one place</small><div class="bound-teaser-ui"><i>♡</i><b>Social profile</b><em>LIVE</em></div></a>
        <a href="#features" class="bound-teaser-card"><span class="bound-teaser-tag">ROLEPLAY</span><strong>Interactions that remember you</strong><small>Curated reactions mutual stats gag styles and achievement progress</small><div class="bound-teaser-ui"><i>◎</i><b>/hug /kiss /gag</b><em>GLOBAL</em></div></a>
        <a href="dashboard.html" class="bound-teaser-card"><span class="bound-teaser-tag">FACTIONS</span><strong>Belong to something bigger</strong><small>Faction identity Nugs progression shops applications and community competition</small><div class="bound-teaser-ui"><i>₦</i><b>Your faction</b><em>SYNCED</em></div></a>
        <a href="dashboard.html#private" class="bound-teaser-card premium"><span class="bound-teaser-tag">PRIVATE BUILDS</span><strong>Your server your version of Bound</strong><small>Custom tickets staff economy moderation subscriptions automation and more</small><div class="bound-teaser-ui"><i>✦</i><b>Server control centre</b><em>PREMIUM</em></div></a>
      </div>`;
    hero.insertAdjacentElement('afterend',teaser);

    const style=document.createElement('style');
    style.textContent=`
      .bound-teasers{padding:0 0 72px}.bound-teaser-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:18px}.bound-teaser-head p{max-width:560px;margin:0;color:#8f8592;font-size:12px;line-height:1.65}.bound-teaser-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.bound-teaser-card{min-height:190px;padding:20px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(150deg,rgba(26,22,31,.96),rgba(13,11,17,.96));text-decoration:none;color:inherit;position:relative;overflow:hidden;transition:.22s ease}.bound-teaser-card:before{content:"";position:absolute;width:130px;height:130px;border-radius:50%;right:-45px;top:-50px;background:rgba(240,108,195,.08);filter:blur(20px)}.bound-teaser-card:hover{transform:translateY(-3px);border-color:rgba(240,108,195,.26);box-shadow:0 18px 50px rgba(0,0,0,.22)}.bound-teaser-card.premium{background:linear-gradient(145deg,rgba(55,26,49,.65),rgba(15,12,19,.98))}.bound-teaser-tag{display:block;color:#d48abf;font-size:8px;font-weight:800;letter-spacing:.16em;margin-bottom:15px}.bound-teaser-card strong{display:block;font-family:"Space Grotesk",Inter,sans-serif;font-size:18px;line-height:1.12;max-width:220px}.bound-teaser-card>small{display:block;color:#817786;font-size:10px;line-height:1.6;margin-top:9px}.bound-teaser-ui{position:absolute;left:20px;right:20px;bottom:16px;display:flex;align-items:center;gap:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)}.bound-teaser-ui i{font-style:normal;color:#f06cc3}.bound-teaser-ui b{font-size:9px;flex:1}.bound-teaser-ui em{font-size:7px;font-style:normal;color:#79e3ae;letter-spacing:.1em}@media(max-width:900px){.bound-teaser-grid{grid-template-columns:repeat(2,1fr)}.bound-teaser-head{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.bound-teasers{padding-bottom:44px}.bound-teaser-grid{grid-template-columns:1fr}.bound-teaser-card{min-height:172px}.bound-teaser-head p{font-size:11px}}
    `;
    document.head.appendChild(style);
  }
}

// Live network reach makes the opening feel established without hardcoding
// numbers that will immediately become stale.
if(!document.querySelector('script[src="reach.js"]')){
  const reach=document.createElement('script');reach.src='reach.js';reach.defer=true;document.body.appendChild(reach);
}

const commandData={
 social:[['/claim user','Send a consent-based ownership request.','GLOBAL'],['/profile','View your Bound profile, owners and subs.','GLOBAL'],['/gag user','Use Bound’s gag interaction with an owned sub.','SOCIAL'],['/hug user','Send a hug with interactive response buttons.','RP'],['/kiss user','Send a kiss and track mutual interaction stats.','RP']],
 safety:[['/safety-flag','Open a safety report for review.','SAFETY'],['/safeword','Trigger the configured safety isolation workflow.','TDS'],['/cage user','Contain a user in a private safety space.','TDS'],['/profile → Data','Request deletion of your stored Bound data.','PRIVACY']],
 economy:[['/balance','Check wallet and bank balances.','ECON'],['/work','Work a job to earn Nugs.','ECON'],['/heist user','Start a high-risk targeted heist.','ECON'],['/depall','Instantly move all wallet funds to the bank.','ECON'],['/shop','Browse server items, boosts and utilities.','ECON']],
 community:[['/verify-setup','Configure server verification and self roles.','ADMIN'],['/ticket setup','Build support and verification ticket panels.','ADMIN'],['/space user','Create a private staff ticket with a selected user.','STAFF'],['/staff','Open staff controls, assignments and clocking.','STAFF'],['/sticky','Create an automatically maintained sticky message.','UTILITY']]
};
const list=document.getElementById('command-list');
function renderCommands(key){list.innerHTML=commandData[key].map(([cmd,desc,tag])=>`<div class="command-row"><code>${cmd}</code><p>${desc}</p><span>${tag}</span></div>`).join('');}
renderCommands('social');
document.querySelectorAll('.command-tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('.command-tabs .active')?.classList.remove('active');btn.classList.add('active');renderCommands(btn.dataset.tab);}));

const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

const card=document.querySelector('.tilt-card');
if(card && matchMedia('(pointer:fine)').matches){card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(900px) rotateY(${x*5}deg) rotateX(${-y*5}deg)`;});card.addEventListener('mouseleave',()=>card.style.transform='');}
