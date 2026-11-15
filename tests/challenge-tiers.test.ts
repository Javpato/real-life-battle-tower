import {describe,it,expect} from 'vitest';
import {CHALLENGES,LEGACY_CHALLENGES,challengeAvailable,getRunChallenge,SKILL_BY_ID} from '../src/tower/catalog';
import {initialSave,applyCommand,activeSeries} from '../src/tower/engine';
import type {PlayerSave,TowerCommand,TowerRun} from '../src/tower/model';
let seq=0;
const send=(s:PlayerSave,c:TowerCommand)=>applyCommand(s,c,{uuid:()=>`tier-${++seq}`,now:()=>1000});
const run=(s:PlayerSave)=>s.activity as TowerRun;
function winFloor(s:PlayerSave){s=send(s,{kind:'startFloor'});const b=run(s).battle!;b.turn='won';b.enemyHp=0;return send(s,{kind:'settleFloor',battleId:b.id});}
describe('temporary challenge access and five-floor progression',()=>{
 it('starts all ten easy challenges in a fresh save with four valid assigned attacks',()=>{
  const easy=CHALLENGES.filter(c=>c.tier==='easy');expect(easy).toHaveLength(10);
  for(const c of easy){
   let s=initialSave();const ownership=Object.fromEntries(Object.entries(s.skills).map(([id,p])=>[id,p.unlocked]));
   expect(challengeAvailable(s,c.id)).toBe(true);expect(new Set(c.skillIds).size).toBe(4);
   for(const id of c.skillIds)expect(SKILL_BY_ID[id]).toBeDefined();
   s=send(s,{kind:'startRun',mode:'challenge',challengeId:c.id});s=send(s,{kind:'startFloor'});
   for(const id of c.skillIds){const attacked=send(s,{kind:'beginAttack',skillId:id});expect(activeSeries(attacked)!.skillId).toBe(id);}
   expect(Object.fromEntries(Object.entries(s.skills).map(([id,p])=>[id,p.unlocked]))).toEqual(ownership);
  }
 });
 it('unlocks only the matching hard challenge after floor five and grants specialization once',()=>{
  let s=initialSave();expect(challengeAvailable(s,'leg')).toBe(false);expect(()=>send(s,{kind:'startRun',mode:'challenge',challengeId:'leg'})).toThrow('CHALLENGE_LOCKED');
  s=send(s,{kind:'startRun',mode:'challenge',challengeId:'leg-easy'});
  for(let i=0;i<4;i++){s=winFloor(s);expect(challengeAvailable(s,'leg')).toBe(false);}
  s=winFloor(s);expect(run(s).status).toBe('complete');expect(challengeAvailable(s,'leg')).toBe(true);expect(challengeAvailable(s,'arm')).toBe(false);
  expect(s.availableSpecializations).toEqual(['leg']);expect(s.records['challenge:leg-easy'].wins).toBe(1);
  s=send(s,{kind:'closeActivity'});s=send(s,{kind:'startRun',mode:'challenge',challengeId:'leg'});
  expect(run(s).loadout).toEqual(CHALLENGES.find(c=>c.id==='leg-easy')!.skillIds);
 });
 it('cannot permanently equip a borrowed move or use it in Infinite Tower after abandoning',()=>{
  let s=initialSave();s=send(s,{kind:'startRun',mode:'challenge',challengeId:'arm-easy'});s=send(s,{kind:'startFloor'});
  s=send(s,{kind:'beginAttack',skillId:'wall-pushup'});s=send(s,{kind:'manualUnit',sessionId:activeSeries(s)!.id});
  expect(s.skills['wall-pushup'].unlocked).toBe(false);s=send(s,{kind:'abandon'});
  expect(()=>send(s,{kind:'equip',skillIds:['wall-pushup']})).toThrow('INVALID_LOADOUT');
  s=send(s,{kind:'startRun',mode:'endless'});s=send(s,{kind:'startFloor'});expect(()=>send(s,{kind:'beginAttack',skillId:'wall-pushup'})).toThrow('SKILL_NOT_EQUIPPED');
 });
 it('preserves legacy victories and active encounter definitions',()=>{
  let s=initialSave();s.records['challenge:mixed']={bestFloor:8,bestVerifiedFloor:0,runs:1,wins:1};expect(challengeAvailable(s,'mixed')).toBe(true);
  s=send(s,{kind:'startRun',mode:'challenge',challengeId:'mixed'});delete run(s).challengeTier;
  const legacy=LEGACY_CHALLENGES.find(c=>c.id==='mixed')!;expect(getRunChallenge(run(s))).toEqual(legacy);expect(getRunChallenge(run(s))!.floors).toBe(8);
  const original=structuredClone(s);s=send(s,{kind:'startFloor'});expect(run(s).battle!.enemy.hp).toBe(40);expect(original.records).toEqual(s.records);
 });
 it('makes hard opponents tougher while keeping the same movements',()=>{
  const s=initialSave();s.records['challenge:leg-easy']={bestFloor:5,bestVerifiedFloor:0,runs:1,wins:1};
  const easy=send(send(s,{kind:'startRun',mode:'challenge',challengeId:'leg-easy'}),{kind:'startFloor'});
  const hard=send(send(s,{kind:'startRun',mode:'challenge',challengeId:'leg'}),{kind:'startFloor'});
  expect(run(hard).battle!.enemy.hp).toBeGreaterThan(run(easy).battle!.enemy.hp);expect(run(hard).battle!.enemy.attack).toBeGreaterThan(run(easy).battle!.enemy.attack);
  expect(run(hard).loadout).toEqual(run(easy).loadout);
 });
});
