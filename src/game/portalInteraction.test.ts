import {describe,it,expect,vi} from 'vitest';
import {PortalInteraction,ArrivalProtection} from './portalInteraction';

describe('acknowledged doorway interaction',()=>{
 it('waits for the command and never assumes success from elapsed time',async()=>{
  const gate=new PortalInteraction();let acknowledge!:(accepted:boolean)=>void;
  const response=new Promise<boolean>(resolve=>{acknowledge=resolve;});
  const send=vi.fn(()=>response),pending=gate.request('house',send);
  expect(gate.pending).toBe(true);expect(gate.latchedId).toBe('house');
  expect(await gate.request('house',send)).toBe(false);expect(send).toHaveBeenCalledTimes(1);
  acknowledge(false);expect(await pending).toBe(false);expect(gate.pending).toBe(false);
  expect(await gate.request('house',send)).toBe(false);expect(send).toHaveBeenCalledTimes(1);
 });
 it('restores retry only after leaving the doorway, including network failure',async()=>{
  const gate=new PortalInteraction();const failing=vi.fn(async()=>{throw new Error('offline');});
  expect(await gate.request('house',failing)).toBe(false);expect(gate.pending).toBe(false);
  gate.leaveThreshold(true);expect(gate.latchedId).toBe('house');
  gate.leaveThreshold(false);expect(gate.latchedId).toBeNull();
  expect(await gate.request('house',async()=>true)).toBe(true);expect(gate.pending).toBe(false);
 });
 it('does not permit another doorway while the previous command awaits acknowledgement',async()=>{
  const gate=new PortalInteraction();let resolve!:(accepted:boolean)=>void;
  const request=gate.request('first',()=>new Promise<boolean>(done=>{resolve=done;}));
  gate.leaveThreshold(false);expect(gate.latchedId).toBe('first');
  const second=vi.fn(async()=>true);expect(await gate.request('second',second)).toBe(false);expect(second).not.toHaveBeenCalled();
  resolve(false);await request;gate.leaveThreshold(false);expect(await gate.request('second',second)).toBe(true);
 });
});


describe('arrival input protection',()=>{
 it('requires a full second after arrival for keyboard, touch and automatic crossing',()=>{
  const guard=new ArrivalProtection();guard.arrive(5000);
  expect(guard.ready(5999)).toBe(false);expect(guard.press('KeyE',5500)).toBe(false);
  guard.release('KeyE');expect(guard.ready(6000)).toBe(true);expect(guard.press('KeyE',6000)).toBe(true);
 });
 it('requires release and a new press for a key held through the map transition',()=>{
  const guard=new ArrivalProtection();expect(guard.press('KeyE',100)).toBe(true);guard.arrive(200);
  expect(guard.press('KeyE',1500)).toBe(false);expect(guard.ready(1500)).toBe(false);
  guard.release('KeyE');expect(guard.press('KeyE',1600)).toBe(true);
 });
 it('clears carried touch gestures without making a repeated press valid',()=>{
  const guard=new ArrivalProtection();guard.press('pointer:1',100);guard.arrive(200);
  expect(guard.ready(1300)).toBe(false);guard.release('pointer:1');expect(guard.press('pointer:1',1301)).toBe(true);
 });
});
