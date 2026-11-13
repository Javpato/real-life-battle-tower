import {energy,type Profile,type NutritionState} from './engine';

/* Adult Hall equations adapted from INSP-RH/bw, src/adult_weight.cpp.
 * https://github.com/INSP-RH/bw — Copyright (c) 2018 Instituto Nacional de Salud Pública.
 * MIT License: Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions: The above copyright notice and this
 * permission notice shall be included in all copies or substantial portions of the
 * Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
 * EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
 * OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * This local scalar implementation uses coupled RK4, constant sodium/carbohydrate
 * composition, and bounded horizons. It is NOT the official NIH planner and has
 * not been clinically validated or certified equivalent to its implementation.
 */
export const MODEL_VERSION='hall-adult-local-rk4-v1';
export type ProjectionPoint={day:number;weight:number;fat:number;lean:number;fluid:number;glycogen:number;adaptation:number};
export type Projection={ok:true;points:ProjectionPoint[];baselineKcal:number;intakeKcal:number;days:number;model:string}|{ok:false;reason:string};
type State=[number,number,number,number]; // lean tissue, glycogen, adaptive thermogenesis, extracellular fluid

export function projectionEligibility(p:Profile):string|null{
 if(!p.eligible||!p.age||p.age<18)return 'Weight scenarios are available only for eligible adults, excluding pregnancy and breastfeeding. Your journal remains available.';
 if(!p.weight||!p.height||!p.sex||![p.weight,p.height,p.age,p.factor].every(Number.isFinite))return 'Add weight, height, age and the equation parameter to calculate a scenario.';
 if(p.weight<30||p.weight>300||p.height<120||p.height>230||p.age>100)return 'These inputs are outside this implementation’s supported range.';
 if(p.factor<1.4||p.factor>2.4)return 'The dynamic model supports activity factors from 1.4 to 2.4. Your calculator setting is unchanged; choose a supported factor only if it describes your routine.';
 if(p.weight/(p.height/100)**2<18.5)return 'This implementation does not provide weight-change scenarios at a BMI below 18.5.';
 return null;
}
export function modelBaseline(p:Profile){return (9.99*p.weight!+6.25*p.height!-4.92*p.age!+(p.sex==='male'?5:-161))*p.factor;}

/** Per-day intake is an explicit scenario. Missing diary days must never be passed as zero. */
export function projectWeight(p:Profile,options:{days?:number;intake?:number;dailyIntake?:number[];step?:number}={}):Projection{
 const invalid=projectionEligibility(p);if(invalid)return {ok:false,reason:invalid};
 const days=options.days??84,step=options.step??.1;
 if(!Number.isInteger(days)||days<1||days>180)return {ok:false,reason:'Choose a whole-number horizon from 1 to 180 days.'};
 if(!Number.isFinite(step)||step<.025||step>.25)return {ok:false,reason:'Invalid numerical integration step.'};
 const baseline=modelBaseline(p),intake=options.intake??energy(p)?.target??baseline;
 const inputs=options.dailyIntake??Array.from({length:days},()=>intake);
 if(inputs.length!==days||inputs.some(v=>!Number.isFinite(v)||v<1000||v>6000))return {ok:false,reason:'The scenario requires a known daily intake between 1,000 and 6,000 kcal. This technical range does not establish nutritional suitability.'};
 const W=p.weight!,H=p.height!/100,A=p.age!,female=p.sex==='female';
 const rmr=baseline/p.factor,fluid0=female?-4+5.98*H+.167*W:.025*A+9.57*H+.191*W-12.4;
 const fat0=p.bodyFat!==undefined&&p.bodyFat>0&&p.bodyFat<75&&p.bodyFatMethod?W*p.bodyFat/100:W*(.14*A+(female?39.96:37.31)*Math.log(W/(H*H))-(female?102.01:103.94))/100;
 const lean0=W-fluid0-fat0-3.7*.5;
 if(fat0<=0||lean0<=0||fluid0<=0)return {ok:false,reason:'The model could not initialize a plausible body composition.'};
 const rhoG=4206.501,rhoF=9440.727,rhoL=1816.444,gammaF=3.107075,gammaL=21.98853;
 const C=10.4*rhoL/rhoF,alpha1=-(1+229.4455/rhoL)*C,alpha2=-(1+179.2543/rhoF);
 const delta=((1-.1)*p.factor-1)*rmr/W,K=baseline-gammaL*lean0-gammaF*fat0-delta*W;
 const carbBase=.5*baseline,kG=carbBase/(.5*.5);
 const fat=(lean:number)=>fat0*Math.exp((lean-lean0)/10.4);
 let state:State=[lean0,.5,0,fluid0];
 const point=(day:number):ProjectionPoint=>({day,weight:state[0]+fat(state[0])+state[3]+3.7*state[1],fat:fat(state[0]),lean:state[0],fluid:state[3],glycogen:state[1],adaptation:state[2]});
 const points=[point(0)],steps=Math.ceil(1/step),h=1/steps;
 for(let day=0;day<days;day++){
  const kcal=inputs[day],change=kcal-baseline,carb=.5*kcal;
  const derivative=(s:State):State=>{
   const [lean,glycogen,adaptive,fluid]=s,F=fat(lean),weight=lean+F+fluid+3.7*glycogen;
   const dG=(carb-kG*glycogen*glycogen)/rhoG;
   const ratio=(K+delta*weight+.1*change+adaptive-kcal+rhoG*dG+gammaL*lean+gammaF*F)/(alpha1+alpha2*F);
   return [ratio*C/rhoL,dG,(.14*change-adaptive)/14,(-3000*(fluid-fluid0)-4000*(1-carb/carbBase))/3220];
  };
  const plus=(s:State,k:State,n:number)=>s.map((v,i)=>v+n*k[i]) as State;
  for(let n=0;n<steps;n++){
   const a=derivative(state),b=derivative(plus(state,a,h/2)),c=derivative(plus(state,b,h/2)),d=derivative(plus(state,c,h));
   state=state.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6) as State;
   if(state.some(v=>!Number.isFinite(v))||state[0]<=0||state[1]<=0||state[3]<=0)return {ok:false,reason:'The numerical model left its supported range. No projection is shown.'};
  }
  const next=point(day+1);if(next.weight/(H*H)<18.5)return {ok:false,reason:'This scenario reaches a BMI below 18.5. Choose another scenario; the app will not extend this projection.'};points.push(next);
 }
 return {ok:true,points,baselineKcal:baseline,intakeKcal:inputs.reduce((a,b)=>a+b,0)/days,days,model:MODEL_VERSION};
}

