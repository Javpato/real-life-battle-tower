import type {TowerEnemy,Element,Challenge} from './model';
export const MAX_FLOOR=1_000_000_000;
export const GENERATOR_VERSION=2;
import {TYPES} from './typeChart';
export {TYPES} from './typeChart';
const LEGACY_TYPES:Element[]=['leg','arm','back'];
export const normalizeSeed=(seed:number)=>Number.isSafeInteger(seed)?((seed%2147483646)+2147483646)%2147483646+1:1;
export const nextRandom=(seed:number)=>(seed*16807)%2147483647;
/** Separate immutable floor seed from the mutable battle RNG. Safe through floor 1e9. */
export function generateLegacyFloor(seed:number,floor:number,mode:'endless'|'challenge'|Challenge='endless'):TowerEnemy{
 if(!Number.isSafeInteger(floor)||floor<1||floor>MAX_FLOOR)throw Error('INVALID_FLOOR');
 const config=typeof mode==='object'?mode:undefined;
 const r=nextRandom(normalizeSeed(normalizeSeed(seed)+floor*104729));
 const pool=config?.types??LEGACY_TYPES,type=pool[r%pool.length],other=LEGACY_TYPES[(LEGACY_TYPES.indexOf(type)+1)%3];
 const boss=!!config?.bossEvery&&floor%config.bossEvery===0||floor%10===0||!!config&&floor===config.floors;
 const mini=!boss&&floor%5===0;
 const base=Math.min(240,Math.round(40+3*Math.sqrt(floor-1)+6*Math.log2(floor)));
 const hp=Math.round(base*(boss?1.8:mini?1.35:1));
 const phases:Element[][]=boss?[[type],[type,other],[other,LEGACY_TYPES[(LEGACY_TYPES.indexOf(other)+1)%3]]]:mini?[[type],[type,other]]:[[type]];
 // Three-phase bosses can demand eight responses at the bounded HP ceiling.
 // With fixed player HP and no levels, cap their attack so strategic manual play remains viable.
 const names=['Terra','Flint','Zephyr'],i=LEGACY_TYPES.indexOf(type);
 return {id:`floor-${floor}`,name:boss?(floor%50===0&&floor%100!==0?'Aster':'Rowan'):mini?names[i]:['Sprig','Cinder','Cirrus'][i],title:boss?'Tower keeper':mini?'Floor guardian':'Tower challenger',artId:boss?(floor%50===0&&floor%100!==0?'warden':'rival'):mini?`leader-${type}`:`trainer-${i+1}`,hp,attack:Math.min(boss?8:12,6+Math.floor(Math.log2(floor+1)/2)),defense:20,speed:10,phases,thresholds:boss?[Math.round(hp*.67),Math.round(hp*.34),0]:mini?[Math.round(hp*.5),0]:[0],boss:boss||mini};
}

const BOSS_TYPES:Element[][]=[['leg'],['arm'],['back'],['core'],['cardio'],['mobility'],['leg','arm'],['leg','back'],['leg','core'],['leg','cardio'],['leg','mobility'],['arm','back'],['arm','core'],['arm','cardio'],['arm','mobility'],['back','core'],['back','cardio'],['back','mobility'],['core','mobility'],['core','cardio']];
const BOSS_NAMES=['Terra','Flint','Zephyr','Axiom','Tempo','Willow','Forge','Granite','Bastion','Volt','Reed','Atlas','Anchor','Blaze','Sable','Cairn','Nimbus','Aster','Solstice','Zenith'];
const NORMAL_NAMES:Record<Element,string[]>={leg:['Briar','Dash','Flora','Kestrel','Mica','Vale'],arm:['Ember','Rook','Coral','Brass','Indigo','Nori'],back:['Gale','Pine','Lark','Dune','Harbor','Wren'],core:['Onyx','Lyra','Echo','Fenn','Iris','Quartz'],cardio:['Cinder','Zip','Nova','Spark','Jett','Sunny'],mobility:['Lotus','Fern','Sage','Moss','Ripple','Juniper']};
export function generateFloor(seed:number,floor:number,mode:'endless'|'challenge'|Challenge='endless',version:1|2=2):TowerEnemy{
 if(version===1)return generateLegacyFloor(seed,floor,mode);
 if(!Number.isSafeInteger(floor)||floor<1||floor>MAX_FLOOR)throw Error('INVALID_FLOOR');
 const config=typeof mode==='object'?mode:undefined;
 const normalized=normalizeSeed(seed);
 const pool=config?.types??TYPES;
 // A coprime traversal of 36 identities avoids consecutive identical archetypes without storing history.
 const index=(normalized+floor*17)%36,type=pool[Math.floor(index/6)%pool.length],variant=index%6+1;
 const boss=floor%5===0||!!config&&(floor===config.floors||!!config.bossEvery&&floor%config.bossEvery===0);
 const bossIndex=(Math.max(1,Math.ceil(floor/5))-1)%20;
 const base=Math.min(240,Math.round(40+3*Math.sqrt(floor-1)+6*Math.log2(floor)));
 const hp=Math.round(base*(boss?1.8:1));
 let phases:Element[][]=[[type]];
 if(boss){
  const discipline=config?.types.length===1?config.types[0]:undefined;
  const primary=discipline?[discipline]:BOSS_TYPES[bossIndex];
  const next=TYPES[(TYPES.indexOf(primary[0])+1)%TYPES.length];
  phases=discipline?[[discipline],[discipline]]:floor%100===0?[['leg','arm'],['back','core'],['cardio','mobility']]:[primary,[primary[0],next]];
  if(floor%10===0&&floor%100!==0)phases.push(discipline?[discipline]:[next,TYPES[(TYPES.indexOf(next)+1)%6]]);
 }
 const thresholds=phases.map((_,i)=>i===phases.length-1?0:Math.round(hp*(phases.length-i-1)/phases.length));
 return {id:`floor-${floor}`,name:boss?BOSS_NAMES[bossIndex]:NORMAL_NAMES[type][variant-1],title:boss?(bossIndex===19?'Centennial sovereign':'Tower keeper'):'Tower challenger',artId:boss?`boss-${String(bossIndex+1).padStart(2,'0')}`:`normal-${type}-${variant}`,hp,attack:Math.min(boss?8:12,6+Math.floor(Math.log2(floor+1)/2)),defense:20,speed:10,phases,thresholds,boss};
}
