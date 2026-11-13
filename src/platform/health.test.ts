import { describe,it,expect,vi } from 'vitest';
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'web'},registerPlugin:()=>({})}));
import {healthPlatform} from './health';
describe('web health boundaries',()=>{
 it('does not advertise fabricated browser steps',async()=>{
  const result=await healthPlatform.availability();
  expect(result).toMatchObject({available:false,healthConnect:false,stepCounter:false});
 });
 it('rejects step readings instead of returning zero as a measured result',async()=>{
  await expect(healthPlatform.readSteps({startTime:new Date().toISOString()})).rejects.toThrow('verified device steps');
 });
 it('rejects native health imports in browsers',async()=>{
  await expect(healthPlatform.importHealth({startTime:new Date().toISOString()})).rejects.toThrow('Android Health Connect');
 });
});
