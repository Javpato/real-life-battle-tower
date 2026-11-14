import {initialAdventure,normalizeAdventure,type AdventureSnapshot} from '../core/commands';
import {readSave,writeSave,withSaveTransaction} from './storage';
export type SaveSlotNumber=1|2|3;
export type SaveSlot={slotNumber:SaveSlotNumber;saveId:string|null;cloudSaveId?:string;syncStatus?:'linked'|'syncing'|'offline'|'error';syncError?:string;updatedAt:string|null;snapshot?:AdventureSnapshot};
const registry='save-slots:v1';
export const adventureKey=(saveId:string)=>`adventure:${saveId}`;
export const nutritionKey=(saveId:string)=>`nutrition:${saveId}`;
const empty=():SaveSlot[]=>[1,2,3].map(slotNumber=>({slotNumber:slotNumber as SaveSlotNumber,saveId:null,updatedAt:null}));
export async function initializeSlots():Promise<SaveSlot[]>{
 await withSaveTransaction(async store=>{
  if(await store.get(registry))return;
  const slots=empty(),legacy=await store.get('adventure'),nutrition=await store.get('nutrition');
  if(legacy!==undefined){
   await store.put(legacy,'recovery:legacy-adventure:v1');
   if(nutrition!==undefined)await store.put(nutrition,'recovery:legacy-nutrition:v1');
   if(!legacy?.player||!Array.isArray(legacy.player.badges)||!Number.isFinite(legacy.player.xp))throw Error('Your previous save needs recovery. Its original record has not been overwritten.');
   const saveId=crypto.randomUUID(),snapshot=normalizeAdventure(legacy);
   slots[0]={slotNumber:1,saveId,updatedAt:new Date().toISOString()};
   await store.put(snapshot,adventureKey(saveId));
   if(nutrition!==undefined)await store.put(nutrition,nutritionKey(saveId));
  }
  await store.put(slots,registry);
 });
 return listSlots();
}
export async function listSlots():Promise<SaveSlot[]>{
 const slots=await readSave<SaveSlot[]>(registry)??empty();
 return Promise.all(slots.map(async slot=>({...slot,snapshot:slot.saveId?(slot.cloudSaveId?await readSave<AdventureSnapshot>(`adventure-cloud-cache:${slot.cloudSaveId}`):undefined)??await readSave<AdventureSnapshot>(adventureKey(slot.saveId)):undefined})));
}
export async function createSlot(slotNumber:SaveSlotNumber,character:{name:string;avatar:'male'|'female'}):Promise<SaveSlot>{
 if(![1,2,3].includes(slotNumber)||!character.name.trim()||character.name.trim().length>20||!['male','female'].includes(character.avatar))throw Error('Invalid character or slot.');
 await initializeSlots();
 const slot:SaveSlot={slotNumber,saveId:crypto.randomUUID(),updatedAt:new Date().toISOString()};
 const snapshot=normalizeAdventure(initialAdventure(),false);snapshot.player.name=character.name.trim();snapshot.journey!.avatar=character.avatar;
 await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[];if(slots[slotNumber-1].saveId)throw Error('This slot already has an adventure.');slots[slotNumber-1]=slot;await store.put(snapshot,adventureKey(slot.saveId!));await store.put(slots,registry);});
 return {...slot,snapshot};
}
export async function deleteSlot(slotNumber:SaveSlotNumber):Promise<void>{
 if(![1,2,3].includes(slotNumber))throw Error('Invalid slot.');
 await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[];const slot=slots[slotNumber-1];if(slot.saveId){await store.put({slot,snapshot:await store.get(adventureKey(slot.saveId)),nutrition:await store.get(nutritionKey(slot.saveId))},`recovery:deleted:${slot.saveId}:${Date.now()}`);await store.delete(adventureKey(slot.saveId));await store.delete(nutritionKey(slot.saveId));}slots[slotNumber-1]={slotNumber,saveId:null,updatedAt:null};await store.put(slots,registry);});
}
export async function bindCloudSlot(localSaveId:string,cloudSaveId:string){await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[];const slot=slots.find(s=>s.saveId===localSaveId);if(!slot)throw Error('Save slot no longer exists.');if(slots.some(s=>s.saveId!==localSaveId&&s.cloudSaveId===cloudSaveId))throw Error('This cloud adventure is already assigned to another slot.');slot.cloudSaveId=cloudSaveId;await store.put(slots,registry);});}
export async function persistSlotSnapshot(saveId:string,snapshot:AdventureSnapshot){await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[]|undefined;const slot=slots?.find(s=>s.saveId===saveId);if(!slot)throw Error('Save slot no longer exists.');slot.updatedAt=new Date().toISOString();await store.put(snapshot,adventureKey(saveId));await store.put(slots,registry);});}
export const readSlotNutrition=<T>(id:string)=>readSave<T>(nutritionKey(id));
export const writeSlotNutrition=(id:string,value:unknown)=>writeSave(nutritionKey(id),value);

export async function setSlotCloudStatus(saveId:string,syncStatus:NonNullable<SaveSlot['syncStatus']>,syncError=''){await withSaveTransaction(async store=>{const slots=await store.get(registry) as SaveSlot[]|undefined;const slot=slots?.find(s=>s.saveId===saveId);if(!slot)return;slot.syncStatus=syncStatus;slot.syncError=syncError;if(syncStatus==='linked')slot.updatedAt=new Date().toISOString();await store.put(slots,registry);});}
