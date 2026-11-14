import type {PoseFrame} from '../exercises/detectors';
import type {PairView,SignalAction} from './protocol';
import type {SignalTransport} from './transport';
import {CompanionFrameGate} from './frames';
export type PeerEvents={onState?:(state:PairView)=>void;onStatus?:(status:string)=>void;onFrame?:(frame:PoseFrame|null)=>void;onPreview?:(stream:MediaStream|null)=>void;onConnected?:()=>void;onDisconnected?:()=>void};
export type PeerOptions={waitForCamera?:boolean};
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
const retryableConflict=(error:unknown)=>{
 const status=error&&typeof error==='object'&&'status' in error?error.status:undefined;
 return status===409||errorText(error)==='SIGNAL_BUSY_RETRY'||/^Pairing failed \(409\)\.?$/.test(errorText(error));
};
type Mutation=Exclude<SignalAction,'poll'|'claim'>;
/** Host-only ICE for same-LAN pairing; no relay, no server media path. */
export class CompanionPeer{
 private connectionAllowed:boolean;
 private writes:Promise<unknown>=Promise.resolve();
 private descriptionPublished=false;
 private descriptionPublishes=0;
 private previewGeneration=0;
 private pc:RTCPeerConnection;private channel?:RTCDataChannel;private timer?:ReturnType<typeof setInterval>;private pulse?:ReturnType<typeof setInterval>;private stopped=false;private polling=false;private negotiating=false;private remoteIce=0;private sequence=0;private lastFrame=-Infinity;private stale=true;private gate=new CompanionFrameGate();private pings=new Map<string,number>();private lastPing=-Infinity;private previewSender?:RTCRtpSender;private remotePreview:MediaStream|null=null;private previewOptin=false;private pendingTrack:MediaStreamTrack|null=null;private started=performance.now();
 constructor(readonly role:'desktop'|'phone',private roomId:string,private capability:string,private transport:SignalTransport,private events:PeerEvents={},options:PeerOptions={}){
  this.connectionAllowed=role!=='phone'||!options.waitForCamera;
  this.pc=new RTCPeerConnection({iceServers:[],iceTransportPolicy:'all'});
  this.pc.onicecandidate=e=>{if(e.candidate&&!this.stopped)void this.mutate('ice',e.candidate.toJSON()).catch(error=>{if(!this.stopped)this.events.onStatus?.(retryableConflict(error)?'Connection signaling is busy. Retry pairing if it does not connect.':'A connection candidate could not be sent. Retry pairing if it does not connect.');});};
  this.pc.ondatachannel=e=>this.attach(e.channel);
  this.pc.ontrack=e=>{if(role==='desktop'){this.remotePreview=e.streams[0]??new MediaStream([e.track]);if(this.previewOptin)this.events.onPreview?.(this.remotePreview);}};
  this.pc.onconnectionstatechange=()=>{if(!this.stopped&&['failed','disconnected','closed'].includes(this.pc.connectionState)){this.events.onDisconnected?.();this.events.onFrame?.(null);this.events.onPreview?.(null);this.events.onStatus?.('Phone connection lost. Reconnect or use the webcam.');}};
 }
 /** Safari may withhold local ICE candidates until capture permission exists.
  * The UI calls this only after an explicit camera start returns a live stream. */
 allowConnection(){if(this.stopped||this.connectionAllowed)return;this.connectionAllowed=true;this.started=performance.now();void this.poll();}
 get connected(){return this.channel?.readyState==='open';}
 start(){void this.poll();this.timer=setInterval(()=>void this.poll(),900);this.pulse=setInterval(()=>this.tick(),100);}
 /** All writes share one queue; signaling uses compare-and-swap on the same room. */
 private mutate(action:Mutation,payload?:unknown):Promise<PairView>{
  const perform=async()=>{
   for(let attempt=0;;attempt++){
    if(this.stopped&&action!=='close')throw Error('PAIR_CLOSED');
    try{return await this.transport.request(this.roomId,this.capability,action,payload)}
    catch(error){
     if(!retryableConflict(error)||attempt>=3||(this.stopped&&action!=='close'))throw error;
     await new Promise<void>(resolve=>setTimeout(resolve,[150,300,600][attempt]));
    }
   }
  };
  const result=this.writes.then(perform);
  this.writes=result.then(()=>undefined,()=>undefined);
  return result;
 }
 async approve(challenge:string){const state=await this.mutate('approve',{challenge});if(this.stopped)return;this.events.onState?.(state);await this.poll();}
 private async publishDescription(action:'offer'|'answer',state:PairView){
  if(this.descriptionPublished||this.stopped)return;
  const local=this.pc.localDescription;
  if(!local)return;
  // A previous response may have been lost after the server committed the SDP.
  if(state[action]?.sdp===local.sdp){this.descriptionPublished=true;return;}
  if(this.descriptionPublishes>=2)throw Error('SIGNAL_PUBLISH_EXHAUSTED');
  this.descriptionPublishes++;
  await this.mutate(action,local.toJSON());
  this.descriptionPublished=true;
 }
 private async poll(){if(this.polling||this.stopped)return;this.polling=true;try{
  const state=await this.transport.request(this.roomId,this.capability,'poll');if(this.stopped)return;this.events.onState?.(state);if(state.closed){this.close(false);this.events.onStatus?.('Pairing ended. Scan a new code to reconnect.');return;}
  if(state.approved&&!this.negotiating){
   this.negotiating=true;
   try{
    if(this.role==='desktop'){
     if(!this.pc.localDescription){
      this.attach(this.pc.createDataChannel('pose',{ordered:false,maxPacketLifeTime:200}));
      this.pc.addTransceiver('video',{direction:'recvonly'});
      await this.pc.setLocalDescription(await this.pc.createOffer());
     }
     await this.publishDescription('offer',state);
     if(!this.stopped&&state.answer&&!this.pc.remoteDescription)await this.pc.setRemoteDescription(state.answer);
    }
    if(this.role==='phone'&&this.connectionAllowed&&state.offer){
     if(!this.pc.remoteDescription)await this.pc.setRemoteDescription(state.offer);
     if(!this.pc.localDescription){
      const video=this.pc.getTransceivers().find(t=>t.receiver.track.kind==='video');
      if(video){video.direction='sendonly';this.previewSender=video.sender;await this.setPreview(this.pendingTrack);}
      if(this.stopped)return;
      await this.pc.setLocalDescription(await this.pc.createAnswer());
     }
     await this.publishDescription('answer',state);
    }
    if(!this.stopped&&this.pc.remoteDescription){for(const candidate of state.ice.slice(this.remoteIce)){await this.pc.addIceCandidate(candidate as RTCIceCandidateInit);this.remoteIce++;}}
   }finally{this.negotiating=false;}
  }
 }catch(error){
  if(this.stopped)return;
  if(this.connected&&/EXPIRED|LIMITED/.test(errorText(error))){clearInterval(this.timer);this.timer=undefined;return;}
  this.events.onStatus?.(`Pairing: ${errorText(error)}`);
  const publishFailed=this.pc.localDescription&&!this.descriptionPublished&&this.descriptionPublishes>0;
  // Only one later polling cycle may retry an exhausted transient SDP write.
  // Permanent errors and the second exhausted cycle require a fresh pairing.
  if(/EXPIRED|CLOSED|CAPABILITY/.test(errorText(error))||(publishFailed&&(!retryableConflict(error)||this.descriptionPublishes>=2))){
   this.close(false);
   if(publishFailed)this.events.onStatus?.('Pairing could not be completed. Scan a new code to retry.');
  }
 }finally{this.polling=false;}}
 private attach(channel:RTCDataChannel){this.channel=channel;channel.onopen=()=>{this.events.onStatus?.('Phone connected. Camera data stays between your devices.');this.events.onConnected?.();if(this.role==='desktop')this.ping();else this.send({type:'preview',enabled:Boolean(this.pendingTrack)});};channel.onclose=()=>{if(this.stopped)return;this.events.onDisconnected?.();this.events.onFrame?.(null);this.events.onPreview?.(null);this.events.onStatus?.('Phone disconnected. No exercise units are being received.');};channel.onmessage=e=>{
  if(this.stopped||typeof e.data!=='string'||e.data.length>18000)return;let p;try{p=JSON.parse(e.data);}catch{return;}if(!p||typeof p!=='object')return;
  if(p.type==='ping'&&this.role==='phone'&&typeof p.id==='string'){this.send({type:'pong',id:p.id,remoteNow:performance.now()});return;}
  if(p.type==='pong'&&this.role==='desktop'&&typeof p.id==='string'){const at=this.pings.get(p.id);if(at!==undefined){this.gate.synchronize(at,p.remoteNow,performance.now());this.pings.delete(p.id);}return;}
  if(p.type==='preview'&&this.role==='desktop'&&typeof p.enabled==='boolean'){this.previewOptin=p.enabled;this.events.onPreview?.(p.enabled?this.remotePreview:null);return;}
  if(p.type==='stop'&&this.role==='desktop'){if(this.gate.invalidate(p.sequence)){this.events.onFrame?.(null);this.lastFrame=-Infinity;this.stale=true;}return;}
  if(this.role==='desktop'){const frame=this.gate.accept(p,performance.now());if(frame){this.lastFrame=performance.now();this.stale=false;this.events.onFrame?.(frame);}}
 };}
 private send(packet:unknown){if(this.stopped)return;if(this.channel?.readyState==='open'&&this.channel.bufferedAmount<32768){try{this.channel.send(JSON.stringify(packet))}catch{/* A concurrent disconnect must not escape UI event handlers. */}}}
 private ping(){const id=crypto.randomUUID(),now=performance.now();this.lastPing=now;this.pings.clear();this.pings.set(id,now);this.send({type:'ping',id});}
 private tick(){if(this.stopped)return;if(this.connected&&this.role==='desktop'){if(performance.now()-this.lastPing>2000)this.ping();if(!this.stale&&performance.now()-this.lastFrame>500){this.stale=true;this.events.onFrame?.(null);}}if(!this.connected&&this.connectionAllowed&&performance.now()-this.started>60000)this.events.onStatus?.('Still waiting. Use the same Wi-Fi; guest networks may isolate devices. You can return to the webcam.');}
 sendPose(frame:PoseFrame,inferenceMs?:number){if(this.role!=='phone')return;this.send({type:'pose',sequence:++this.sequence,sentAt:performance.now(),frame:{timestamp:frame.timestamp,width:frame.width,height:frame.height,landmarks:frame.landmarks},inferenceMs});}
 stopPose(){this.send({type:'stop',sequence:++this.sequence});}
 private isClosed(){return this.stopped||this.pc.connectionState==='closed'||this.pc.signalingState==='closed';}
 async setPreview(track:MediaStreamTrack|null){
  if(this.isClosed()){this.pendingTrack=null;return;}
  const generation=++this.previewGeneration;
  this.pendingTrack=track;
  // Withdraw the remote preview immediately, even while replaceTrack is pending.
  if(!track)this.send({type:'preview',enabled:false});
  try{
   if(this.previewSender)await this.previewSender.replaceTrack(track);
   if(!this.stopped&&generation===this.previewGeneration)this.send({type:'preview',enabled:Boolean(this.pendingTrack)});
  }catch{
   if(this.isClosed()||generation!==this.previewGeneration)return;
   this.pendingTrack=null;
   this.send({type:'preview',enabled:false});
   try{await this.previewSender?.replaceTrack(null)}catch{/* Best effort cleanup; never reject an ignored UI promise. */}
   if(!this.stopped)this.events.onStatus?.('Live video preview could not start. Pose tracking continues; try enabling preview again.');
  }
 }
 close(notify=true){
  if(this.stopped)return;
  this.stopPose();this.stopped=true;this.previewGeneration++;this.pendingTrack=null;
  clearInterval(this.timer);clearInterval(this.pulse);
  this.channel?.close();this.pc.close();this.events.onDisconnected?.();this.events.onFrame?.(null);this.events.onPreview?.(null);
  if(notify)void this.mutate('close').catch(()=>{});
 }
}
