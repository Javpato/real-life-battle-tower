import type {PairView,SignalAction} from './protocol';
export type CreatedPair={roomId:string;desktopToken:string;inviteToken:string;expiresAt:number};
export interface SignalTransport{create():Promise<CreatedPair>;request(roomId:string,token:string,action:SignalAction,payload?:unknown):Promise<PairView&{phoneToken?:string}>;}
const env=import.meta.env;
export const companionEndpoint=env.VITE_SUPABASE_URL?`${env.VITE_SUPABASE_URL}/functions/v1/camera-pair`:undefined;
export class HttpSignalTransport implements SignalTransport{
 constructor(private endpoint=companionEndpoint,private publicKey=env.VITE_SUPABASE_PUBLISHABLE_KEY??env.VITE_SUPABASE_ANON_KEY){}
 private async send(body:unknown){
  if(!this.endpoint)throw Error('Phone pairing is unavailable until the camera-pair service is configured. Webcam and manual play are available.');
  let result:Response;try{result=await fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(this.publicKey?{apikey:this.publicKey}:{})},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});}catch{throw Error('Could not reach phone pairing. Check the connection or use this device’s camera.');}
  const data=await result.json().catch(()=>({error:'Camera pairing service is not deployed.'}));if(!result.ok||data.error)throw Error(data.error??`Pairing failed (${result.status}).`);return data;
 }
 create():Promise<CreatedPair>{return this.send({action:'create'});}
 request(roomId:string,token:string,action:SignalAction,payload?:unknown):Promise<PairView&{phoneToken?:string}>{return this.send({roomId,token,action,payload});}
}
export function phonePairUrl(roomId:string,inviteToken:string){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('cameraCompanion',roomId);url.hash=new URLSearchParams({token:inviteToken}).toString();return url.toString();}
export function readPhonePair(){const roomId=new URLSearchParams(location.search).get('cameraCompanion'),token=new URLSearchParams(location.hash.slice(1)).get('token');return roomId&&token?{roomId,token}:null;}
