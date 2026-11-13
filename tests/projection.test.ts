import {describe,it,expect} from 'vitest';
import {defaultNutrition,type Profile,type NutritionState} from '../src/nutrition/engine';
import {projectWeight,modelBaseline,proposeAdaptation,acceptAdaptation} from '../src/nutrition/projection';
const profile:Profile={age:35,height:175,weight:80,sex:'male',method:'mifflin',factor:1.6,goal:'maintain',adjustment:10,eligible:true,exerciseCredit:0};
describe('nonlinear adult dynamic model',()=>{
 it('holds an energy-balanced baseline, including all compartments',()=>{const r=projectWeight(profile,{intake:modelBaseline(profile)});expect(r.ok).toBe(true);if(r.ok){expect(r.points).toHaveLength(85);expect(r.points.at(-1)!.weight).toBeCloseTo(80,8);expect(r.points.at(-1)!.adaptation).toBeCloseTo(0,8);}});
 it('integrates a deficit and adaptive thermogenesis without indefinite linear loss',()=>{const r=projectWeight(profile,{days:180,intake:modelBaseline(profile)-300});expect(r.ok).toBe(true);if(r.ok){expect(r.points.at(-1)!.weight).toBeLessThan(80);expect(r.points.at(-1)!.adaptation).toBeLessThan(0);expect(r.points[60].weight-r.points[90].weight).toBeGreaterThan(r.points[150].weight-r.points[180].weight);}});
 it('supports positive energy scenarios',()=>{const r=projectWeight(profile,{intake:modelBaseline(profile)+200});expect(r.ok).toBe(true);if(r.ok)expect(r.points.at(-1)!.weight).toBeGreaterThan(80);});
 it('converges when halving the numerical integration step',()=>{const a=projectWeight(profile,{intake:2300,step:.1}),b=projectWeight(profile,{intake:2300,step:.05});expect(a.ok&&b.ok).toBe(true);if(a.ok&&b.ok)expect(Math.abs(a.points.at(-1)!.weight-b.points.at(-1)!.weight)).toBeLessThan(.001);});
 it('is deterministic',()=>expect(projectWeight(profile)).toEqual(projectWeight(profile)));
 it.each([{...profile,eligible:false},{...profile,age:17},{...profile,sex:undefined},{...profile,factor:1.2},{...profile,weight:NaN}])('rejects unsupported or ineligible input',p=>expect(projectWeight(p).ok).toBe(false));
 it.each([0,181,84.5,NaN])('bounds the horizon',days=>expect(projectWeight(profile,{days}).ok).toBe(false));
 it.each([0,.000001,1,NaN])('bounds numerical work',step=>expect(projectWeight(profile,{step}).ok).toBe(false));
 it('never fills absent intake with zero',()=>expect(projectWeight(profile,{days:28,dailyIntake:[2000]}).ok).toBe(false));
 it('refuses unsupported intake and trajectories',()=>{expect(projectWeight(profile,{intake:0}).ok).toBe(false);expect(projectWeight({...profile,weight:45}).ok).toBe(false);});
});
function data():NutritionState{
 const s=defaultNutrition();s.profile={...profile,factor:1.5};const actual=projectWeight({...profile,factor:1.7},{days:28,intake:2400});if(!actual.ok)throw Error(actual.reason);
 for(let i=0;i<28;i++){const date=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10);s.completeDays.push(date);s.entries.push({id:String(i),date,meal:'All meals',planned:false,amount:100,createdAt:date,food:{id:'food',name:'Known daily total',source:'test fixture',per100:{kcal:2400,protein:100,carbs:200,fat:100}}});s.weights.push({id:String(i),date,weight:actual.points[i].weight});}return s;
}
describe('human-reviewed recalibration',()=>{
 it('requires 28 complete days and actual records',()=>{const s=data();s.completeDays.pop();expect(proposeAdaptation(s,'2026-01-29').ok).toBe(false);});
 it('does not accept planned food or missing nutrients',()=>{const s=data();s.entries[0].planned=true;expect(proposeAdaptation(s,'2026-01-29').ok).toBe(false);});
 it('fits against an independent final week and caps an approved change',()=>{const s=data(),p=proposeAdaptation(s,'2026-01-29');expect(p.ok).toBe(true);if(p.ok){expect(p.proposedTarget-p.previousTarget).toBeLessThanOrEqual(100.00001);const next=acceptAdaptation(s,p,'2026-01-29');expect(next.profile.factor).toBeGreaterThan(s.profile.factor);expect(s.goalHistory).toHaveLength(0);expect(next.goalHistory).toHaveLength(1);expect(acceptAdaptation(next,p,'2026-01-29')).toBe(next);}});
 it('rejects stale proposals after diary edits',()=>{const s=data(),p=proposeAdaptation(s,'2026-01-29');s.entries[0].amount=110;expect(acceptAdaptation(s,p,'2026-01-29')).toBe(s);});
 it('does not repeatedly lower a target after a preference change',()=>{const s=data();s.goalHistory.push({date:'2026-01-28T12:00:00Z',profile:{...s.profile}});expect(proposeAdaptation(s,'2026-01-29').ok).toBe(false);});
});
