import {describe,it,expect} from 'vitest';
import {GameSync} from './sync';
describe('unconfigured cloud safety',()=>{
 it('keeps cloud unavailable without a project rather than synthesizing a shared save',async()=>{
  const sync=new GameSync();
  if(sync.configured) return;
  expect(sync.availability).toBe('unavailable');
  expect(await sync.authenticate()).toMatchObject({ok:false,unavailable:true});
  expect(await sync.createSave()).toMatchObject({ok:false,unavailable:true});
  expect(await sync.purchase('absent',1,'potion')).toMatchObject({ok:false,unavailable:true});
 });
});
