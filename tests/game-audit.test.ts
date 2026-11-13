import {describe,it,expect} from 'vitest';
import {initialPlayer,effectiveness,stab,statMultiplier,startBattle,enemyFor,beginAttack,acceptUnit,attacks,cancelSeries,enemyTurn,reward,win,lose,attackFor,type Battle,type Player} from '../src/core/game';
import type {ExerciseUnit,Element} from '../src/core/contracts';
const types:Element[]=['leg','arm','back'];
const unit=(b:Battle,id='rep',verified=true):ExerciseUnit=>({id,exerciseId:b.attack!.exercise,quality:1,confidence:verified?1:0,verified,timestamp:0,side:b.side==='left'?'right':'left'});
const setup=()=>{const p=initialPlayer();const e={...enemyFor('trainer-1',p),hp:10000,thresholds:[0]};return {p,b:startBattle(e,p,null,123456)}};
function full(b:Battle,p:Player,attackIndex:number,verified:boolean,n:number){b=beginAttack({...b,turn:'player'},attacks[attackIndex]);for(let i=0;i<b.attack!.units;i++)b=acceptUnit(b,unit(b,`${n}:${i}`,verified),p,b.sessionId);return b;}

describe('game audit: authoritative rules',()=>{
  it('matrix is cyclic and no type dominates all single or dual defenses',()=>{
    for(let i=0;i<3;i++){expect(effectiveness(types[i],[types[(i+1)%3]])).toBe(1.5);expect(effectiveness(types[i],[types[(i+2)%3]])).toBe(.75);expect(effectiveness(types[i],[])).toBe(1);}
    const totals=types.map(t=>types.reduce((n,d)=>n+effectiveness(t,[d]),0));expect(new Set(totals).size).toBe(1);
    const pairs:Element[][]=[['leg','arm'],['arm','back'],['back','leg']];expect(new Set(types.map(t=>pairs.reduce((n,d)=>n+effectiveness(t,d),0))).size).toBe(1);
    expect(stab('back',['leg','arm'])).toBe(1);expect(stab('arm',['leg','arm'])).toBe(1.25);
  });
  it('damage applies each multiplier exactly once and retains fractions',()=>{
    const {p,b}=setup();p.badges=['leg'];p.attack=24;
    let next=beginAttack({...b,type:'leg',enemy:{...b.enemy,defense:20,phases:[['arm']]}},attacks[0]);next.boost=true;
    const before=next.enemyHp;next=acceptUnit(next,{...unit(next),quality:.8},p);
    expect(before-next.enemyHp).toBeCloseTo(32/8*.8*1.5*1.25*1.2*1.25,8);
    expect(statMultiplier(1,100)).toBe(.8);expect(statMultiplier(100,1)).toBe(1.2);
  });
  it('locked specialization is neutral and initiative is deterministic',()=>{
    const p=initialPlayer();const e=enemyFor('rival',p);expect(startBattle(e,p,'leg').type).toBeNull();expect(startBattle(e,p,null).turn).toBe('enemy');p.speed=e.speed;expect(startBattle(e,p,null).turn).toBe('player');
  });
  it('paused battles cannot start actions; malformed units and attacks do nothing',()=>{
    const {p,b}=setup();expect(beginAttack({...b,paused:true},attacks[0]).turn).toBe('player');
    expect(beginAttack(b,{...attacks[0],units:0})).toBe(b);const attacking=beginAttack(b,attacks[0]);
    for(const patch of [{id:''},{quality:NaN},{quality:2},{timestamp:Infinity},{confidence:NaN},{confidence:.1},{side:'invalid'}])expect(acceptUnit(attacking,{...unit(attacking),...patch} as ExerciseUnit,p)).toBe(attacking);
  });
  it('duplicate IDs and stale session callbacks never cross turns',()=>{
    const {p,b}=setup();let next=beginAttack(b,attacks[0]);const oldSession=next.sessionId;const old=unit(next);next=acceptUnit(next,old,p,oldSession);next=beginAttack({...cancelSeries(next),turn:'player'},attacks[0]);
    expect(acceptUnit(next,old,p,next.sessionId)).toBe(next);expect(acceptUnit(next,unit(next,'late-unseen'),p,oldSession)).toBe(next);
  });
  it('phase cap discards excess and no units apply until transformation finishes',()=>{
    const p=initialPlayer();let b=beginAttack(startBattle(enemyFor('leader-leg',p),p,null),{...attacks[0],damage:9999});b=acceptUnit(b,unit(b),p);expect(b.turn).toBe('transform');expect(b.enemyHp).toBe(60);expect(acceptUnit(b,unit(b,'another'),p)).toBe(b);
    b={...b,phase:1,turn:'player'};b=beginAttack(b,{...attacks[0],damage:9999});b=acceptUnit(b,unit(b,'second-phase'),p);expect(b.turn).toBe('won');expect(enemyTurn(b,p)).toBe(b);
  });
  it('manual fatigue follows group, persists through camera, and caps at 40%',()=>{
    const {p,b}=setup();let next=b;const losses:number[]=[];
    for(let n=0;n<4;n++){const before=next.enemyHp;next=full(next,p,0,false,n);losses.push(before-next.enemyHp);}
    expect(losses.map(n=>n/losses[0])).toEqual(expect.arrayContaining([expect.closeTo(1),expect.closeTo(.85),expect.closeTo(.7),expect.closeTo(.6)]));
    const fatigue=next.fatigue.leg;next=full(next,p,0,true,10);expect(next.fatigue.leg).toBe(fatigue);next=full(next,p,2,false,11);expect(next.fatigue.leg).toBe(fatigue-.5);
    let arm=full(b,p,2,false,20);arm=beginAttack({...arm,turn:'player'},attacks[3]);arm=acceptUnit(arm,unit(arm,'diamond',false),p);expect(arm.manualFactor).toBe(.85);
  });
  it('mixed partial series only fatigues manual fraction, cancellation retains damage',()=>{
    const {p,b}=setup();let next=beginAttack(b,attacks[0]);next=acceptUnit(next,unit(next,'verified'),p);next=acceptUnit(next,unit(next,'manual',false),p);const hp=next.enemyHp;next=cancelSeries(next);expect(next.enemyHp).toBe(hp);expect(next.fatigue.leg).toBe(1/8);expect(next.verified).toBe(1);expect(next.unverified).toBe(1);
  });
  it('guard halves the next landed hit and survives a dodge',()=>{
    const {p,b}=setup();const normal=enemyTurn({...b,turn:'enemy'},p),guarded=enemyTurn({...b,turn:'enemy',defending:true},p);expect(b.playerHp-guarded.playerHp).toBeCloseTo((b.playerHp-normal.playerHp)/2);expect(guarded.defending).toBe(false);
    expect(enemyTurn({...b,turn:'enemy',seed:1,defending:true},p).defending).toBe(true);
  });
  it('rewards require victory and are idempotent per encounter',()=>{
    const {p,b}=setup();expect(win(p,b)).toBe(p);const won={...b,turn:'won' as const,enemyHp:0};const rewarded=win(p,won);expect(win(rewarded,won)).toBe(rewarded);expect(rewarded.coins).toBeGreaterThan(p.coins);
    expect(reward(p,Infinity,0)).toBe(p);expect(reward(p,-1,0)).toBe(p);expect(reward(p,1,NaN)).toBe(p);
  });
  it('defeat caps coin loss and preserves permanent progress; upgrades keep unit efficiency',()=>{
    const p={...initialPlayer(),coins:1000,badges:['leg'] as Element[],xp:40};const result=lose(p);expect(result.coins).toBe(970);expect(result.badges).toEqual(p.badges);expect(result.xp).toBe(40);expect(result.hp).toBe(result.maxHp);
    for(const a of attacks){let efficiency=0;for(let level=0;level<5;level++){p.upgrades[a.id]=level;const upgraded=attackFor(a.id,p);expect(upgraded.damage/upgraded.units).toBeGreaterThan(efficiency);efficiency=upgraded.damage/upgraded.units;}}
  });
});

