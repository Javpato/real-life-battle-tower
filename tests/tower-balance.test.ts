import {it,expect} from 'vitest';
import {initialSave,applyCommand,effectiveness,stab,activeSeries,skillTypes} from '../src/tower/engine';
import {SKILL_BY_ID} from '../src/tower/catalog';
import {generateFloor} from '../src/tower/generation';
import type {Element,PlayerSave,TowerCommand,TowerRun} from '../src/tower/model';
const strongest=['single-leg-squat','diamond','advanced-birddog','archer-pushup'];
function simulate(floor:number,specialization:Element|null,seed:number){
 let id=0;const context={uuid:()=>`balance-${++id}`,now:()=>1000};
 let save=initialSave('Balance','male',true);save.loadout=strongest;save.specialization=specialization;
 const send=(command:TowerCommand)=>{save=applyCommand(save,command,context);};
 send({kind:'startRun',mode:'endless',floor,seed});send({kind:'startFloor'});
 let responses=0,series=0,units=0;
 for(let guard=0;guard<500;guard++){
  const r=save.activity as TowerRun,b=r.battle!;
  if(b.turn==='won'||b.turn==='lost')return {floor,specialization,seed,won:b.turn==='won',hp:b.playerHp,enemyHp:b.enemyHp,responses,series,units};
  if(b.turn==='player'){
   const skills=r.loadout.map(id=>SKILL_BY_ID[id]);
   skills.sort((a,c)=>c.damage*effectiveness(skillTypes(c),b.enemy.phases[b.phase])*stab(c.type,r.specialization)*(1-Math.min(.4,.15*b.fatigue[c.type]))-a.damage*effectiveness(skillTypes(a),b.enemy.phases[b.phase])*stab(a.type,r.specialization)*(1-Math.min(.4,.15*b.fatigue[a.type])));
   send({kind:'beginAttack',skillId:skills[0].id});series++;
  }else if(b.turn==='exercise'){send({kind:'manualUnit',sessionId:activeSeries(save)!.id});units++;}
  else if(b.turn==='transform')send({kind:'continuePhase'});
  else if(b.turn==='enemy'){send({kind:'resolveEnemy'});responses++;}
 }
 throw Error('Balance simulation did not terminate');
}
it('allows strongest legal four-skill manual play through bounded high-floor bosses',()=>{
 const results=[];
 for(const floor of [10,100,1000,999_999_995,1_000_000_000])for(const specialization of [null,'leg','arm','back','core','cardio','mobility'] as const)for(const seed of Array.from({length:12},(_,i)=>i+1))results.push(simulate(floor,specialization,seed));
 console.log(JSON.stringify({simulations:results.length,minHp:Math.min(...results.map(r=>r.hp)),maxResponses:Math.max(...results.map(r=>r.responses)),failures:results.filter(r=>!r.won)}));
 expect(results.filter(r=>!r.won)).toEqual([]);
});

it('caps three-phase boss pressure without flattening normal and miniboss progression',()=>{
 expect(generateFloor(42,1_000_000_000).attack).toBe(8);expect(generateFloor(42,999_999_999).attack).toBe(12);expect(generateFloor(42,999_999_995).attack).toBe(8);
});
