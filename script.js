const oauthParams=new URLSearchParams(window.location.search);
const oauthHash=new URLSearchParams(window.location.hash.replace(/^#/,''));
if(oauthParams.has('code')||oauthParams.has('error')||oauthParams.has('error_description')||oauthHash.has('access_token')||oauthHash.has('refresh_token')){
  import('./auth-bridge.js').catch(error=>console.error('Bound OAuth bridge failed:',error));
}

const navToggle=document.querySelector('.nav-toggle');
const navLinks=document.querySelector('.nav-links');
navToggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));

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
