import {initialSave} from './engine';
import {SKILLS,SKILL_BY_ID,CHALLENGES} from './catalog';
import {MAX_FLOOR,TYPES} from './generation';
import type {Element,HistoryEntry,PlayerSave,WorkoutEntryResult} from './model';

function requireImport(ok:unknown,error='INVALID_TOWER_IMPORT'):asserts ok {if(!ok)throw Error(error);}
function object(v:unknown):Record<string,unknown>{requireImport(v!==null&&typeof v==='object'&&!Array.isArray(v));const p=Object.getPrototypeOf(v);requireImport(p===Object.prototype||p===null);return v as Record<string,unknown>;}
function number(v:unknown,max=1e12,min=0):number{requireImport(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max);return v;}
function integer(v:unknown,max=1e9,min=0){const n=number(v,max,min);requireImport(Number.isSafeInteger(n));return n;}
function string(v:unknown,max=200):string{requireImport(typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v));return v;}
function bool(v:unknown){requireImport(typeof v==='boolean');return v;}
function array(v:unknown,max:number):unknown[]{requireImport(Array.isArray(v)&&v.length<=max);return v;}
function uniqueStrings(v:unknown,max:number,length=200){const a=array(v,max).map(x=>string(x,length));requireImport(new Set(a).size===a.length);return a;}
function skillId(v:unknown){const id=string(v,60);requireImport(Object.hasOwn(SKILL_BY_ID,id),'UNKNOWN_IMPORT_SKILL');return id;}
function type(v:unknown):Element {requireImport(typeof v==='string'&&TYPES.includes(v as Element));return v as Element;}
function exactKeys(v:Record<string,unknown>,keys:string[]){requireImport(Object.keys(v).every(k=>keys.includes(k)));}
function entryResult(raw:unknown):WorkoutEntryResult{
 const r=object(raw);exactKeys(r,['skillId','target','units','verified','manual','quality','completion','stars','technicalStars','activeSecondsEstimate']);const id=skillId(r.skillId),target=integer(r.target,1000,1),units=integer(r.units,target),verified=integer(r.verified,units),manual=integer(r.manual,units);
 requireImport(verified+manual===units);const completion=r.completion;requireImport(completion==='complete'||completion==='partial'||completion==='skipped');
 requireImport(completion==='complete'?units===target:completion==='skipped'?units===0:units>0&&units<target);
 integer(r.stars,3);if(r.activeSecondsEstimate!==null)number(r.activeSecondsEstimate);
 if(r.quality!==null){const q=object(r.quality);exactKeys(q,['samples','mean','minimum','standardDeviation','metric']);const samples=integer(q.samples,units,1),mean=number(q.mean,1),minimum=number(q.minimum,1);requireImport(samples===verified&&minimum<=mean&&(q.metric==='movement-control'||q.metric==='observed-amplitude'));number(q.standardDeviation,1);}
 if(r.technicalStars!==null){const t=object(r.technicalStars);exactKeys(t,['control','consistency']);requireImport(t.control===null||typeof t.control==='boolean');bool(t.consistency);}
 // Imported camera receipts are local claims, not evidence from this server session.
 return {skillId:id,target,units,verified:0,manual:units,quality:null,completion,stars:completion==='complete'?1:0,technicalStars:null,activeSecondsEstimate:null};
}
function historyEntry(raw:unknown):HistoryEntry{
 const h=object(raw);exactKeys(h,['id','kind','name','completed','skipped','verified','manual','result','at','seed','workoutResults','timing']);const id=string(h.id),name=string(h.name,60);requireImport(h.kind==='tower'||h.kind==='workout');
 const kind=h.kind,completed=integer(h.completed,kind==='tower'?MAX_FLOOR:100),skipped=integer(h.skipped,100),verified=integer(h.verified),manual=integer(h.manual);
 const result=h.result;requireImport(result==='complete'||result==='incomplete'||result==='lost'||result==='abandoned');
 requireImport(kind==='workout'||skipped===0);requireImport(kind==='tower'||result!=='lost');
 requireImport(!(kind==='workout'&&skipped>0&&result==='complete'));
 integer(verified+manual);const out:HistoryEntry={id,kind,name,completed,skipped,verified:0,manual:verified+manual,result,at:integer(h.at,Number.MAX_SAFE_INTEGER)};
 if(h.seed!==undefined){requireImport(kind==='tower');out.seed=integer(h.seed,2147483647,1);}
 if(h.workoutResults!==undefined){requireImport(kind==='workout');out.workoutResults=array(h.workoutResults,100).map(entryResult);requireImport(out.workoutResults.reduce((n,r)=>n+r.units,0)===out.manual);}
 if(h.timing!==undefined){requireImport(kind==='workout');const t=object(h.timing);exactKeys(t,['elapsedSeconds','restSeconds','pausedSeconds','activeSecondsEstimate']);const elapsedSeconds=number(t.elapsedSeconds),restSeconds=number(t.restSeconds),pausedSeconds=number(t.pausedSeconds);requireImport(restSeconds+pausedSeconds<=elapsedSeconds+.001);if(t.activeSecondsEstimate!==null)number(t.activeSecondsEstimate);out.timing={elapsedSeconds,restSeconds,pausedSeconds,activeSecondsEstimate:null};}
 return out;
}
/** Explicit owner-only import into an empty cloud save. Endpoint enforces emptiness/lease.
 * Schema 1 only; this is not a migration of the removed RPG progression.
 * Pure reconstruction prevents unknown nested properties entering canonical storage.
 */
