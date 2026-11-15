import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL||'http://127.0.0.1:5191',out=process.env.QA_DIR||'/tmp/bt-flash-layout-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForTimeout(1950);
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 await click('PRESS ANYTHING TO START');await click('Explore a local preview');await page.getByRole('button',{name:/Skills Learn/}).click();await click('Attempt Flash trial');
 const guide=page.getByRole('button',{name:'Close exercise guide'});if(await guide.isVisible())await guide.click();
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[915,412],[800,360]]){
  await page.setViewportSize({width,height});const timer=page.getByRole('region',{name:'Flash timer'});
  await expect(timer).toBeVisible();await expect(timer).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`${out}/flash-trial-${width}x${height}.png`});
 }
 await click('Manual');const timer=page.getByRole('timer',{name:'Unverified practice time'});await expect(timer).not.toHaveText('0.0s');
 await page.locator('.bt-series-controls').getByRole('button',{name:'Rest',exact:true}).click();const atRest=await timer.textContent();await page.waitForTimeout(400);expect(await timer.textContent()).toBe(atRest);
 await page.locator('.bt-series-controls').getByRole('button',{name:'Resume',exact:true}).click();
 for(let i=0;i<9;i++)await click('Confirm one repetition');await click('Complete Flash trial');
 await expect(page.getByRole('button',{name:'Recalibrate Flash pace'})).toBeVisible();
 await page.getByRole('button',{name:'Recalibrate Flash pace'}).click();await expect(page.getByRole('heading',{name:/Mini Squat · Flash/})).toBeVisible();
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,checks:['visible Flash timer at five viewports','manual practice stopwatch and rest','manual unlock','repeat camera pace trial after manual unlock'],errors}));
}finally{await browser.close();}
