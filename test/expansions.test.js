import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,validateSave} from '../engine.js';
import {PARTS,TECH,ROUTES} from '../data.js';
import {plan} from '../planner.js';

function ready(parts, location='Earth orbit', expansions={outer:true,stations:true}) {
  const s=newGame(42,expansions);
  s.tech=Object.fromEntries(Object.keys(TECH).map(k=>[k,0]));
  s.crafts=[{id:1,name:'Test',parts,location,eta:0,destination:null,samples:[],visited:['Earth',location]}];
  s.nextId=2;
  return s;
}
function burn(s,id,stage) {
  const available=[...s.crafts.find(c=>c.id===id).parts];
  const rockets=stage.rockets.map(p=>{const i=available.indexOf(p);assert.ok(i>=0);available[i]=null;return i;});
  return act(s,{type:'maneuver',craft:id,route:stage.route.id,rockets});
}
test('technology-first planning uses one rocket technology across the mission',()=>{
  const p=plan(['probe'],[0,2,4]);
  assert.equal(p.technologies.filter(t=>PARTS[t]?.thrust).length,1);
  assert.ok(p.technologies.includes('landing'));
  const known=plan(['probe'],[0,2,4],{knownTech:['saturn','landing']});
  assert.deepEqual(known.newTechnologies,[]);
  assert.equal(known.researchCost,0);
  assert.throws(()=>plan(['missing'],[0]),/payload/);
  assert.throws(()=>plan(['probe'],[999]),/connected/);
  assert.throws(()=>plan(['groundHabitat'],[0],{expansions:{stations:true}}),/cannot move/);
});
test('orbital assembly plan is executable and conserves its payload',()=>{
  const result=plan(['probe'],[0,2,4],{rendezvous:true,objective:'hardware',knownTech:Object.keys(TECH)});
  const p=result.launches?result:result.alternative;
  assert.ok(p.launches?.length>1);
  let s=ready([], 'Earth');s.crafts=[];s.nextId=1;
  for(const launch of p.launches) {
    s.stock.push(...launch.parts);
    s=act(s,{type:'assemble',parts:launch.parts});
    s=burn(s,s.nextId-1,launch.stages[0]);
  }
  for(const id of s.crafts.slice(1).map(c=>c.id)) s=act(s,{type:'dock',craft:1,target:id});
  for(const stage of p.stages)s=burn(s,1,stage);
  assert.deepEqual(s.crafts[0].parts,['probe']);
  assert.equal(s.crafts[0].location,'Moon');
  validateSave(s);
});
test('docking requires co-location, no transit and researched rendezvous',()=>{
  const s=ready(['probe']);
  s.crafts.push({...structuredClone(s.crafts[0]),id:2,parts:['atlas']});s.nextId=3;
  assert.throws(()=>act(s,{type:'dock',craft:1,target:1}),/different/);
  s.crafts[1].eta=1;s.crafts[1].destination='Moon';
  assert.throws(()=>act(s,{type:'dock',craft:1,target:2}),/stationary/);
  s.crafts[1].eta=0;s.crafts[1].destination=null;
  delete s.tech.rendezvous;
  assert.throws(()=>act(s,{type:'dock',craft:1,target:2}),/Research/);
  s.tech.rendezvous=['minor']; const before=structuredClone(s);
  const failed=act(s,{type:'dock',craft:1,target:2,outcomeDecisions:[false]});
  assert.equal(failed.crafts.length,2);assert.deepEqual(s,before);
  s.tech.rendezvous=0;
  const joined=act(s,{type:'dock',craft:1,target:2});
  assert.equal(joined.crafts.length,1);assert.deepEqual(joined.crafts[0].parts,['probe','atlas']);
});
test('separation preserves transit and sample identities and rejects unseated crew',()=>{
  const s=ready(['capsule','astronaut','sample','probe']);
  s.crafts[0].eta=2;s.crafts[0].destination='Mars orbit';s.crafts[0].samples=['Moon'];
  assert.throws(()=>act(s,{type:'separate',craft:1,parts:[1]}),/seat/);
  assert.throws(()=>act(s,{type:'separate',craft:1,parts:[2,2]}),/subset/);
  const split=act(s,{type:'separate',craft:1,parts:[2,3]});
  assert.deepEqual(split.crafts[1].samples,['Moon']);assert.deepEqual(split.crafts[0].samples,[]);
  assert.equal(split.crafts[1].eta,2);assert.equal(split.crafts[1].destination,'Mars orbit');
  validateSave(split);
});
test('expansion budgets, prerequisites, long transit and saves',()=>{
  let s=newGame(1,{outer:true,stations:true});
  assert.equal(s.money,30);
  assert.throws(()=>act(s,{type:'research',key:'proton'}),/prerequisite/);
  s=act(s,{type:'research',key:'soyuz'});s=act(s,{type:'research',key:'proton'});
  s.year=1976;s=act(s,{type:'year'});assert.equal(s.year,1977);assert.equal(s.money,30);assert.equal(s.ended,false);
  s.year=1986;s=act(s,{type:'year'});assert.equal(s.ended,true);validateSave(s);
  assert.throws(()=>act(newGame(),{type:'buy',key:'habitat'}),/purchased/);
  assert.throws(()=>validateSave({...newGame(),expansions:{outer:'yes'}}),/expansion/);
  const route=ROUTES.find(r=>r.to==='Neptune fly-by');
  let flight=ready(['saturn','probe'],route.from);
  flight=act(flight,{type:'maneuver',craft:1,route:route.id,rockets:[0]});
  assert.equal(flight.crafts[0].eta,6);validateSave(flight);
});
test('reusable rockets require fuel and retain the rocket after a successful burn',()=>{
  let s=ready(['shuttle','largeTank','probe'],'Earth');
  s=act(s,{type:'maneuver',craft:1,route:0,rockets:[0]});
  assert.deepEqual(s.crafts[0].parts,['shuttle','probe']);
  assert.throws(()=>act(s,{type:'maneuver',craft:1,route:2,rockets:[0]}),/fuel tank/);
  const missing=ready(['daedalus','daedalus','smallTank']);
  assert.throws(()=>act(missing,{type:'maneuver',craft:1,route:2,rockets:[0,1]}),/fuel tank/);
});
test('station food feeds five, hydroponics produces at start of year, habitats are immovable',()=>{
  let s=ready(['habitat','astronaut','astronaut','food','hydroponics']);
  s=act(s,{type:'year'});
  assert.equal(s.crafts[0].parts.filter(p=>p==='astronaut').length,2);
  assert.equal(s.crafts[0].parts.filter(p=>p==='food').length,1);
  let ground=ready(['capsule','mechanic','food','habitatParts','generator'],'Mars');
  ground=act(ground,{type:'year'});
  assert.ok(ground.crafts[0].parts.includes('groundHabitat'));
  assert.ok(ground.crafts[0].parts.includes('smallTank'));
  assert.throws(()=>act(ground,{type:'maneuver',craft:1,route:9,rockets:[]}),/cannot move/);
});
test('combined expansions require scientists and science modules for experiments and remote samples',()=>{
  let s=ready(['capsule','astronaut','science','experiment'],'Moon');
  assert.throws(()=>act(s,{type:'experiment',craft:1}),/qualified/);
  s.crafts[0].parts[1]='scientist';
  s=act(s,{type:'experiment',craft:1});assert.ok(s.crafts[0].parts.includes('finishedExperiment'));
  s=act(s,{type:'collect',craft:1});assert.ok(s.completed.includes('sample'));
  let noLab=ready(['capsule','scientist'],'Moon');
  noLab=act(noLab,{type:'collect',craft:1});assert.ok(!noLab.completed.includes('sample'));
});