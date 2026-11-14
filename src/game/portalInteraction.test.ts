import {describe,it,expect,vi} from 'vitest';
import {PortalInteraction} from './portalInteraction';

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
