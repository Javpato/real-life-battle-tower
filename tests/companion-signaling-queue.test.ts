import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CompanionPeer} from '../src/companion/peer';
import type {PairView} from '../src/companion/protocol';
import type {SignalTransport} from '../src/companion/transport';
class FakePeerConnection {
 static instances:FakePeerConnection[]=[];
 localDescription:{type:string;sdp:string;toJSON:()=>object}|null=null;
 remoteDescription:object|null=null;
 connectionState='new';signalingState='stable';
 onicecandidate:any;ondatachannel:any;ontrack:any;onconnectionstatechange:any;
 sender={replaceTrack:vi.fn(async(_track:unknown)=>{})};
 channel={readyState:'open',bufferedAmount:0,send:vi.fn(),close:vi.fn(),onopen:null,onclose:null,onmessage:null};
 constructor(){FakePeerConnection.instances.push(this)}
 createDataChannel=()=>this.channel;
 addTransceiver=vi.fn();
 setRemoteDescription=vi.fn(async value=>{this.remoteDescription=value});
 createOffer=vi.fn(async()=>({type:'offer',sdp:'v=0 test offer'}));
 createAnswer=vi.fn(async()=>({type:'answer',sdp:'v=0 test answer'}));
 setLocalDescription=vi.fn(async value=>{this.localDescription={...value,toJSON:()=>value}});
 getTransceivers=()=>[{receiver:{track:{kind:'video'}},direction:'recvonly',sender:this.sender}];
 addIceCandidate=vi.fn(async()=>{});
 close=vi.fn(()=>{this.connectionState='closed';this.signalingState='closed'});
}
let peers:CompanionPeer[]=[];
const view=():PairView=>({approved:true,closed:false,expiresAt:Date.now()+300000,offer:{type:'offer',sdp:'v=0 test offer'},ice:[]});
const flush=async()=>{for(let n=0;n<40;n++)await Promise.resolve()};
const setup=(role:'desktop'|'phone'='phone')=>{
 const state={value:view()};if(role==='desktop')state.value.offer=undefined;
 const request=vi.fn(async(_room:string,_cap:string,_action:string,_payload?:unknown)=>state.value);
 const transport={create:vi.fn(),request} as SignalTransport;
 const events={onDisconnected:vi.fn(),onStatus:vi.fn()};
 const p=new CompanionPeer(role,'room','capability',transport,events);peers.push(p);
 return {p,state,request,events,pc:FakePeerConnection.instances.at(-1)!};
};
const ice=(pc:FakePeerConnection,id:number)=>pc.onicecandidate({candidate:{toJSON:()=>({candidate:`candidate:${id}`})}});
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('RTCPeerConnection',FakePeerConnection);FakePeerConnection.instances=[];peers=[]});
afterEach(()=>{for(const p of peers)p.close(false);vi.useRealTimers();vi.unstubAllGlobals()});
describe('serialized signaling mutations',()=>{
 it('serializes a burst of ICE and preserves candidate ordering',async()=>{
  const {pc,request}=setup();let active=0,max=0;const sent:number[]=[];
  request.mockImplementation(async(_r,_c,_a,p:any)=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,20));sent.push(Number(p.candidate.split(':')[1]));active--;return view()});
  for(let n=0;n<12;n++)ice(pc,n);await vi.advanceTimersByTimeAsync(300);
  expect(max).toBe(1);expect(sent).toEqual(Array.from({length:12},(_,i)=>i));
 });
 it('retries only conflicts with bounded backoff while later candidates wait',async()=>{
  const {pc,request}=setup();let conflicts=0;
  request.mockImplementation(async(_r,_c,_a,p:any)=>{if(p.candidate==='candidate:1'&&conflicts++<3)throw Error('SIGNAL_BUSY_RETRY');return view()});
  ice(pc,1);ice(pc,2);await flush();expect(request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1049);expect(request).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1);expect(request.mock.calls.map(c=>(c[3] as any).candidate)).toEqual(['candidate:1','candidate:1','candidate:1','candidate:1','candidate:2']);
 });
 it('recovers the queue after a permanent failure without retrying that write',async()=>{
  const {pc,request,events}=setup();request.mockRejectedValueOnce(Error('INVALID_ICE'));
  ice(pc,1);ice(pc,2);await flush();expect(request).toHaveBeenCalledTimes(2);expect(events.onStatus).toHaveBeenCalledTimes(1);
 });
 it.each(['desktop','phone'] as const)('republishes failed %s SDP on the next poll without recreating it',async role=>{
  const {p,pc,request}=setup(role);const action=role==='desktop'?'offer':'answer';let writes=0;
  request.mockImplementation(async(_r,_c,a)=>{if(a===action&&++writes<=4)throw Error('SIGNAL_BUSY_RETRY');return view()});
  // Desktop own offer must not appear before the first successful write.
  if(role==='desktop')request.mockImplementation(async(_r,_c,a)=>{if(a===action&&++writes<=4)throw Error('SIGNAL_BUSY_RETRY');return {...view(),offer:undefined}});
  p.start();await vi.advanceTimersByTimeAsync(2000);
  expect(writes).toBe(5);expect(role==='desktop'?pc.createOffer:pc.createAnswer).toHaveBeenCalledTimes(1);expect(pc.setLocalDescription).toHaveBeenCalledTimes(1);
 });
 it('does not retry permanent SDP errors or loop forever on exhausted conflicts',async()=>{
  const permanent=setup('desktop');permanent.request.mockImplementation(async(_r,_c,a)=>{if(a==='offer')throw Error('INVALID_SDP');return {...view(),offer:undefined}});permanent.p.start();await vi.advanceTimersByTimeAsync(10000);expect(permanent.request.mock.calls.filter(c=>c[2]==='offer')).toHaveLength(1);expect(permanent.events.onDisconnected).toHaveBeenCalledTimes(1);
  const busy=setup('desktop');busy.request.mockImplementation(async(_r,_c,a)=>{if(a==='offer')throw Object.assign(Error('conflict'),{status:409});return {...view(),offer:undefined}});busy.p.start();await vi.advanceTimersByTimeAsync(10000);expect(busy.request.mock.calls.filter(c=>c[2]==='offer')).toHaveLength(8);expect(busy.events.onDisconnected).toHaveBeenCalledTimes(1);
 });
 it('serializes approval and closure with pending mutations',async()=>{
  const {p,pc,request}=setup();let resolve!:(v:PairView)=>void;request.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));ice(pc,1);await flush();const approval=p.approve('123456').catch(()=>{});p.close();resolve(view());await flush();await approval;expect(request.mock.calls.map(c=>c[2])).toEqual(['ice','close']);
 });
});
describe('preview replacement across disconnect',()=>{
 it('does not replace tracks after close, including reentrant camera-stop callbacks',async()=>{
  const {p,pc,events}=setup();p.start();await flush();const before=pc.sender.replaceTrack.mock.calls.length;events.onDisconnected.mockImplementation(()=>{void p.setPreview(null)});p.close(false);await p.setPreview(null);expect(pc.sender.replaceTrack).toHaveBeenCalledTimes(before);
 });
 it('swallows a replaceTrack rejection caused by closing during the operation',async()=>{
  const {p,pc,events}=setup();p.start();await flush();let reject!:(e:Error)=>void;pc.sender.replaceTrack.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r}));const change=p.setPreview({} as MediaStreamTrack);p.close(false);reject(Error('RTCPeerConnection is closed'));await expect(change).resolves.toBeUndefined();expect(events.onStatus).not.toHaveBeenCalledWith(expect.stringContaining('Live video'));
 });
 it('disables failed preview and reports non-close errors without rejecting UI promises',async()=>{
  const {p,pc,events}=setup();p.start();await flush();pc.sender.replaceTrack.mockRejectedValueOnce(Error('encoder failure'));
  await expect(p.setPreview({} as MediaStreamTrack)).resolves.toBeUndefined();expect(pc.sender.replaceTrack).toHaveBeenLastCalledWith(null);expect(events.onStatus).toHaveBeenCalledWith(expect.stringContaining('Live video preview could not start'));
 });
});
