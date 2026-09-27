import { PARTS, TECH, ROUTES, MISSIONS, LOCATIONS } from './data.js';
export const mass = parts => parts.reduce((sum, p) => sum + PARTS[p].mass, 0);
const need = (condition, message) => { if (!condition) throw new Error(message); };
export function newGame(seed = 1956) {
  return { version: 1, seed: seed >>> 0 || 1, year: 1956, money: 25, tech: {}, stock: [], crafts: [], nextId: 1, completed: [], score: 0, log: ['1956 · Agency established. Annual budget: $25.'], ended: false };
}
function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
function note(s, text) { s.log.unshift(`${s.year} · ${text}`); }
function pay(s, amount) { need(s.money >= amount, `Requires $${amount}; available $${s.money}.`); s.money -= amount; }
function outcome(s, key) {
  need(Object.hasOwn(s.tech, key), `Research ${TECH[key]} first.`);
  const failures = s.tech[key];
  const failed = random(s) < failures / (failures + 3);
  if (failed) s.tech[key] = Math.max(0, failures - 1);
  note(s, `${TECH[key]}: ${failed ? 'failure; engineering improved reliability' : 'success'}.`);
  return !failed;
}
function score(s, c) {
  for (const m of MISSIONS) {
    if (s.completed.includes(m.id) || c.location !== m.location || c.eta) continue;
    if (m.crew && !c.parts.includes('astronaut')) continue;
    if (m.sample && !c.samples.includes(m.sample)) continue;
    if (m.visited && !c.visited.includes(m.visited)) continue;
    s.completed.push(m.id); s.score += m.points; note(s, `Mission complete: ${m.name} (+${m.points}).`);
  }
}
export function act(state, action) {
  const s = structuredClone(state);
  need(!s.ended, 'This campaign has ended. Start a new game to continue.');
  const c = s.crafts.find(craft => craft.id === Number(action.craft));
  switch (action.type) {
    case 'research':
      need(Object.hasOwn(TECH, action.key), 'Unknown technology.');
      need(!Object.hasOwn(s.tech, action.key), 'Technology already researched.');
      pay(s, 10); s.tech[action.key] = 3; note(s, `Researched ${TECH[action.key]}.`); break;
    case 'test':
      need(Object.hasOwn(s.tech, action.key), 'Research this technology first.');
      pay(s, 2); outcome(s, action.key); break;
    case 'buy': {
      const p = PARTS[action.key]; need(p && action.key !== 'sample', 'Component cannot be purchased.');
      if (p.tech) need(Object.hasOwn(s.tech,p.tech), 'Research this rocket first.');
      pay(s,p.cost); s.stock.push(action.key); note(s, `Purchased ${p.name}.`); break;
    }
    case 'assemble': {
      need(Array.isArray(action.parts) && action.parts.length > 0, 'Select components to assemble.');
      const remaining = [...s.stock];
      for (const p of action.parts) { const i = remaining.indexOf(p); need(i >= 0,'Component not in inventory.'); remaining.splice(i,1); }
      need(action.parts.filter(p=>p==='astronaut').length <= action.parts.filter(p=>p==='capsule').length, 'Each astronaut requires a capsule.');
      s.stock = remaining;
      const craft = {id:s.nextId++, name:String(action.name || `Flight ${s.nextId - 1}`).slice(0,60), parts:[...action.parts], location:'Earth', eta:0, destination:null, samples:[], visited:['Earth']};
      s.crafts.push(craft); note(s, `Assembled ${craft.name}.`); break;
    }
    case 'disassemble':
      need(c && c.location === 'Earth' && !c.eta, 'Only craft on Earth can be disassembled.');
      s.stock.push(...c.parts.filter(p=>p!=='sample')); s.crafts = s.crafts.filter(x=>x!==c); break;
    case 'maneuver': {
      need(c && !c.eta,'Select a spacecraft not in transit.');
      const route = ROUTES.find(r=>r.id===Number(action.route) && r.from===c.location);
      need(route,'No such maneuver from this location.');
      if (route.hazard) need(Object.hasOwn(s.tech,route.hazard),`Research ${TECH[route.hazard]} first.`);
      const indices = action.rockets || [];
      need(Array.isArray(indices) && new Set(indices).size===indices.length,'Invalid rocket selection.');
      let thrust = 0;
      for (const i of indices) { need(Number.isInteger(i) && PARTS[c.parts[i]]?.thrust,'Select rocket components only.'); thrust += PARTS[c.parts[i]].thrust; }
      need(thrust >= mass(c.parts)*route.difficulty, `Need ${mass(c.parts)*route.difficulty} thrust; selected ${thrust}.`);
      let success = true;
      for (const i of indices) if (!outcome(s,PARTS[c.parts[i]].tech)) success = false;
      c.parts = c.parts.filter((_,i)=>!indices.includes(i));
      if (!success) { note(s,`${c.name}: burn failed; fired rockets consumed.`); break; }
      if (route.hazard && !outcome(s,route.hazard)) {
        s.crafts = s.crafts.filter(x=>x!==c); note(s,`${c.name} lost during ${route.hazard}.`); break;
      }
      c.destination = route.to; c.eta = route.years;
      if (!c.eta) { c.location = route.to; c.destination = null; c.visited.push(route.to); score(s,c); }
      note(s,`${c.name}: ${route.from} → ${route.to}${route.years ? `, ${route.years} years` : ''}.`); break;
    }
    case 'collect':
      need(c && !c.eta && ['Moon','Mars','Venus'].includes(c.location),'Land on a surface to collect a sample.');
      need(!c.samples.includes(c.location),'Sample already collected.');
      c.samples.push(c.location); c.parts.push('sample'); note(s,`${c.name} collected a ${c.location} sample.`); break;
    case 'year':
      for (const craft of s.crafts) {
        const crew = craft.parts.filter(p=>p==='astronaut').length;
        if (crew && craft.location!=='Earth') {
          const supplies = craft.parts.filter(p=>p==='supplies').length;
          if (supplies < crew || !Object.hasOwn(s.tech,'life') || !outcome(s,'life')) {
            craft.parts = craft.parts.filter(p=>p!=='astronaut'); note(s,`${craft.name}: crew lost without successful life support and supplies.`);
          } else { for (let i=0;i<crew;i++) craft.parts.splice(craft.parts.indexOf('supplies'),1); }
        }
        if (craft.eta && --craft.eta===0) { craft.location=craft.destination; craft.destination=null; craft.visited.push(craft.location); score(s,craft); note(s,`${craft.name} arrived at ${craft.location}.`); }
      }
      if (s.year===1976) { s.ended=true; note(s,`Campaign ended: ${s.score} points. ${s.score > MISSIONS.reduce((n,m)=>n+m.points,0)-s.score ? 'Victory!' : 'Mission target not reached.'}`); }
      else { s.year++; s.money=25; note(s,'New annual budget: $25. Unspent funding does not carry over.'); } break;
    default: throw new Error('Unknown action.');
  }
  return s;
}
export function validateSave(s) {
  need(s && s.version===1 && Number.isInteger(s.seed) && s.seed>0 && s.seed<=4294967295,'Invalid save header.');
  need(Number.isInteger(s.year) && s.year>=1956 && s.year<=1976 && Number.isInteger(s.money) && s.money>=0 && s.money<=25,'Invalid campaign values.');
  need(typeof s.ended==='boolean' && Number.isInteger(s.nextId) && s.nextId>0,'Invalid campaign status.');
  need(s.tech && typeof s.tech==='object' && Object.entries(s.tech).every(([k,v])=>Object.hasOwn(TECH,k)&&Number.isInteger(v)&&v>=0&&v<=3),'Invalid technologies.');
  const partsOK = ps=>Array.isArray(ps)&&ps.length<=10000&&ps.every(p=>Object.hasOwn(PARTS,p));
  need(partsOK(s.stock) && Array.isArray(s.crafts) && s.crafts.length<=1000,'Invalid inventory.');
  const ids = new Set();
  for (const c of s.crafts) {
    need(Number.isInteger(c.id)&&c.id>0&&c.id<s.nextId&&!ids.has(c.id),'Invalid craft ID.'); ids.add(c.id);
    need(typeof c.name==='string'&&c.name.length<=60&&partsOK(c.parts)&&LOCATIONS.includes(c.location),'Invalid spacecraft.');
    need(Number.isInteger(c.eta)&&c.eta>=0&&c.eta<=2&&(c.eta ? LOCATIONS.includes(c.destination) : c.destination===null),'Invalid transit.');
    need(Array.isArray(c.samples)&&c.samples.every(x=>['Moon','Mars','Venus'].includes(x))&&Array.isArray(c.visited)&&c.visited.every(x=>LOCATIONS.includes(x)),'Invalid exploration data.');
  }
  need(Array.isArray(s.completed)&&new Set(s.completed).size===s.completed.length&&s.completed.every(id=>MISSIONS.some(m=>m.id===id)),'Invalid missions.');
  need(s.score===MISSIONS.filter(m=>s.completed.includes(m.id)).reduce((n,m)=>n+m.points,0),'Invalid score.');
  need(Array.isArray(s.log)&&s.log.length<=100000&&s.log.every(x=>typeof x==='string'&&x.length<=1000),'Invalid journal.');
  return structuredClone(s);
}