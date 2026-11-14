import { openDB } from "idb";
let connection:ReturnType<typeof openDB>|undefined;
const db=()=>connection??=openDB("everstride", 1, {
  upgrade(db) {
    db.createObjectStore("state");
  },
});
export async function readSave<T>(key: string): Promise<T | undefined> {
  return (await db()).get("state", key);
}
export async function writeSave(key: string, value: unknown) {
  return (await db()).put("state", value, key);
}
export async function clearSave(key: string) {
  return (await db()).delete("state", key);
}
export async function withSaveTransaction<T>(action:(store:import('idb').IDBPObjectStore<unknown,['state'],'state','readwrite'>)=>Promise<T>):Promise<T>{
 const tx=(await db()).transaction('state','readwrite');
 try{const result=await action(tx.objectStore('state'));await tx.done;return result;}catch(error){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error;}
}
