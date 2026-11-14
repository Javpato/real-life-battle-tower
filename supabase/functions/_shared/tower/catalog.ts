// GENERATED. Edit src/tower, then run supabase/sync-core.mjs.
import type {Skill,Challenge,PlayerSave} from './model.ts';
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
export const SKILLS:Skill[]=([['leg',legs],['arm',arms],['back',backs]] as const).flatMap(([type,rows])=>rows.map(([id,name,exercise,units,damage,prerequisite,detector='manual',alternating=false],i)=>({
 id,name,type,exercise,units,damage,prerequisite,detector,detectorStatus:(detector==='manual'?'pending':['mini-squat','knee-pushup'].includes(id)?'experimental':'configured') as Skill['detectorStatus'],alternating,tier:(i<4?1:i<7?2:3) as 1|2|3,
 unit:held.has(id)?'seconds' as const:'reps' as const,trialTarget:held.has(id)?5:alternating?4:3,
 description:`${units} ${held.has(id)?'observable seconds':'controlled repetitions'}${alternating?' · alternate sides':''}`,
 cue:held.has(id)?'Hold steady · keep breathing':alternating?'Return with control · alternate sides':'Move with control · return to the start',
})));
export const SKILL_BY_ID:Readonly<Record<string,Skill>>=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
export const CHALLENGES:Challenge[]=[
 {id:'leg',name:'Root Trial',description:'Five floors of lower-body control.',floors:5,seed:31415,types:['leg'],skillIds:['mini-squat','squat','assisted-lunge','lunge'],specialization:'leg'},
 {id:'arm',name:'Ember Trial',description:'Five floors of upper-body strength.',floors:5,seed:27182,types:['arm'],skillIds:['knee-pushup','wall-pushup','incline-pushup','pushup'],specialization:'arm'},
 {id:'back',name:'Gale Trial',description:'Five floors of stability and balance.',floors:5,seed:16180,types:['back'],skillIds:['birddog','alternating-birddog','short-superman','superman'],specialization:'back'},
 {id:'mixed',name:'Threefold Ascent',description:'Eight floors across all three styles.',floors:8,seed:14142,types:['leg','arm','back'],skillIds:['squat','pushup','birddog','superman']},
 {id:'endurance',name:'Steady Flame',description:'Eight floors of sustained effort.',floors:8,seed:17320,types:['leg','arm','back'],skillIds:['wall-sit','high-plank','short-superman','superman']},
 {id:'control',name:'Perfect Balance',description:'Six floors of deliberate movement.',floors:6,seed:22360,types:['back','leg','arm'],skillIds:['pause-squat','pause-pushup','pause-birddog','tempo-extension']},
 {id:'boss',name:'Keepers’ Gauntlet',description:'Five encounters with the tower keepers.',floors:5,seed:24494,types:['leg','arm','back'],skillIds:['squat','pushup','birddog','superman'],bossEvery:1},
];
export const canAttemptTrial=(save:PlayerSave,id:string)=>{const skill=Object.hasOwn(SKILL_BY_ID,id)?SKILL_BY_ID[id]:undefined;return !!skill&&(!skill.prerequisite||!!save.skills[skill.prerequisite]?.unlocked);};
export const unlockedSkills=(save:PlayerSave)=>SKILLS.filter(s=>save.skills[s.id]?.unlocked);
export const challengeAvailable=(save:PlayerSave,id:string)=>{const c=CHALLENGES.find(c=>c.id===id);return !!c&&c.skillIds.every(id=>save.skills[id]?.unlocked);};
