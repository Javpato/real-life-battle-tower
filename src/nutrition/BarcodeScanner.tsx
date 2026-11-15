import {useEffect,useRef,useState} from 'react';
import {barcodeCameraError,startBarcodeCamera} from './barcodeScanner';

export default function BarcodeScanner({onCode,onClose}:{onCode:(code:string)=>void;onClose:()=>void}){
 const video=useRef<HTMLVideoElement>(null),callback=useRef(onCode),stream=useRef<MediaStream|null>(null);
 callback.current=onCode;
 const [attempt,setAttempt]=useState(0),[status,setStatus]=useState('Allow camera access. Opening the rear camera…'),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[torch,setTorch]=useState(false),[torchAvailable,setTorchAvailable]=useState(false);
 useEffect(()=>{
  setReady(false);setFailed(false);setTorch(false);setTorchAvailable(false);setStatus('Allow camera access. Opening the rear camera…');
  if(!video.current)return;
  video.current.closest('.food-modal')?.scrollTo({top:0});
  let active=true;
  const stop=startBarcodeCamera(video.current,code=>{if(active)callback.current(code);},media=>{
   if(!active)return;stream.current=media;setReady(true);setStatus('Scanning… Keep the full barcode inside the frame. Move a little farther away if it is blurry.');
   const caps=media.getVideoTracks()[0]?.getCapabilities?.() as MediaTrackCapabilities&{torch?:boolean};setTorchAvailable(Boolean(caps?.torch));
  },error=>{if(active){setReady(false);setFailed(true);setStatus(barcodeCameraError(error));}});
  return()=>{active=false;stop();stream.current=null;};
 },[attempt]);
 async function toggleTorch(){
  try{await stream.current?.getVideoTracks()[0]?.applyConstraints({advanced:[{torch:!torch} as MediaTrackConstraintSet]});setTorch(v=>!v);}
  catch{setStatus('This camera could not change its light. Try brighter, indirect lighting.');}
 }
 return <section className="barcode-scanner" aria-label="Barcode camera">
  <div className="barcode-viewfinder"><video ref={video} id="barcode-video" muted playsInline autoPlay aria-label="Barcode camera preview"/><div className="barcode-scan-frame" aria-hidden="true"/></div>
  <p role="status">{status}</p>
  <div className="button-row">
   <button type="button" onClick={onClose}>Stop scanner</button>
   {failed&&<button type="button" onClick={()=>setAttempt(v=>v+1)}>Retry scanner</button>}
   {ready&&torchAvailable&&<button type="button" onClick={()=>void toggleTorch()}>{torch?'Light off':'Light on'}</button>}
  </div>
  <p className="tiny">Your camera image stays on this device. Only the detected barcode is sent to find the product.</p>
 </section>;
}
