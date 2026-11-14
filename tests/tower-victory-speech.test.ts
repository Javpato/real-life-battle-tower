import {describe,it,expect} from 'vitest';
import {VictoryAnnouncement} from '../src/tower/victorySpeech';
import {generateFloor} from '../src/tower/generation';
import type {TowerBattle} from '../src/tower/model';
const enemy=generateFloor(123,5);
const battle=(turn:TowerBattle['turn'],id='floor-5')=>({id,turn,enemy});
describe('victory narration',()=>{
 it('names the defeated opponent once, even across rerenders',()=>{
  const a=new VictoryAnnouncement();
  expect(a.observe(battle('exercise'))).toBeNull();
  expect(a.observe(battle('won'))).toBe(`You defeated ${enemy.name}!`);
  expect(a.observe(battle('won'))).toBeNull();
 });
 it('does not announce phase changes, defeats or restored wins',()=>{
  const a=new VictoryAnnouncement();
  for(const turn of ['won','player','exercise','transform','player','lost'] as const)expect(a.observe(battle(turn))).toBeNull();
  expect(a.observe(battle('won','restored'))).toBeNull();
  a.observe(null);
  expect(a.observe(battle('won','restored'))).toBeNull();
 });
 it('allows the next floor to announce its own victory',()=>{
  const a=new VictoryAnnouncement();
  for(const id of ['one','two']){a.observe(battle('player',id));expect(a.observe(battle('won',id))).toBe(`You defeated ${enemy.name}!`)}
 });
});
