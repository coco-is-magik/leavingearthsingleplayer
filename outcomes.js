import {TECH} from './data.js';

export const random = s => { s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0; return s.seed/4294967296; };
export const outcomeCard = value => ['success','minor','major'].includes(value);
// Scenario supply composition; the local rulebook specifies 90 cards but does
// not enumerate the split. Keep this explicit rather than hiding probabilities.
const supply = () => [...Array(60).fill('success'),...Array(15).fill('minor'),...Array(15).fill('major')];

export function researchOutcomes(s,key) {
  s.outcomeSupply ??= supply(); s.outcomeDiscard ??= [];
  const cards=[];
  for(let i=0;i<(key==='synthesis'?5:3);i++) {
    if(!s.outcomeSupply.length) s.outcomeSupply=s.outcomeDiscard.splice(0);
    if(!s.outcomeSupply.length) throw new Error('No outcome cards remain.');
    cards.push(s.outcomeSupply.splice(Math.floor(random(s)*s.outcomeSupply.length),1)[0]);
  }
  return cards;
}

// Old prototype saves used failure counters, not actual outcome cards. Preserve
// fully reliable technologies; redraw uncertain ones once using the saved seed.
export function migrateOutcomes(s) {
  for(const [key,value] of Object.entries(s.tech)) if(typeof value==='number') s.tech[key]=value===0?[]:researchOutcomes(s,key);
}

export class OutcomeChoice extends Error {
  constructor(key,result,cost,money) { super('Choose whether to remove the drawn outcome.'); Object.assign(this,{key,result,cost,money}); }
}

export function drawOutcome(s,key) {
  if(!Object.hasOwn(s.tech,key)) throw new Error(`Research ${TECH[key]} first.`);
  const cards=s.tech[key];
  if(!cards.length) {s.lastOutcome='success';return true;}
  const index=Math.floor(random(s)*cards.length), result=cards[index];
  const cost=result==='success'?(cards.length===1?0:10):5;
  const decision=s.outcomeDecisions[s.outcomeCursor++];
  if(decision===undefined) throw new OutcomeChoice(key,result,cost,s.money);
  if(decision) {
    if(s.money<cost) throw new Error(`Removing this outcome requires $${cost}.`);
    s.money-=cost; cards.splice(index,1); (s.outcomeDiscard??=[]).push(result);
  }
  s.log.unshift(`${s.year} · ${TECH[key]}: ${result}; ${decision?`removed for $${cost}`:'returned to advancement'}.`);
  s.lastOutcome=result;
  return result==='success';
}