describe('deterministic playable encounter simulation',()=>{
  it('baseline progression can defeat trainers, leaders and rival without fabricated stats',()=>{
    const scenarios=[{id:'trainer-1',xp:0,badges:[]},{id:'leader-leg',xp:210,badges:[]},{id:'leader-arm',xp:210,badges:['leg']},{id:'leader-back',xp:210,badges:['leg','arm']},{id:'rival',xp:540,badges:types}];
    const durations:Record<string,number>={squat:3,lunge:3,pushup:3,diamond:4,superman:1,birddog:4};
    const report=[];
    for(const scenario of scenarios){
      const p=reward(initialPlayer(),scenario.xp,0);p.badges=scenario.badges as Element[];
      let b=startBattle(enemyFor(scenario.id,p),p,null,123456),series=0,seconds=0;
      while(b.turn!=='won'&&b.turn!=='lost'&&series<40){
        if(b.turn==='enemy'){b=enemyTurn(b,p);seconds+=2;continue}
        if(b.turn==='transform'){b={...b,phase:b.phase+1,turn:'enemy'};continue}
        const a=attacks.slice(0,6).reduce((best,a)=>effectiveness(a.type,b.enemy.phases[b.phase])*a.damage>effectiveness(best.type,b.enemy.phases[b.phase])*best.damage?a:best);
        b=beginAttack(b,a);series++;
        for(let i=0;i<a.units&&b.turn==='exercise';i++){seconds+=durations[a.exercise];b=acceptUnit(b,{...unit(b,`${scenario.id}:${series}:${i}`),quality:.8},p,b.sessionId);}
      }
      report.push({enemy:scenario.id,level:p.level,result:b.turn,series,activeSeconds:seconds,hp:Math.round(b.playerHp)});
      expect(b.turn,JSON.stringify(report)).toBe('won');
    }
    console.info('Balance estimate (assumed cadence; excludes setup and unlimited rest):',JSON.stringify(report));
  });
  it.each(['trainer-1','leader-leg','leader-arm','leader-back','rival'])('%s can finish with controlled phase transitions',id=>{
    const p={...initialPlayer(),maxHp:600,hp:600,speed:40,badges:types};let b=startBattle(enemyFor(id,p),p,null,123456);let series=0;
    while(b.turn!=='won'&&b.turn!=='lost'&&series<60){
      if(b.turn==='enemy'){b=enemyTurn(b,p);continue}if(b.turn==='transform'){b={...b,phase:b.phase+1,turn:'enemy'};continue}
      const attack=attacks.slice(0,6).reduce((best,a)=>effectiveness(a.type,b.enemy.phases[b.phase])*a.damage>effectiveness(best.type,b.enemy.phases[b.phase])*best.damage?a:best);
      b=beginAttack(b,attack);series++;for(let i=0;i<attack.units&&b.turn==='exercise';i++)b=acceptUnit(b,unit(b,`sim:${series}:${i}`),p,b.sessionId);
    }
    expect(b.turn).toBe('won');expect(b.phase).toBe(b.enemy.phases.length-1);expect(series).toBeLessThan(20);
  });
});
