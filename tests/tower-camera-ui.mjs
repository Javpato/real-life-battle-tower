// Actual tower UI and real Lite model; browser fake camera has no human body.
// This checks integration and layout, never exercise-recognition accuracy.
import {chromium,expect} from '@playwright/test';
const b=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const p=await b.newPage({viewport:{width:1366,height:768}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:5174');await p.waitForTimeout(2100);
 await p.getByRole('button',{name:'PRESS ANYTHING TO START'}).click();await p.getByRole('button',{name:'Explore a local preview'}).click();
 await p.getByRole('button',{name:/Infinite Tower A new/}).click();await p.getByRole('button',{name:'Begin a new ascent'}).click();
 await p.getByRole('button',{name:'Enter floor 1'}).click();await p.locator('.bt-moves>button').first().click();
 const close=p.getByRole('button',{name:'Close exercise guide'});if(await close.isVisible())await close.click();
 await p.getByRole('button',{name:'Enable camera',exact:true}).click();
 try{await expect.poll(()=>p.locator('.exercise-feed video').evaluate(v=>v.readyState),{timeout:20000}).toBeGreaterThanOrEqual(2)}catch(e){await p.screenshot({path:'/tmp/tower-camera-failure.png'});console.log(await p.locator('.exercise-camera').innerText());console.log(await p.locator('.exercise-feed video').evaluate(v=>({ready:v.readyState,src:!!v.srcObject,paused:v.paused,tracks:v.srcObject?.getTracks().map(t=>({state:t.readyState,enabled:t.enabled}))})));console.log(errors);throw e};
 await p.waitForTimeout(3500);
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720],[915,412],[800,360]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(200);await p.locator('.bt-camera-pane').evaluate(e=>e.scrollTop=0);
  await p.screenshot({path:`/tmp/battle-tower-qa/camera-fake-input-${width}x${height}.png`});
  expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  expect(await p.evaluate(()=>document.documentElement.scrollHeight)).toBe(height);
  await expect(p.locator('.exercise-feed video')).toBeInViewport();
 }
 await p.getByRole('button',{name:'Stop camera',exact:true}).click();
 expect(errors).toEqual([]);console.log('Tower camera/live model integration and5viewports passed with fake blank camera. No physical accuracy claim.');
}finally{await b.close();}
