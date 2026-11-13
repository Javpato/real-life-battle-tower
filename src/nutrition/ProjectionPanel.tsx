import {useMemo,useState} from 'react';
import {type NutritionState,today,energy} from './engine';
import {projectWeight,proposeAdaptation,acceptAdaptation} from './projection';

export default function ProjectionPanel({state,onChange}:{state:NutritionState;onChange:(next:NutritionState)=>void}){
 const [days,setDays]=useState(84),[scenario,setScenario]=useState<number|undefined>(),[review,setReview]=useState(false),[message,setMessage]=useState('');
 const date=today(),current=energy(state.profile);
 const result=useMemo(()=>projectWeight(state.profile,{days,intake:scenario}),[state.profile,days,scenario]);
 const proposal=useMemo(()=>review?proposeAdaptation(state,date):null,[state,date,review]);
 const rounded=(n:number)=>Math.round(n/50)*50;
 let path='',min=0,max=0;
 if(result.ok){min=Math.min(...result.points.map(p=>p.weight))-.2;max=Math.max(...result.points.map(p=>p.weight))+.2;path=result.points.map(p=>`${p.day?'L':'M'}${36+p.day/days*530},${160-(p.weight-min)/(max-min)*125}`).join(' ');}
 return <section className="card" aria-label="Weight scenarios and reviewed recalibration">
  <div className="card-title"><h2>A possible path, not a promise</h2><span className="eyebrow">NO AI · LOCAL CALCULATION</span></div>
  <p className="muted">An experimental adult dynamic model accounts for changing energy needs, tissue, glycogen and fluid. This is a conditional scenario, not a prediction of what your body will do.</p>
  <div className="form-grid"><label>Scenario horizon<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={42}>6 weeks</option><option value={84}>12 weeks</option><option value={180}>180 days maximum</option></select></label><label>Scenario intake · kcal/day<input type="number" min={1000} max={6000} step={50} placeholder={current?String(rounded(current.target)):'Profile required'} value={scenario??''} onChange={e=>setScenario(e.target.value===''?undefined:Number(e.target.value))}/></label></div>
  <p className="tiny">Leave intake blank to illustrate your current food target. Changing a scenario does not change your goal, log food or award game rewards.</p>
  {result.ok?<>
   <svg viewBox="0 0 600 195" role="img" aria-label={`Conditional ${days}-day weight scenario, starting at ${result.points[0].weight.toFixed(1)} kg and ending at ${result.points.at(-1)!.weight.toFixed(1)} kg`} style={{width:'100%',maxHeight:230,overflow:'visible'}}>
    <line x1="36" x2="566" y1="160" y2="160" stroke="#dfe7dc"/><line x1="36" x2="566" y1="97" y2="97" stroke="#edf1e9"/><line x1="36" x2="566" y1="35" y2="35" stroke="#edf1e9"/>
    <text x="0" y="40" fill="#7a8776" fontSize="11">{max.toFixed(1)}</text><text x="0" y="165" fill="#7a8776" fontSize="11">{min.toFixed(1)}</text><text x="36" y="185" fill="#7a8776" fontSize="11">Today</text><text x="515" y="185" fill="#7a8776" fontSize="11">Day {days}</text>
    <path d={path} fill="none" stroke="#608969" strokeWidth="3" strokeDasharray="6 3"/>
   </svg>
   <div className="button-row"><span><strong>{result.points.at(-1)!.weight.toFixed(1)} kg</strong> · conditional endpoint</span><span><strong>{rounded(result.intakeKcal).toLocaleString()} kcal/day</strong> · scenario intake</span></div>
  </>:<p className="notice">{result.reason}</p>}
  <details style={{marginTop:16}}><summary>Assumptions and limitations</summary><p className="tiny">The model initializes from the published Mifflin equation, even if your separate calculator uses Katch or a clinical measurement. Activity stays constant; sodium and carbohydrate proportions stay constant. It assumes an initial energy-balanced baseline. Real-life water changes, illness, medication, intake uncertainty and routine changes can produce different results. No confidence interval or exact goal date is claimed.</p><p className="tiny">Adapted from <a href="https://github.com/INSP-RH/bw" target="_blank" rel="noreferrer">INSP-RH/bw (MIT)</a> and <a href="https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner" target="_blank" rel="noreferrer">Hall’s published adult model</a>. Numerical tests do not establish clinical validity; this is not the official NIH planner.</p></details>
  <hr style={{border:0,borderTop:'1px solid #e5eade',margin:'24px 0'}}/>
  <h3>Review your estimate over time</h3><p className="muted">After four complete weeks, you can request a conservative recalibration. Food-recording error and metabolic differences cannot be distinguished by these data.</p>
  {!review?<button className="secondary" onClick={()=>setReview(true)}>Check whether there is enough data</button>:proposal&&!proposal.ok?<p className="notice">{proposal.reason}</p>:proposal?.ok?<div className="soft-callout"><p>Review this proposed food target: <strong>{Math.round(proposal.previousTarget)} → {Math.round(proposal.proposedTarget)} kcal/day</strong>.</p><p className="tiny">Based on {proposal.start} to {proposal.end}; last week held out from fitting. Change is limited to 100 kcal/day or 5%, whichever is smaller. These software limits do not establish medical suitability.</p><div className="button-row"><button className="primary" onClick={()=>{const updated=acceptAdaptation(state,proposal,date);if(updated!==state){onChange(updated);setMessage('Adjustment accepted. Your previous preferences remain in goal history.');setReview(false);}else setMessage('The underlying data changed. Review a fresh proposal.');}}>Accept this adjustment</button><button className="secondary" onClick={()=>{setReview(false);setMessage('Current target kept. Nothing was changed.');}}>Keep my current target</button></div></div>:null}
  {message&&<p role="status" className="notice">{message}</p>}
 </section>;
}
