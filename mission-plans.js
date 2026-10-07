import {PARTS,ROUTES,TECH,enabled,technologyClosure} from './data.js';

const partsOK = parts => Array.isArray(parts)&&parts.length<=10000&&parts.every(p=>Object.hasOwn(PARTS,p));
export function validateMission(m) {
  if(!m || typeof m.name!=='string'||m.name.length>60||!partsOK(m.payload)||!Array.isArray(m.flights)||!m.flights.length||m.flights.length>201) throw new Error('Invalid saved mission.');
  let total=0;
  for(const flight of m.flights) {
    if(!partsOK(flight.parts)||!Array.isArray(flight.legs)||!flight.legs.length||flight.legs.length>20) throw new Error('Invalid mission flight.');
    total+=flight.parts.length;
    for(const leg of flight.legs) {
      if(!Number.isInteger(leg.route)||!ROUTES[leg.route]||!partsOK(leg.rockets)||leg.rockets.some(p=>!PARTS[p].thrust||PARTS[p].fuel)) throw new Error('Invalid mission stage.');
      total+=leg.rockets.length;
    }
  }
  if(total>30000) throw new Error('Mission is too large.');
  return structuredClone(m);
}
export function missionFromPlan(result,payload,name='Untitled mission') {
  const flight=p=>({parts:[...p.parts],legs:p.stages.map(s=>({route:s.route.id,rockets:[...s.rockets]}))});
  const flights=result.launches?[...result.launches.map(flight),{parts:[],legs:flight(result).legs}]:[flight(result)];
  return validateMission({name,payload:[...payload],flights});
}
export function editStage(m,flightIndex,legIndex,rockets) {
  const copy=validateMission(m), flight=copy.flights[flightIndex], leg=flight?.legs[legIndex];
  if(!leg||!partsOK(rockets)||rockets.some(p=>!PARTS[p].thrust||PARTS[p].fuel)) throw new Error('Invalid stage edit.');
  // Direct and launch stages can update their own manifest. Onward stages of
  // assembled missions need an explicit manifest edit on a launch as well.
  if(copy.flights.length===1||flightIndex<copy.flights.length-1) {
    for(const key of leg.rockets) {const i=flight.parts.indexOf(key);if(i>=0)flight.parts.splice(i,1);}
    flight.parts.push(...rockets);
  }
  leg.rockets=[...rockets];
  return validateMission(copy);
}

export function checkMission(input,state) {
  const m=validateMission(input), errors=[], warnings=[], steps=[], required=new Set();
  const assembled=m.flights.length>1, launchCount=assembled?m.flights.length-1:1;
  let joined=[], meeting=null, elapsed=0;
  const manifest=m.flights.slice(0,launchCount).flatMap(f=>f.parts);
  const weight=ps=>ps.reduce((n,p)=>n+PARTS[p].mass,0);
  const crew=ps=>ps.filter(p=>PARTS[p].crew).length;
  for(const p of manifest) {
    if(PARTS[p].tech)required.add(PARTS[p].tech);
    if(!enabled(state,PARTS[p]))errors.push(`${PARTS[p].name}: expansion is disabled.`);
    if(PARTS[p].fuel)errors.push('Reusable propulsion is not supported by this checker.');
    if(p==='groundHabitat')errors.push('A constructed ground habitat cannot fly.');
  }
  if(assembled)required.add('rendezvous');
  m.flights.forEach((flight,fi)=>{
    const onward=assembled&&fi===m.flights.length-1;
    if(onward&&flight.parts.length)errors.push('Onward manifest must be empty; its components come from the docked launches.');
    let parts=onward?[...joined]:[...flight.parts], location=onward?meeting:'Earth', years=0;
    const seats=parts.reduce((n,p)=>n+(PARTS[p].seats||0),0);
    if(crew(parts)>seats)errors.push(`Flight ${fi+1}: not enough crew seats.`);
    flight.legs.forEach((leg,li)=>{
      const r=ROUTES[leg.route], label=`Flight ${fi+1}, leg ${li+1}`;
      if(r.from!==location)errors.push(`${label}: disconnected route (expected ${location}).`);
      if(!enabled(state,r))errors.push(`${label}: expansion is disabled.`);
      if(r.hazard)required.add(r.hazard);
      const mass=weight(parts), thrust=leg.rockets.reduce((n,p)=>n+PARTS[p].thrust,0);
      for(const rocket of leg.rockets) {const i=parts.indexOf(rocket);if(i<0)errors.push(`${label}: missing ${PARTS[rocket].name}.`);else parts.splice(i,1);}
      if(thrust<mass*r.difficulty)errors.push(`${label}: ${thrust} thrust is less than ${mass*r.difficulty} required.`);
      if(r.years&&crew(parts)) {
        required.add('life');
        const food=state.expansions?.stations?'food':'supplies', amount=Math.ceil(crew(parts)/5)*r.years;
        for(let i=0;i<amount;i++){const index=parts.indexOf(food);if(index<0){errors.push(`${label}: insufficient ${food} for ${r.years} years.`);break;}parts.splice(index,1);}
      }
      years+=r.years; location=r.to;
      steps.push({label,mass,thrust,required:mass*r.difficulty});
    });
    if(assembled&&!onward) {
      if(location==='Earth')errors.push('Rendezvous must be away from Earth.');
      if(meeting&&meeting!==location)errors.push('Launches do not meet at the same location.');
      if(years)errors.push('Multi-year launch synchronization is not supported; use same-year assembly.');
      meeting=location;joined.push(...parts);
    } else {
      const remaining=[...parts];
      for(const p of m.payload.filter(p=>!['food','supplies'].includes(p))) {const i=remaining.indexOf(p);if(i<0)errors.push(`Final payload is missing ${PARTS[p].name}.`);else remaining.splice(i,1);}
      elapsed=years;
    }
  });
  const technologies=technologyClosure(required), missingTech=technologies.filter(k=>!Object.hasOwn(state.tech,k));
  const stock=[...state.stock], shortages=[];
  for(const p of manifest) {const i=stock.indexOf(p);if(i<0)shortages.push(p);else stock.splice(i,1);}
  const procurement=shortages.reduce((n,p)=>n+PARTS[p].cost,0)+missingTech.length*10;
  if(state.year+elapsed>(state.expansions?.outer||state.expansions?.stations?1986:1976))errors.push('Arrival is after the campaign ends.');
  if(state.ended)errors.push('Campaign has ended.');
  if(missingTech.length)warnings.push(`Research needed: ${missingTech.map(k=>TECH[k]).join(', ')}.`);
  if(shortages.length)warnings.push(`${shortages.length} components are missing from unassembled inventory.`);
  if(shortages.some(p=>p==='sample'||PARTS[p].unbuyable))warnings.push('Some missing components cannot be purchased on Earth.');
  if(procurement>state.money)warnings.push(`Procurement and research need $${procurement}; current budget is $${state.money}. Procurement delays are not simulated.`);
  if(technologies.some(k=>Array.isArray(state.tech[k])?state.tech[k].length:state.tech[k]))warnings.push('Required technologies still have uncertain outcomes.');
  return {valid:!errors.length,ready:!errors.length&&!missingTech.length&&!shortages.length,errors:[...new Set(errors)],warnings,steps,technologies,procurement,years:elapsed};
}