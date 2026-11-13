import {describe,it,expect} from 'vitest';
import {initialPlayer,effectiveness,stab,startBattle,enemyFor,beginAttack,acceptUnit,attacks,cancelSeries,enemyTurn,reward} from '../src/core/game';
describe('combat contracts',()=>{
it('type matrix and double types',()=>{expect(effectiveness('leg',['arm'])).toBe(1.5);expect(effectiveness('arm',['leg','back'])).toBe(1.125);expect(effectiveness('back',[])).toBe(1);expect(stab('leg',['back','leg'])).toBe(1.25)});
it('deduplicates and preserves partial damage',()=>{const p=initialPlayer();let b=beginAttack(startBattle(enemyFor('trainer-1',p),p,null),attacks[0]);const u={id:'1',exerciseId:'squat' as const,quality:1,confidence:1,verified:true,timestamp:0};b=acceptUnit(b,u,p);expect(b.enemyHp).toBeLessThan(b.enemy.hp);expect(acceptUnit(b,u,p)).toEqual(b);expect(cancelSeries(b).enemyHp).toBe(b.enemyHp);});
it('phase excess cannot cross threshold',()=>{const p=initialPlayer();let b=beginAttack(startBattle(enemyFor('leader-leg',p),p,null),{...attacks[0],damage:9999});b=acceptUnit(b,{id:'a',exerciseId:'squat',quality:1,confidence:1,verified:true,timestamp:0},p);expect(b.turn).toBe('transform');expect(b.enemyHp).toBe(b.enemy.hp*.5);});
it('pause blocks unit and enemy',()=>{const p=initialPlayer();let b=beginAttack(startBattle(enemyFor('trainer-1',p),p,null),attacks[0]);b.paused=true;expect(acceptUnit(b,{id:'a',exerciseId:'squat',quality:1,confidence:1,verified:true,timestamp:0},p)).toBe(b);b.turn='enemy';expect(enemyTurn(b,p)).toBe(b)});
it('enforces alternation in motor',()=>{const p=initialPlayer();let b=beginAttack(startBattle(enemyFor('trainer-1',p),p,null),attacks[1]);for(const id of ['a','b'])b=acceptUnit(b,{id,exerciseId:'lunge',side:'left',quality:1,confidence:1,verified:true,timestamp:0},p);expect(b.progress).toBe(1)});
it('levels restore health',()=>{const p=reward(initialPlayer(),90,0);expect(p.level).toBe(2);expect(p.hp).toBe(p.maxHp)});
});
