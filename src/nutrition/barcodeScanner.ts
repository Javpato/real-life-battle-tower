import {normalizeBarcode} from './foodSearchService';
import type {IScannerControls} from '@zxing/browser';

export function stopBarcodeControls(controls?:IScannerControls|null){
 try{const pending=controls?.stop();void Promise.resolve(pending).catch(()=>{});}catch{/* Track cleanup still happens below. */}
}
async function reader(){
 const [{BrowserMultiFormatReader},{BarcodeFormat,DecodeHintType}]=await Promise.all([import('@zxing/browser'),import('@zxing/library')]);
 const hints=new Map();
 hints.set(DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF]);
 hints.set(DecodeHintType.TRY_HARDER,true);
 return new BrowserMultiFormatReader(hints,{delayBetweenScanAttempts:120,delayBetweenScanSuccess:1000,tryPlayVideoTimeout:8000});
}
export const BARCODE_CAMERA_CONSTRAINTS:MediaStreamConstraints={audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:24,max:30}}};
export function barcodeCameraError(error:unknown){
 const name=error instanceof Error?error.name:'';
 if(name==='NotAllowedError'||name==='SecurityError')return 'Camera access was denied. Allow camera permission, retry, or scan a photo.';
 if(name==='NotReadableError')return 'The camera is busy. Stop the exercise or phone camera, then retry, or scan a photo.';
 if(name==='NotFoundError')return 'No camera was found. Scan a photo or type the barcode.';
 return 'The camera could not start. Retry, scan a photo or type the barcode.';
}

/** Stop is available immediately, even while permission or decoder initialization is pending. */
export function startBarcodeCamera(video:HTMLVideoElement,onCode:(code:string)=>void,onReady:(stream:MediaStream)=>void,onError:(error:unknown)=>void){
 let stopped=false,stream:MediaStream|null=null,controls:IScannerControls|null=null,delivered=false;
 const stop=()=>{stopped=true;stopBarcodeControls(controls);stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;};
 video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;
 video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('autoplay','');
 void(async()=>{
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable');
   stream=await navigator.mediaDevices.getUserMedia(BARCODE_CAMERA_CONSTRAINTS);
   if(stopped){stream.getTracks().forEach(track=>track.stop());return;}
   // Improving focus is optional; an unsupported advanced constraint must not block scanning.
   const track=stream.getVideoTracks()[0];
   const capabilities=track?.getCapabilities?.() as MediaTrackCapabilities&{focusMode?:string[]};
   if(capabilities?.focusMode?.includes('continuous'))void track.applyConstraints({advanced:[{focusMode:'continuous'} as MediaTrackConstraintSet]}).catch(()=>{});
   const decoder=await reader();if(stopped)return;
   controls=await decoder.decodeFromStream(stream,video,(result,_error,callbackControls)=>{
    if(stopped||delivered||!result)return;
    let code;try{code=normalizeBarcode(result.getText());}catch{return;}
    delivered=true; // A callback may run before decodeFromStream resolves.
    stopBarcodeControls(callbackControls);stop();onCode(code);
   });
   if(stopped||delivered){stopBarcodeControls(controls);return;}
   onReady(stream);
  }catch(error){if(!stopped){stop();onError(error);}}
 })();
 return stop;
}

export async function readBarcodePhoto(file:File):Promise<string>{
 if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Choose a barcode photo under 20 MB.');
 const url=URL.createObjectURL(file);
 try{const result=await(await reader()).decodeFromImageUrl(url);return normalizeBarcode(result.getText());}
 catch{throw Error('No product barcode found in this photo. Include the full bars with clear space on both sides, or type the number.');}
 finally{URL.revokeObjectURL(url);}
}
