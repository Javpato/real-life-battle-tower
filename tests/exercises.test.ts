import { describe, expect, it } from 'vitest';
import { ExerciseDetector, angle, observePose, type Observation, type PoseFrame, type Side } from '../src/exercises/detectors';
import type { ExerciseId, ExerciseUnit } from '../src/core/contracts';

const observation = (overrides: Partial<Observation> = {}): Observation => ({ visible: true, ready: true, extended: false, amplitude: 0, confidence: .95, motion: 0, ...overrides });
function rep(detector: ExerciseDetector, start: number, side?: Side): ExerciseUnit[] {
  const units: ExerciseUnit[] = [];
  const points: [number, Partial<Observation>][] = [
    [0, {}], [200, {}], [400, { ready: false, motion: .1, amplitude: .2 }],
    [600, { ready: false, extended: true, motion: .8, amplitude: .95, side }],
    [800, { ready: false, extended: true, motion: 1, amplitude: 1, side }],
    [1000, { ready: false, motion: .5, amplitude: .5 }], [1200, {}], [1400, {}],
  ];
  for (const [delta, o] of points) { const result = detector.updateObservation(observation(o), start + delta); if (result.unit) units.push(result.unit); }
  return units;
}

describe('exercise cycle and quality contracts', () => {
  it.each<ExerciseId>(['squat','pushup','diamond'])('%s emits once after a full return and never computes damage', id => {
    const d = new ExerciseDetector(id, 'fixture'); const units = rep(d, 0);
    expect(units).toHaveLength(1); expect(units[0].verified).toBe(true); expect(units[0].quality).toBeGreaterThan(.7);
    expect(units[0]).not.toHaveProperty('damage'); expect(d.updateObservation(observation(), 1600).unit).toBeUndefined();
  });
  it('does not count a bounce or incomplete movement', () => {
    const d = new ExerciseDetector('squat'); d.updateObservation(observation(), 0); d.updateObservation(observation(), 200);
    d.updateObservation(observation({ready:false,motion:.1}), 400);
    expect(d.updateObservation(observation(), 600)).toMatchObject({rejected:true});
  });
  it.each<ExerciseId>(['lunge','birddog'])('%s enforces anatomical alternation', id => {
    const d = new ExerciseDetector(id, 'alternation');
    expect(rep(d, 0, 'right')).toHaveLength(1); expect(d.expectedSide).toBe('left');
    expect(rep(d, 1600, 'right')).toHaveLength(0); expect(d.expectedSide).toBe('left');
    const units = rep(d, 3200, 'left'); expect(units).toHaveLength(1); expect(units[0].side).toBe('left');
  });
  it('rejects indistinguishable sides', () => { expect(rep(new ExerciseDetector('lunge'), 0)).toHaveLength(0); });
  it('cannot finish an interrupted cycle after tracking loss', () => {
    const d = new ExerciseDetector('squat'); rep(d, 0);
    d.updateObservation(observation({ready:false, extended:true, motion:1}),1600);
    d.updateObservation(observation({visible:false}),1800);
    expect(d.updateObservation(observation(),2000).unit).toBeUndefined();
    expect(d.updateObservation(observation(),2200).unit).toBeUndefined();
  });
  it('pause preserves alternation and fresh IDs', () => {
    const d = new ExerciseDetector('birddog', 'ids'); const first = rep(d,0,'left')[0]; d.pause();
    expect(d.expectedSide).toBe('right'); const second = rep(d,2000,'right')[0]; expect(second.id).not.toBe(first.id);
  });
  it('holds count real visible seconds, preserve fractions and exclude gaps', () => {
    const d = new ExerciseDetector('superman'); const held = observation({extended:true, amplitude:1});
    let count=0;
    for(let t=0;t<=800;t+=200) if(d.updateObservation(held,t).unit) count++;
    expect(count).toBe(0); d.pause();
    for(let t=2000;t<=2600;t+=200) if(d.updateObservation(held,t).unit) count++;
    expect(count).toBe(1);
    expect(d.updateObservation(held,10000).unit).toBeUndefined();
    expect(d.updateObservation(held,10000).unit).toBeUndefined();
  });
  it('does not count arm movement without torso motion as a push-up', () => {
    const d = new ExerciseDetector('pushup');
    for(let t=0;t<=200;t+=200) d.updateObservation(observation(),t);
    for(let t=400;t<=1000;t+=200) d.updateObservation(observation({ready:false,extended:true,amplitude:1,motion:0}),t);
    d.updateObservation(observation(),1200); expect(d.updateObservation(observation(),1400).rejected).toBe(true);
  });
});

describe('pose geometry', () => {
  const frame = (): PoseFrame => {
    const landmarks = Array.from({length:33}, () => ({x:.5,y:.5,visibility:.99}));
    for(const i of [11,12]) landmarks[i]={x:.45+(i-11)*.05,y:.2,visibility:.99};
    for(const i of [23,24]) landmarks[i]={x:.45+(i-23)*.05,y:.45,visibility:.99};
    for(const i of [25,26]) landmarks[i]={x:.45+(i-25)*.05,y:.65,visibility:.99};
    for(const i of [27,28]) landmarks[i]={x:.45+(i-27)*.05,y:.85,visibility:.99};
    return {timestamp:0,width:480,height:480,landmarks};
  };
  it('recognizes straight starting legs', () => { expect(observePose('squat',frame())).toMatchObject({visible:true,ready:true,extended:false}); });
  it('rejects a hidden required joint regardless of inferred geometry', () => { const f=frame();f.landmarks[25].visibility=.1;expect(observePose('squat',f).visible).toBe(false); });
  it('uses angle geometry and guards degenerate points', () => { expect(angle({x:0,y:1},{x:0,y:0},{x:1,y:0})).toBe(90);expect(angle({x:0,y:0},{x:0,y:0},{x:1,y:0})).toBe(0); });
  it('requires opposite limbs for Bird Dog, never same-side extension', () => {
    const f = frame(); const put = (i:number,x:number,y:number) => { f.landmarks[i]={x,y,visibility:.99}; };
    put(11,.38,.4); put(12,.4,.42); put(23,.62,.4); put(24,.64,.42);
    put(13,.25,.4); put(15,.12,.4); put(14,.4,.55); put(16,.4,.7);
    put(25,.76,.4); put(27,.9,.4); put(26,.64,.57); put(28,.78,.57);
    expect(observePose('birddog',f).extended).toBe(false);
    put(25,.62,.57); put(27,.76,.57); put(26,.77,.42); put(28,.92,.42);
    expect(observePose('birddog',f)).toMatchObject({extended:true,side:'left'});
  });
});
