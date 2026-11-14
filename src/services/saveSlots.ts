import {initialAdventure,normalizeAdventure,type AdventureSnapshot} from '../core/commands';
import {attacks} from '../core/game';
import {WORLD_MAPS} from '../core/worldMaps';
import {GUIDE_BASICS} from '../core/commands';
import {readSave,writeSave,withSaveTransaction} from './storage';
export type SaveSlotNumber=1|2|3;
export type SaveSlot={testOnly?:boolean;slotNumber:SaveSlotNumber;saveId:string|null;cloudSaveId?:string;syncStatus?:'linked'|'syncing'|'offline'|'error';syncError?:string;updatedAt:string|null;snapshot?:AdventureSnapshot};
const registry='save-slots:v1';
export const adventureKey=(saveId:string)=>`adventure:${saveId}`;
export const nutritionKey=(saveId:string)=>`nutrition:${saveId}`;
const empty=():SaveSlot[]=>[1,2,3].map(slotNumber=>({slotNumber:slotNumber as SaveSlotNumber,saveId:null,updatedAt:null}));
export async function initializeSlots():Promise<SaveSlot[]>{
 let migrationError:Error|undefined;
 await withSaveTransaction(async store=>{
  if(await store.get(registry))return;
  const slots=empty(),legacy=await store.get('adventure'),nutrition=await store.get('nutrition');
  if(legacy!==undefined){
   if(await store.get('recovery:legacy-adventure:v1')===undefined)await store.put(legacy,'recovery:legacy-adventure:v1');
   if(nutrition!==undefined&&await store.get('recovery:legacy-nutrition:v1')===undefined)await store.put(nutrition,'recovery:legacy-nutrition:v1');
   let snapshot:AdventureSnapshot;
   try{if(!legacy?.player||!Array.isArray(legacy.player.badges)||!Number.isFinite(legacy.player.xp))throw Error('Incompatible save format.');snapshot=normalizeAdventure(legacy);}catch{migrationError=Error('Your previous save needs recovery. Its original record and recovery copy have been preserved.');return;}
   const saveId=crypto.randomUUID();
   slots[0]={slotNumber:1,saveId,updatedAt:new Date().toISOString()};
   await store.put(snapshot,adventureKey(saveId));
   if(nutrition!==undefined)await store.put(nutrition,nutritionKey(saveId));
  }
  await store.put(slots,registry);
 });
 if(migrationError)throw migrationError;
 return listSlots();
}
export async function listSlots():Promise<SaveSlot[]>{
 const slots=await readSave<SaveSlot[]>(registry)??empty();
 return Promise.all(slots.map(async slot=>({...slot,snapshot:slot.saveId?(slot.cloudSaveId?await readSave<AdventureSnapshot>(`adventure-cloud-cache:${slot.cloudSaveId}`):undefined)??await readSave<AdventureSnapshot>(adventureKey(slot.saveId)):undefined})));
}
export async function createSlot(slotNumber:SaveSlotNumber,character:{name:string;avatar:'male'|'female';testOnly?:boolean}):Promise<SaveSlot>{
 if(![1,2,3].includes(slotNumber)||!character.name.trim()||character.name.trim().length>20||!['male','female'].includes(character.avatar))throw Error('Invalid character or slot.');
 await initializeSlots();
 const slot:SaveSlot={slotNumber,saveId:crypto.randomUUID(),updatedAt:new Date().toISOString()};
 const snapshot=normalizeAdventure(initialAdventure(),false);snapshot.player.name=character.name.trim();snapshot.journey!.avatar=character.avatar;
 if(character.testOnly){slot.testOnly=true;snapshot.testOnly=true;snapshot.player={...snapshot.player,name:'admin',level:20,hp:328,maxHp:328,attack:58,defense:58,speed:31,coins:10000,badges:['leg','arm','back'],unlockedAttacks:attacks.map(a=>a.id),equipped:['squat','pushup','superman','birddog'],upgrades:Object.fromEntries(attacks.map(a=>[a.id,4])),items:{potion:99,shield:99,boost:99,ingredient:99}};snapshot.journey!.introComplete=true;snapshot.journey!.tutorialStage=6;snapshot.journey!.guide={version:1,completed:[...GUIDE_BASICS],seen:[]};snapshot.journey!.location={mapId:'starter_town',...WORLD_MAPS.starter_town.spawns.safe};}
 await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[];if(slots[slotNumber-1].saveId)throw Error('This slot already has an adventure.');slots[slotNumber-1]=slot;await store.put(snapshot,adventureKey(slot.saveId!));await store.put(slots,registry);});
 return {...slot,snapshot};
}
export async function deleteSlot(slotNumber:SaveSlotNumber):Promise<void>{
 if(![1,2,3].includes(slotNumber))throw Error('Invalid slot.');
 await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[];const slot=slots[slotNumber-1];
 if(slot.cloudSaveId){
  const prefix=`adventure-cloud-pending:${slot.cloudSaveId}:`;
  for(const key of await store.getAllKeys())if(typeof key==='string'&&key.startsWith(prefix)&&!key.slice(prefix.length).includes(':')){const queue=await store.get(key);if(!Array.isArray(queue)||queue.length)throw Error('Resolve pending cloud adventure actions before removing this slot.');}
  if(typeof localStorage!=='undefined')for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(`everstride.nutrition.cloud.v1.${slot.cloudSaveId}.`))continue;let cache;try{cache=JSON.parse(localStorage.getItem(key)??'null');}catch{throw Error('Recover the unreadable cloud journal before removing this slot.');}if(!cache||!Array.isArray(cache.pending)||!Array.isArray(cache.conflicts)||cache.pending.length||cache.conflicts.length||cache.draft)throw Error('Resolve pending cloud journal edits and conflicts before removing this slot.');}
 }
 if(slot.saveId){await store.put({slot,snapshot:await store.get(adventureKey(slot.saveId)),nutrition:await store.get(nutritionKey(slot.saveId))},`recovery:deleted:${slot.saveId}:${Date.now()}`);await store.delete(adventureKey(slot.saveId));await store.delete(nutritionKey(slot.saveId));}slots[slotNumber-1]={slotNumber,saveId:null,updatedAt:null};await store.put(slots,registry);});
}
export async function bindCloudSlot(localSaveId:string,cloudSaveId:string){await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[];const slot=slots.find(s=>s.saveId===localSaveId);if(!slot)throw Error('Save slot no longer exists.');if(slot.testOnly)throw Error('Test adventures stay on this device.');if(slots.some(s=>s.saveId!==localSaveId&&s.cloudSaveId===cloudSaveId))throw Error('This cloud adventure is already assigned to another slot.');slot.cloudSaveId=cloudSaveId;await store.put(slots,registry);});}
export async function persistSlotSnapshot(saveId:string,snapshot:AdventureSnapshot){await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[]|undefined;const slot=slots?.find(s=>s.saveId===saveId);if(!slot)throw Error('Save slot no longer exists.');slot.updatedAt=new Date().toISOString();await store.put(snapshot,adventureKey(saveId));await store.put(slots,registry);});}
export const readSlotNutrition=<T>(id:string)=>readSave<T>(nutritionKey(id));
export const writeSlotNutrition=(id:string,value:unknown)=>writeSave(nutritionKey(id),value);

export async function setSlotCloudStatus(saveId:string,syncStatus:NonNullable<SaveSlot['syncStatus']>,syncError=''){await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[]|undefined;const slot=slots?.find(s=>s.saveId===saveId);if(!slot)return;slot.syncStatus=syncStatus;slot.syncError=syncError;if(syncStatus==='linked')slot.updatedAt=new Date().toISOString();await store.put(slots,registry);});}
