import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL||'http://127.0.0.1:5174';
const out=process.env.QA_DIR||'/tmp/bt-challenge-tiers-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(base);await page.waitForTimeout(1900);
 await page.getByRole('button',{name:'PRESS ANYTHING TO START',exact:true}).click();
 await page.getByRole('button',{name:'New adventure',exact:true}).first().click();
 await page.getByRole('button',{name:'Choose this adventurer',exact:true}).click();
 await page.getByLabel('Your name',{exact:true}).fill('Tier QA');
 await page.getByRole('button',{name:'Begin your adventure',exact:true}).click();
 await page.getByRole('button',{name:/Challenges/}).click();
 await expect(page.getByRole('button',{name:'Enter challenge',exact:true})).toHaveCount(10);
 const hard=page.getByRole('button',{name:'Clear the matching easy tower first',exact:true});await expect(hard).toHaveCount(10);
 for(const button of await hard.all())await expect(button).toBeDisabled();
 for(const[width,height]of [[1920,1080],[1366,768],[1280,720],[915,412],[800,360]]){
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight])).toEqual([width,height]);
  await page.screenshot({path:`${out}/challenge-tiers-${width}x${height}.png`});
 }
 await page.getByRole('button',{name:'Enter challenge',exact:true}).nth(1).click();
 await page.getByRole('button',{name:'Enter floor 1',exact:true}).click();
 await expect(page.locator('.bt-moves>button')).toHaveCount(4);
 await page.locator('.bt-moves>button').filter({hasText:'Wall Push-up'}).click();
 await page.getByRole('button',{name:'Manual',exact:true}).click();
 await page.getByRole('button',{name:'Confirm one repetition',exact:true}).click();
 await expect(page.locator('.bt-camera-pane .bt-progress-display')).toContainText('1');
 await page.screenshot({path:`${out}/borrowed-challenge-attack-800x360.png`});
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,easyOpen:10,hardLocked:10,borrowedAttack:true,viewports:5,errors}));
}finally{await browser.close();}
