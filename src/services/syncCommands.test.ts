import {describe,it,expect} from 'vitest';
import {applyAdventureCommand,initialAdventure,type AdventureSnapshot} from '../core/commands';
import {attacks} from '../core/game';
const command=applyAdventureCommand;
function winTrainer(s=initialAdventure()):AdventureSnapshot {
 s=command(s,{kind:'startBattle',enemyId:'trainer-1',specialization:null});
 let guard=0;
 while(s.battle&&s.battle.turn!=='won'&&guard++<100){
  if(s.battle.turn==='enemy')s=command(s,{kind:'resolveEnemy'});
  else if(s.battle.turn==='player')s=command(s,{kind:'beginAttack',attackId:'squat'});
  else if(s.battle.turn==='exercise')s=command(s,{kind:'manualRemaining',sessionId:s.battle.sessionId});
 }
 return command(s,{kind:'finishBattle'});
}
describe('authoritative adventure commands',()=>{
 it('plays a battle to a server-derived reward without accepting arbitrary XP',()=>{const s=winTrainer();expect(s.player.defeated).toContain('trainer-1');expect(s.player.coins).toBe(70);expect(s.battle).toBeNull();expect(()=>command(s,{kind:'grantXP',xp:999} as never)).toThrow('UNKNOWN_COMMAND');});
 it('blocks skipping the rival, locked skills and free rewards',()=>{const s=initialAdventure();expect(()=>command(s,{kind:'startBattle',enemyId:'rival',specialization:null})).toThrow('RIVAL_LOCKED');expect(()=>command(s,{kind:'equip',attackIds:['quake']})).toThrow('INVALID_LOADOUT');expect(()=>command(s,{kind:'finishBattle'})).toThrow('BATTLE_NOT_FINISHED');expect(()=>command(s,{kind:'finishQuest'})).toThrow('QUEST_NOT_FINISHED');});
 it('prices purchases centrally and prevents prototype item names',()=>{let s=initialAdventure();s=command(s,{kind:'purchaseItem',item:'shield'});expect(s.player.coins).toBe(38);expect(s.player.items.shield).toBe(2);expect(()=>command(s,{kind:'purchaseItem',item:'__proto__'} as never)).toThrow();});
 it('fences stale exercise units and never changes pause damage',()=>{let s=command(initialAdventure(),{kind:'startBattle',enemyId:'trainer-1',specialization:null});s=command(s,{kind:'beginAttack',attackId:'squat'});const unit={id:'unit-1',exerciseId:'squat' as const,quality:1,confidence:1,verified:true,timestamp:10};expect(()=>command(s,{kind:'exerciseUnit',sessionId:'old',unit})).toThrow('STALE_EXERCISE_SESSION');s=command(s,{kind:'pause',paused:true});const hp=s.battle!.enemyHp;const next=command(s,{kind:'exerciseUnit',sessionId:s.battle!.sessionId,unit});expect(next.battle!.enemyHp).toBe(hp);});
 it('credits a quest only after its target and only once',()=>{let s=command(initialAdventure(),{kind:'startQuest',exercise:'lunge'});const id=s.quest!.id;expect(()=>command(s,{kind:'finishQuest'})).toThrow();s=command(s,{kind:'manualQuest',sessionId:id});s=command(s,{kind:'finishQuest'});expect(s.player.quests.lunge).toBe(1);expect(s.player.coins).toBe(62);expect(()=>command(s,{kind:'finishQuest'})).toThrow();});
 it('keeps duplicate food discoveries from granting extra ingredients',()=>{let s=initialAdventure();s=command(s,{kind:'discoverFood',barcode:'3017620422003'});s=command(s,{kind:'discoverFood',barcode:'3017620422003'});expect(s.player.items.ingredient).toBe(1);});
 it('uses exactly the central attack definitions',()=>{let s=command(initialAdventure(),{kind:'startBattle',enemyId:'trainer-1',specialization:null});s=command(s,{kind:'beginAttack',attackId:'squat'});expect(s.battle!.attack).toEqual(attacks.find(a=>a.id==='squat'));});
});
