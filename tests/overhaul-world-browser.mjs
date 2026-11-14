import {chromium,expect} from '@playwright/test';
import {attacks,effectiveness} from '../src/core/game.ts';
import {WORLD_MAPS,isWalkable} from '../src/core/worldMaps.ts';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const origin=process.env.GAME_URL||'http://127.0.0.1:5173';
const snapshot=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('everstride');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('state'),store=tx.objectStore('state');const slots=store.get('save-slots:v1');slots.onsuccess=()=>{const q=store.get('adventure:'+slots.result[0].saveId);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)};tx.oncomplete=()=>db.close();};}));
async function walkTo(x,y){
 const startingMap=(await snapshot()).journey.location.mapId;
 for(let attempt=0;attempt<35;attempt++){
  const current=(await snapshot()).journey.location;if(current.mapId!==startingMap||Math.hypot(current.x-x,current.y-y)<16)return;
  const points=(({x,y,current})=>{const q=[{x:current.x,y:current.y,parent:-1}],seen=new Set();let found=-1;for(let i=0;i<q.length&&i<50000;i++){const p=q[i];if(Math.hypot(p.x-x,p.y-y)<12){found=i;break;}for(const [dx,dy]of[[8,0],[-8,0],[0,8],[0,-8]]){const xx=p.x+dx,yy=p.y+dy,k=`${xx},${yy}`;if(!seen.has(k)&&isWalkable(current.mapId,xx,yy)&&!WORLD_MAPS[current.mapId].npcs.some(n=>Math.abs(n.x-xx)<34&&Math.abs(n.y-yy)<28)){seen.add(k);q.push({x:xx,y:yy,parent:i});}}}if(found<0)throw Error('No walking path');const path=[];while(found>=0){path.unshift(q[found]);found=q[found].parent;}return path;})({x,y,current});
  if(points.length<2)return;const dx=Math.sign(points[1].x-current.x),dy=Math.sign(points[1].y-current.y);let end=points[1];for(const p of points.slice(2)){if(Math.sign(p.x-end.x)!==dx||Math.sign(p.y-end.y)!==dy)break;end=p;}
  const key=dx>0?'d':dx<0?'a':dy>0?'s':'w';const distance=Math.hypot(end.x-current.x,end.y-current.y);await page.keyboard.down('Shift');await page.keyboard.down(key);await page.waitForTimeout(Math.min(4000,distance/132*1000));await page.keyboard.up(key);await page.keyboard.up('Shift');await page.waitForTimeout(180);
 }
 throw Error('Could not reach '+x+','+y+' actual '+JSON.stringify((await snapshot()).journey.location));
}
async function battle(){
 for(let round=0;round<70;round++){
  const s=await snapshot(),b=s.battle;if(!b)return;if(b.turn==='won'){await page.getByRole('button',{name:'Continue adventure'}).click();await page.waitForTimeout(200);console.log('Won',b.enemy.id);return;}if(b.turn==='lost')throw Error('Lost '+b.enemy.id);
  if(b.turn==='transform'){await page.getByRole('button',{name:'Continue when ready'}).click();await page.waitForTimeout(200);continue;}
  if(b.turn==='enemy'){await page.waitForTimeout(1200);continue;}
  if(b.turn==='exercise'){const fallback=page.getByRole('button',{name:'Detection trouble? Continue remaining units manually'});if(await fallback.isVisible())await fallback.click();await page.getByRole('button',{name:'I completed the remaining units',exact:true}).click();await page.waitForTimeout(200);continue;}
  if(b.playerHp<43&&s.player.items.potion>0&&b.enemyHp>30){await page.getByRole('button',{name:'Items Use your supplies'}).click();await page.getByRole('button',{name:/Potion/}).click();await page.waitForTimeout(200);continue;}
  const choices=attacks.filter(a=>s.player.equipped.includes(a.id));choices.sort((a,c)=>c.damage*(1+(s.player.upgrades[c.id]??0)*.22)*effectiveness(c.type,b.enemy.phases[b.phase])*(1-Math.min(.4,.15*b.fatigue[c.type]))-a.damage*(1+(s.player.upgrades[a.id]??0)*.22)*effectiveness(a.type,b.enemy.phases[b.phase])*(1-Math.min(.4,.15*b.fatigue[a.type])));
  await page.locator('.command-attack').click();await page.locator('.attack-card').filter({has:page.getByText(choices[0].name,{exact:true})}).click();await page.waitForTimeout(150);
 }
 throw Error('Battle did not finish');
}
async function recover(){await page.getByRole('button',{name:'Rest House',exact:true}).click();const heal=page.getByRole('button',{name:'Rest and recover',exact:true});if(await heal.isVisible())await heal.click();await page.getByRole('button',{name:'Return to the village',exact:true}).click();}
async function leader(id,map){await portal(map+':enter',map);await walkTo(192,154);await page.keyboard.press('e');await page.getByLabel('Use camera verification').uncheck();await page.getByRole('button',{name:'Begin encounter'}).click();await battle();await recover();await portal(map+':exit','starter_town');expect((await snapshot()).player.defeated).toContain(id);}
async function portal(id,to){const data=Object.values(WORLD_MAPS).flatMap(m=>m.portals).find(p=>p.id===id);await walkTo(data.x+data.w/2,data.y+data.h/2+(data.id.endsWith(':enter')?25:-20));if((await snapshot()).journey.location.mapId!==to){await page.keyboard.press('e');}await expect(page.locator(`[data-map-id="${to}"]`)).toBeVisible();await page.waitForTimeout(450);console.log('Visited',to);}
try{
 await page.goto(origin);await page.waitForTimeout(2800);await page.getByRole('button',{name:'PRESS ANYTHING TO START'}).click();await page.getByRole('button',{name:'New adventure ▸'}).first().click();await page.getByRole('button',{name:'The adventurer Neutral'}).click();await page.getByRole('button',{name:'Choose this character'}).click();await page.getByLabel('Your name').fill('World QA');await page.getByRole('button',{name:'Begin adventure'}).click();await page.getByRole('button',{name:'Skip introduction'}).click();await page.waitForTimeout(900);
 await page.screenshot({path:'/tmp/everstride-new-bedroom.png'});
 await portal('bedroom:exit','starter_house');await portal('starter_house:exit','starter_town');await walkTo(280,332);await page.keyboard.press('e');await page.waitForTimeout(400);console.log((await page.locator('body').innerText()).slice(-3000));await page.screenshot({path:'/tmp/everstride-moss-tutorial.png'});
 await page.getByRole('button',{name:'Practice with Moss'}).click();
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:844,height:390}]){await page.setViewportSize(viewport);await page.waitForTimeout(220);await page.screenshot({path:`/tmp/everstride-battle-${viewport.width}.png`});const box=await page.locator('.combat-sprite.hero').boundingBox();expect(box.width).toBeGreaterThan(20);expect(box.height).toBeGreaterThan(20);}
 await page.setViewportSize({width:1366,height:768});await page.getByLabel('Camera',{exact:true}).uncheck();await page.locator('.command-attack').click();await page.locator('.attack-card').first().click();await page.getByRole('button',{name:'I completed the remaining units',exact:true}).click();await page.getByRole('button',{name:'Continue adventure'}).click();await page.waitForTimeout(300);expect((await snapshot()).player.xp).toBeGreaterThan(0);for(let i=0;i<2;i++)await page.locator('.tutorial-ribbon').getByRole('button',{name:'Continue',exact:true}).click();
 await portal('general_store:enter','general_store');await page.screenshot({path:'/tmp/everstride-shop.png'});await portal('general_store:exit','starter_town');
 await portal('starter_town:training_route','training_route');await page.screenshot({path:'/tmp/everstride-route.png'});await portal('training_route:rival_town','rival_town');await page.screenshot({path:'/tmp/everstride-summit.png'});
 const beforeReload=(await snapshot()).journey.location;await page.reload();await page.waitForTimeout(2700);await page.getByRole('button',{name:'PRESS ANYTHING TO START'}).click();await page.getByRole('button',{name:'Continue ▸'}).first().click();await expect(page.locator('[data-map-id="rival_town"]')).toBeVisible();expect((await snapshot()).journey.location).toEqual(beforeReload);
 await portal('rival_town:training_route','training_route');await portal('training_route:starter_town','starter_town');
 if(process.env.FULL_CAMPAIGN==='1'){await leader('leader-leg','gym_leg');await leader('leader-arm','gym_arm');await leader('leader-back','gym_back');await portal('starter_town:training_route','training_route');await portal('training_route:rival_town','rival_town');await portal('rival_arena:enter','rival_arena');await walkTo(192,154);await page.keyboard.press('e');await page.getByLabel('Use camera verification').uncheck();await page.getByRole('button',{name:'Begin encounter'}).click();await battle();expect((await snapshot()).player.ending).toBe(true);await page.screenshot({path:'/tmp/everstride-campaign-victory.png'});}
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,journey:'bedroom → home → tutorial battle victory → shop → route → summit → reload → village',errors}));
}catch(e){console.log('PAGE ERRORS',errors);console.log('FAIL SCREEN',await page.locator('body').innerText());await page.screenshot({path:'/tmp/everstride-world-failure.png'});throw e;}finally{await browser.close();}
