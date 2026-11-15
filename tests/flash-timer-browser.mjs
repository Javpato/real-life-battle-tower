/** Synthetic integration: real phone-frame path, detector and canonical reducer.
 * This does not validate a physical camera or human exercise technique.
 */
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.GAME_URL||'http://127.0.0.1:5191';
const out=process.env.QA_DIR||'/tmp/bt-flash-timer-qa';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  localStorage.setItem('everstride-guide-squat','seen');
  localStorage.setItem('everstride-exercise-voice','off');
  window.__localCaptures=0;
  navigator.mediaDevices.getUserMedia=async()=>{window.__localCaptures++;throw Error('Phone input must not acquire a local camera');};
 });
 await page.goto(`${base.replace(/\/$/,'')}/tests/fixtures/flash-timer.html`);
 await page.getByRole('heading',{name:'Flash timing · synthetic phone integration'}).waitFor();
 // Keep a real-time stream going while the test changes only anatomical pose.
 // Near hip/knee/ankle geometry matches flash-detection.test.ts; no observations,
 // exercise units, timer state or saved progress are injected here.
 await page.evaluate(()=>{
  window.__flashAngle=175;
  window.__flashPump=setInterval(()=>{
   const radians=window.__flashAngle*Math.PI/180;
   const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0}));
   const point=(i,x,y)=>{landmarks[i]={x,y,visibility:.98,presence:.98};};
   point(23,.5-Math.sin(radians)*.22,.65+Math.cos(radians)*.22);
   point(25,.5,.65);point(27,.5,.87);
   window.dispatchEvent(new CustomEvent('test-flash-frame',{detail:{timestamp:performance.now(),width:480,height:480,landmarks}}));
  },60);
 });
 const timer=()=>page.getByRole('timer',{name:'Observed repetition time'});
 const saved=()=>page.getByTestId('saved-units');
 async function ready(){
  await page.evaluate(()=>{window.__flashAngle=175;});
  await expect(page.getByRole('region',{name:'Flash timer'})).not.toContainText('PAUSED',{timeout:15000});
  await page.waitForTimeout(350);
 }
 async function pose(angle,duration=400){
  await page.evaluate(async({angle,duration})=>{
   const from=window.__flashAngle,start=performance.now();
   await new Promise(resolve=>{
    const tick=()=>{const p=Math.min(1,(performance.now()-start)/duration);window.__flashAngle=from+(angle-from)*p;if(p<1)requestAnimationFrame(tick);else resolve();};tick();
   });
  },{angle,duration});
 }
 async function cycle(){await pose(122);await page.waitForTimeout(420);await pose(175);await page.waitForTimeout(500);}
 await ready();
 await expect(saved()).toHaveText('0');
 await expect(timer()).toHaveText('0.0s');
 // The timer starts with observed motion and resets when rest interrupts it.
 await pose(122);await page.waitForTimeout(220);
 const first=Number.parseFloat(await timer().innerText());
 await page.waitForTimeout(240);
 const later=Number.parseFloat(await timer().innerText());
 expect(first).toBeGreaterThan(0);expect(later).toBeGreaterThan(first);
 await page.screenshot({path:`${out}/camera-timer-active.png`});
 await page.getByRole('button',{name:'Pause / rest',exact:true}).click();
 await expect(timer()).toHaveText('0.0s');await page.waitForTimeout(350);await expect(timer()).toHaveText('0.0s');await expect(saved()).toHaveText('0');
 await page.evaluate(()=>{window.__flashAngle=175;});
 await page.getByRole('button',{name:'Resume recognition',exact:true}).click();await ready();
 // An authority rejection cannot become local repetition progress.
 await page.getByRole('button',{name:'Reject next stale receipt',exact:true}).click();await cycle();
 await expect(page.getByTestId('rejected')).toHaveText('1');await expect(saved()).toHaveText('0');
 // Three real reference cycles, followed by six measured test cycles.
 for(let n=1;n<=9;n++){
  await cycle();await expect(saved()).toHaveText(String(n));
  if(n===3){await expect(page.getByTestId('trial-state')).toHaveText('test');expect(Number(await page.getByTestId('cadence').innerText())).toBeGreaterThanOrEqual(700);await expect(page.getByRole('region',{name:'Flash timer'})).toContainText('s / rep');}
 }
 await expect(page.getByTestId('trial-state')).toHaveText('complete');
 await page.getByRole('button',{name:'Finish trial',exact:true}).click();
 await expect(page.getByTestId('verification')).toHaveText('verified');
 const cadence=Number(await page.getByTestId('cadence').innerText());expect(cadence).toBeGreaterThanOrEqual(700);expect(cadence).toBeLessThanOrEqual(12000);
 // Manual practice has an explicitly unverified stopwatch, never a camera pace.
 await page.getByRole('button',{name:'Reset trial',exact:true}).click();await page.getByRole('button',{name:'Manual mode',exact:true}).click();
 const practice=page.getByRole('timer',{name:'Unverified practice time'});
 await expect(page.getByRole('region',{name:'Flash timer'})).toContainText('Practice pace · unverified');
 await page.waitForTimeout(400);expect(Number.parseFloat(await practice.innerText())).toBeGreaterThan(.1);
 await page.getByRole('button',{name:'Pause trial',exact:true}).click();const frozen=await practice.innerText();await page.waitForTimeout(400);await expect(practice).toHaveText(frozen);
 await page.getByRole('button',{name:'Resume trial',exact:true}).click();
 await page.getByRole('button',{name:'Confirm manual repetition',exact:true}).click();await expect(saved()).toHaveText('1');expect(Number.parseFloat(await practice.innerText())).toBeLessThan(.4);
 await page.screenshot({path:`${out}/manual-unverified-timer.png`});
 for(let n=2;n<=9;n++)await page.getByRole('button',{name:'Confirm manual repetition',exact:true}).click();
 await page.getByRole('button',{name:'Finish trial',exact:true}).click();await expect(page.getByTestId('verification')).toHaveText('manual');await expect(page.getByTestId('cadence')).toHaveText('none');
 expect(await page.evaluate(()=>window.__localCaptures)).toBe(0);expect(errors).toEqual([]);
 const report={passed:true,syntheticPhoneGeometry:true,physicalCameraTested:false,checks:['observed moving timer','rest resets and freezes','canonical stale receipt rejection','three reference and six test cycles','verified cadence persisted','manual unverified stopwatch','manual pause and reset','manual completion stores no cadence','no local camera acquisition'],cameraCadenceMs:cadence,errors};
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
