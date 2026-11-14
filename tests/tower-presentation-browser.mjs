import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const out=process.env.QA_DIR||'/tmp/bt-presentation-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],anchors=[];
const sizes=[[1920,1080],[1366,768],[1280,720],[915,412],[800,360]];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__speech=[];Object.defineProperty(window,'speechSynthesis',{value:{speaking:false,getVoices:()=>[],cancel:()=>{},speak:s=>window.__speech.push({text:s.text,lang:s.lang})}})});
async function click(name){await page.getByRole('button',{name,exact:true}).click()}
async function shot(name){await page.screenshot({path:`${out}/${name}.png`})}
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:4174');await page.waitForTimeout(1950);
 for(const[width,height]of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(120);const imgs=page.locator('.pixel-title-party>img');await expect(imgs).toHaveCount(2);for(const img of await imgs.all()){await expect(img).toHaveCSS('image-rendering','pixelated');const b=await img.boundingBox();expect(b.width).toBe(b.height);expect(b.width%128).toBe(0)}await shot(`title-${width}x${height}`)}
 await click('PRESS ANYTHING TO START');await click('Explore a local preview');
 for(const[width,height]of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(150);const v=await page.locator('.pixel-scene-hub').evaluate(el=>{const p=el.querySelector('.pixel-scene-plane').getBoundingClientRect(),s=el.querySelector('.pixel-hub-hero').getBoundingClientRect();return{x:(s.x+s.width/2-p.x)/p.width,y:(s.y+s.height*122/128-p.y)/p.height,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}});expect(v.x).toBeCloseTo(184/480,3);expect(v.y).toBeCloseTo(250/270,3);expect(v.width).toBe(width);expect(v.height).toBe(height);anchors.push({width,height,...v});await shot(`hub-${width}x${height}`)}
 await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:/Infinite Tower A new/}).click();await page.getByLabel('Preview starting floor').fill('5');await click('Begin a new ascent');await click('Enter floor 5');
 async function labels(){const badges=page.locator('.bt-effectiveness');await expect(badges).toHaveCount(4);for(const b of await badges.all()){const m=Number(await b.getAttribute('data-multiplier'));await expect(b).toContainText(m>1?'Super effective':m<1?'Not very effective':'Effective')}}
 for(const[width,height]of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(100);await labels();for(const b of await page.locator('.bt-moves>button').all()){await expect(b).toBeInViewport();const box=await b.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.y+box.height).toBeLessThanOrEqual(height)}expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(height);await shot(`attacks-${width}x${height}`)}
 await page.setViewportSize({width:1366,height:768});const name=await page.locator('.bt-health.enemy>strong').innerText();let phases=0;
 for(let turn=0;turn<40;turn++){
  if(await page.getByRole('button',{name:'Claim floor result',exact:true}).isVisible())break;
  if(await page.getByRole('button',{name:'Face the next phase',exact:true}).isVisible()){phases++;expect((await page.evaluate(()=>window.__speech)).filter(s=>s.text.startsWith('You defeated'))).toHaveLength(0);await shot('phase-change');await click('Face the next phase');await labels();continue;}
  if(await page.locator('.bt-moves>button').count()){const moves=await page.locator('.bt-effectiveness').evaluateAll(els=>els.map(e=>Number(e.dataset.multiplier)));const idx=moves.indexOf(Math.max(...moves));await page.locator('.bt-moves>button').nth(idx).click();await click('Manual')}
  for(let i=0;i<35;i++){const b=page.getByRole('button',{name:/Confirm one (repetition|held second)/});if(!await b.isVisible()||!await b.isEnabled())break;await b.click();await page.waitForTimeout(60)}await page.waitForTimeout(1100);
 }
 await expect(page.getByRole('button',{name:'Claim floor result',exact:true})).toBeVisible();await page.waitForTimeout(300);let speech=await page.evaluate(()=>window.__speech);expect(speech.filter(s=>s.text===`You defeated ${name}!`)).toEqual([{text:`You defeated ${name}!`,lang:'en-US'}]);await shot('victory');await page.setViewportSize({width:915,height:412});await page.waitForTimeout(400);speech=await page.evaluate(()=>window.__speech);expect(speech.filter(s=>s.text.startsWith('You defeated'))).toHaveLength(1);expect(phases).toBeGreaterThan(0);expect(errors).toEqual([]);
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,sizes,anchors,phases,speech,errors,realSpeakerTested:false},null,2));console.log(JSON.stringify({passed:true,phases,speech,errors}));
}finally{await browser.close()}
