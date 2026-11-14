import {chromium,expect} from '@playwright/test';import fs from 'node:fs/promises';
const url=process.env.GAME_URL;
if(!url?.startsWith('https://'))throw Error('Set GAME_URL to the public HTTPS game address.');
const out=process.env.QA_DIR||'/tmp/bt-public-camera-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
try{const page=await browser.newPage({viewport:{width:915,height:412}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);await page.waitForTimeout(1950);
const click=name=>page.getByRole('button',{name,exact:true}).click();await click('PRESS ANYTHING TO START');await click('Explore a local preview');await page.getByRole('button',{name:/Infinite Tower A new/}).click();await click('Begin a new ascent');await click('Enter floor 1');await page.locator('.bt-moves>button').first().click();
const close=page.getByRole('button',{name:'Close exercise guide'});if(await close.isVisible())await close.click();
await page.getByRole('button',{name:/Enable camera/}).first().click();
await page.waitForFunction(()=>[...document.querySelectorAll('video')].some(v=>v.srcObject?.getVideoTracks().some(t=>t.readyState==='live')),{timeout:30000});await page.waitForTimeout(10000);
const status=await page.locator('.exercise-camera').innerText();expect(errors).toEqual([]);await page.screenshot({path:`${out}/public-game-camera.png`});await fs.writeFile(`${out}/public-game-camera.json`,JSON.stringify({syntheticCamera:true,physicalCameraTested:false,status,errors},null,2));console.log(JSON.stringify({passed:true,status,errors}));}finally{await browser.close()}
