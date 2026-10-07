import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,mass,validateSave} from '../engine.js';
import {plan} from '../planner.js';
import {save,load,importSave} from '../storage.js';
import {createServer} from '../server.js';

function launchReady() {
  let s=newGame(42);
  s=act(s,{type:'research',key:'atlas'});
  s=act(s,{type:'buy',key:'atlas'});
  s=act(s,{type:'buy',key:'probe'});
  s=act(s,{type:'assemble',parts:['atlas','probe'],name:'Explorer'});
  s.tech.atlas=0;
  return s;
}
test('purchase and assembly preserve mass and charge correct budget',()=>{
  const s=launchReady(); assert.equal(s.money,8); assert.equal(mass(s.crafts[0].parts),5); assert.deepEqual(s.stock,[]);
});
test('invalid action leaves original state untouched',()=>{
  const s=launchReady(),before=structuredClone(s);
  assert.throws(()=>act(s,{type:'maneuver',craft:1,route:999,rockets:[0]}),/No such maneuver/);
  assert.deepEqual(s,before);
  assert.throws(()=>act(s,{type:'buy',key:'saturn'}),/Research/);
  assert.throws(()=>act(s,{type:'assemble',parts:['probe']}),/inventory/);
});
test('Soyuz launches probe at exact thrust threshold and is consumed',()=>{
  let s=launchReady(); s.crafts[0].parts=['soyuz','probe'];s.tech.soyuz=0;
  s=act(s,{type:'maneuver',craft:1,route:0,rockets:[0]});
  assert.equal(s.crafts[0].location,'Earth orbit'); assert.deepEqual(s.crafts[0].parts,['probe']); assert.equal(s.score,1);
  assert.equal(validateSave(s).score,1);
});
test('duplicate rocket indices rejected',()=>{
  assert.throws(()=>act(launchReady(),{type:'maneuver',craft:1,route:0,rockets:[0,0]}),/Invalid rocket/);
});
test('randomness is repeatable and state input remains immutable',()=>{
  const s=launchReady();s.tech.atlas=['success','minor','major'];
  const action={type:'maneuver',craft:1,route:0,rockets:[0],outcomeDecisions:[false]};
  assert.deepEqual(act(s,action),act(s,action)); assert.equal(s.money,8);
});
test('funding resets, travel arrives, final year ends campaign',()=>{
  let s=launchReady(); s.crafts[0].location='Earth orbit';s.crafts[0].destination='Mars orbit';s.crafts[0].eta=2;
  s=act(s,{type:'year'}); assert.equal(s.money,25);assert.equal(s.crafts[0].eta,1);
  s=act(s,{type:'year'});assert.equal(s.crafts[0].location,'Mars orbit');
  s.year=1976;s=act(s,{type:'year'});assert.equal(s.ended,true);assert.throws(()=>act(s,{type:'year'}),/ended/);
});
test('crew supplies and life support are automatic',()=>{
  let s=launchReady();s.tech.life=0;s.crafts[0].location='Moon';s.crafts[0].parts=['capsule','astronaut','supplies'];
  s=act(s,{type:'year'});assert.deepEqual(s.crafts[0].parts,['capsule','astronaut']);
  s=act(s,{type:'year'});assert.deepEqual(s.crafts[0].parts,['capsule']);
});
test('sample adds mass and cannot be collected twice',()=>{
  let s=launchReady();s.crafts[0].location='Moon';const old=mass(s.crafts[0].parts);
  s=act(s,{type:'collect',craft:1});assert.equal(mass(s.crafts[0].parts),old+1);
  assert.throws(()=>act(s,{type:'collect',craft:1}),/already/);
});
test('planner stages execute with fully reliable technologies',()=>{
  const p=plan(['probe'],[0,2,4]);
  let s=launchReady();s.crafts[0].parts=p.parts;s.tech={atlas:0,juno:0,soyuz:0,saturn:0,landing:0};
  for(const stage of p.stages){
    assert.ok(stage.thrust>=stage.required);
    const available=[...s.crafts[0].parts];const rockets=stage.rockets.map(key=>{const i=available.indexOf(key);available[i]=null;return i;});
    s=act(s,{type:'maneuver',craft:1,route:stage.route.id,rockets});
  }
  assert.equal(s.crafts[0].location,'Moon');assert.deepEqual(s.crafts[0].parts,['probe']);assert.equal(s.score,3);
  assert.throws(()=>plan(['probe'],[0,5]),/connected/);
});
test('saves roundtrip, recover previous save, reject malformed imports',()=>{
  const entries=new Map();const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
  const s=newGame(1);save(storage,s);save(storage,act(s,{type:'year'}));
  assert.equal(load(storage).state.year,1957);
  entries.set('leaving-earth.prototype.v1','broken');const recovery=load(storage);assert.equal(recovery.recovered,true);assert.equal(recovery.state.year,1956);
  assert.deepEqual(importSave(JSON.stringify(s)),s);
  assert.throws(()=>importSave('{}'),/header/);
  assert.throws(()=>validateSave({...s,score:100}),/score/);
});
test('server serves app assets but not references, traversal or writes',async t=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/','/app.js','/engine.js','/data.js','/planner.js','/storage.js','/outcomes.js','/mission-plans.js','/style.css']){const r=await fetch(base+path);assert.equal(r.status,200);assert.ok((await r.text()).length>0);assert.ok(r.headers.get('content-security-policy'));}
  for(const path of ['/package.json','/../server.js','/.git/config'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,404);
});