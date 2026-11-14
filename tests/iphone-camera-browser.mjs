/** Real Chromium peers + WebKit UI permission regression. Synthetic camera, not a physical iPhone. */
import {chromium,webkit,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {applySignal,createPairState,pairView,roleForToken} from '../src/companion/protocol.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:5185';
const out=process.env.QA_DIR||'/tmp/bt-iphone-qa';await fs.mkdir(out,{recursive:true});
const hash=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const rooms=new Map(),signals=[];const cap=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function signaling(route){const body=route.request().postDataJSON();signals.push(body);try{
 if(body.action==='create'){const roomId=crypto.randomUUID(),desktopToken=cap(),inviteToken=cap();const state=createPairState(roomId,await hash(desktopToken),await hash(inviteToken),Date.now());rooms.set(roomId,state);return route.fulfill({json:{roomId,desktopToken,inviteToken,expiresAt:state.expiresAt}})}
 const state=rooms.get(body.roomId);if(!state)throw Error('PAIR_EXPIRED');const role=roleForToken(state,await hash(body.token));if(!role)throw Error('INVALID_CAPABILITY');const phoneToken=body.action==='claim'?cap():undefined;
 const payload=body.action==='claim'?{phoneHash:await hash(phoneToken),phoneName:'Test iPhone',challenge:'123456'}:body.payload;
 const next=applySignal(state,role,body.action,payload,Date.now());rooms.set(body.roomId,next);
 return route.fulfill({json:{...pairView(next,body.action==='claim'?'phone':role),...(phoneToken?{phoneToken}:{})}});
 }catch(e){return route.fulfill({status:400,json:{error:e.message}})}}
const args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'];
const browsers=await Promise.all([1,2].map(()=>chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args})));
const errors=[],checks=[];
let safari;
async function wire(page){page.on('pageerror',e=>errors.push(e.message));await page.route('**/functions/v1/camera-pair',signaling)}
try{
 const desktop=await browsers[0].newPage();await wire(desktop);
 await desktop.route('**/peer-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Companion desktop fixture</title>'}));await desktop.goto(base+'/peer-fixture');
 async function create(){return desktop.evaluate(async()=>{
  window.peer?.close();const{HttpSignalTransport}=await import('/src/companion/transport.ts');const{CompanionPeer}=await import('/src/companion/peer.ts');
  window.transport=new HttpSignalTransport(location.origin+'/functions/v1/camera-pair','');const pair=await window.transport.create();window.connected=false;window.previews=[];window.peer=new CompanionPeer('desktop',pair.roomId,pair.desktopToken,window.transport,{onConnected:()=>window.connected=true,onPreview:s=>window.previews.push(Boolean(s))});window.peer.start();return pair;
 })}
 if(!process.env.ONLY_WEBKIT){
 const pair=await create();const phone=await browsers[1].newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});await wire(phone);
 await phone.addInitScript(()=>{window.__cameraAttempts=0;window.__deny=true;const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=c=>{window.__cameraAttempts++;if(window.__deny)return Promise.reject(new DOMException('User denied camera','NotAllowedError'));return original(c)}});
 await phone.goto(`${base}/?cameraCompanion=${pair.roomId}#token=${pair.inviteToken}`);await phone.getByRole('button',{name:'Connect this phone',exact:true}).click();await expect(phone.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();expect(await phone.evaluate(()=>window.__cameraAttempts)).toBe(0);checks.push('Start enabled before peer connection, no automatic camera permission');
 await desktop.evaluate(()=>window.peer.approve('123456'));await expect(phone.getByText('Code confirmed. Start the camera to finish connecting.')).toBeVisible();await phone.waitForTimeout(1200);expect(rooms.get(pair.roomId).answer).toBeUndefined();expect(await desktop.evaluate(()=>window.connected)).toBe(false);await phone.screenshot({path:`${out}/iphone-start-before-connection.png`});
 await phone.getByRole('button',{name:'Start camera',exact:true}).click();await expect(phone.getByRole('alert',{name:'Camera status'})).toContainText('permission was not granted');await expect(phone.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();expect(rooms.get(pair.roomId).answer).toBeUndefined();await phone.waitForTimeout(1500);await expect(phone.getByRole('alert',{name:'Camera status'})).toContainText('permission was not granted');checks.push('Permission denial remains visible; retry allowed; no ICE answer');
 await phone.evaluate(()=>window.__deny=false);await phone.getByRole('button',{name:'Start camera',exact:true}).click();await expect.poll(()=>desktop.evaluate(()=>window.connected),{timeout:30000}).toBe(true);
 await expect(phone.getByRole('status',{name:'Camera status'})).toContainText('Camera ready',{timeout:30000});await expect(phone.locator('video')).toHaveJSProperty('muted',true);await expect(phone.locator('video')).toHaveJSProperty('playsInline',true);
 expect(await desktop.evaluate(()=>window.previews.some(Boolean))).toBe(false);await phone.screenshot({path:`${out}/iphone-synthetic-camera-running.png`});checks.push('Camera ready after retry; real peer connection; default video privacy');
 await phone.getByRole('checkbox').check();await expect.poll(()=>desktop.evaluate(()=>window.previews.at(-1)),{timeout:10000}).toBe(true);await phone.getByRole('checkbox').uncheck();await expect.poll(()=>desktop.evaluate(()=>window.previews.at(-1))).toBe(false);checks.push('Explicit preview opt-in and opt-out');
 await phone.getByRole('button',{name:'Stop camera',exact:true}).click();await expect(phone.locator('video')).toHaveJSProperty('srcObject',null);await expect(phone.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();await phone.getByLabel('Camera facing').selectOption('user');await phone.getByRole('button',{name:'Start camera',exact:true}).click();await expect(phone.getByRole('status',{name:'Camera status'})).toContainText('Camera ready',{timeout:30000});await desktop.evaluate(()=>window.peer.close());await expect(phone.locator('video')).toHaveJSProperty('srcObject',null);await expect(phone.getByRole('button',{name:'Start camera',exact:true})).toBeDisabled();checks.push('Stop/restart, switch facing, remote disconnect releases camera');
 }
 await fs.writeFile(`${out}/chromium-report.json`,JSON.stringify({checks,errors,physicalIPhoneTested:false},null,2));
 // Linux WebKit verifies WebKit DOM/permission control flow; it is not an iOS handset.
 safari=await webkit.launch({headless:true});const wp=await safari.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});await wire(wp);
 await wp.addInitScript(()=>{window.__cameraAttempts=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{window.__cameraAttempts++;return Promise.reject(new DOMException('Denied','NotAllowedError'))}}})});
 const sp=await create();await wp.goto(`${base}/?cameraCompanion=${sp.roomId}#token=${sp.inviteToken}`);await wp.getByRole('button',{name:'Connect this phone',exact:true}).click();await expect(wp.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();await wp.getByRole('button',{name:'Start camera',exact:true}).click();await expect(wp.getByRole('alert',{name:'Camera status'})).toContainText('permission was not granted');expect(await wp.evaluate(()=>window.__cameraAttempts)).toBe(1);await wp.screenshot({path:`${out}/webkit-permission-feedback.png`});await wp.getByRole('button',{name:'Disconnect',exact:true}).click();await expect(wp.getByRole('button',{name:'Start camera',exact:true})).toBeDisabled();checks.push('WebKit permission button, clear error and disconnect');
 expect(errors).toEqual([]);expect(signals.every(s=>!JSON.stringify(s).includes('landmarks')&&!JSON.stringify(s).includes('data:image'))).toBe(true);console.log(JSON.stringify({passed:true,checks,errors,physicalIPhoneTested:false}));
 await fs.writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,errors,physicalIPhoneTested:false},null,2));
}finally{await safari?.close();await Promise.all(browsers.map(b=>b.close()))}
