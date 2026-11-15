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
 const timer=()=>page.getByRole('timer',{name:'Set countdown'});
 const saved=()=>page.getByTestId('saved-units');
 async function ready(){
  await page.evaluate(()=>{window.__flashAngle=175;});
  await page.waitForTimeout(6500);
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
 await expect(timer()).toHaveText('—s');
 // Actual synthetic landmark cycles establish the reference, not injected units.
 for(let n=1;n<=3;n++){await cycle();await expect(saved()).toHaveText(String(n));}
 await expect(page.getByTestId('trial-state')).toHaveText('test');
 const cadence=Number(await page.getByTestId('cadence').innerText());
 const initial=Number.parseFloat(await timer().innerText());
 expect(initial).toBeGreaterThan(0);
 await pose(122,220);await page.waitForTimeout(100);await pose(175,220);await page.waitForTimeout(160);
 await expect(saved()).toHaveText('4');
 const after=Number.parseFloat(await timer().innerText());expect(after).toBeLessThan(initial);
 await page.getByRole('region',{name:'Flash timer'}).screenshot({path:`${out}/whole-set-countdown.png`});
 // Receipts take longer than a repetition: recognition must continue while saving.
 await page.evaluate(()=>{window.__flashReceiptDelay=1000;});
 for(let n=5;n<=9;n++){await pose(122,220);await page.waitForTimeout(100);await pose(175,220);await page.waitForTimeout(160);}
 await expect(saved()).toHaveText('9',{timeout:10000});
 await expect(page.getByTestId('trial-state')).toHaveText('complete');
 await page.getByRole('button',{name:'Finish trial',exact:true}).click();
 await expect(page.getByTestId('verification')).toHaveText('verified');
 // Manual fallback retains explicit unverified provenance.
 await page.getByRole('button',{name:'Reset trial',exact:true}).click();await page.getByRole('button',{name:'Manual mode',exact:true}).click();
 await expect(page.getByRole('region',{name:'Flash timer'})).toContainText('unverified');
 for(let n=1;n<=9;n++)await page.getByRole('button',{name:'Confirm manual repetition',exact:true}).click();
 await page.getByRole('button',{name:'Finish trial',exact:true}).click();await expect(page.getByTestId('verification')).toHaveText('manual');await expect(page.getByTestId('cadence')).toHaveText('none');
 expect(await page.evaluate(()=>window.__localCaptures)).toBe(0);expect(errors).toEqual([]);
 const report={passed:true,syntheticPhoneGeometry:true,physicalCameraTested:false,checks:['three reference cycles','six faster test cycles','whole-set countdown decreases without resetting each repetition','one-second receipts do not block faster repetitions','verified cadence persists','manual completion unverified','no local camera acquisition'],cameraCadenceMs:cadence,errors};
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