export function validateTowerImport(raw:unknown):PlayerSave{
 const r=object(raw);requireImport(r.version===1,'UNSUPPORTED_TOWER_VERSION');
 requireImport(!Object.hasOwn(r,'xp')&&!Object.hasOwn(r,'level')&&!Object.hasOwn(r,'player')&&!Object.hasOwn(r,'journey'),'LEGACY_SAVE_UNSUPPORTED');
 requireImport(r.debug===false,'TEST_SAVE_LOCAL_ONLY');
 requireImport(object(r.activity).kind==='idle','FINISH_CURRENT_ACTIVITY');
 exactKeys(r,['version','name','avatar','debug','skills','loadout','specialization','availableSpecializations','activity','records','history','routines','settings','completedTrials','lastOperationIds','importProvenance']);
 exactKeys(object(r.activity),['kind']);
 const name=string(r.name,20);requireImport(name.trim().length>0);requireImport(r.avatar==='male'||r.avatar==='female');
 const save=initialSave(name,r.avatar),skills=object(r.skills);requireImport(Object.keys(skills).length===SKILLS.length);
 for(const id of Object.keys(skills))skillId(id);
 for(const skill of SKILLS){const p=object(skills[skill.id]);exactKeys(p,['unlocked','mastery','totalUnits','verifiedUnits','manualUnits','trialVerification']);const unlocked=bool(p.unlocked),totalUnits=integer(p.totalUnits),verifiedUnits=integer(p.verifiedUnits,totalUnits),manualUnits=integer(p.manualUnits,totalUnits),mastery=integer(p.mastery,totalUnits);
  requireImport(verifiedUnits+manualUnits===totalUnits);requireImport(p.trialVerification===null||['verified','manual','mixed'].includes(String(p.trialVerification)));
  requireImport(!unlocked||p.trialVerification!==null);requireImport(unlocked||p.trialVerification===null);
  save.skills[skill.id]={unlocked,mastery,totalUnits,verifiedUnits:0,manualUnits:totalUnits,trialVerification:unlocked?'manual':null};
 }
 for(const skill of SKILLS)requireImport(!save.skills[skill.id].unlocked||!skill.prerequisite||save.skills[skill.prerequisite].unlocked,'IMPORT_PREREQUISITE_MISSING');
 save.completedTrials=integer(r.completedTrials,SKILLS.length);const unlocked=SKILLS.filter(k=>save.skills[k.id].unlocked).length;requireImport(save.completedTrials===unlocked);
 save.loadout=uniqueStrings(r.loadout,4,60).map(skillId);requireImport(save.loadout.every(id=>save.skills[id].unlocked)&&(!unlocked||save.loadout.length>0));
 save.availableSpecializations=uniqueStrings(r.availableSpecializations,3,4).map(type);
 save.specialization=r.specialization===null?null:type(r.specialization);requireImport(save.specialization===null||save.availableSpecializations.includes(save.specialization));
 const settings=object(r.settings);exactKeys(settings,['muted','reducedMotion','difficulty']);save.settings.muted=bool(settings.muted);save.settings.reducedMotion=bool(settings.reducedMotion);requireImport(settings.difficulty==='easy'||settings.difficulty==='normal'||settings.difficulty==='hard');save.settings.difficulty=settings.difficulty;
 const records=object(r.records);requireImport(Object.keys(records).length<=CHALLENGES.length+1);
 for(const [key,rawRecord] of Object.entries(records)){const challenge=CHALLENGES.find(c=>key===`challenge:${c.id}`);requireImport(key==='endless'||challenge,'UNKNOWN_IMPORT_RECORD');const rec=object(rawRecord);exactKeys(rec,['bestFloor','bestVerifiedFloor','runs','wins']);const bestFloor=integer(rec.bestFloor,challenge?.floors??MAX_FLOOR);integer(rec.bestVerifiedFloor,bestFloor);const runs=integer(rec.runs),wins=integer(rec.wins,runs);requireImport(wins===0||bestFloor===(challenge?.floors??MAX_FLOOR));save.records[key]={bestFloor,bestVerifiedFloor:0,runs,wins};}
 for(const specialization of save.availableSpecializations)requireImport((save.records[`challenge:${specialization}`]?.wins??0)>0,'IMPORT_SPECIALIZATION_UNEARNED');
 save.routines=array(r.routines,30).map(rawRoutine=>{const routine=object(rawRoutine);exactKeys(routine,['id','name','entries','restSeconds']);const entries=array(routine.entries,100).map(rawEntry=>{const e=object(rawEntry);exactKeys(e,['skillId','target']);const id=skillId(e.skillId),target=integer(e.target,1000,1);requireImport(save.skills[id].unlocked&&(!SKILL_BY_ID[id].alternating||target%2===0));return {skillId:id,target};});requireImport(entries.length>0);return {id:string(routine.id,100),name:string(routine.name,60),entries,restSeconds:integer(routine.restSeconds,600)};});
 requireImport(new Set(save.routines.map(x=>x.id)).size===save.routines.length);
 save.history=array(r.history,200).map(historyEntry);requireImport(new Set(save.history.map(x=>x.id)).size===save.history.length);
 uniqueStrings(r.lastOperationIds,256);save.lastOperationIds=[];
 if(r.importProvenance!==undefined)requireImport(r.importProvenance==='local-unverified');
 save.importProvenance='local-unverified';return save;
}
