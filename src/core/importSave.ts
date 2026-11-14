import {normalizeAdventure,type AdventureSnapshot} from './commands';
import {attacks} from './game';
/** Explicit one-time import. Called only by the server for an owner's empty save. */
export function validateLocalImport(value:unknown):AdventureSnapshot{
 if(!value||typeof value!=='object')throw Error('INVALID_LOCAL_SAVE');
 const s=structuredClone(value) as AdventureSnapshot,p=s.player;
 if(!p||s.battle||s.quest)throw Error('FINISH_CURRENT_ACTIVITY');
 const integer=(n:unknown,max=10000000)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=max;
 if(typeof p.name!=='string'||!p.name.trim()||p.name.length>20||!['easy','medium','hard'].includes(p.difficulty))throw Error('INVALID_LOCAL_CHARACTER');
 for(const key of ['hp','maxHp','attack','defense','speed','level','xp','coins'] as const)if(!integer(p[key]))throw Error('INVALID_LOCAL_STATS');
 if(p.level<1||p.maxHp<1||p.hp>p.maxHp)throw Error('INVALID_LOCAL_STATS');
 const strings=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max&&v.every(x=>typeof x==='string'&&x.length<=200)&&new Set(v).size===v.length;
 if(!strings(p.badges,3)||p.badges.some(b=>!['leg','arm','back'].includes(b))||!strings(p.equipped,4)||!p.equipped.length||p.equipped.some(id=>!attacks.some(a=>a.id===id)))throw Error('INVALID_LOCAL_LOADOUT');
 if(!strings(p.defeated,100)||!strings(p.discoveries,10000)||!strings(p.claimedBattles??[],10000)||typeof p.ending!=='boolean')throw Error('INVALID_LOCAL_PROGRESS');
 for(const record of [p.items,p.upgrades,p.quests])if(!record||typeof record!=='object'||Object.keys(record).length>100||Object.entries(record).some(([k,n])=>k.length>100||!integer(n)))throw Error('INVALID_LOCAL_INVENTORY');
 if(Object.entries(p.upgrades).some(([id,n])=>!attacks.some(a=>a.id===id)||n>4))throw Error('INVALID_LOCAL_UPGRADE');
 if(s.journey&&(!['male','female'].includes(s.journey.avatar)||typeof s.journey.introComplete!=='boolean'||!integer(s.journey.tutorialStage,6)||!integer(s.journey.playSeconds,100000000)))throw Error('INVALID_LOCAL_JOURNEY');
 return normalizeAdventure({player:p,battle:null,quest:null,journey:s.journey});
}
