import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CompanionPeer} from '../src/companion/peer';
import type {PairView} from '../src/companion/protocol';
import type {SignalTransport} from '../src/companion/transport';

class FakePeerConnection {
  static instances:FakePeerConnection[]=[];
  localDescription: {type:string;sdp:string;toJSON:()=>object}|null=null;
  remoteDescription:object|null=null;
  connectionState='new';
  onicecandidate:unknown;
  ondatachannel:unknown;
  ontrack:unknown;
  onconnectionstatechange:unknown;
  constructor(){FakePeerConnection.instances.push(this)}
  setRemoteDescription=vi.fn(async value=>{this.remoteDescription=value});
  createAnswer=vi.fn(async()=>({type:'answer',sdp:'v=0 test answer'}));
  setLocalDescription=vi.fn(async value=>{this.localDescription={...value,toJSON:()=>value}});
  getTransceivers=()=>[{receiver:{track:{kind:'video'}},direction:'recvonly',sender:{replaceTrack:vi.fn(async()=>{})}}];
  addIceCandidate=vi.fn(async()=>{});
  close=vi.fn();
}
let peers:CompanionPeer[]=[];
const view=(approved=true):PairView=>({approved,closed:false,expiresAt:Date.now()+300000,offer:approved?{type:'offer',sdp:'v=0 test offer'}:undefined,ice:[]});
const flush=async()=>{for(let n=0;n<10;n++)await Promise.resolve()};
const setup=(waitForCamera=true)=>{
 const state={value:view()};
 const request=vi.fn(async()=>state.value);
 const transport={create:vi.fn(),request} as SignalTransport;
 const events={onDisconnected:vi.fn(),onStatus:vi.fn()};
 const p=new CompanionPeer('phone','room','capability',transport,events,{waitForCamera});peers.push(p);
 return {p,state,request,events,pc:FakePeerConnection.instances.at(-1)!};
};
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('RTCPeerConnection',FakePeerConnection);FakePeerConnection.instances=[];peers=[]});
afterEach(()=>{for(const peer of peers)peer.close(false);vi.useRealTimers();vi.unstubAllGlobals()});

describe('phone camera permission before ICE negotiation',()=>{
 it('polls approval but never answers or gathers candidates before a live capture is allowed',async()=>{
  const {p,pc,request,events}=setup();p.start();await flush();await vi.advanceTimersByTimeAsync(61000);
  expect(request).toHaveBeenCalled();expect(pc.setRemoteDescription).not.toHaveBeenCalled();expect(pc.createAnswer).not.toHaveBeenCalled();expect(pc.setLocalDescription).not.toHaveBeenCalled();expect(events.onStatus).not.toHaveBeenCalledWith(expect.stringContaining('same Wi-Fi'));
  p.allowConnection();await flush();expect(pc.createAnswer).toHaveBeenCalledTimes(1);expect(pc.setLocalDescription).toHaveBeenCalledTimes(1);expect(request).toHaveBeenCalledWith('room','capability','answer',{type:'answer',sdp:'v=0 test answer'});
  p.allowConnection();await vi.advanceTimersByTimeAsync(900);expect(pc.createAnswer).toHaveBeenCalledTimes(1);
 });
 it('does not bypass desktop approval when capture permission is available first',async()=>{
  const {p,state,pc}=setup();state.value=view(false);p.start();p.allowConnection();await flush();expect(pc.createAnswer).not.toHaveBeenCalled();
  state.value=view(true);await vi.advanceTimersByTimeAsync(900);expect(pc.createAnswer).toHaveBeenCalledTimes(1);
 });
 it('handles permission granted while a signaling poll is in flight',async()=>{
  const {p,request,pc}=setup();let resolve!:(state:PairView)=>void;request.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));p.start();p.allowConnection();expect(pc.createAnswer).not.toHaveBeenCalled();resolve(view());await flush();expect(pc.createAnswer).toHaveBeenCalledTimes(1);
 });
 it('preserves immediate negotiation for existing ungated phone clients',async()=>{
  const {p,pc}=setup(false);p.start();await flush();expect(pc.createAnswer).toHaveBeenCalledTimes(1);
 });
 it('notifies capture owners once when a remote pair closes and blocks later starts',async()=>{
  const {p,state,events,pc}=setup();state.value={...view(),closed:true};p.start();await flush();expect(events.onDisconnected).toHaveBeenCalledTimes(1);expect(pc.close).toHaveBeenCalledTimes(1);p.allowConnection();p.close(false);expect(pc.createAnswer).not.toHaveBeenCalled();expect(events.onDisconnected).toHaveBeenCalledTimes(1);
 });
 it('notifies capture owners when unused pairing expires',async()=>{
  const {p,request,events}=setup();request.mockRejectedValueOnce(Error('PAIR_EXPIRED'));p.start();await flush();expect(events.onDisconnected).toHaveBeenCalledTimes(1);expect(events.onStatus).toHaveBeenCalledWith('Pairing: PAIR_EXPIRED');
 });
});
