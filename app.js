import {PARTS,TECH,ROUTES,MISSIONS,SURFACES,enabled,missionsFor,PREREQUISITES,TECH_EXPANSIONS,missingPrerequisites} from './data.js';
import {newGame,act,mass} from './engine.js';
import {plan} from './planner.js';
import {save,load,importSave} from './storage.js';
import {OutcomeChoice} from './outcomes.js';
import {missionFromPlan,editStage,checkMission,validateMission} from './mission-plans.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=newGame(crypto.getRandomValues(new Uint32Array(1))[0]),tab='hangar',routeIds=[];
let mission=null, savedIndex=null, draft={probe:1}, objective='technology', rendezvous=true;
function perform(action) {
  const decisions=[];
  for(let i=0;i<10000;i++) {
    try{return act(state,{...action,outcomeDecisions:decisions});}
    catch(e) {
      if(!(e instanceof OutcomeChoice))throw e;
      if(e.money<e.cost){alert(`${TECH[e.key]}: ${e.result}. Removing costs $${e.cost}; only $${e.money} available. Card returned. Effects still apply.`);decisions.push(false);}
      else decisions.push(confirm(`${TECH[e.key]}: ${e.result}.\nOK: remove this card for $${e.cost}.\nCancel: return it to the advancement.\nThe current outcome still applies either way.`));
    }
  }
  throw new Error('Too many outcomes in one action.');
}
function captureDraft() {
  if(!$('plan-form'))return;
  draft=Object.fromEntries(new FormData($('plan-form')));
  objective=$('plan-objective').value;rendezvous=$('plan-rendezvous').checked;
}
function renderMission() {
  $('view').insertAdjacentHTML('beforeend',`<article><h3>Saved missions (included in campaign exports)</h3>${(state.plannedMissions||[]).map((m,i)=>`<p>${escape(m.name)} ${button('Load','load-plan',`data-index="${i}"`)} ${button('Delete','delete-plan',`data-index="${i}"`)}</p>`).join('')||'<p>No saved missions.</p>'}</article>`);
  if(!mission)return;
  const report=checkMission(mission,state);
  $('plan-result').innerHTML=`<h3>Editable mission</h3><label>Name<input id="mission-name" maxlength="60" value="${escape(mission.name)}"></label>${button('Save mission','save-plan')}${button('Save as copy','copy-plan')}${button('Check mission','check-plan')}<p><b>${report.valid?'Physically executable assuming successful outcomes':'Plan has errors'} · ${report.ready?'Inventory and research ready':'Not ready with current campaign resources'}</b></p>${[...report.errors,...report.warnings].map(t=>`<p>${escape(t)}</p>`).join('')}<p>Check assumes all outcomes succeed. It does not simulate procurement delays, random failures, production, samples collected later or arbitrary rendezvous timing.</p>${report.steps.map(s=>`<p>${s.label}: ${s.mass} mass; ${s.thrust}/${s.required} thrust.</p>`).join('')}${mission.flights.map((f,fi)=>`<section><h4>Flight ${fi+1}${mission.flights.length>1&&fi===mission.flights.length-1?' (after docking all launches)':''}</h4><form data-form="manifest" data-flight="${fi}"><label>Initial components (comma-separated component keys; empty for onward flight)<textarea name="parts">${escape(f.parts.join(', '))}</textarea></label><button>Update manifest</button></form>${f.legs.map((leg,li)=>`<form data-form="edit-stage" data-flight="${fi}" data-leg="${li}"><h4>${ROUTES[leg.route].from} → ${ROUTES[leg.route].to}</h4>${Object.entries(PARTS).filter(([,p])=>p.thrust&&!p.fuel&&enabled(state,p)).map(([key,p])=>`<label>${p.name}<input name="${key}" type="number" min="0" max="1000" value="${leg.rockets.filter(x=>x===key).length}"></label>`).join('')}<button>Update stage and check</button></form>`).join('')}</section>`).join('')}<p>Stage edits update the direct/launch manifest. For onward orbital-assembly edits, also update a launch manifest to deliver the changed hardware. Earlier stages are checked, not silently recalculated.</p>`;
}
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
    $('view').querySelectorAll('form[data-form="maneuver"]').forEach(form=>{
      const c=state.crafts.find(c=>c.id===Number(form.dataset.craft));
      form.querySelector('legend').textContent='Fire purchased rockets (underpowered test attempts are allowed)';
      form.querySelectorAll('input[name="rocket"]').forEach(input=>{if(c.damaged?.includes(Number(input.value))){input.disabled=true;input.parentElement.append(' — damaged');}});
      if(c.location==='Earth'&&c.damaged?.length)form.insertAdjacentHTML('afterend',button('Repair on Earth (free)','repair',`data-craft="${c.id}"`));
    });
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
    for(const input of $('plan-form').querySelectorAll('input[name]'))input.value=draft[input.name]||0;
    $('plan-objective').value=objective;$('plan-rendezvous').checked=rendezvous;
    renderMission();
  }
}
function renderHangar() {
  $('view').innerHTML=`<div class="columns"><div><h2>Flight operations <small>${state.crafts.length} spacecraft</small></h2><div class="orbit-art"><div class="planet"></div><span>EARTH / HOME PORT</span><i>✦</i></div>${state.crafts.length?'':'<article><h3>Your program starts here</h3><p>Research Soyuz, purchase a Soyuz and a probe, then assemble a spacecraft. Use the planner to prepare multi-stage missions.</p></article>'}${state.crafts.map(c=>`<article><h3>${escape(c.name)} <small>${mass(c.parts)} mass</small></h3><p class="accent">${escape(c.location)}${c.eta?` → ${escape(c.destination)} · ${c.eta} years remaining`:''}</p><p>${escape(counts(c.parts))}</p>${!c.eta?`<form data-form="maneuver" data-craft="${c.id}"><label>Maneuver<select name="route">${ROUTES.filter(r=>r.from===c.location).map(r=>`<option value="${r.id}">${r.to} · difficulty ${r.difficulty} · ${r.years} years · ${mass(c.parts)*r.difficulty} thrust${r.hazard?' · '+r.hazard:''}</option>`).join('')}</select></label><fieldset><legend>Rockets to fire (consumed on attempt)</legend>${c.parts.map((p,i)=>PARTS[p].thrust?`<label class="check"><input type="checkbox" name="rocket" value="${i}">${PARTS[p].name} · ${PARTS[p].thrust} thrust</label>`:'').join('')||'<small>No rockets aboard</small>'}</fieldset><button>Attempt maneuver</button></form>${['Moon','Mars','Venus'].includes(c.location)?button('Collect surface sample','collect',`data-craft="${c.id}"`):''}${c.location==='Earth'?button('Disassemble into inventory','disassemble',`data-craft="${c.id}"`):''}`:''}</article>`).join('')}</div><aside><h2>Mission objectives</h2><p>Win by scoring more than the points left uncompleted by the end of 1976.</p>${MISSIONS.map(m=>`<article class="mission ${state.completed.includes(m.id)?'done':''}"><b>${state.completed.includes(m.id)?'✓':'○'} ${m.name}</b><span>${m.points} PT</span></article>`).join('')}<h2>Assembly bay</h2><form data-form="assemble"><label>Spacecraft name<input name="name" maxlength="60" placeholder="Odyssey 1"></label><fieldset><legend>Available inventory</legend>${state.stock.map((p,i)=>`<label class="check"><input type="checkbox" name="part" value="${i}">${PARTS[p].name} · ${PARTS[p].mass} mass</label>`).join('')||'<p>Purchase components in Research & procurement.</p>'}</fieldset><button>Assemble spacecraft</button></form></aside></div>`;
}
function renderResearch() {
  $('view').innerHTML=`<h2>Research & development</h2><p>Research costs $10 and deals three hidden outcomes (five for Synthesis). Draw only when using an advancement with actual hardware or crew. No standalone paid ground tests. After each draw, choose whether to return it or remove it: failure $5, success $10, last success free. Removing a card never cancels its effects.</p><div class="cards">${Object.entries(TECH).filter(([key])=>!TECH_EXPANSIONS[key]||state.expansions?.[TECH_EXPANSIONS[key]]).map(([key,name])=>`<article><small>ADVANCEMENT</small><h3>${name}</h3><p>Prerequisites: ${(PREREQUISITES[key]||[]).map(k=>`${TECH[k]} (${Object.hasOwn(state.tech,k)?'researched':'missing'})`).join(', ')||'None'}</p>${Object.hasOwn(state.tech,key)?`<p>${Array.isArray(state.tech[key])?`${state.tech[key].length} hidden outcomes remaining`:state.tech[key]===0?'Flight proven':'Legacy reliability will migrate on next action'}</p>`:button('Research · $10','research',`data-key="${key}" ${state.money<10||missingPrerequisites(state.tech,key).length?'disabled':''}`)}</article>`).join('')}</div><h2>Component procurement</h2><div class="cards">${Object.entries(PARTS).filter(([k,p])=>k!=='sample'&&!p.unbuyable&&enabled(state,p)).map(([key,p])=>`<article><h3>${p.name}</h3><p>${p.mass} mass ${p.thrust?' / '+p.thrust+' thrust':''}</p><p>Requires: ${p.tech?TECH[p.tech]:'No advancement'} · In storage: ${state.stock.filter(x=>x===key).length}</p>${button(`Purchase · $${p.cost}`,'buy',`data-key="${key}" ${state.money<p.cost||(p.tech&&!Object.hasOwn(state.tech,p.tech))?'disabled':''}`)}</article>`).join('')}</div>`;
}
function renderPlanner() {
  $('view').innerHTML=`<h2>Mission design laboratory</h2><p>Build a connected route. The planner works backwards, including the mass of all later stages, and picks the cheapest single rocket type per burn. Estimates assume successful outcomes and do not purchase anything.</p><div class="columns"><article><h3>01 / Payload</h3><form id="plan-form">${['probe','capsule','astronaut','supplies','sample'].map(p=>`<label>${PARTS[p].name}<input type="number" name="${p}" min="0" max="50" value="${p==='probe'?1:0}"></label>`).join('')}<h3>02 / Flight path</h3><ol>${routeIds.map(id=>`<li>${ROUTES[id].from} → ${ROUTES[id].to}</li>`).join('')}</ol><label>Next maneuver<select id="next-route">${ROUTES.filter(r=>r.from===(routeIds.length?ROUTES[routeIds.at(-1)].to:'Earth')).map(r=>`<option value="${r.id}">${r.to} · difficulty ${r.difficulty} · ${r.years} years</option>`).join('')}</select></label>${button('Add leg','add-leg')}${button('Clear route','clear-route')}<hr><button>Calculate flight plan</button></form></article><article id="plan-result"><h3>03 / Flight analysis</h3><p>Add a destination, then calculate your staging requirements.</p><p>Crew need a capsule, one supply per astronaut per year away from Earth, and researched life support. Samples collected en route add mass: include their expected mass in the payload for a conservative estimate.</p><p>Planner excludes reliability losses, research cost and non-flight operations. It does not guarantee mission success.</p></article></div>`;
}
function renderJournal() {
  $('view').innerHTML=`<h2>Campaign archive</h2><article><p>Autosaved after every action in this browser, with a previous-state backup. Export before clearing browser data.</p>${button('Export save','export')}${button('New campaign','new')}<label>Import save JSON<input type="file" id="import-file" accept=".json,application/json"></label></article><details><summary>Rules coverage & limitations</summary><p>This is a playable prototype, not a faithful complete Leaving Earth game. It includes annual budgets, purchases, assembly, staged burns, travel time, supplies, samples, objectives and seeded outcomes. The route network and mission set are simplified scenario data. Outcome cards are replaced by an explicit reliability model. It omits component damage, astronauts’ skills, hidden planetary conditions, surveys, rendezvous, ion propulsion, variable travel speed, original mission selection, and both expansions.</p></details><h2>Flight journal</h2><div class="journal">${state.log.map(line=>`<p>${escape(line)}</p>`).join('')}</div>`;
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button'); if(!b)return;
  if(b.dataset.tab) {captureDraft();if(mission&&$('mission-name'))mission.name=$('mission-name').value;tab=b.dataset.tab;render();return;}
  const action=b.dataset.action; if(!action)return; event.preventDefault();
  try {
    if(action==='add-leg') {captureDraft();if(routeIds.length>=20)throw new Error('Maximum 20 legs.');if(!$('next-route').value)throw new Error('No available maneuver.');routeIds.push(Number($('next-route').value));render();return;}
    if(action==='clear-route') {captureDraft();routeIds=[];render();return;}
    if(['save-plan','copy-plan','check-plan','load-plan','delete-plan'].includes(action)) {
      captureDraft();
      if(action==='load-plan') {savedIndex=Number(b.dataset.index);mission=validateMission(state.plannedMissions[savedIndex]);routeIds=(mission.flights.length>1?[...mission.flights[0].legs,...mission.flights.at(-1).legs]:mission.flights[0].legs).map(l=>l.route);draft={};for(const p of mission.payload)draft[p]=(draft[p]||0)+1;}
      else if(action==='delete-plan') {state.plannedMissions.splice(Number(b.dataset.index),1);savedIndex=null;persist();}
      else {
        if(!mission)throw new Error('Calculate or load a mission first.');
        mission.name=$('mission-name').value.trim()||'Untitled mission';
        if(action!=='check-plan') {
          state.plannedMissions??=[];
          if(action==='copy-plan'||savedIndex===null) {if(state.plannedMissions.length>=20)throw new Error('Maximum 20 saved missions.');savedIndex=state.plannedMissions.length;}
          state.plannedMissions[savedIndex]=validateMission(mission);persist();
        }
      }
      render();return;
    }
    if(action==='export') {const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`leaving-earth-${state.year}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(action==='new'||action==='new-expansions') {if(!confirm('Replace the current campaign? Export a save first if you want to keep it.'))return;state=newGame(crypto.getRandomValues(new Uint32Array(1))[0],action==='new-expansions'?{outer:true,stations:true}:{});routeIds=[];mission=null;savedIndex=null;draft={probe:1};}
    else {if(action==='year'&&!confirm('End the year? Unspent funds expire and crew require life support and supplies.'))return;state=perform({type:action,key:b.dataset.key,craft:b.dataset.craft});}
    message('Operation recorded.');persist();render();
  }catch(e){message(e.message,true);}
});
document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target, data=new FormData(form);
  try{
    if(form.dataset.form==='edit-stage'||form.dataset.form==='manifest') {
      mission.name=$('mission-name').value.trim()||'Untitled mission';captureDraft();
      if(form.dataset.form==='edit-stage') {
        const rockets=[];
        for(const [key,value] of data){const n=Number(value);if(!Number.isInteger(n)||n<0||n>1000)throw new Error('Rocket counts must be 0–1000.');rockets.push(...Array(n).fill(key));}
        mission=editStage(mission,Number(form.dataset.flight),Number(form.dataset.leg),rockets);
      } else {
        const copy=structuredClone(mission);copy.flights[Number(form.dataset.flight)].parts=data.get('parts').split(',').map(s=>s.trim()).filter(Boolean);mission=validateMission(copy);
      }
      render();return;
    }
    if(form.id==='plan-form') {
      if(!routeIds.length)throw new Error('Add at least one flight leg.');
      const parts=[];for(const [p,v] of data) {const n=Number(v);if(!Number.isInteger(n)||n<0||n>50)throw new Error('Payload counts must be 0–50.');parts.push(...Array(n).fill(p));}
      if(!parts.length)throw new Error('Add a payload.');
      const result=plan(parts,routeIds,{objective:$('plan-objective').value,rendezvous:$('plan-rendezvous').checked,knownTech:Object.keys(state.tech),expansions:state.expansions});
      captureDraft();mission=missionFromPlan(result,parts,mission?.name||'Untitled mission');savedIndex=null;
      message(`${result.strategy}: $${result.cost} hardware, $${result.researchCost} new research.${result.alternative?` Alternative ${result.alternative.strategy}: $${result.alternative.cost} hardware, ${result.alternative.newTechnologies.length} new technologies.`:''}`);
      render();return;
    }
    if(form.dataset.form==='assemble')state=perform({type:'assemble',name:data.get('name'),parts:data.getAll('part').map(i=>state.stock[Number(i)])});
    if(form.dataset.form==='maneuver')state=perform({type:'maneuver',craft:form.dataset.craft,route:Number(data.get('route')),rockets:data.getAll('rocket').map(Number)});
    if(form.dataset.form==='dock')state=perform({type:'dock',craft:form.dataset.craft,target:Number(data.get('target'))});
    if(form.dataset.form==='separate')state=perform({type:'separate',craft:form.dataset.craft,parts:data.getAll('part').map(Number)});
    message('Operation recorded.');persist();render();
  }catch(e){message(e.message,true);}
});
document.addEventListener('change',async event=>{
  if(event.target.id!=='import-file')return;
  try {const file=event.target.files[0];if(!file)return;if(file.size>2000000)throw new Error('Save is too large.');const imported=importSave(await file.text());if(!confirm('Replace the current campaign with this save?'))return;state=imported;mission=null;savedIndex=null;routeIds=[];draft={probe:1};message('Save imported.');persist();render();}catch(e){message(`Import failed: ${e.message}`,true);}
});
render();