export type Adaptation={ok:false;reason:string}|{ok:true;factor:number;previousTarget:number;proposedTarget:number;trainingError:number;validationError:number;start:string;end:string;fingerprint:string};
const shift=(date:string,n:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function proposeAdaptation(s:NutritionState,asOf:string):Adaptation{
 const invalid=projectionEligibility(s.profile);if(invalid)return {ok:false,reason:invalid};
 const calc=energy(s.profile);if(!calc||calc.restricted)return {ok:false,reason:'Review your current profile and goal before requesting a recalibration.'};
 const recent=s.goalHistory.some(h=>{const age=Date.parse(asOf+'T12:00:00Z')-Date.parse(h.date);return age>=0&&age<14*86400000;});
 if(recent)return {ok:false,reason:'Allow at least 14 days after your last preference or target change before another recalibration.'};
 const dates=Array.from({length:28},(_,i)=>shift(asOf,i-28));
 if(dates.some(d=>!s.completeDays.includes(d)))return {ok:false,reason:'Recalibration needs 28 consecutive completed days ending yesterday. Unlogged days are never treated as zero intake.'};
 const meals=dates.map(date=>s.entries.filter(e=>e.date===date&&!e.planned));
 if(meals.some(entries=>!entries.length||entries.some(e=>e.food.per100.kcal===null||!Number.isFinite(e.food.per100.kcal)||!Number.isFinite(e.amount)||e.amount<=0)))return {ok:false,reason:'Each completed day needs actual food entries with known energy and quantities.'};
 const intake=meals.map(entries=>entries.reduce((sum,e)=>sum+e.food.per100.kcal!*e.amount/100,0));
 const weights=dates.map(d=>{const readings=s.weights.filter(w=>w.date===d&&Number.isFinite(w.weight)&&w.weight>0);return readings.length?readings.reduce((n,w)=>n+w.weight,0)/readings.length:null;});
 if(weights[0]===null||[0,1,2,3].some(week=>weights.slice(week*7,week*7+7).filter(w=>w!==null).length<3))return {ok:false,reason:'Add a starting-day measurement and at least three distinct weigh-in days in each of the four weeks. Duplicate same-day readings count once.'};
 const baselineProfile={...s.profile,weight:weights[0]!};
 const error=(result:Projection,from:number,to:number)=>{if(!result.ok)return Infinity;let sum=0,n=0;for(let i=from;i<to;i++)if(weights[i]!==null){sum+=Math.abs(result.points[i].weight-weights[i]!);n++;}return n?sum/n:Infinity;};
 const old=projectWeight(baselineProfile,{days:28,dailyIntake:intake});
 let bestFactor=0,bestError=Infinity,best:Projection={ok:false,reason:'No fit'};
 for(let n=140;n<=240;n++){const factor=n/100,result=projectWeight({...baselineProfile,factor},{days:28,dailyIntake:intake});const loss=error(result,0,21);if(loss<bestError){bestError=loss;bestFactor=factor;best=result;}}
 const holdout=error(best,21,28),oldHoldout=error(old,21,28);
 if(bestFactor<=1.4||bestFactor>=2.4||!Number.isFinite(bestError)||error(old,0,21)-bestError<.05||oldHoldout-holdout<.01)return {ok:false,reason:'No stable improvement was found on the held-out week. Keep the current estimate; more data may help.'};
 const candidate=energy({...s.profile,factor:bestFactor});if(!candidate||candidate.restricted)return {ok:false,reason:'The proposed setting conflicts with the current goal limits. Review your plan first.'};
 const change=candidate.target-calc.target,limit=Math.min(100,.05*calc.target);
 const factor=s.profile.factor+(bestFactor-s.profile.factor)*Math.min(1,limit/Math.max(Math.abs(change),.00001));
 const adjusted=energy({...s.profile,factor});if(!adjusted||adjusted.restricted)return {ok:false,reason:'No adjustment is available within the current goal limits.'};
 if(Math.abs(adjusted.target-calc.target)<25)return {ok:false,reason:'The estimated difference is too small to justify changing your target.'};
 return {ok:true,factor,previousTarget:calc.target,proposedTarget:adjusted.target,trainingError:bestError,validationError:holdout,start:dates[0],end:dates[27],fingerprint:JSON.stringify([dates,intake,weights,s.profile,s.goalHistory.length])};
}
/** Caller must present the proposal and receive an explicit user confirmation. */
export function acceptAdaptation(s:NutritionState,proposal:Adaptation,asOf:string):NutritionState{
 if(!proposal.ok)return s;const current=proposeAdaptation(s,asOf);if(!current.ok||current.fingerprint!==proposal.fingerprint||current.factor!==proposal.factor)return s;
 const profile={...s.profile,factor:proposal.factor};return {...s,profile,goalHistory:[...s.goalHistory,{date:asOf+'T12:00:00Z',profile:{...profile}}]};
}
