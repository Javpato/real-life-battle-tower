import {chromium,expect} from '@playwright/test';
import {WORLD_MAPS,ROOM_DETAILS} from '../src/core/worldMaps.ts';
// Explicit fixture QA: isolated IndexedDB snapshots select rooms; all door actions use real UI.
// This does not claim a played campaign or exercise/sensor validation.
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
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
 await expect(page.locator(`[data-map-id="${mapId}"]`)).toBeVisible();await expect(page.getByText('Opening the world…',{exact:true})).toHaveCount(0);await page.waitForTimeout(250);
}
async function key(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(120);}
async function leaveAndReturn(map){
 const exit=map.portals.find(p=>p.id.endsWith(':exit'));expect(exit).toBeTruthy();
 await key('s',180);await page.keyboard.press('e');await expect(page.locator(`[data-map-id="${exit.to}"]`)).toBeVisible();await page.waitForTimeout(350);
 const parent=WORLD_MAPS[exit.to],entry=parent.portals.find(p=>p.to===map.id);expect(entry).toBeTruthy();
 await page.keyboard.press('e');await expect(page.locator(`[data-map-id="${map.id}"]`)).toBeVisible();await page.waitForTimeout(250);
}
try{
 for(const map of (process.env.SKIP_ROOM_ROUND_TRIPS==='1'?[]:Object.values(WORLD_MAPS).filter(m=>m.kind==='interior'))){
  await fixture(map.id);await page.screenshot({path:`/tmp/everstride-room-${map.id}-1366.png`});
  await leaveAndReturn(map);console.log('Door round trip',map.id);
 }
 await fixture('starter_house_bedroom',{position:{x:300,y:145,facing:'up'}});
 await page.locator('.world-interact').click();await expect(page.getByText(ROOM_DETAILS['starter_house_bedroom:arrival-letter'].text,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.modal')).toHaveCount(0);
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
 const labelClear=await page.locator('.world-nearby-label').evaluate(label=>{const a=label.getBoundingClientRect();return [...document.querySelectorAll('.game-hud-player,.game-hud-objective')].every(hud=>{const b=hud.getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;});});expect(labelClear).toBe(true);
 await page.screenshot({path:'/tmp/everstride-room-bedroom-844.png'});
 await fixture('starter_town',{position:{x:200,y:275,facing:'up'}});await page.screenshot({path:'/tmp/everstride-world-labels-844.png'});
 const fonts=await page.locator('.world-map-label').evaluateAll(nodes=>nodes.map(node=>({size:parseFloat(getComputedStyle(node).fontSize),transform:getComputedStyle(node).transform})));expect(fonts.every(f=>f.size>=12)).toBe(true);
 await page.setViewportSize({width:1366,height:768});await page.screenshot({path:'/tmp/everstride-world-labels-1366.png'});
 // Rejected server-facing callback: the tutorial blocks the route, not houses.
 await fixture('starter_town',{position:{x:640,y:905,facing:'down'},badges:[],stage:1});
 await page.evaluate(()=>{window.__qaFades=[];new MutationObserver(()=>window.__qaFades.push(document.querySelector('.world-arrival')?.style.opacity)).observe(document.querySelector('.world-arrival'),{attributes:true,attributeFilter:['style']});});
 await key('s',800);expect((await snapshot()).journey.location.mapId).toBe('starter_town');
 await expect(page.locator('.world-portal-status')).toBeVisible();
 const atDoor=(await snapshot()).journey.location;await key('d',650);const away=(await snapshot()).journey.location;
 expect(away.x-atDoor.x).toBeGreaterThan(25);expect(away.mapId).toBe('starter_town');expect(await page.evaluate(()=>window.__qaFades.includes('1'))).toBe(false);
 await expect(page.locator('.world-portal-status')).toHaveCount(0);await page.screenshot({path:'/tmp/everstride-rejected-door-recovery.png'});
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,fixture:true,interiors:process.env.SKIP_ROOM_ROUND_TRIPS==='1'?0:14,rejectedDoorMovement:true,inspection:true,errors}));
}finally{await browser.close();}
