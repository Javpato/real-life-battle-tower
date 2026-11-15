import type {Skill,Challenge,PlayerSave,Element,TowerRun} from './model';
import {ADDITIONAL_SKILLS} from './expandedCatalog';
export const INITIAL_SKILLS=['mini-squat','knee-pushup','birddog','short-superman'] as const;
// Variant recognition is deliberately conservative. Sharing a movement family is not proof
// that its range, support, tempo or hold requirements have been observed by the detector.
type Row=[string,string,Skill['exercise'],number,number,Skill['prerequisite'],Skill['detector']?,boolean?];
const legs:Row[]=[
 ['mini-squat','Mini Squat','squat',6,24,null,'supported'],['squat','Squat','squat',8,32,'mini-squat','supported'],
 ['pause-squat','Pause Squat','squat',6,36,'squat'],['assisted-lunge','Assisted Lunge','lunge',6,28,'mini-squat',undefined,true],
 ['lunge','Lunge','lunge',8,38,'assisted-lunge','supported',true],['sumo-squat','Sumo Squat','squat',8,36,'squat'],
 ['wall-sit','Wall Sit','squat',12,36,'pause-squat'],['reverse-lunge','Reverse Lunge','lunge',8,40,'lunge',undefined,true],
 ['tempo-squat','Tempo Squat','squat',6,42,'pause-squat'],['single-leg-squat','Single-leg Squat','squat',6,46,'tempo-squat',undefined,true],
];
const arms:Row[]=[
 ['wall-pushup','Wall Push-up','wallpushup',8,28,'knee-pushup','supported'],['incline-pushup','Incline Push-up','pushup',6,30,'wall-pushup'],
 ['knee-pushup','Knee Push-up','pushup',6,26,null,'supported'],['high-plank','High Plank','pushup',12,32,'knee-pushup'],
 ['pushup','Push-up','pushup',6,40,'incline-pushup','supported'],['pause-pushup','Pause Push-up','pushup',5,42,'pushup'],
 ['diamond','Diamond Push-up','diamond',4,48,'pushup'],['eccentric-pushup','Eccentric Push-up','pushup',5,42,'pause-pushup'],
 ['wide-pushup','Wide Push-up','pushup',6,44,'pushup'],['archer-pushup','Archer Push-up','pushup',6,48,'wide-pushup',undefined,true],
];
const backs:Row[]=[
 ['birddog','Basic Bird Dog','birddog',4,26,null,'supported',true],['alternating-birddog','Alternating Bird Dog','birddog',8,34,'birddog','supported',true],
 ['short-superman','Short Superman','superman',8,26,null,'supported'],['superman','Superman','superman',15,36,'short-superman','supported'],
 ['back-extension','Back Extension','superman',6,32,'short-superman'],['snow-angels','Reverse Snow Angels','superman',6,36,'back-extension'],
 ['pause-birddog','Pause Bird Dog','birddog',6,38,'alternating-birddog',undefined,true],['alternating-superman','Alternating Superman','superman',8,38,'superman',undefined,true],
 ['tempo-extension','Tempo Extension','superman',6,42,'back-extension'],['advanced-birddog','Advanced Bird Dog','birddog',8,44,'pause-birddog',undefined,true],
];
const held=new Set(['wall-sit','high-plank','short-superman','superman']);
const LEGACY_SKILLS:Skill[]=([['leg',legs],['arm',arms],['back',backs]] as const).flatMap(([type,rows])=>rows.map(([id,name,exercise,units,damage,prerequisite,detector='manual',alternating=false],i)=>({
 id,name,type,exercise,units,damage,prerequisite,detector,detectorStatus:(detector==='manual'?'pending':['mini-squat','knee-pushup'].includes(id)?'experimental':'configured') as Skill['detectorStatus'],alternating,tier:(i<4?1:i<7?2:3) as 1|2|3,
 qualityMetric:(detector==='manual'?'none':held.has(id)?'observed-amplitude':'movement-control') as Skill['qualityMetric'],
 unit:held.has(id)?'seconds' as const:'reps' as const,trialTarget:held.has(id)?5:alternating?4:3,
 description:`${units} ${held.has(id)?'observable seconds':'controlled repetitions'}${alternating?' · alternate sides':''}`,
 cue:held.has(id)?'Hold steady · keep breathing':alternating?'Return with control · alternate sides':'Move with control · return to the start',
})));
const secondary:Partial<Record<string,Element>>={'high-plank':'core',birddog:'core','alternating-birddog':'core','pause-birddog':'core','advanced-birddog':'core','wall-sit':'core','alternating-superman':'core'};
const equipment:Partial<Record<string,Skill['equipment']>>={'wall-pushup':'wall','wall-sit':'wall','incline-pushup':'support','assisted-lunge':'support','single-leg-squat':'support'};
export const SKILLS:Skill[]=[...LEGACY_SKILLS.map(s=>({...s,types:(secondary[s.id]?[s.type,secondary[s.id]!]:[s.type]) as [Element]|[Element,Element],equipment:equipment[s.id]??'none',impact:'none' as const,detectorFamily:s.exercise,demonstration:s.id})),...ADDITIONAL_SKILLS];
// Trial requirements follow branch depth, not the visual ordering of the catalogue.
const byId=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
for(const skill of SKILLS){let depth=0,ancestor=skill.prerequisite;const seen=new Set([skill.id]);while(ancestor){if(seen.has(ancestor)||!byId[ancestor])throw Error('INVALID_SKILL_DEPENDENCY');seen.add(ancestor);depth++;ancestor=byId[ancestor].prerequisite;}skill.trialTarget=(skill.unit==='seconds'?[6,10,15]:[4,6,8])[Math.min(2,depth)];}
export const SKILL_BY_ID:Readonly<Record<string,Skill>>=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
export const LEGACY_CHALLENGES:Challenge[]=[
 {id:'leg',name:'Root Trial',description:'Five floors of lower-body control.',floors:5,seed:31415,types:['leg'],skillIds:['mini-squat','squat','assisted-lunge','lunge'],specialization:'leg'},
 {id:'arm',name:'Ember Trial',description:'Five floors of upper-body strength.',floors:5,seed:27182,types:['arm'],skillIds:['knee-pushup','wall-pushup','incline-pushup','pushup'],specialization:'arm'},
 {id:'back',name:'Gale Trial',description:'Five floors of stability and balance.',floors:5,seed:16180,types:['back'],skillIds:['birddog','alternating-birddog','short-superman','superman'],specialization:'back'},
 {id:'core',name:'Anchor Trial',description:'Five floors of controlled trunk movement.',floors:5,seed:31623,types:['core'],skillIds:['supine-march','deadbug-heel-tap','abdominal-brace','short-crunch'],specialization:'core'},
 {id:'cardio',name:'Pulse Trial',description:'Five floors of steady, low-impact rhythm.',floors:5,seed:33166,types:['cardio'],skillIds:['march-in-place','step-touch','heel-dig','shadowbox-straight'],specialization:'cardio'},
 {id:'mobility',name:'Flow Trial',description:'Five floors of comfortable controlled movement.',floors:5,seed:34641,types:['mobility'],skillIds:['shoulder-circles','standing-chest-opening','cat-cow','hip-circles'],specialization:'mobility'},
 {id:'mixed',name:'Sixfold Ascent',description:'Eight floors across the six disciplines.',floors:8,seed:14142,types:['leg','arm','back','core','cardio','mobility'],skillIds:['squat','pushup','birddog','superman']},
 {id:'endurance',name:'Steady Flame',description:'Eight floors of sustained effort.',floors:8,seed:17320,types:['leg','arm','back'],skillIds:['wall-sit','high-plank','short-superman','superman']},
 {id:'control',name:'Perfect Balance',description:'Six floors of deliberate movement.',floors:6,seed:22360,types:['back','leg','arm'],skillIds:['pause-squat','pause-pushup','pause-birddog','tempo-extension']},
 {id:'boss',name:'Keepers’ Gauntlet',description:'Five encounters with the tower keepers.',floors:5,seed:24494,types:['leg','arm','back'],skillIds:['squat','pushup','birddog','superman'],bossEvery:1},
];
// Assigned skills are borrowed by a challenge only. They never alter permanent unlocks.
const beginnerLoadouts:Record<string,string[]>={
 leg:['mini-squat','squat','sitstand','calf-raise'],
 arm:['wall-pushup','incline-pushup','knee-pushup','high-plank'],
 back:['birddog','short-superman','back-extension','alternating-birddog'],
 core:['supine-march','deadbug-heel-tap','abdominal-brace','short-crunch'],
 cardio:['march-in-place','step-touch','heel-dig','shadowbox-straight'],
 mobility:['shoulder-circles','standing-chest-opening','cat-cow','hip-circles'],
 mixed:['mini-squat','wall-pushup','birddog','march-in-place'],
 endurance:['mini-squat','wall-pushup','short-superman','march-in-place'],
 control:['mini-squat','wall-pushup','birddog','cat-cow'],
 boss:['mini-squat','wall-pushup','birddog','short-superman'],
};
export const CHALLENGES:Challenge[]=LEGACY_CHALLENGES.flatMap(c=>{
 const skillIds=beginnerLoadouts[c.id];
 return [
  {...c,id:`${c.id}-easy`,legacyId:c.id,name:`${c.name} · Easy`,description:'Five floors. Assigned beginner attacks are available here without unlocking them.',floors:5,skillIds,tier:'easy' as const,hpMultiplier:.8,attackMultiplier:.8},
  {...c,legacyId:c.id,name:`${c.name} · Hard`,description:'Stronger opponents with the same four assigned movements.',floors:5,skillIds,tier:'hard' as const,prerequisiteId:`${c.id}-easy`,hpMultiplier:1.25,attackMultiplier:1.1},
 ];
});
export const getRunChallenge=(run:TowerRun)=> (run.challengeTier?CHALLENGES:LEGACY_CHALLENGES).find(c=>c.id===run.challengeId);
export const canAttemptTrial=(save:PlayerSave,id:string)=>{const skill=Object.hasOwn(SKILL_BY_ID,id)?SKILL_BY_ID[id]:undefined;return !!skill&&(!skill.prerequisite||!!save.skills[skill.prerequisite]?.unlocked);};
export const unlockedSkills=(save:PlayerSave)=>SKILLS.filter(s=>save.skills[s.id]?.unlocked);
export const challengeAvailable=(save:PlayerSave,id:string)=>{
 const c=CHALLENGES.find(c=>c.id===id);
 return !!c&&(c.tier==='easy'||!!c.prerequisiteId&&((save.records[`challenge:${c.prerequisiteId}`]?.wins??0)>0||(save.records[`challenge:${c.legacyId}`]?.wins??0)>0));
};
