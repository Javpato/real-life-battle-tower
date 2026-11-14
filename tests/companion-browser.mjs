/** Two separate Chrome processes, real WebRTC; in-memory signaling and synthetic poses only. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {applySignal,createPairState,pairView,roleForToken} from '../src/companion/protocol.ts';
const base=process.env.GAME_URL??'http://127.0.0.1:5182';
const hash=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const rooms=new Map(),signals=[];const cap=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function signaling(route){const body=route.request().postDataJSON();signals.push(body);try{
 if(body.action==='create'){const roomId=crypto.randomUUID(),desktopToken=cap(),inviteToken=cap();const state=createPairState(roomId,await hash(desktopToken),await hash(inviteToken),Date.now());rooms.set(roomId,state);return route.fulfill({json:{roomId,desktopToken,inviteToken,expiresAt:state.expiresAt}});}
 const state=rooms.get(body.roomId);if(!state)throw Error('PAIR_EXPIRED');const role=roleForToken(state,await hash(body.token));if(!role)throw Error('INVALID_CAPABILITY');const phoneToken=body.action==='claim'?cap():undefined;
 const payload=body.action==='claim'?{phoneHash:await hash(phoneToken),phoneName:'Test phone',challenge:'123456'}:body.payload;
 const next=applySignal(state,role,body.action,payload,Date.now());rooms.set(body.roomId,next);return route.fulfill({json:{...pairView(next,body.action==='claim'?'phone':role),...(phoneToken?{phoneToken}:{})}});
 }catch(error){return route.fulfill({status:400,json:{error:error.message}});}}
const browsers=await Promise.all([1,2].map(()=>chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']})));
try{
 const pages=[];for(const browser of browsers){const page=await browser.newPage();await page.route('**/functions/v1/camera-pair',signaling);await page.route('**/companion-peer-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated companion browser fixture</title>'}));await page.goto(base+'/companion-peer-fixture');pages.push(page);}
 const [desktop,phone]=pages;
 const pair=await desktop.evaluate(async()=>{const {HttpSignalTransport}=await import('/src/companion/transport.ts');window.transport=new HttpSignalTransport(location.origin+'/functions/v1/camera-pair','');return window.transport.create();});
 const claim=await phone.evaluate(async pair=>{const {HttpSignalTransport}=await import('/src/companion/transport.ts');window.transport=new HttpSignalTransport(location.origin+'/functions/v1/camera-pair','');return window.transport.request(pair.roomId,pair.inviteToken,'claim',{phoneName:'Test phone'});},pair);
 await assert.rejects(()=>phone.evaluate(async pair=>window.transport.request(pair.roomId,pair.inviteToken,'claim',{phoneName:'Second phone'}),pair),/PHONE_ALREADY_CLAIMED/);
 await desktop.evaluate(async({pair})=>{const {CompanionPeer}=await import('/src/companion/peer.ts');window.frames=[];window.previews=[];window.connected=false;window.statuses=[];window.peer=new CompanionPeer('desktop',pair.roomId,pair.desktopToken,window.transport,{onFrame:f=>window.frames.push(f),onPreview:s=>window.previews.push(Boolean(s)),onConnected:()=>window.connected=true,onStatus:s=>window.statuses.push(s)});window.peer.start();},{pair});
 await phone.evaluate(async({pair,claim})=>{const {CompanionPeer}=await import('/src/companion/peer.ts');window.connected=false;window.peer=new CompanionPeer('phone',pair.roomId,claim.phoneToken,window.transport,{onConnected:()=>window.connected=true});window.peer.start();},{pair,claim});
 assert.equal(await desktop.evaluate(()=>window.connected),false);
 await desktop.evaluate(challenge=>window.peer.approve(challenge),claim.challenge);
 await expect.poll(()=>desktop.evaluate(()=>window.connected),{timeout:20000}).toBe(true);await expect.poll(()=>phone.evaluate(()=>window.connected),{timeout:10000}).toBe(true);
 await phone.evaluate(async()=>{for(let i=0;i<20;i++){const timestamp=performance.now();window.peer.sendPose({timestamp,width:640,height:480,landmarks:Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.95,presence:.95}))});await new Promise(r=>setTimeout(r,50));}});
 assert(await desktop.evaluate(()=>window.frames.filter(Boolean).length)>0,'No fresh peer poses received');assert.equal(await desktop.evaluate(()=>window.previews.some(Boolean)),false,'Preview enabled without consent');
 await phone.evaluate(async()=>{window.media=await navigator.mediaDevices.getUserMedia({video:true,audio:false});await window.peer.setPreview(window.media.getVideoTracks()[0]);});await expect.poll(()=>desktop.evaluate(()=>window.previews.at(-1)),{timeout:10000}).toBe(true);
 await phone.evaluate(()=>window.peer.setPreview(null));await expect.poll(()=>desktop.evaluate(()=>window.previews.at(-1))).toBe(false);
 await expect.poll(()=>desktop.evaluate(()=>window.frames.at(-1)),{timeout:1500}).toBe(null);
 await phone.evaluate(()=>window.peer.stopPose());await expect.poll(()=>desktop.evaluate(()=>window.frames.at(-1))).toBe(null);
 const before=await desktop.evaluate(()=>window.frames.filter(Boolean).length);await phone.evaluate(()=>window.peer.sendPose({timestamp:performance.now()-2000,width:640,height:480,landmarks:[]}));await new Promise(r=>setTimeout(r,150));assert.equal(await desktop.evaluate(()=>window.frames.filter(Boolean).length),before);
 await phone.evaluate(()=>{window.peer.close();window.media.getTracks().forEach(t=>t.stop());});await expect.poll(()=>desktop.evaluate(()=>window.frames.at(-1))).toBe(null);await desktop.evaluate(()=>window.peer.close());
 assert(signals.every(s=>!JSON.stringify(s).includes('landmarks')&&!JSON.stringify(s).includes('data:image')),'Media or poses passed through signaling');
 console.log('PASS: two actual Chrome peers, desktop confirmation, one-phone claim, direct fresh poses, no default video, explicit video opt-in/off, stale-frame stop, disconnect, no pose/image payloads to signaling. Synthetic pose and fake camera fixtures; not physical-device validation.');
}finally{await Promise.all(browsers.map(b=>b.close()));}
