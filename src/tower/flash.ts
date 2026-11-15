import type {ExerciseUnit} from '../core/contracts';

/** Shared pacing policy for Flash trials, battle bonuses and the timer display.
 * These are game acceptance bounds, not a prescribed exercise speed. A pause
 * never earns progress or consumes an opportunity; a new complete cycle can retry.
 */
export const FLASH_TIMING = {
 minCycleMs:700,
 maxCycleMs:12000,
 minQuality:.5,
 minConfidence:.5,
 referenceReps:3,
 testReps:6,
 minCadenceFactor:.5,
 maxCadenceFactor:1.75,
} as const;

export type FlashCadenceWindow={minMs:number;maxMs:number;referenceMs:number|null};
export type FlashRejection='manual'|'missing-cycle'|'invalid-clock'|'interrupted'|'low-confidence'|'low-quality'|'overlap'|'too-fast'|'too-slow';
export type FlashAssessment={accepted:true;durationMs:number}|{accepted:false;durationMs:number|null;reason:FlashRejection};

/** No baseline means the broad reference range. Invalid saved values cannot
 * enlarge the global bounds or produce an unbounded timer.
 */
export function flashCadenceWindow(cadenceMs?:number):FlashCadenceWindow {
 const referenceMs=typeof cadenceMs==='number'&&Number.isFinite(cadenceMs)&&cadenceMs>=FLASH_TIMING.minCycleMs&&cadenceMs<=FLASH_TIMING.maxCycleMs?cadenceMs:null;
 return {
  minMs:referenceMs===null?FLASH_TIMING.minCycleMs:Math.max(FLASH_TIMING.minCycleMs,referenceMs*FLASH_TIMING.minCadenceFactor),
  maxMs:referenceMs===null?FLASH_TIMING.maxCycleMs:Math.min(FLASH_TIMING.maxCycleMs,referenceMs*FLASH_TIMING.maxCadenceFactor),
  referenceMs,
 };
}

/** Timing comes only from an uninterrupted detector-observed full cycle.
 * The HUD may inspect this result but cannot manufacture exercise units from a timer.
 */
export function assessFlashCycle(unit:ExerciseUnit,cadenceMs?:number,previousEnd?:number):FlashAssessment {
 const reject=(reason:FlashRejection,durationMs:number|null=null):FlashAssessment=>({accepted:false,durationMs,reason});
 if(unit.verified!==true)return reject('manual');
 const cycle=unit.cycle;
 if(!cycle)return reject('missing-cycle');
 if(cycle.clockId!==undefined&&(typeof cycle.clockId!=='string'||!cycle.clockId.length||cycle.clockId.length>200))return reject('invalid-clock');
 if(!Number.isFinite(cycle.startedAt)||!Number.isFinite(cycle.endedAt)||!Number.isFinite(unit.timestamp)||cycle.startedAt<0||cycle.endedAt<=cycle.startedAt||cycle.endedAt!==unit.timestamp)return reject('invalid-clock');
 const durationMs=cycle.endedAt-cycle.startedAt;
 if(cycle.uninterrupted!==true)return reject('interrupted',durationMs);
 if(!Number.isFinite(unit.confidence)||unit.confidence<FLASH_TIMING.minConfidence||unit.confidence>1)return reject('low-confidence',durationMs);
 if(!Number.isFinite(unit.quality)||unit.quality<FLASH_TIMING.minQuality||unit.quality>1)return reject('low-quality',durationMs);
 if(previousEnd!==undefined&&(!Number.isFinite(previousEnd)||cycle.startedAt<previousEnd))return reject('overlap',durationMs);
 const window=flashCadenceWindow(cadenceMs);
 if(durationMs<window.minMs)return reject('too-fast',durationMs);
 if(durationMs>window.maxMs)return reject('too-slow',durationMs);
 return {accepted:true,durationMs};
}
