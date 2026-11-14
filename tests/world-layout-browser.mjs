import {chromium,expect} from '@playwright/test';
import {WORLD_MAPS,ROOM_DETAILS} from '../src/core/worldMaps.ts';
// Explicit fixture QA: isolated IndexedDB snapshots select rooms; all door actions use real UI.
// This does not claim a played campaign or exercise/sensor validation.
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1366,height:768},hasTouch:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5173';
async function snapshot(){return page.evaluate(async()=>{const {listSlots}=await import('/src/services/saveSlots.ts');return (await listSlots())[0].snapshot;});}
async function fixture(mapId,{position,badges=['leg','arm','back'],stage=6}={}){
 await page.goto(url);
 await page.evaluate(async({mapId,position,badges,stage})=>{
  const {initialAdventure,normalizeAdventure}=await import('/src/core/commands.ts');
  const {WORLD_MAPS}=await import('/src/core/worldMaps.ts');
  const {initializeSlots,createSlot,persistSlotSnapshot}=await import('/src/services/saveSlots.ts');
  const slots=await initializeSlots(),slot=slots[0].saveId?slots[0]:await createSlot(1,{name:'Interior QA fixture',avatar:'female'});
  const s=normalizeAdventure(initialAdventure(),false);s.player.name='Interior QA fixture';s.player.badges=badges;s.journey.avatar='female';s.journey.introComplete=true;s.journey.tutorialStage=stage;
  s.journey.location={mapId,...(position??WORLD_MAPS[mapId].spawns.entry??WORLD_MAPS[mapId].spawns.safe)};s.player.position={x:s.journey.location.x,y:s.journey.location.y};
  s.journey.guide={version:1,completed:stage>=6?['move','turn','door','talk','close','inventory','map','journal']:[],seen:[]};
  await persistSlotSnapshot(slot.saveId,s);
 },{mapId,position,badges,stage});
 await page.reload();await page.getByRole('button',{name:'PRESS ANYTHING TO START'}).click();await page.getByRole('button',{name:'Continue ▸'}).first().click();
 await expect(page.locator(`[data-map-id="${mapId}"]`)).toBeVisible();await expect(page.getByText('Opening the world…',{exact:true})).toHaveCount(0);await page.waitForTimeout(1100);
}
async function key(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(120);}
async function leaveAndReturn(map){
 const exit=map.portals.find(p=>p.id.endsWith(':exit'));expect(exit).toBeTruthy();
 await key('s',180);await page.keyboard.press('e');await expect(page.locator(`[data-map-id="${exit.to}"]`)).toBeVisible();await page.waitForTimeout(1100);
 const parent=WORLD_MAPS[exit.to],entry=parent.portals.find(p=>p.to===map.id);expect(entry).toBeTruthy();
 await page.keyboard.press('e');await expect(page.locator(`[data-map-id="${map.id}"]`)).toBeVisible();await page.waitForTimeout(1100);
}
try{
 await fixture('starter_house_bedroom');
 await page.keyboard.down('e');await expect(page.locator('[data-map-id="starter_house"]')).toBeVisible();
 await page.waitForTimeout(1500);await page.keyboard.down('e');await page.waitForTimeout(200);
 expect((await snapshot()).journey.location.mapId).toBe('starter_house');
 const start=(await snapshot()).journey.location;await key('d',300);const moved=(await snapshot()).journey.location;
 expect(moved.x-start.x).toBeGreaterThan(10);expect(moved.mapId).toBe('starter_house');
 await page.keyboard.up('e');await page.keyboard.press('e');await expect(page.locator('[data-map-id="starter_house_bedroom"]')).toBeVisible();
 // A new press inside the safe second is discarded, never queued for later.
 await page.keyboard.press('e');await page.waitForTimeout(1350);expect((await snapshot()).journey.location.mapId).toBe('starter_house_bedroom');
 await page.keyboard.press('e');await expect(page.locator('[data-map-id="starter_house"]')).toBeVisible();
 console.log('Held E, new-press cooldown, and movement recovery passed');
 await expect(page.getByText('Opening the world…',{exact:true})).toHaveCount(0);await page.waitForTimeout(1100);
 await page.locator('.world-interact').tap();await expect(page.locator('[data-map-id="starter_house_bedroom"]')).toBeVisible();
 await expect(page.getByText('Opening the world…',{exact:true})).toHaveCount(0);await expect(page.locator('.world-interact')).toBeEnabled();
 await page.locator('.world-interact').tap();await page.waitForTimeout(1150);expect((await snapshot()).journey.location.mapId).toBe('starter_house_bedroom');
 await page.locator('.world-interact').tap();await expect(page.locator('[data-map-id="starter_house"]')).toBeVisible();
 console.log('Browser touch activation respects the same arrival guard');
 for(const item of [{id:'starter_town',x:280,y:292,shot:'town-arrival'},{id:'starter_town',x:480,y:680,shot:'town-plaza'},{id:'training_route',x:448,y:496,shot:'route-grove'},{id:'rival_town',x:384,y:408,shot:'summit-square'}]){
  await fixture(item.id,{position:{x:item.x,y:item.y,facing:'down'}});
  await page.screenshot({path:`/tmp/everstride-ordered-${item.shot}-1366.png`});
  if(item.shot==='town-plaza'){await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);await page.screenshot({path:'/tmp/everstride-ordered-town-plaza-844.png'});await page.setViewportSize({width:1366,height:768});}
 }
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,fixture:true,heldE:true,arrivalCooldown:true,pointerCooldown:true,movementDuringGuard:true,exteriorScreenshots:5,errors}));
}finally{await browser.close();}
