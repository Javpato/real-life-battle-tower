import {useEffect,useRef,useState} from 'react';
import {CameraLifecycle, type CameraSnapshot} from '../exercises/cameraLifecycle';
import {CompanionPeer} from './peer';
import {HttpSignalTransport,readPhonePair} from './transport';
import type {PairView} from './protocol';
import './companion.css';

export default function PhoneCompanionScreen(){
 const [invitation]=useState(readPhonePair);
 const [state,setState]=useState<PairView|null>(null);
 const [status,setStatus]=useState('Connect this phone, then confirm its code on the Battle Tower screen.');
 const [busy,setBusy]=useState(false),[claimed,setClaimed]=useState(false),[ended,setEnded]=useState(false),[connected,setConnected]=useState(false);
 const [snapshot,setSnapshot]=useState<CameraSnapshot>({status:'off',message:'Camera off. Tap Start camera to allow local camera access.',stream:null});
 const [sharePreview,setSharePreview]=useState(false),[facing,setFacing]=useState<'user'|'environment'>('environment');
 const peer=useRef<CompanionPeer|null>(null),camera=useRef<CameraLifecycle|null>(null),video=useRef<HTMLVideoElement>(null),generation=useRef(0),previewEnabled=useRef(false);
 const cameraPending=snapshot.status==='requesting';
 const cameraOn=Boolean(snapshot.stream);

 useEffect(()=>{
  history.replaceState(null,'',location.pathname+location.search);
  const base=new URL(import.meta.env.BASE_URL,location.href);
  const controller=new CameraLifecycle({
   dependencies:{
    getUserMedia:constraints=>navigator.mediaDevices?.getUserMedia(constraints)??Promise.reject(Error('Camera access requires HTTPS and browser permission.')),
    createWorker:()=>new Worker(new URL('../exercises/pose.worker.ts',import.meta.url),{type:'module'}),
    captureFrame:v=>createImageBitmap(v),requestFrame:fn=>requestAnimationFrame(fn),cancelFrame:id=>cancelAnimationFrame(id),
    setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id),now:()=>performance.now()
   },
   init:{type:'init',modelUrl:new URL('models/pose_landmarker_lite.task',base).href,wasmUrl:new URL('models/wasm',base).href},
   onState:s=>{
    setSnapshot(s);
    if(s.stream){
     // Safari may withhold local ICE candidates until camera access is granted.
     // Local preview must never depend on an already connected data channel.
     peer.current?.allowConnection();
     if(previewEnabled.current)void peer.current?.setPreview(s.stream.getVideoTracks()[0]??null);
    }
    if(s.status==='off'||s.status==='error'){peer.current?.stopPose();void peer.current?.setPreview(null);}
   },
   onPose:frame=>{if(peer.current?.connected)peer.current.sendPose(frame);}
  });
  camera.current=controller;
  const hidden=()=>{if(document.hidden){controller.stop('Camera paused because the phone page is in the background. Return and press Start camera.');peer.current?.stopPose();}};
  document.addEventListener('visibilitychange',hidden);
  return()=>{generation.current++;document.removeEventListener('visibilitychange',hidden);controller.dispose();peer.current?.close();};
 },[]);

 async function connect(){
  if(!invitation)return;
  const epoch=++generation.current;setBusy(true);
  try{
   if(!window.isSecureContext)throw Error('Open the HTTPS game link to use this camera.');
   const transport=new HttpSignalTransport();
   const response=await transport.request(invitation.roomId,invitation.token,'claim',{phoneName:'My phone'});
   if(epoch!==generation.current)return;
   if(!response.phoneToken)throw Error('Phone claim could not be verified.');
   setClaimed(true);setState(response);
   const p=new CompanionPeer('phone',invitation.roomId,response.phoneToken,transport,{
    onState:setState,onStatus:setStatus,onConnected:()=>setConnected(true),
    onDisconnected:()=>{
     setConnected(false);setEnded(true);
     camera.current?.stop('The Battle Tower connection ended. Scan a new QR code to reconnect.');
    }
   },{waitForCamera:true});
   peer.current=p;p.start();
   setStatus('Tap Start camera, then compare and confirm this code on your Battle Tower screen. Nothing is shared before confirmation.');
  }catch(error){setStatus(error instanceof Error?error.message:String(error));}
  finally{setBusy(false);}
 }
 async function start(){
  if(!claimed||ended||cameraPending||cameraOn||!video.current)return;
  await camera.current?.start(video.current,{facingMode:facing});
 }
 function stop(){
  camera.current?.stop('Camera stopped. Your completed exercise progress stays on the Battle Tower screen.');
  peer.current?.stopPose();void peer.current?.setPreview(null);
 }
 function disconnect(){
  stop();peer.current?.close();peer.current=null;setConnected(false);setEnded(true);
  setStatus('Disconnected. Scan a new QR code on the Battle Tower screen to reconnect.');
 }

 return <main className="phone-companion"><header><span>REAL-LIFE BATTLE TOWER</span><h1>Your phone camera</h1><p>Movement here. Battle on your other screen.</p></header><section className="phone-companion-card">
  {!invitation?<p role="alert">This link is incomplete or was already used. Scan a new QR code on your Battle Tower screen.</p>:<>
   {!claimed&&<button className="primary" type="button" disabled={busy} onClick={()=>void connect()}>{busy?'Connecting…':'Connect this phone'}</button>}
   {state?.challenge&&!state.approved&&!ended&&<><p>Confirm this code on your Battle Tower screen</p><b className="companion-code">{state.challenge}</b></>}
   {state?.approved&&!connected&&!ended&&<p>{cameraOn?'Code confirmed. Camera on; connecting to your Battle Tower screen…':'Code confirmed. Start the camera to finish connecting.'}</p>}
   <p role="status" aria-label="Phone connection status">{status}</p>
   <div className="phone-camera-stage">
    <video ref={video} muted playsInline autoPlay className="phone-camera-preview" aria-label="Local phone camera preview"/>
    {!cameraOn&&<p className="phone-camera-placeholder">{cameraPending?'Allow camera access in the browser prompt.':snapshot.status==='error'?'Camera could not start. See the message below.':'Camera off · tap Start camera below'}</p>}
   </div>
   <p role={snapshot.status==='error'?'alert':'status'} aria-label="Camera status">{snapshot.message}</p>
   <div className="companion-actions">
    <button type="button" className="primary" disabled={!claimed||ended||cameraOn||cameraPending} onClick={()=>void start()}>{cameraPending?'Waiting for permission…':'Start camera'}</button>
    <button type="button" disabled={!cameraOn&&!cameraPending} onClick={stop}>Stop camera</button>
    <button type="button" onClick={disconnect} disabled={!claimed||ended}>Disconnect</button>
   </div>
   <label>Camera facing<select value={facing} onChange={e=>{stop();setFacing(e.target.value as 'user'|'environment');}}><option value="environment">Rear camera</option><option value="user">Front camera</option></select></label>
   <label className="companion-optin"><input type="checkbox" checked={sharePreview} disabled={!connected||ended} onChange={e=>{const enabled=e.target.checked;previewEnabled.current=enabled;setSharePreview(enabled);void peer.current?.setPreview(enabled?camera.current?.currentStream?.getVideoTracks()[0]??null:null);}}/>Also show live video on my Battle Tower screen (direct connection)</label>
  </>}
  <p className="companion-privacy">By default, only pose coordinates and confidence travel directly to your other device after you confirm the code. No camera images are sent to our server or saved. Your phone cannot access the Battle Tower save or nutrition journal.</p><p>Place the phone securely, leave space to move, and keep this page in front. Follow exercise instructions on the Battle Tower screen.</p>
 </section></main>;
}
