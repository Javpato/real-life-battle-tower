import {it,expect} from 'vitest';
import {initialSave,applyCommand} from '../src/tower/engine';
import type {PlayerSave,TowerCommand,TowerRun} from '../src/tower/model';
let id=0;
const send=(s:PlayerSave,c:TowerCommand)=>applyCommand(s,c,{uuid:()=>`safe-${++id}`,now:()=>1000});
const ready=()=>send(initialSave('QA','male',true),{kind:'startRun',mode:'endless',seed:42});
const loadout=['squat','pushup','superman','birddog'];
function changeBoth(s:PlayerSave){s=send(s,{kind:'equip',skillIds:loadout});return send(s,{kind:'specialize',type:'back'});}
function assertBoth(s:PlayerSave){const r=s.activity as TowerRun;expect(s.loadout).toEqual(loadout);expect(r.loadout).toEqual(loadout);expect(s.specialization).toBe('back');expect(r.specialization).toBe('back');expect(r.loadout).not.toBe(s.loadout);}
it('updates profile and endless-run loadout at the ready safe point without starting a fight',()=>{
 const before=ready(),s=changeBoth(before);assertBoth(s);expect((s.activity as TowerRun).status).toBe('ready');expect((s.activity as TowerRun).battle).toBeNull();expect(before.loadout).not.toEqual(s.loadout);
 const started=send(s,{kind:'startFloor'});expect((started.activity as TowerRun).specialization).toBe('back');expect(()=>send(started,{kind:'beginAttack',skillId:'squat'})).not.toThrow();
});
it('changes both snapshots between floors while preserving HP, seed, progress and records',()=>{
 let s=send(ready(),{kind:'startFloor'});const b=(s.activity as TowerRun).battle!;b.enemyHp=0;b.turn='won';b.playerHp=50;
 s=send(s,{kind:'settleFloor',battleId:b.id});const before=structuredClone(s),r=s.activity as TowerRun;
 expect(r.status).toBe('between');s=changeBoth(s);assertBoth(s);
 for(const key of ['hp','seed','floor','lastSettledFloor','cleared','id'] as const)expect((s.activity as TowerRun)[key]).toEqual((before.activity as TowerRun)[key]);expect(s.records).toEqual(before.records);
 s=send(s,{kind:'specialize',type:null});expect(s.specialization).toBeNull();expect((s.activity as TowerRun).specialization).toBeNull();
});
it.each(['battle','trial','workout','challenge-ready','challenge-between'] as const)('rejects gear and specialization changes during %s',state=>{
 let s=initialSave('QA','male',true);
 if(state==='battle')s=send(send(s,{kind:'startRun',mode:'endless'}),{kind:'startFloor'});
 if(state==='trial')s=send(s,{kind:'startTrial',skillId:'mini-squat'});
 if(state==='workout')s=send(s,{kind:'startWorkout',entries:[{skillId:'squat',target:3}]});
 if(state.startsWith('challenge')){s=send(s,{kind:'startRun',mode:'challenge',challengeId:'leg'});if(state==='challenge-between'){s=send(s,{kind:'startFloor'});const b=(s.activity as TowerRun).battle!;b.enemyHp=0;b.turn='won';s=send(s,{kind:'settleFloor',battleId:b.id});}}
 const before=structuredClone(s);
 expect(()=>send(s,{kind:'equip',skillIds:loadout})).toThrow('CHANGE_LOADOUT_AT_SAFE_POINT');expect(()=>send(s,{kind:'specialize',type:'back'})).toThrow('CHANGE_LOADOUT_AT_SAFE_POINT');expect(s).toEqual(before);
});
it('continues to enforce unlocked skills, unique slots and earned specialization at safe points',()=>{
 const s=ready();s.skills.diamond.unlocked=false;s.availableSpecializations=[];
 expect(()=>send(s,{kind:'equip',skillIds:['diamond']})).toThrow('INVALID_LOADOUT');expect(()=>send(s,{kind:'equip',skillIds:['squat','squat']})).toThrow('INVALID_LOADOUT');expect(()=>send(s,{kind:'equip',skillIds:[]})).toThrow('INVALID_LOADOUT');expect(()=>send(s,{kind:'specialize',type:'back'})).toThrow('SPECIALIZATION_LOCKED');
});
