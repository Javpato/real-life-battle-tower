// Isolated browser storage only: never opens an existing user browser profile.
import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const base=process.env.GAME_URL||'http://127.0.0.1:5182';
async function slots(){await page.getByRole('button',{name:'PRESS ANYTHING TO START',exact:true}).click({timeout:10000});}
try{
 await page.goto(base);await slots();
 const original=await page.evaluate(async()=>{
  const {initialSave,applyCommand}=await import('/src/tower/engine.ts');
  const {writeSave}=await import('/src/services/storage.ts');
  const snapshots=Array.from({length:3},(_,i)=>{
   let save=initialSave(`Migrated ${i+1}`,i===1?'female':'male');
   if(i===1){save=applyCommand(save,{kind:'startRun',mode:'endless',seed:17});save.activity.contentVersion=1;}
   save.version=1;delete save.progression;delete save.flashEquipped;
   save.records.endless={bestFloor:i+7,bestVerifiedFloor:i+1,runs:i+2,wins:0};
   return {slot:i+1,save,updatedAt:'2026-11-14T12:00:00Z'};
  });
  await writeSave('battle-tower:slots:v1',snapshots);return snapshots;
 });
 await page.reload();await slots();
 await expect(page.getByRole('button',{name:'Continue adventure',exact:true})).toHaveCount(3);
 const after=await page.evaluate(async()=>{const {readSave}=await import('/src/services/storage.ts');return {slots:await readSave('battle-tower:slots:v1'),backup:await readSave('battle-tower:slots:v1:migration-backup')};});
 expect(after.backup).toEqual(original);
 after.slots.forEach((slot,i)=>{expect(slot.save.version).toBe(2);expect(slot.save.name).toBe(original[i].save.name);expect(slot.save.records).toEqual(original[i].save.records);});
 expect(after.slots[1].save.activity).toEqual(original[1].save.activity);
 const corrupt=structuredClone(after.slots);corrupt[1].save.version=99;
 await page.evaluate(async value=>{const {writeSave}=await import('/src/services/storage.ts');await writeSave('battle-tower:slots:v1',value);},corrupt);
 await page.reload();await slots();
 await expect(page.getByText(/Cannot open saved games. Existing data was preserved/)).toBeVisible();
 for(const button of await page.getByRole('button',{name:'New adventure',exact:true}).all())await expect(button).toBeDisabled();
 expect(await page.evaluate(async()=>{const {readSave}=await import('/src/services/storage.ts');return readSave('battle-tower:slots:v1');})).toEqual(corrupt);
 await page.evaluate(async value=>{const {writeSave}=await import('/src/services/storage.ts');await writeSave('battle-tower:slots:v1',value.slice(0,2));},original);
 await page.reload();await slots();
 await expect(page.getByText(/INVALID_SAVE_SLOTS/)).toBeVisible();
 for(const button of await page.getByRole('button',{name:'New adventure',exact:true}).all())await expect(button).toBeDisabled();
 expect(await page.evaluate(async()=>{const {readSave}=await import('/src/services/storage.ts');return readSave('battle-tower:slots:v1');})).toEqual(original.slice(0,2));
 console.log('PASS: three independent migrations, immutable v1 backup, preserved active legacy run, unreadable/malformed saves cannot be overwritten through blank slots.');
}finally{await browser.close();}
