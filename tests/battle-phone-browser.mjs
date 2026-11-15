/** Real hosted signaling/peers with synthetic cameras; never accesses saved games. */
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL||'http://127.0.0.1:5191';
const out=process.env.QA_DIR||'/tmp/bt-battle-phone-qa';await fs.mkdir(out,{recursive:true});
const browsers=await Promise.all([1,2].map(()=>chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']})));
let desktop,phone;const errors=[];
try{
 desktop=await browsers[0].newPage({viewport:{width:915,height:412},serviceWorkers:'block'});
 phone=await browsers[1].newPage({viewport:{width:393,height:852},serviceWorkers:'block'});
 for(const p of [desktop,phone])p.on('pageerror',e=>errors.push(e.message));
 await desktop.goto(base);await desktop.waitForTimeout(1950);
 const click=name=>desktop.getByRole('button',{name,exact:true}).click();
 await click('PRESS ANYTHING TO START');await click('Explore a local preview');
 await desktop.getByRole('button',{name:/Infinite Tower A new/}).click();await click('Begin a new ascent');await click('Enter floor 1');
 await desktop.locator('.bt-moves>button').first().click();
 const guide=desktop.getByRole('button',{name:'Close exercise guide'});if(await guide.isVisible())await guide.click();
 await click('Manual');await click('Confirm one repetition');
 await expect(desktop.getByTestId('exercise-count')).toHaveText('1');
 const hp=await desktop.locator('.bt-health.enemy [role=progressbar]').getAttribute('aria-valuenow');
 await click('Connect phone camera');
 const dialog=desktop.getByRole('dialog',{name:'Connect phone camera'});
 await expect(dialog).toBeVisible();await expect(desktop.getByRole('button',{name:'Confirm one repetition'})).toBeDisabled();
 await click('Pair phone camera');
 const link=desktop.getByRole('link',{name:'Open temporary phone link'});await expect(link).toBeVisible({timeout:20000});
 await phone.goto(await link.getAttribute('href'));await phone.getByRole('button',{name:'Connect this phone',exact:true}).click();await click('Confirm this phone');
 await phone.getByRole('button',{name:'Start camera',exact:true}).click();
 await expect(phone.getByRole('status',{name:'Camera status'})).toContainText('Camera ready',{timeout:45000});
 await expect(desktop.locator('.companion-connected')).toBeVisible({timeout:30000});
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[915,412],[800,360]]){
  await desktop.setViewportSize({width,height});const close=desktop.getByRole('button',{name:'Close phone pairing'});await expect(close).toBeInViewport();
  expect(await desktop.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await desktop.screenshot({path:`${out}/battle-pairing-${width}x${height}.png`});
 }
 await click('Close phone pairing');await expect(dialog).toBeHidden();
 await expect(desktop.getByTestId('exercise-count')).toHaveText('1');
 expect(await desktop.locator('.bt-health.enemy [role=progressbar]').getAttribute('aria-valuenow')).toBe(hp);
 await expect(desktop.getByText('Phone pose tracking',{exact:true})).toBeVisible();
 await click('Manual');await click('Confirm one repetition');await expect(desktop.getByTestId('exercise-count')).toHaveText('2');
 await desktop.locator('.bt-series-controls').getByRole('button',{name:'Rest',exact:true}).click();
 await click('Connect phone camera');await expect(desktop.locator('.companion-connected')).toBeVisible();await click('Close phone pairing');
 await expect(desktop.locator('.bt-series-controls').getByRole('button',{name:'Resume',exact:true})).toBeVisible();
 await expect(desktop.getByRole('button',{name:'Confirm one repetition'})).toBeDisabled();
 await click('Connect phone camera');await click('Use webcam instead');await click('Close phone pairing');
 await expect(phone.locator('video')).toHaveJSProperty('srcObject',null,{timeout:10000});
 expect(errors).toEqual([]);
 const report={passed:true,checks:['pair during active series','canonical pause blocks manual credit','real signaling and WebRTC','actual MediaPipe with synthetic camera','five viewport accessible close','preserve damage and reps','persist connection after close','continue attack','preserve pre-existing rest','disconnect cleanup'],errors,physicalPhoneTested:false};
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await phone?.getByRole('button',{name:'Disconnect',exact:true}).click({timeout:1000}).catch(()=>{});await Promise.all(browsers.map(b=>b.close()));}
