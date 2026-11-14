// GENERATED. Edit src/tower, then run supabase/sync-core.mjs.
import type {TowerEnemy,Element,Challenge} from './model.ts';
export const MAX_FLOOR=1_000_000_000;
export const GENERATOR_VERSION=1;
export const TYPES:Element[]=['leg','arm','back'];
export const normalizeSeed=(seed:number)=>Number.isSafeInteger(seed)?((seed%2147483646)+2147483646)%2147483646+1:1;
export const nextRandom=(seed:number)=>(seed*16807)%2147483647;
/** Separate immutable floor seed from the mutable battle RNG. Safe through floor 1e9. */
export function generateFloor(seed:number,floor:number,mode:'endless'|'challenge'|Challenge='endless'):TowerEnemy{
 if(!Number.isSafeInteger(floor)||floor<1||floor>MAX_FLOOR)throw Error('INVALID_FLOOR');
 const config=typeof mode==='object'?mode:undefined;
 const r=nextRandom(normalizeSeed(normalizeSeed(seed)+floor*104729));
 const pool=config?.types??TYPES,type=pool[r%pool.length],other=TYPES[(TYPES.indexOf(type)+1)%3];
 const boss=!!config?.bossEvery&&floor%config.bossEvery===0||floor%10===0||!!config&&floor===config.floors;
 const mini=!boss&&floor%5===0;
 const base=Math.min(240,Math.round(40+3*Math.sqrt(floor-1)+6*Math.log2(floor)));
 const hp=Math.round(base*(boss?1.8:mini?1.35:1));
 const phases:Element[][]=boss?[[type],[type,other],[other,TYPES[(TYPES.indexOf(other)+1)%3]]]:mini?[[type],[type,other]]:[[type]];
 // Three-phase bosses can demand eight responses at the bounded HP ceiling.
 // With fixed player HP and no levels, cap their attack so strategic manual play remains viable.
 const names=['Terra','Flint','Zephyr'],i=TYPES.indexOf(type);
 return {id:`floor-${floor}`,name:boss?(floor%50===0&&floor%100!==0?'Aster':'Rowan'):mini?names[i]:['Sprig','Cinder','Cirrus'][i],title:boss?'Tower keeper':mini?'Floor guardian':'Tower challenger',artId:boss?(floor%50===0&&floor%100!==0?'warden':'rival'):mini?`leader-${type}`:`trainer-${i+1}`,hp,attack:Math.min(boss?8:12,6+Math.floor(Math.log2(floor+1)/2)),defense:20,speed:10,phases,thresholds:boss?[Math.round(hp*.67),Math.round(hp*.34),0]:mini?[Math.round(hp*.5),0]:[0],boss:boss||mini};
}
