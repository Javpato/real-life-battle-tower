import type {PoseFrame} from '../exercises/detectors';
export type PosePacket={type:'pose';sequence:number;sentAt:number;frame:PoseFrame;inferenceMs?:number};
/** Clock interval from a round-trip probe, no asserted one-way network latency. */
export class CompanionFrameGate{
 private offset?:{low:number;high:number};private sequence=-1;private sourceStamp=-Infinity;private lastStamp=-Infinity;
 invalidate(sequence:number){if(!Number.isSafeInteger(sequence)||sequence<=this.sequence)return false;this.sequence=sequence;return true;}
 synchronize(sentAt:number,remoteNow:number,receivedAt:number){if(![sentAt,remoteNow,receivedAt].every(Number.isFinite)||receivedAt<sentAt||receivedAt-sentAt>250)return false;this.offset={low:sentAt-remoteNow,high:receivedAt-remoteNow};return true;}
 accept(value:unknown,now:number):(PoseFrame&{receivedAt:number;inferenceMs?:number})|null{
  const p=value as PosePacket;if(!this.offset||!p||p.type!=='pose'||!Number.isSafeInteger(p.sequence)||p.sequence<=this.sequence||!Number.isFinite(p.sentAt))return null;
  const f=p.frame;if(!f||!Number.isFinite(f.timestamp)||f.timestamp<=this.sourceStamp||p.sentAt<f.timestamp||p.sentAt-f.timestamp>500||!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<1||f.height<1||f.width>4096||f.height>4096||!Array.isArray(f.landmarks)||(f.landmarks.length!==0&&f.landmarks.length!==33))return null;
  const timestamp=f.timestamp+this.offset.low;if(now-timestamp>500||timestamp>now+5||timestamp<=this.lastStamp)return null;
  if(f.landmarks.some(l=>!l||!Number.isFinite(l.x)||!Number.isFinite(l.y)||Math.abs(l.x)>4||Math.abs(l.y)>4||(l.z!==undefined&&(!Number.isFinite(l.z)||Math.abs(l.z)>10))||[l.visibility,l.presence].some(n=>n!==undefined&&(!Number.isFinite(n)||n<0||n>1))))return null;
  this.sequence=p.sequence;this.sourceStamp=f.timestamp;this.lastStamp=timestamp;
  return {timestamp,width:f.width,height:f.height,landmarks:f.landmarks.map(l=>({x:l.x,y:l.y,z:l.z,visibility:l.visibility,presence:l.presence})),receivedAt:now,...(Number.isFinite(p.inferenceMs)&&p.inferenceMs!>=0&&p.inferenceMs!<=500?{inferenceMs:p.inferenceMs}:{})};
 }
}
