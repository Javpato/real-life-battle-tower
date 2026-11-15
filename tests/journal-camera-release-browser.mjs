import {chromium,expect} from '@playwright/test';
const base=process.env.GAME_URL||'http://127.0.0.1:5191';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const page=await browser.newPage({viewport:{width:915,height:412}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__tracks=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const stream=await original(c);window.__tracks.push(...stream.getTracks());return stream;};});
 await page.goto(base);await page.waitForTimeout(1950);const click=name=>page.getByRole('button',{name,exact:true}).click();
 await click('PRESS ANYTHING TO START');await click('Explore a local preview');await page.getByRole('button',{name:/Infinite Tower A new/}).click();await click('Begin a new ascent');await click('Enter floor 1');await page.locator('.bt-moves>button').first().click();
 const guide=page.getByRole('button',{name:'Close exercise guide'});if(await guide.isVisible())await guide.click();await click('Enable camera');
 await expect(page.locator('.exercise-camera')).toHaveAttribute('data-camera-state','ready',{timeout:45000});
 await click('Open journal');await expect.poll(()=>page.evaluate(()=>window.__tracks.every(t=>t.readyState==='ended'))).toBe(true);
 await page.locator('[data-guide=journal-add]').click();await click('Scan a barcode');await expect(page.getByRole('region',{name:'Barcode camera'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__tracks.filter(t=>t.readyState==='live').length)).toBe(1);
 await page.locator('[data-guide=journal-food-close]').click();await expect.poll(()=>page.evaluate(()=>window.__tracks.every(t=>t.readyState==='ended'))).toBe(true);
 await page.locator('[data-guide=journal-close]').click();await expect(page.locator('.exercise-camera')).toHaveAttribute('data-camera-state','off');await expect(page.locator('.bt-series-controls').getByRole('button',{name:'Resume',exact:true})).toBeVisible();
 expect(errors).toEqual([]);console.log(JSON.stringify({passed:true,checks:['release exercise camera before journal scanner','single active camera','close scanner releases tracks','return preserves paused battle and requires explicit webcam restart'],errors,syntheticCamera:true}));
}finally{await browser.close();}
