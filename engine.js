import { PARTS, TECH, ROUTES, MISSIONS, LOCATIONS, SURFACES, TECH_EXPANSIONS, missingPrerequisites, enabled, missionsFor } from './data.js';
import {drawOutcome as outcome, researchOutcomes, migrateOutcomes, outcomeCard} from './outcomes.js';
import {validateMission} from './mission-plans.js';
export const mass = parts => parts.reduce((sum, p) => sum + PARTS[p].mass, 0);
const need = (condition, message) => { if (!condition) throw new Error(message); };
export const crewCount = parts => parts.filter(p=>PARTS[p].crew).length;
const seated = parts => crewCount(parts) <= parts.reduce((n,p)=>n+(PARTS[p].seats||0),0);
function removeParts(c,indices) {
  const old=c.parts;
  c.parts=old.filter((_,i)=>!indices.includes(i));
  c.damaged=(c.damaged||[]).filter(i=>!indices.includes(i)).map(i=>old.slice(0,i).filter((_,j)=>!indices.includes(j)).length);
}
export function newGame(seed = 1956, expansions = {}) {
  const money = expansions.stations ? 30 : 25;
  return { version: 1, expansions: {outer:!!expansions.outer,stations:!!expansions.stations}, seed: seed >>> 0 || 1, year: 1956, money, tech: {}, stock: [], crafts: [], nextId: 1, completed: [], score: 0, log: [`1956 · Agency established. Annual budget: $${money}.`], ended: false };
}
function note(s, text) { s.log.unshift(`${s.year} · ${text}`); }
function pay(s, amount) { need(s.money >= amount, `Requires $${amount}; available $${s.money}.`); s.money -= amount; }
function score(s, c) {
  for (const m of missionsFor(s)) {
    const laboratory = m.sample && s.expansions?.outer && c.parts.includes('scientist') && (!s.expansions?.stations || c.parts.includes('science'));
    const habitatReturn = m.visited && s.expansions?.stations && c.parts.some(p=>['habitat','groundHabitat'].includes(p));
    if (s.completed.includes(m.id) || (c.location !== m.location && !laboratory && !habitatReturn) || c.eta) continue;
    if (m.crew && !crewCount(c.parts)) continue;
    if (m.part && !c.parts.includes(m.part)) continue;
    if (m.sample && !c.samples.includes(m.sample)) continue;
    if (m.visited && !c.visited.includes(m.visited)) continue;
    s.completed.push(m.id); s.score += m.points; note(s, `Mission complete: ${m.name} (+${m.points}).`);
  }
}
export function act(state, action) {
  const s = structuredClone(state);
  migrateOutcomes(s);
  need(action.outcomeDecisions===undefined || (Array.isArray(action.outcomeDecisions)&&action.outcomeDecisions.length<=10000&&action.outcomeDecisions.every(x=>typeof x==='boolean')), 'Invalid outcome decisions.');
  s.outcomeDecisions=action.outcomeDecisions||[]; s.outcomeCursor=0;
  need(!s.ended, 'This campaign has ended. Start a new game to continue.');
  const c = s.crafts.find(craft => craft.id === Number(action.craft));
  switch (action.type) {
    case 'research':
      need(Object.hasOwn(TECH, action.key), 'Unknown technology.');
      need(!Object.hasOwn(s.tech, action.key), 'Technology already researched.');
      need(!TECH_EXPANSIONS[action.key] || s.expansions?.[TECH_EXPANSIONS[action.key]], 'Enable the required expansion for this technology.');
      need(!missingPrerequisites(s.tech,action.key).length, `Research prerequisite first: ${missingPrerequisites(s.tech,action.key).map(k=>TECH[k]).join(', ')}.`);
      pay(s, 10); s.tech[action.key] = researchOutcomes(s,action.key); note(s, `Researched ${TECH[action.key]}.`); break;
    case 'test':
      throw new Error('Standalone ground tests are not allowed. Buy and assemble hardware, then attempt a maneuver or use its advancement.');
    case 'buy': {
      const p = PARTS[action.key]; need(p && action.key !== 'sample' && !p.unbuyable && enabled(s,p), 'Component cannot be purchased.');
      if (p.tech) need(Object.hasOwn(s.tech,p.tech), `Research ${TECH[p.tech]} before purchasing ${p.name}.`);
      pay(s,p.cost); s.stock.push(action.key); note(s, `Purchased ${p.name}.`); break;
    }
    case 'assemble': {
      need(Array.isArray(action.parts) && action.parts.length > 0, 'Select components to assemble.');
      const remaining = [...s.stock];
      for (const p of action.parts) { const i = remaining.indexOf(p); need(i >= 0,'Component not in inventory.'); remaining.splice(i,1); }
      need(seated(action.parts), 'Each astronaut requires a capsule or habitat seat.');
      s.stock = remaining;
      const craft = {id:s.nextId++, name:String(action.name || `Flight ${s.nextId - 1}`).slice(0,60), parts:[...action.parts], location:'Earth', eta:0, destination:null, samples:[], visited:['Earth']};
      s.crafts.push(craft); note(s, `Assembled ${craft.name}.`); break;
    }
    case 'disassemble':
      need(c && c.location === 'Earth' && !c.eta, 'Only craft on Earth can be disassembled.');
      s.stock.push(...c.parts.filter(p=>p!=='sample')); s.crafts = s.crafts.filter(x=>x!==c); break;
    case 'repair':
      need(c&&c.location==='Earth'&&!c.eta,'Free repairs require a spacecraft on Earth.');
      c.damaged=[];note(s,`${c.name}: repaired on Earth.`);break;
    case 'maneuver': {
      need(c && !c.eta,'Select a spacecraft not in transit.');
      need(!c.parts.includes('groundHabitat'), 'Constructed ground habitats cannot move.');
      const route = ROUTES.find(r=>r.id===Number(action.route) && r.from===c.location);
      need(route && enabled(s,route),'No such maneuver from this location.');
      if (route.hazard) need(Object.hasOwn(s.tech,route.hazard),`Research ${TECH[route.hazard]} first.`);
      const indices = action.rockets || [];
      need(Array.isArray(indices) && new Set(indices).size===indices.length,'Invalid rocket selection.');
      for (const i of indices) {
        need(Number.isInteger(i) && PARTS[c.parts[i]]?.thrust,'Select rocket components only.');
        need(Object.hasOwn(s.tech,PARTS[c.parts[i]].tech),`Research ${TECH[PARTS[c.parts[i]].tech]} first.`);
      }
      const required = mass(c.parts)*route.difficulty;
      let generated = 0, destroyed = false;
      const consumed = new Set();
      const tanks = new Map();
      for (const i of indices) {
        const fuel = PARTS[c.parts[i]].fuel;
        if (!fuel) continue;
        const tank = c.parts.findIndex((p,j)=>p===fuel && !consumed.has(j));
        need(tank>=0, 'Each reusable rocket requires its own matching fuel tank.');
        consumed.add(tank); tanks.set(i,tank);
      }
      consumed.clear();
      c.damaged ??= [];
      for (const i of indices) need(!c.damaged.includes(i), 'Damaged rockets cannot fire.');
      for (const i of indices) {
        const p=PARTS[c.parts[i]];
        if (outcome(s,p.tech)) {generated+=p.thrust; consumed.add(p.fuel?tanks.get(i):i);}
        else if(s.lastOutcome==='major') {destroyed=true;break;}
        else c.damaged.push(i);
      }
      if(destroyed) {s.crafts=s.crafts.filter(x=>x!==c);note(s,`${c.name}: rocket explosion destroyed spacecraft.`);break;}
      const oldParts=c.parts;
      c.parts=oldParts.filter((_,i)=>!consumed.has(i));
      c.damaged=c.damaged.filter(i=>!consumed.has(i)).map(i=>oldParts.slice(0,i).filter((_,j)=>!consumed.has(j)).length);
      if (generated<required) {note(s,`${c.name}: ${generated}/${required} thrust; remains at ${c.location}.`);break;}
      if (route.hazard && !outcome(s,route.hazard)) {
        s.crafts = s.crafts.filter(x=>x!==c); note(s,`${c.name} lost during ${route.hazard}.`); break;
      }
      c.destination = route.to; c.eta = route.years;
      if (!c.eta) { c.location = route.to; c.destination = null; c.visited.push(route.to); score(s,c); }
      note(s,`${c.name}: ${route.from} → ${route.to}${route.years ? `, ${route.years} years` : ''}.`); break;
    }
    case 'collect':
      need(c && !c.eta && SURFACES.includes(c.location),'Land on a surface to collect a sample.');
      need(!c.samples.includes(c.location),'Sample already collected.');
      c.samples.push(c.location); c.parts.push('sample'); score(s,c); note(s,`${c.name} collected a ${c.location} sample.`); break;
    case 'dock': {
      const target = s.crafts.find(x=>x.id===Number(action.target));
      need(c && target && c!==target && !c.eta && !target.eta && c.location===target.location && c.location!=='Earth', 'Dock two different stationary spacecraft at the same off-Earth location.');
      if (!outcome(s,'rendezvous')) break;
      c.damaged=[...(c.damaged||[]),...(target.damaged||[]).map(i=>i+c.parts.length)];
      c.parts.push(...target.parts); c.samples.push(...target.samples);
      c.visited = [...new Set([...c.visited,...target.visited])];
      s.crafts = s.crafts.filter(x=>x!==target); score(s,c); note(s,`${c.name} docked with ${target.name}.`); break;
    }
    case 'separate': {
      need(c && c.location!=='Earth', 'Separate only away from Earth.');
      const indices = action.parts;
      need(Array.isArray(indices) && indices.length>0 && indices.length<c.parts.length && new Set(indices).size===indices.length && indices.every(i=>Number.isInteger(i)&&i>=0&&i<c.parts.length), 'Select a nonempty proper subset of components.');
      const detached=c.parts.filter((_,i)=>indices.includes(i)), remaining=c.parts.filter((_,i)=>!indices.includes(i));
      need(!detached.includes('groundHabitat'), 'Constructed ground habitats cannot move.');
      need(seated(detached)&&seated(remaining), 'Each astronaut requires a seat after separation.');
      if (!outcome(s,'rendezvous')) break;
      let sampleIndex=0; const movedSamples=[], keptSamples=[];
      c.parts.forEach((p,i)=>{if(p==='sample') (indices.includes(i)?movedSamples:keptSamples).push(c.samples[sampleIndex++]);});
      const child={...structuredClone(c),id:s.nextId++,name:`${c.name.slice(0,45)} / separated`,parts:detached,samples:movedSamples};
      child.damaged=(c.damaged||[]).filter(i=>indices.includes(i)).map(i=>c.parts.slice(0,i).filter((_,j)=>indices.includes(j)).length);
      c.damaged=(c.damaged||[]).filter(i=>!indices.includes(i)).map(i=>c.parts.slice(0,i).filter((_,j)=>!indices.includes(j)).length);
      c.parts=remaining; c.samples=keptSamples; s.crafts.push(child); note(s,`${c.name} separated.`); break;
    }
    case 'experiment':
      need(s.expansions?.stations && c && !c.eta && c.location!=='Earth' && c.parts.includes('science') && c.parts.includes('experiment') && (s.expansions?.outer ? c.parts.includes('scientist') : crewCount(c.parts)), 'Experiment requires a ready payload, science module and qualified crew away from Earth.');
      c.parts[c.parts.indexOf('experiment')]='finishedExperiment';
      note(s,`${c.name} completed an experiment at ${c.location}.`); break;
    case 'year':
      for (const craft of s.crafts) {
        if(craft.location==='Earth'&&!craft.eta)craft.damaged=[];
        const crew = crewCount(craft.parts);
        if (crew && (craft.location!=='Earth' || craft.eta)) {
          const food = s.expansions?.stations ? 'food' : 'supplies';
          const required = Math.ceil(crew/5);
          const supplies = craft.parts.filter(p=>p===food).length;
          if (supplies < required || !Object.hasOwn(s.tech,'life') || !outcome(s,'life')) {
            removeParts(craft,craft.parts.map((p,i)=>PARTS[p].crew?i:-1)); note(s,`${craft.name}: crew lost without successful life support and supplies.`);
          } else { for (let i=0;i<required;i++) removeParts(craft,[craft.parts.indexOf(food)]); }
        }
        if (craft.eta && --craft.eta===0) { craft.location=craft.destination; craft.destination=null; craft.visited.push(craft.location); score(s,craft); note(s,`${craft.name} arrived at ${craft.location}.`); }
      }
      if (s.year===(s.expansions?.stations || s.expansions?.outer ? 1986 : 1976)) { s.ended=true; note(s,`Campaign ended: ${s.score} points. ${s.score > missionsFor(s).reduce((n,m)=>n+m.points,0)-s.score ? 'Victory!' : 'Mission target not reached.'}`); }
      else {
        s.year++; s.money=s.expansions?.stations ? 30 : 25;
        if (s.expansions?.stations) for (const craft of s.crafts) {
          if (!craft.eta && SURFACES.includes(craft.location) && craft.parts.includes('mechanic')) craft.parts=craft.parts.map(p=>p==='habitatParts'?'groundHabitat':p);
          for (const p of [...craft.parts]) {
            if (p==='hydroponics' && crewCount(craft.parts) && Object.hasOwn(s.tech,'synthesis') && outcome(s,'synthesis')) craft.parts.push('food');
            if (p==='generator' && !craft.eta && ['Mars','Venus'].includes(craft.location) && Object.hasOwn(s.tech,'synthesis') && outcome(s,'synthesis')) craft.parts.push('smallTank');
          }
          score(s,craft);
        }
        note(s,`New annual budget: $${s.money}. Unspent funding does not carry over.`);
      } break;
    default: throw new Error('Unknown action.');
  }
  delete s.outcomeDecisions; delete s.outcomeCursor; delete s.lastOutcome;
  return s;
}
export function validateSave(s) {
  need(s && s.version===1 && Number.isInteger(s.seed) && s.seed>0 && s.seed<=4294967295,'Invalid save header.');
  need(s.expansions===undefined || (s.expansions && typeof s.expansions.outer==='boolean' && typeof s.expansions.stations==='boolean'), 'Invalid expansion settings.');
  need(Number.isInteger(s.year) && s.year>=1956 && s.year<=(s.expansions?.stations||s.expansions?.outer?1986:1976) && Number.isInteger(s.money) && s.money>=0 && s.money<=(s.expansions?.stations?30:25),'Invalid campaign values.');
  need(typeof s.ended==='boolean' && Number.isInteger(s.nextId) && s.nextId>0,'Invalid campaign status.');
  need(s.tech && typeof s.tech==='object' && !Array.isArray(s.tech) && Object.entries(s.tech).every(([k,v])=>Object.hasOwn(TECH,k)&&((Number.isInteger(v)&&v>=0&&v<=3)||(Array.isArray(v)&&v.length<=(k==='synthesis'?5:3)&&v.every(outcomeCard)))),'Invalid technologies.');
  for(const key of ['outcomeSupply','outcomeDiscard']) need(s[key]===undefined||(Array.isArray(s[key])&&s[key].length<=90&&s[key].every(outcomeCard)),'Invalid outcome deck.');
  const partsOK = ps=>Array.isArray(ps)&&ps.length<=10000&&ps.every(p=>Object.hasOwn(PARTS,p));
  need(partsOK(s.stock) && Array.isArray(s.crafts) && s.crafts.length<=1000,'Invalid inventory.');
  const ids = new Set();
  for (const c of s.crafts) {
    need(Number.isInteger(c.id)&&c.id>0&&c.id<s.nextId&&!ids.has(c.id),'Invalid craft ID.'); ids.add(c.id);
    need(typeof c.name==='string'&&c.name.length<=60&&partsOK(c.parts)&&LOCATIONS.includes(c.location),'Invalid spacecraft.');
    need(c.damaged===undefined||(Array.isArray(c.damaged)&&new Set(c.damaged).size===c.damaged.length&&c.damaged.every(i=>Number.isInteger(i)&&i>=0&&i<c.parts.length)), 'Invalid damaged components.');
    need(Number.isInteger(c.eta)&&c.eta>=0&&c.eta<=6&&(c.eta ? LOCATIONS.includes(c.destination) : c.destination===null),'Invalid transit.');
    need(Array.isArray(c.samples)&&c.samples.every(x=>SURFACES.includes(x))&&Array.isArray(c.visited)&&c.visited.every(x=>LOCATIONS.includes(x)),'Invalid exploration data.');
  }
  need(Array.isArray(s.completed)&&new Set(s.completed).size===s.completed.length&&s.completed.every(id=>MISSIONS.some(m=>m.id===id)),'Invalid missions.');
  need(s.score===MISSIONS.filter(m=>s.completed.includes(m.id)).reduce((n,m)=>n+m.points,0),'Invalid score.');
  need(Array.isArray(s.log)&&s.log.length<=100000&&s.log.every(x=>typeof x==='string'&&x.length<=1000),'Invalid journal.');
  need(s.plannedMissions===undefined||(Array.isArray(s.plannedMissions)&&s.plannedMissions.length<=20),'Invalid mission library.');
  for(const mission of s.plannedMissions||[])validateMission(mission);
  return structuredClone(s);
}