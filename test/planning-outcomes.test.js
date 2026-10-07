import test from 'node:test';
import assert from 'node:assert/strict';
import {act,newGame,validateSave} from '../engine.js';
import {OutcomeChoice} from '../outcomes.js';
import {plan} from '../planner.js';
import {missionFromPlan,checkMission,editStage} from '../mission-plans.js';
import {save,load,importSave} from '../storage.js';

function rocket(cards=['success'],parts=['juno']) {
  const s=newGame(42);s.tech.juno=cards;
  s.crafts=[{id:1,name:'Hardware test',parts,location:'Earth',eta:0,destination:null,samples:[],visited:['Earth']}];s.nextId=2;
  return s;
}
const burn=decisions=>({type:'maneuver',craft:1,route:0,rockets:[0],outcomeDecisions:decisions});
test('all supported expansion prerequisites and expansion gates are enforced',()=>{
  let s=newGame(1,{stations:true,outer:true});
  assert.throws(()=>act(s,{type:'research',key:'shuttle'}),/Reentry, Atlas/);
  assert.throws(()=>act(s,{type:'research',key:'synthesis'}),/Life support/);
  assert.throws(()=>act(s,{type:'research',key:'proton'}),/Soyuz/);
  assert.throws(()=>act(s,{type:'research',key:'aerobraking'}),/Reentry/);
  s.tech.reentry=[];assert.throws(()=>act(s,{type:'research',key:'shuttle'}),/Atlas/);
  s.tech.atlas=[];s=act(s,{type:'research',key:'shuttle'});assert.equal(s.tech.shuttle.length,3);
  s.tech.life=[];s=act(s,{type:'research',key:'synthesis'});assert.equal(s.tech.synthesis.length,5);
  assert.throws(()=>act(newGame(),{type:'research',key:'shuttle'}),/expansion/);
  assert.throws(()=>act(newGame(1,{stations:true}),{type:'buy',key:'habitat'}),/Research/);
});
test('standalone testing is rejected, actual hardware prompts without mutating state',()=>{
  const s=rocket(),before=structuredClone(s);
  assert.throws(()=>act(s,{type:'test',key:'juno'}),/Standalone/);
  assert.throws(()=>act(s,burn()),e=>e instanceof OutcomeChoice&&e.result==='success'&&e.cost===0);
  assert.deepEqual(s,before);
  const result=act(s,burn([true]));
  assert.equal(result.money,25);assert.deepEqual(result.tech.juno,[]);
  assert.deepEqual(result.crafts[0].parts,[]);assert.equal(result.crafts[0].location,'Earth');
  validateSave(result);
});
test('outcomes are returned unless paid for and removing a failure never undoes damage',()=>{
  const s=rocket(['minor']);
  const kept=act(s,burn([false]));assert.deepEqual(kept.tech.juno,['minor']);assert.equal(kept.money,25);
  const removed=act(s,burn([true]));assert.deepEqual(removed.tech.juno,[]);assert.equal(removed.money,20);
  assert.deepEqual(removed.crafts[0].damaged,[0]);assert.deepEqual(removed.crafts[0].parts,['juno']);
  assert.throws(()=>act(removed,burn([])),/Damaged/);
  const repaired=act(removed,{type:'repair',craft:1});assert.deepEqual(repaired.crafts[0].damaged,[]);
  const poor=rocket(['minor']);poor.money=4;assert.throws(()=>act(poor,burn([true])),/requires \$5/);
  const success=act(rocket(['success','success']),burn([true]));assert.equal(success.money,15);assert.equal(success.tech.juno.length,1);
});
test('major rocket failure destroys craft and stops further outcome draws',()=>{
  const s=rocket(['major'],['juno','juno']);
  const result=act(s,{...burn([true]),rockets:[0,1]});assert.equal(result.crafts.length,0);assert.equal(result.money,20);
});
test('multiple outcomes resolve one by one, including the free final success',()=>{
  const s=rocket(['success','success'],['juno','juno']);
  assert.throws(()=>act(s,{...burn([true]),rockets:[0,1]}),e=>e instanceof OutcomeChoice&&e.cost===0&&e.money===15);
  const result=act(s,{...burn([true,true]),rockets:[0,1]});assert.equal(result.money,15);assert.deepEqual(result.tech.juno,[]);
  assert.deepEqual(result.crafts[0].parts,[]);
});
test('legacy outcome migration is deterministic and save deck validation is strict',()=>{
  const s=newGame(42);s.tech={juno:3,atlas:0};
  const a=act(s,{type:'year'}),b=act(s,{type:'year'});assert.deepEqual(a,b);
  assert.equal(a.tech.juno.length,3);assert.deepEqual(a.tech.atlas,[]);assert.equal(s.tech.juno,3);
  validateSave(a);assert.throws(()=>validateSave({...a,tech:{juno:['fake']}}),/technologies/);
  assert.throws(()=>validateSave({...a,outcomeSupply:['fake']}),/deck/);
});
test('saved missions roundtrip, stage edits invalidate thrust and checks do not mutate state',()=>{
  const p=plan(['probe'],[0,2,4]),m=missionFromPlan(p,['probe'],'Lunar probe');
  const s=newGame();s.stock=[...p.parts];s.tech=Object.fromEntries(p.technologies.map(t=>[t,[]]));
  const before=structuredClone(s);assert.equal(checkMission(m,s).ready,true);assert.deepEqual(s,before);
  const edited=editStage(m,0,0,[]);assert.equal(checkMission(edited,s).valid,false);assert.ok(m.flights[0].legs[0].rockets.length);
  s.plannedMissions=[edited];const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  save(storage,s);assert.deepEqual(load(storage).state.plannedMissions,[edited]);
  assert.deepEqual(importSave(JSON.stringify(s)).plannedMissions,[edited]);
  const bad=structuredClone(s);bad.plannedMissions[0].flights[0].legs[0].route=999;
  assert.throws(()=>validateSave(bad),/stage/);
});
test('mission checker catches crew, supply, expansion, route, manifest and deadline problems',()=>{
  const s=newGame();
  const crew=missionFromPlan(plan(['astronaut'],[0]),['astronaut']);assert.match(checkMission(crew,s).errors.join(' '),/seats/);
  const trip=missionFromPlan(plan(['capsule','astronaut'],[0,6]),['capsule','astronaut']);
  assert.match(checkMission(trip,s).errors.join(' '),/supplies/);
  s.year=1976;assert.match(checkMission(trip,s).errors.join(' '),/campaign ends/);
  const outer=missionFromPlan(plan(['probe'],[0,14],{expansions:{outer:true}}),['probe']);assert.match(checkMission(outer,s).errors.join(' '),/disabled/);
  assert.throws(()=>plan(['probe'],[0,14]),/expansion/);
  const missing=missionFromPlan(plan(['probe'],[0]),['probe']);missing.flights[0].parts=['probe'];
  assert.match(checkMission(missing,s).errors.join(' '),/missing/);
  missing.flights[0].legs[0].route=2;assert.match(checkMission(missing,s).errors.join(' '),/disconnected/);
});
test('orbital assembly validation checks delivered hardware rather than cached totals',()=>{
  const p=plan(['probe'],[0,2,4],{rendezvous:true}),assembly=p.launches?p:p.alternative;
  const m=missionFromPlan(assembly,['probe']);assert.equal(checkMission(m,newGame()).valid,true);
  const broken=structuredClone(m);broken.flights[0].parts=[];
  assert.equal(checkMission(broken,newGame()).valid,false);
});