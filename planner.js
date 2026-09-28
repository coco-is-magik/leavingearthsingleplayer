import { ROUTES, PARTS, PREREQUISITES } from './data.js';
import { mass } from './engine.js';
function stagePlan(parts, routeIds, keys) {
  let payload = [...parts];
  const stages = [];
  let previous;
  for (const id of routeIds) {
    const r=ROUTES.find(r=>r.id===Number(id));
    if (!r || (previous && previous!==r.from)) throw new Error('Choose connected maneuvers.');
    previous=r.to;
  }
  // Work backwards so each earlier burn includes the mass of later stages.
  for (const id of [...routeIds].reverse()) {
    const r=ROUTES.find(r=>r.id===Number(id));
    let best=null;
    for (const key of keys) {
      const p=PARTS[key];
      const net=p.thrust-r.difficulty*p.mass;
      if (r.difficulty && net<=0) continue;
      const count=r.difficulty ? Math.ceil(r.difficulty*mass(payload)/net) : 0;
      if (count+payload.length>10000) continue;
      const cost=count*p.cost;
      if (!best || cost<best.cost) best={key,count,cost};
    }
    if (!best || best.count>10000) throw new Error('This payload cannot be planned.');
    const rockets=Array(best.count).fill(best.key);
    payload.push(...rockets);
    stages.unshift({route:r,rockets,mass:mass(payload),required:mass(payload)*r.difficulty,thrust:best.count*PARTS[best.key].thrust,cost:best.cost});
  }
  return {stages,parts:payload,mass:mass(payload),cost:payload.reduce((n,p)=>n+PARTS[p].cost,0),years:stages.reduce((n,s)=>n+s.route.years,0)};
}

export function plan(parts, routeIds, options={}) {
  if (!Array.isArray(parts) || !parts.length || parts.length>1000 || parts.some(p=>!Object.hasOwn(PARTS,p))) throw new Error('Choose a valid payload.');
  if (!Array.isArray(routeIds) || !routeIds.length || routeIds.length>20) throw new Error('Choose 1–20 connected maneuvers.');
  const routes=routeIds.map(id=>ROUTES.find(r=>r.id===Number(id)));
  routes.forEach((r,i)=>{if(!r || (i && routes[i-1].to!==r.from))throw new Error('Choose connected maneuvers.');});
  if (parts.includes('groundHabitat')) throw new Error('Constructed ground habitats cannot move.');
  const keys=Object.keys(PARTS).filter(k=>PARTS[k].thrust && !PARTS[k].fuel && (!PARTS[k].expansion || options.expansions?.[PARTS[k].expansion]));
  const known=new Set(options.knownTech||[]), candidates=[];
  const add = (candidate, rendezvous=false) => {
    const tech=new Set(candidate.parts.map(p=>PARTS[p].tech).filter(Boolean));
    routes.forEach(r=>{if(r.hazard)tech.add(r.hazard);});
    if (parts.some(p=>PARTS[p].crew) && routes.some(r=>r.years)) tech.add('life');
    if (rendezvous) tech.add('rendezvous');
    for (const key of tech) if (PREREQUISITES[key]) tech.add(PREREQUISITES[key]);
    candidate.technologies=[...tech].sort();
    candidate.newTechnologies=candidate.technologies.filter(t=>!known.has(t));
    candidate.researchCost=candidate.newTechnologies.length*10;
    candidate.strategy=rendezvous?'Orbital assembly':'Direct launch';
    candidates.push(candidate);
  };
  const attempt=(payload,ids,available)=>{try{return stagePlan(payload,ids,available);}catch{return null;}};
  // Enumerate technology subsets; staging within each subset is a cost heuristic.
  for (let mask=1;mask<2**keys.length;mask++) {
    const available=keys.filter((_,i)=>mask&(1<<i));
    const direct=attempt(parts,routeIds,available); if(direct)add(direct);
    if (!options.rendezvous || routes[0].from!=='Earth' || routes[0].to!=='Earth orbit' || routes.length<2) continue;
    const onward=attempt(parts,routeIds.slice(1),available);
    if (!onward || onward.parts.length<2 || onward.parts.length>200) continue;
    const modules=onward.parts.filter(p=>!PARTS[p].crew).map(p=>[p]);
    let valid=true;
    for (const person of onward.parts.filter(p=>PARTS[p].crew)) {
      const module=modules.find(ps=>ps.reduce((n,p)=>n+(PARTS[p].seats||0),0)>ps.filter(p=>PARTS[p].crew).length);
      if (!module) {valid=false;break;} module.push(person);
    }
    if (!valid || modules.length<2) continue;
    const launches=modules.map(ps=>attempt(ps,[routeIds[0]],available));
    if (launches.some(x=>!x)) continue;
    const allParts=launches.flatMap(x=>x.parts);
    if (allParts.length>10000) continue;
    add({parts:allParts,stages:onward.stages,launches,dockCount:launches.length-1,mass:mass(allParts),cost:launches.reduce((n,x)=>n+x.cost,0),years:onward.years},true);
  }
  if (!candidates.length) throw new Error('This payload cannot be planned.');
  candidates.sort((a,b)=>options.objective==='hardware' ? a.cost-b.cost || a.newTechnologies.length-b.newTechnologies.length : a.newTechnologies.length-b.newTechnologies.length || a.cost-b.cost);
  const best=candidates[0];
  const alternative=candidates.find(c=>c.strategy!==best.strategy);
  return {...best,alternative};
}