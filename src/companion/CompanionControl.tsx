import {useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import type {PoseFrame} from '../exercises/detectors';
import {CompanionPeer} from './peer';
import {HttpSignalTransport,phonePairUrl,type CreatedPair} from './transport';
import type {PairView} from './protocol';
import './companion.css';
export type CompanionControlProps={onFrame:(frame:PoseFrame|null)=>void;onSourceChange:(source:'webcam'|'phone')=>void};
export default function CompanionControl(props:CompanionControlProps){
 const callbacks=useRef(props);callbacks.current=props;const peer=useRef<CompanionPeer|null>(null),generation=useRef(0),preview=useRef<HTMLVideoElement>(null);
 const [pair,setPair]=useState<CreatedPair|null>(null),[state,setState]=useState<PairView|null>(null),[qr,setQr]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('Use this device’s webcam, or pair a phone on the same Wi-Fi.'),[connected,setConnected]=useState(false),[videoEnabled,setVideoEnabled]=useState(false);
 useEffect(()=>()=>{generation.current++;peer.current?.close();callbacks.current.onFrame(null);},[]);
 async function begin(){const epoch=++generation.current;peer.current?.close();peer.current=null;setPair(null);setState(null);setQr('');setConnected(false);setBusy(true);callbacks.current.onFrame(null);callbacks.current.onSourceChange('phone');try{
  if(!window.isSecureContext)throw Error('Phone cameras require HTTPS. Use the published HTTPS address; a plain LAN address cannot request camera access.');
  const transport=new HttpSignalTransport(),created=await transport.create();if(epoch!==generation.current)return;const image=await QRCode.toDataURL(phonePairUrl(created.roomId,created.inviteToken),{width:256,margin:2,errorCorrectionLevel:'M'});if(epoch!==generation.current)return;setPair(created);setQr(image);
  const p=new CompanionPeer('desktop',created.roomId,created.desktopToken,transport,{onState:setState,onStatus:setStatus,onFrame:frame=>callbacks.current.onFrame(frame),onConnected:()=>setConnected(true),onPreview:stream=>{if(preview.current){preview.current.srcObject=stream;if(stream)void preview.current.play().catch(()=>{});}setVideoEnabled(Boolean(stream));}});peer.current=p;p.start();setStatus('Scan the QR code on your phone. Pairing expires in five minutes.');
 }catch(error){if(epoch===generation.current)setStatus(error instanceof Error?error.message:String(error));}finally{if(epoch===generation.current)setBusy(false);}}
 function webcam(){generation.current++;peer.current?.close();peer.current=null;setPair(null);setState(null);setQr('');setConnected(false);setVideoEnabled(false);callbacks.current.onFrame(null);callbacks.current.onSourceChange('webcam');setStatus('Webcam selected. Enable it with the camera controls when ready.');}
 return <section className="companion-control" aria-label="Phone camera companion" data-guide="phone-companion"><h3>Use your phone as the camera</h3><p>Keep the adventure on this screen. Your phone recognizes your pose locally and sends joint positions directly to this device.</p><div className="companion-actions"><button type="button" onClick={()=>void begin()} disabled={busy}>{busy?'Preparing pairing…':pair?'New pairing code':'Pair phone camera'}</button><button type="button" onClick={webcam}>Use webcam instead</button></div><p role="status">{status}</p>
 {pair&&!connected&&<div className="companion-pairing">{qr&&<img src={qr} width="220" height="220" alt="Scan to open the temporary phone camera connection"/>}<div><strong>Same Wi-Fi · expires {new Date(pair.expiresAt).toLocaleTimeString()}</strong><p>Open the link on your phone, then compare the six-digit code shown on both screens.</p><a href={phonePairUrl(pair.roomId,pair.inviteToken)} target="_blank" rel="noreferrer">Open temporary phone link</a><button type="button" onClick={()=>void navigator.clipboard?.writeText(phonePairUrl(pair.roomId,pair.inviteToken)).then(()=>setStatus('Temporary pairing link copied.')).catch(()=>setStatus('Copy the temporary link using your browser.'))}>Copy link</button></div></div>}
 {state?.phoneName&&!state.approved&&<div className="companion-confirm"><strong>{state.phoneName} wants to connect</strong><b className="companion-code">{state.challenge}</b><p>Only confirm if this code matches your own phone.</p><button type="button" onClick={()=>void peer.current?.approve(state.challenge!).catch(error=>setStatus(String(error)))}>Confirm this phone</button><button type="button" onClick={webcam}>Reject</button></div>}
 <video ref={preview} className="companion-preview" hidden={!videoEnabled} muted playsInline autoPlay aria-label="Optional direct phone video preview"/>
 {connected&&<p className="companion-connected">Phone connected. Stop or disconnect on either screen at any time. A lost connection pauses incoming exercise data.</p>}
 <small>No account, save or food journal is shared. Camera images stay on the phone unless you explicitly enable the direct video preview there.</small></section>;
}
