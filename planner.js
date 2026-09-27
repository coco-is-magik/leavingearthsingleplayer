import { ROUTES, PARTS } from './data.js';
import { mass } from './engine.js';
export function plan(parts, routeIds) {
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
    for (const [key,p] of Object.entries(PARTS).filter(([,p])=>p.thrust)) {
      const net=p.thrust-r.difficulty*p.mass;
      if (r.difficulty && net<=0) continue;
      const count=r.difficulty ? Math.ceil(r.difficulty*mass(payload)/net) : 0;
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