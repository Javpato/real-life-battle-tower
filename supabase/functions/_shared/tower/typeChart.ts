// GENERATED. Edit src/tower, then run supabase/sync-core.mjs.
import type {Element,Skill} from './model.ts';
export const TYPES:Element[]=['leg','arm','back','core','cardio','mobility'];
export const TYPE_NAMES:Record<Element,string>={leg:'Leg',arm:'Arm',back:'Back',core:'Core',cardio:'Cardio',mobility:'Mobility'};
export const TYPE_CHART:Record<Element,Record<Element,number>>={
 leg:{leg:1,arm:1.5,back:.75,core:1.5,cardio:1,mobility:.75},
 arm:{leg:.75,arm:1,back:1.5,core:.75,cardio:1.5,mobility:1},
 back:{leg:1.5,arm:.75,back:1,core:1,cardio:.75,mobility:1.5},
 core:{leg:.75,arm:1.5,back:1,core:1,cardio:1.5,mobility:.75},
 cardio:{leg:1,arm:.75,back:1.5,core:.75,cardio:1,mobility:1.5},
 mobility:{leg:1.5,arm:1,back:.75,core:1.5,cardio:.75,mobility:1},
};
export const skillTypes=(skill:Skill):Element[]=>skill.types??[skill.type];
/** Offensive hybrids average coverage, never sum two complete attacks. */
export function effectiveness(type:Element|readonly Element[],targets:readonly Element[]):number{
 const attacking=typeof type==='string'?[type]:[...new Set(type)];
 const defending=[...new Set(targets)];
 if(attacking.length<1||attacking.length>2||defending.length>2||[...attacking,...defending].some(t=>!TYPES.includes(t)))throw Error('INVALID_TYPES');
 return Math.max(.5625,Math.min(2.25,attacking.reduce((sum,t)=>sum+defending.reduce((n,d)=>n*TYPE_CHART[t][d],1),0)/attacking.length));
}
export const stab=(types:Element|readonly Element[],specialization:Element|null)=>specialization&&(typeof types==='string'?[types]:types).includes(specialization)?1.25:1;
