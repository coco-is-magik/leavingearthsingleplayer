import {PARTS,TECH,ROUTES,MISSIONS,SURFACES,enabled,missionsFor} from './data.js';
import {newGame,act,mass} from './engine.js';
import {plan} from './planner.js';
import {save,load,importSave} from './storage.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=newGame(crypto.getRandomValues(new Uint32Array(1))[0]),tab='hangar',routeIds=[];
function message(text,error=false) { $('message').textContent=text; $('message').className=error?'error':'success'; }
try { const loaded=load(localStorage); if(loaded.state) state=loaded.state; if(loaded.recovered) message('Recovered the previous valid autosave.',true); } catch(e) { message(e.message,true); }
const button=(label,action,attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`;
const counts=parts=>Object.entries(PARTS).filter(([key])=>parts.includes(key)).map(([key,p])=>`${parts.filter(x=>x===key).length} × ${p.name}`).join(', ')||'Empty';
function persist() { try {save(localStorage,state);} catch(e) {message(`Game is running, but autosave failed: ${e.message}. Export a backup.`,true);} }
function render() {
  $('status').innerHTML=`<span>YEAR <b>${state.year}</b></span><span>BUDGET <b>$${state.money}</b></span><span>SCORE <b>${state.score} / ${missionsFor(state).reduce((n,m)=>n+m.points,0)}</b></span>${button(state.ended?'Campaign ended':'End year →','year',state.ended?'disabled':'')}`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='hangar') renderHangar();
  if(tab==='research') renderResearch();
  if(tab==='planner') renderPlanner();
  if(tab==='journal') renderJournal();
  renderExpansionControls();
}
function renderExpansionControls() {
  if(tab==='journal') {
    $('view').insertAdjacentHTML('afterbegin',`<article><h3>Campaign rules</h3><p>New expansion campaigns run through 1986. Stations grants $30 per year. Expansion hardware and routes use provisional scenario values, not verified printed cards.</p>${button('New campaign: Stations + Outer Planets','new-expansions')}</article>`);
    const coverage=$('view').querySelector('details p');
    coverage.textContent='Prototype rules: docking/separation, orbital assembly planning, expansion destinations, habitats, production, reusable rockets and science payloads are supported. Printed decks, features/rovers, slingshot calendars, radiation, mental health, component damage, occupation scoring and experiment-return objectives are not yet implemented. Expansion prices, masses and routes are scenario approximations. See README for precise coverage.';
  }
  if(tab==='hangar') {
    $('view').querySelector('aside > p').textContent=`Win by scoring more than the points left uncompleted by the end of ${state.expansions?.outer||state.expansions?.stations?1986:1976}.`;
    $('view').querySelectorAll('.mission').forEach((element,i)=>{if(!enabled(state,MISSIONS[i]))element.remove();});
    $('view').querySelectorAll('form[data-form="maneuver"] option').forEach(option=>{if(!enabled(state,ROUTES[Number(option.value)]))option.remove();});
    $('view').insertAdjacentHTML('beforeend',`<h2>Rendezvous & station operations</h2>${state.crafts.filter(c=>c.location!=='Earth').map(c=>`<article><h3>${escape(c.name)}</h3>${!c.eta?`<form data-form="dock" data-craft="${c.id}"><label>Dock with<select name="target">${state.crafts.filter(t=>t.id!==c.id&&!t.eta&&t.location===c.location).map(t=>`<option value="${t.id}">${escape(t.name)}</option>`).join('')}</select></label><button>Attempt docking</button></form>`:''}<form data-form="separate" data-craft="${c.id}"><fieldset><legend>Components for new spacecraft (crew need seats)</legend>${c.parts.map((p,i)=>`<label class="check"><input type="checkbox" name="part" value="${i}">${PARTS[p].name}</label>`).join('')}</fieldset><button>Attempt separation</button></form>${!c.eta&&SURFACES.slice(3).includes(c.location)?button('Collect surface sample','collect',`data-craft="${c.id}"`):''}${state.expansions?.stations&&!c.eta?button('Perform experiment','experiment',`data-craft="${c.id}"`):''}</article>`).join('')}`);
  }
  if(tab==='research') $('view').querySelectorAll('[data-action="buy"]').forEach(b=>{const p=PARTS[b.dataset.key];if(p.unbuyable||!enabled(state,p))b.closest('article').remove();});
  if(tab==='planner') {
    $('view').querySelector('h2 + p').textContent='Compare rocket technology subsets and optional multi-launch orbital assembly. Default priority: fewest new technologies, then hardware cost. Single-type stages and one-component assembly modules are a bounded search, not a global mixed-engine optimum.';
    $('next-route').querySelectorAll('option').forEach(o=>{if(!enabled(state,ROUTES[Number(o.value)]))o.remove();});
    $('plan-form').insertAdjacentHTML('afterbegin',`<label>Optimization<select id="plan-objective"><option value="technology">Fewest new technologies</option><option value="hardware">Lowest hardware cost</option></select></label><label class="check"><input type="checkbox" id="plan-rendezvous" checked>Compare orbital rendezvous assembly</label>`);
    if(state.expansions?.stations||state.expansions?.outer) $('plan-form').insertAdjacentHTML('beforeend',Object.entries(PARTS).filter(([,p])=>p.expansion&&enabled(state,p)&&!p.thrust&&!p.unbuyable).map(([key,p])=>`<label>${p.name}<input type="number" name="${key}" min="0" max="50" value="0"></label>`).join(''));
    $('plan-result').innerHTML='<h3>Flight analysis</h3><p>Estimates assume successful outcomes. Include food (one feeds five crew per year), crew seats and expected sample mass in your payload. Planner does not infer supplies, waiting time, reusable propulsion, lander separation or arbitrary rendezvous schedules.</p>';
  }
}
function renderHangar() {
  $('view').innerHTML=`<div class="columns"><div><h2>Flight operations <small>${state.crafts.length} spacecraft</small></h2><div class="orbit-art"><div class="planet"></div><span>EARTH / HOME PORT</span><i>✦</i></div>${state.crafts.length?'':'<article><h3>Your program starts here</h3><p>Research Soyuz, purchase a Soyuz and a probe, then assemble a spacecraft. Use the planner to prepare multi-stage missions.</p></article>'}${state.crafts.map(c=>`<article><h3>${escape(c.name)} <small>${mass(c.parts)} mass</small></h3><p class="accent">${escape(c.location)}${c.eta?` → ${escape(c.destination)} · ${c.eta} years remaining`:''}</p><p>${escape(counts(c.parts))}</p>${!c.eta?`<form data-form="maneuver" data-craft="${c.id}"><label>Maneuver<select name="route">${ROUTES.filter(r=>r.from===c.location).map(r=>`<option value="${r.id}">${r.to} · difficulty ${r.difficulty} · ${r.years} years · ${mass(c.parts)*r.difficulty} thrust${r.hazard?' · '+r.hazard:''}</option>`).join('')}</select></label><fieldset><legend>Rockets to fire (consumed on attempt)</legend>${c.parts.map((p,i)=>PARTS[p].thrust?`<label class="check"><input type="checkbox" name="rocket" value="${i}">${PARTS[p].name} · ${PARTS[p].thrust} thrust</label>`:'').join('')||'<small>No rockets aboard</small>'}</fieldset><button>Attempt maneuver</button></form>${['Moon','Mars','Venus'].includes(c.location)?button('Collect surface sample','collect',`data-craft="${c.id}"`):''}${c.location==='Earth'?button('Disassemble into inventory','disassemble',`data-craft="${c.id}"`):''}`:''}</article>`).join('')}</div><aside><h2>Mission objectives</h2><p>Win by scoring more than the points left uncompleted by the end of 1976.</p>${MISSIONS.map(m=>`<article class="mission ${state.completed.includes(m.id)?'done':''}"><b>${state.completed.includes(m.id)?'✓':'○'} ${m.name}</b><span>${m.points} PT</span></article>`).join('')}<h2>Assembly bay</h2><form data-form="assemble"><label>Spacecraft name<input name="name" maxlength="60" placeholder="Odyssey 1"></label><fieldset><legend>Available inventory</legend>${state.stock.map((p,i)=>`<label class="check"><input type="checkbox" name="part" value="${i}">${PARTS[p].name} · ${PARTS[p].mass} mass</label>`).join('')||'<p>Purchase components in Research & procurement.</p>'}</fieldset><button>Assemble spacecraft</button></form></aside></div>`;
}
function renderResearch() {
  $('view').innerHTML=`<h2>Research & development</h2><p>Research costs $10. Prototype reliability model: three initial failure tokens; a failed attempt removes one. Ground tests cost $2. This differs from the physical outcome-card rules.</p><div class="cards">${Object.entries(TECH).map(([key,name])=>`<article><small>ADVANCEMENT</small><h3>${name}</h3>${Object.hasOwn(state.tech,key)?`<p>${state.tech[key]===0?'Flight proven':`${Math.round(300/(state.tech[key]+3))}% success probability`}</p>${button('Ground test · $2','test',`data-key="${key}" ${state.money<2?'disabled':''}`)}`:`<p>Unlock flight capability</p>${button('Research · $10','research',`data-key="${key}" ${state.money<10?'disabled':''}`)}`}</article>`).join('')}</div><h2>Component procurement</h2><div class="cards">${Object.entries(PARTS).filter(([k])=>k!=='sample').map(([key,p])=>`<article><small>${p.thrust?'PROPULSION':'PAYLOAD'}</small><h3>${p.name}</h3><p>${p.mass} mass ${p.thrust?' / '+p.thrust+' thrust':''}</p><p>In storage: ${state.stock.filter(x=>x===key).length}</p>${button(`Purchase · $${p.cost}`,'buy',`data-key="${key}" ${state.money<p.cost||(p.tech&&!Object.hasOwn(state.tech,p.tech))?'disabled':''}`)}</article>`).join('')}</div>`;
}
function renderPlanner() {
  $('view').innerHTML=`<h2>Mission design laboratory</h2><p>Build a connected route. The planner works backwards, including the mass of all later stages, and picks the cheapest single rocket type per burn. Estimates assume successful outcomes and do not purchase anything.</p><div class="columns"><article><h3>01 / Payload</h3><form id="plan-form">${['probe','capsule','astronaut','supplies','sample'].map(p=>`<label>${PARTS[p].name}<input type="number" name="${p}" min="0" max="50" value="${p==='probe'?1:0}"></label>`).join('')}<h3>02 / Flight path</h3><ol>${routeIds.map(id=>`<li>${ROUTES[id].from} → ${ROUTES[id].to}</li>`).join('')}</ol><label>Next maneuver<select id="next-route">${ROUTES.filter(r=>r.from===(routeIds.length?ROUTES[routeIds.at(-1)].to:'Earth')).map(r=>`<option value="${r.id}">${r.to} · difficulty ${r.difficulty} · ${r.years} years</option>`).join('')}</select></label>${button('Add leg','add-leg')}${button('Clear route','clear-route')}<hr><button>Calculate flight plan</button></form></article><article id="plan-result"><h3>03 / Flight analysis</h3><p>Add a destination, then calculate your staging requirements.</p><p>Crew need a capsule, one supply per astronaut per year away from Earth, and researched life support. Samples collected en route add mass: include their expected mass in the payload for a conservative estimate.</p><p>Planner excludes reliability losses, research cost and non-flight operations. It does not guarantee mission success.</p></article></div>`;
}
function renderJournal() {
  $('view').innerHTML=`<h2>Campaign archive</h2><article><p>Autosaved after every action in this browser, with a previous-state backup. Export before clearing browser data.</p>${button('Export save','export')}${button('New campaign','new')}<label>Import save JSON<input type="file" id="import-file" accept=".json,application/json"></label></article><details><summary>Rules coverage & limitations</summary><p>This is a playable prototype, not a faithful complete Leaving Earth game. It includes annual budgets, purchases, assembly, staged burns, travel time, supplies, samples, objectives and seeded outcomes. The route network and mission set are simplified scenario data. Outcome cards are replaced by an explicit reliability model. It omits component damage, astronauts’ skills, hidden planetary conditions, surveys, rendezvous, ion propulsion, variable travel speed, original mission selection, and both expansions.</p></details><h2>Flight journal</h2><div class="journal">${state.log.map(line=>`<p>${escape(line)}</p>`).join('')}</div>`;
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button'); if(!b)return;
  if(b.dataset.tab) {tab=b.dataset.tab;render();return;}
  const action=b.dataset.action; if(!action)return; event.preventDefault();
  try {
    if(action==='add-leg') {if(routeIds.length>=20)throw new Error('Maximum 20 legs.');if(!$('next-route').value)throw new Error('No available maneuver.');routeIds.push(Number($('next-route').value));render();return;}
    if(action==='clear-route') {routeIds=[];render();return;}
    if(action==='export') {const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`leaving-earth-${state.year}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(action==='new'||action==='new-expansions') {if(!confirm('Replace the current campaign? Export a save first if you want to keep it.'))return;state=newGame(crypto.getRandomValues(new Uint32Array(1))[0],action==='new-expansions'?{outer:true,stations:true}:{});routeIds=[];}
    else {if(action==='year'&&!confirm('End the year? Unspent funds expire and crew require life support and supplies.'))return;state=act(state,{type:action,key:b.dataset.key,craft:b.dataset.craft});}
    message('Operation recorded.');persist();render();
  }catch(e){message(e.message,true);}
});
document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target, data=new FormData(form);
  try{
    if(form.id==='plan-form') {
      if(!routeIds.length)throw new Error('Add at least one flight leg.');
      const parts=[];for(const [p,v] of data) {const n=Number(v);if(!Number.isInteger(n)||n<0||n>50)throw new Error('Payload counts must be 0–50.');parts.push(...Array(n).fill(p));}
      if(!parts.length)throw new Error('Add a payload.');
      const result=plan(parts,routeIds,{objective:$('plan-objective').value,rendezvous:$('plan-rendezvous').checked,knownTech:Object.keys(state.tech),expansions:state.expansions});
      if(result.alternative) message(`Also evaluated ${result.alternative.strategy}: $${result.alternative.cost} hardware, ${result.alternative.newTechnologies.length} new technologies. Selected ${result.strategy}.`);
      $('plan-result').innerHTML=`<h3>${result.strategy}</h3><div class="numbers"><b>$${result.cost}<small>HARDWARE</small></b><b>${result.mass}<small>TOTAL LAUNCH MASS</small></b><b>${result.years}<small>FLIGHT YEARS</small></b></div><p>Required technologies: ${result.technologies.map(t=>TECH[t]).join(', ')||'None'}. New research: $${result.researchCost} (${result.newTechnologies.length} technologies).</p><p>${escape(counts(result.parts))}</p>${result.launches?`<h4>Launch separately to Earth orbit</h4>${result.launches.map((launch,i)=>`<p>${i+1}: Assemble ${escape(counts(launch.parts))}; fire ${escape(counts(launch.stages[0].rockets))}.</p>`).join('')}<p>Dock all modules (${result.dockCount} rendezvous attempts) before continuing.</p>`:''}${result.stages.map((s,i)=>`<section class="stage"><h4>${i+1}. ${s.route.from} → ${s.route.to}</h4><p>Fire ${escape(counts(s.rockets))}</p><p>${s.mass} mass × ${s.route.difficulty} = ${s.required} required thrust / ${s.thrust} available</p>${s.route.hazard?`<p>Requires ${TECH[s.route.hazard]}</p>`:''}</section>`).join('')}<p>Failure reserves, annual procurement delays and crew upkeep are not included.</p>`;return;
    }
    if(form.dataset.form==='assemble')state=act(state,{type:'assemble',name:data.get('name'),parts:data.getAll('part').map(i=>state.stock[Number(i)])});
    if(form.dataset.form==='maneuver')state=act(state,{type:'maneuver',craft:form.dataset.craft,route:Number(data.get('route')),rockets:data.getAll('rocket').map(Number)});
    if(form.dataset.form==='dock')state=act(state,{type:'dock',craft:form.dataset.craft,target:Number(data.get('target'))});
    if(form.dataset.form==='separate')state=act(state,{type:'separate',craft:form.dataset.craft,parts:data.getAll('part').map(Number)});
    message('Operation recorded.');persist();render();
  }catch(e){message(e.message,true);}
});
document.addEventListener('change',async event=>{
  if(event.target.id!=='import-file')return;
  try {const file=event.target.files[0];if(!file)return;if(file.size>2000000)throw new Error('Save is too large.');const imported=importSave(await file.text());if(!confirm('Replace the current campaign with this save?'))return;state=imported;message('Save imported.');persist();render();}catch(e){message(`Import failed: ${e.message}`,true);}
});
render();