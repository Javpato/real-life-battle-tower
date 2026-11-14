import type {PoseFrame} from '../exercises/detectors';
import type {PairView} from './protocol';
import type {SignalTransport} from './transport';
import {CompanionFrameGate} from './frames';
export type PeerEvents={onState?:(state:PairView)=>void;onStatus?:(status:string)=>void;onFrame?:(frame:PoseFrame|null)=>void;onPreview?:(stream:MediaStream|null)=>void;onConnected?:()=>void;onDisconnected?:()=>void};
/** Host-only ICE for same-LAN pairing; no relay, no server media path. */
export class CompanionPeer{
 private pc:RTCPeerConnection;private channel?:RTCDataChannel;private timer?:ReturnType<typeof setInterval>;private pulse?:ReturnType<typeof setInterval>;private stopped=false;private polling=false;private negotiating=false;private remoteIce=0;private sequence=0;private lastFrame=-Infinity;private stale=true;private gate=new CompanionFrameGate();private pings=new Map<string,number>();private lastPing=-Infinity;private previewSender?:RTCRtpSender;private remotePreview:MediaStream|null=null;private previewOptin=false;private pendingTrack:MediaStreamTrack|null=null;private started=performance.now();
 constructor(readonly role:'desktop'|'phone',private roomId:string,private capability:string,private transport:SignalTransport,private events:PeerEvents={}){
  this.pc=new RTCPeerConnection({iceServers:[],iceTransportPolicy:'all'});
  this.pc.onicecandidate=e=>{if(e.candidate&&!this.stopped)void this.transport.request(this.roomId,this.capability,'ice',e.candidate.toJSON()).catch(error=>this.events.onStatus?.(String(error)));};
  this.pc.ondatachannel=e=>this.attach(e.channel);
  this.pc.ontrack=e=>{if(role==='desktop'){this.remotePreview=e.streams[0]??new MediaStream([e.track]);if(this.previewOptin)this.events.onPreview?.(this.remotePreview);}};
  this.pc.onconnectionstatechange=()=>{if(!this.stopped&&['failed','disconnected','closed'].includes(this.pc.connectionState)){this.events.onDisconnected?.();this.events.onFrame?.(null);this.events.onPreview?.(null);this.events.onStatus?.('Phone connection lost. Reconnect or use the webcam.');}};
 }
 get connected(){return this.channel?.readyState==='open';}
 start(){void this.poll();this.timer=setInterval(()=>void this.poll(),900);this.pulse=setInterval(()=>this.tick(),100);}
 async approve(challenge:string){const state=await this.transport.request(this.roomId,this.capability,'approve',{challenge});this.events.onState?.(state);await this.poll();}
 private async poll(){if(this.polling||this.stopped)return;this.polling=true;try{
  const state=await this.transport.request(this.roomId,this.capability,'poll');if(this.stopped)return;this.events.onState?.(state);if(state.closed){this.close(false);return;}
  if(state.approved&&!this.negotiating){
   if(this.role==='desktop'&&!this.pc.localDescription){this.negotiating=true;this.attach(this.pc.createDataChannel('pose',{ordered:false,maxPacketLifeTime:200}));this.pc.addTransceiver('video',{direction:'recvonly'});await this.pc.setLocalDescription(await this.pc.createOffer());await this.transport.request(this.roomId,this.capability,'offer',this.pc.localDescription!.toJSON());this.negotiating=false;}
   if(this.role==='phone'&&state.offer&&!this.pc.remoteDescription){this.negotiating=true;await this.pc.setRemoteDescription(state.offer);const video=this.pc.getTransceivers().find(t=>t.receiver.track.kind==='video');if(video){video.direction='sendonly';this.previewSender=video.sender;await this.previewSender.replaceTrack(this.pendingTrack);}await this.pc.setLocalDescription(await this.pc.createAnswer());await this.transport.request(this.roomId,this.capability,'answer',this.pc.localDescription!.toJSON());this.negotiating=false;}
   if(this.role==='desktop'&&state.answer&&!this.pc.remoteDescription)await this.pc.setRemoteDescription(state.answer);
   if(this.pc.remoteDescription){for(const candidate of state.ice.slice(this.remoteIce)){await this.pc.addIceCandidate(candidate as RTCIceCandidateInit);this.remoteIce++;}}
  }
 }catch(error){if(this.stopped)return;if(this.connected&&/EXPIRED|LIMITED/.test(String(error))){clearInterval(this.timer);this.timer=undefined;return;}this.events.onStatus?.(`Pairing: ${error instanceof Error?error.message:String(error)}`);if(/EXPIRED|CLOSED|CAPABILITY/.test(String(error)))this.close(false);}finally{this.polling=false;}}
 private attach(channel:RTCDataChannel){this.channel=channel;channel.onopen=()=>{this.events.onStatus?.('Phone connected. Camera data stays between your devices.');this.events.onConnected?.();if(this.role==='desktop')this.ping();else this.send({type:'preview',enabled:Boolean(this.pendingTrack)});};channel.onclose=()=>{if(this.stopped)return;this.events.onDisconnected?.();this.events.onFrame?.(null);this.events.onPreview?.(null);this.events.onStatus?.('Phone disconnected. No exercise units are being received.');};channel.onmessage=e=>{
  if(this.stopped||typeof e.data!=='string'||e.data.length>18000)return;let p;try{p=JSON.parse(e.data);}catch{return;}if(!p||typeof p!=='object')return;
  if(p.type==='ping'&&this.role==='phone'&&typeof p.id==='string'){this.send({type:'pong',id:p.id,remoteNow:performance.now()});return;}
  if(p.type==='pong'&&this.role==='desktop'&&typeof p.id==='string'){const at=this.pings.get(p.id);if(at!==undefined){this.gate.synchronize(at,p.remoteNow,performance.now());this.pings.delete(p.id);}return;}
  if(p.type==='preview'&&this.role==='desktop'&&typeof p.enabled==='boolean'){this.previewOptin=p.enabled;this.events.onPreview?.(p.enabled?this.remotePreview:null);return;}
  if(p.type==='stop'&&this.role==='desktop'){if(this.gate.invalidate(p.sequence)){this.events.onFrame?.(null);this.lastFrame=-Infinity;this.stale=true;}return;}
  if(this.role==='desktop'){const frame=this.gate.accept(p,performance.now());if(frame){this.lastFrame=performance.now();this.stale=false;this.events.onFrame?.(frame);}}
 };}
 private send(packet:unknown){if(this.channel?.readyState==='open'&&this.channel.bufferedAmount<32768)this.channel.send(JSON.stringify(packet));}
 private ping(){const id=crypto.randomUUID(),now=performance.now();this.lastPing=now;this.pings.clear();this.pings.set(id,now);this.send({type:'ping',id});}
 private tick(){if(this.stopped)return;if(this.connected&&this.role==='desktop'){if(performance.now()-this.lastPing>2000)this.ping();if(!this.stale&&performance.now()-this.lastFrame>500){this.stale=true;this.events.onFrame?.(null);}}if(!this.connected&&performance.now()-this.started>60000)this.events.onStatus?.('Still waiting. Use the same Wi-Fi; guest networks may isolate devices. You can return to the webcam.');}
 sendPose(frame:PoseFrame,inferenceMs?:number){if(this.role!=='phone')return;this.send({type:'pose',sequence:++this.sequence,sentAt:performance.now(),frame:{timestamp:frame.timestamp,width:frame.width,height:frame.height,landmarks:frame.landmarks},inferenceMs});}
 stopPose(){this.send({type:'stop',sequence:++this.sequence});}
 async setPreview(track:MediaStreamTrack|null){this.pendingTrack=track;this.send({type:'preview',enabled:Boolean(track)});if(this.previewSender)await this.previewSender.replaceTrack(track);}
 close(notify=true){if(this.stopped)return;this.stopped=true;clearInterval(this.timer);clearInterval(this.pulse);this.stopPose();this.channel?.close();this.pc.close();this.events.onFrame?.(null);this.events.onPreview?.(null);if(notify)void this.transport.request(this.roomId,this.capability,'close').catch(()=>{});}
}
