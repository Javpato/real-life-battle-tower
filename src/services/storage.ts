import { openDB } from "idb";
const db = openDB("everstride", 1, {
  upgrade(db) {
    db.createObjectStore("state");
  },
});
export async function readSave<T>(key: string): Promise<T | undefined> {
  return (await db).get("state", key);
}
export async function writeSave(key: string, value: unknown) {
  return (await db).put("state", value, key);
}
export async function clearSave(key: string) {
  return (await db).delete("state", key);
}
