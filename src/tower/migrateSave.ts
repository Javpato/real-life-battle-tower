import type {PlayerSave} from './model';
import {SKILLS,INITIAL_SKILLS} from './catalog';
/** Local/authoritative snapshots only. Untrusted imports use validateTowerImport. */
export function migrateSave(input:PlayerSave):PlayerSave{
 if(input?.version!==1&&input?.version!==2)throw Error('UNSUPPORTED_TOWER_VERSION');
 const s=structuredClone(input),legacy=s.version===1;
 for(const skill of SKILLS)s.skills[skill.id]??={unlocked:false,mastery:0,totalUnits:0,verifiedUnits:0,manualUnits:0,trialVerification:null};
 for(const id of INITIAL_SKILLS)s.skills[id].unlocked=true;
 s.progression??={trialTokens:0,flashTokens:0,flashSkills:[],flashCadence:{},flashVerification:{}};
 s.flashEquipped??=[];
 if(legacy){
  s.migration={from:1,preservedActiveRules:s.activity.kind!=='idle'};
  if(s.activity.kind==='trial')s.activity.legacy=true;
  if(s.activity.kind==='tower')s.activity.contentVersion=1;
  s.version=2;
  // Preserve chosen moves, filling only vacancies. An old expedition retains its own snapshot.
  for(const id of INITIAL_SKILLS)if(s.loadout.length<4&&!s.loadout.includes(id))s.loadout.push(id);
 }
 return s;
}
