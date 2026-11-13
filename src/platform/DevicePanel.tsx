import {useEffect,useState} from 'react';
import {healthPlatform,type HealthAvailability,type HealthReading,type ImportedHealth} from './health';
import {gameSync,type StepEpoch} from '../services/sync';
import './DevicePanel.css';

type StepSession={startTime:string;source:StepEpoch['source'];epochId?:string;saveId?:string;userId?:string;difficulty:StepEpoch['difficulty']};
export type DevicePanelProps={onActivityImport?:(reading:ImportedHealth)=>void|Promise<void>};
const sessionKey='everstride.step-session.v1';
function savedSession():StepSession|null{try{return JSON.parse(localStorage.getItem(sessionKey)??'null');}catch{return null;}}
function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export default function DevicePanel({onActivityImport}:DevicePanelProps){
 const [availability,setAvailability]=useState<HealthAvailability|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[session,setSession]=useState<StepSession|null>(savedSession),[reading,setReading]=useState<HealthReading|null>(null);
 const [source,setSource]=useState<StepEpoch['source']>(savedSession()?.source??'health-connect'),[difficulty,setDifficulty]=useState<StepEpoch['difficulty']>('medium');
 const [date,setDate]=useState(localDay),[preview,setPreview]=useState<ImportedHealth|null>(null),[imported,setImported]=useState(false);
 const [userId,setUserId]=useState(''),[saves,setSaves]=useState<Array<{id:string;coins:number;revision:number;nutrition_generation:number}>>([]),[saveId,setSaveId]=useState('');
 const [deviceName,setDeviceName]=useState('My device'),[pairCode,setPairCode]=useState(''),[expiresAt,setExpiresAt]=useState(''),[approveCode,setApproveCode]=useState(''),[shareConsent,setShareConsent]=useState(false);
 useEffect(()=>{let active=true;void healthPlatform.availability().then(a=>{if(active){setAvailability(a);if(!savedSession())setSource(a.healthConnect?'health-connect':'step-counter');}});return()=>{active=false;};},[]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
 function persist(value:StepSession){setSession(value);localStorage.setItem(sessionKey,JSON.stringify(value));}
 async function refreshSaves(){const result=await gameSync.listSaves();if(result.ok===false)throw new Error(result.error);setSaves(result.data);setSaveId(current=>result.data.some(s=>s.id===current)?current:result.data[0]?.id??'');}
 async function connect(){const result=await gameSync.authenticate();if(result.ok===false)throw new Error(result.error);setUserId(result.data.userId);await refreshSaves();setMessage('Device authenticated. Your local adventure and journal have not been uploaded.');}
 async function readCurrent(){if(!session)throw new Error('Start a step session first.');const value=await healthPlatform.readSteps({startTime:session.startTime,source:session.source});setReading(value);setMessage(`Read ${value.steps.toLocaleString()} real steps from ${value.source==='health-connect'?'Health Connect':'the hardware counter'}.`);}
 async function startSession(){
  if(session?.epochId)throw new Error('Sync your existing cloud step session first. Use “Finish step session” before changing source or difficulty.');
  let next:StepSession={startTime:new Date().toISOString(),source,difficulty};
  if(userId&&saveId){const result=await gameSync.startStepEpoch(saveId,source,difficulty);if(result.ok===false)throw new Error(result.error);next={...next,startTime:result.data.startedAt,epochId:result.data.epochId,saveId,userId};}
  persist(next);setReading(null);
  const value=await healthPlatform.readSteps({startTime:next.startTime,source:next.source});setReading(value);
  setMessage(next.epochId?'Cloud step session started. Only new steps in this session can earn cloud coins.':'Local step session started. These readings do not change adventure coins.');
 }
 async function syncSteps(){
  if(!session?.epochId||!session.saveId)throw new Error('This is a local reading session, not a cloud reward session.');
  if(session.userId!==userId)throw new Error('Connect the device account that started this step session.');
  const value=await healthPlatform.readSteps({startTime:session.startTime,source:session.source});setReading(value);
  const key=`everstride.steps.pending.${session.epochId}`;
  let operationId=crypto.randomUUID();
  try{const pending=JSON.parse(localStorage.getItem(key)??'null');if(pending?.total===value.steps)operationId=pending.id;}catch{/* Start a fresh idempotent observation. */}
  localStorage.setItem(key,JSON.stringify({id:operationId,total:value.steps}));
  const result=await gameSync.creditSteps(session.saveId,session.epochId,value.steps,operationId);if(result.ok===false)throw new Error(result.error);
  localStorage.removeItem(key);await refreshSaves();setMessage(`${result.data.creditedCoins} cloud coins credited. Cloud balance: ${result.data.coins}. Your separate local adventure balance is unchanged.`);
 }
 async function finishSession(){if(session?.epochId)await syncSteps();setSession(null);setReading(null);localStorage.removeItem(sessionKey);setMessage('Step session finished locally. Start the next session to close the previous server epoch and establish a new source baseline.');}
 async function previewHealth(){
  const start=new Date(`${date}T00:00:00`),next=new Date(start);next.setDate(next.getDate()+1);
  const end=new Date(Math.min(next.getTime(),Date.now()));
  if(!Number.isFinite(start.getTime())||start>=end)throw new Error('Choose today or an earlier day.');
  const value=await healthPlatform.importHealth({startTime:start.toISOString(),endTime:end.toISOString()});setPreview(value);setImported(false);setMessage('Health data read on this device. Review it before saving; nothing has been uploaded.');
 }
 return <div className="everstride-device-panel" aria-busy={busy}>
  <section className="device-card"><h3>Real movement, real sources</h3><p>{availability===null?'Checking this device…':availability.available?'A native activity source is available. Permission is required.':availability.reason}</p>
   <div className="device-badges"><span>Health Connect {availability?.healthConnect?'available':'unavailable'}</span><span>Step counter {availability?.stepCounter?'available':'unavailable'}</span></div>
   {availability?.available&&<><button disabled={busy} onClick={()=>void run(async()=>{const p=await healthPlatform.requestPermissions();setMessage(`Motion permission: ${p.activityRecognition?'granted':'not granted'}. All requested Health Connect permissions: ${p.healthConnect?'granted':'not all granted; individual readings may still be available'}.`);})}>Allow device activity access</button>
    <div className="device-fields"><label>Step source<select value={source} disabled={!!session||busy} onChange={e=>setSource(e.target.value as StepEpoch['source'])}><option value="health-connect" disabled={!availability.healthConnect}>Health Connect</option><option value="step-counter" disabled={!availability.stepCounter}>Hardware step counter</option></select></label><label>Cloud reward difficulty<select value={difficulty} disabled={!!session||busy} onChange={e=>setDifficulty(e.target.value as StepEpoch['difficulty'])}><option value="easy">Easy · 30 / 1,000 steps</option><option value="medium">Medium · 12 / 500 steps</option><option value="hard">Hard · 2 / 100 steps</option></select></label></div>
    {!session?<button disabled={busy} onClick={()=>void run(startSession)}>{userId&&saveId?'Start cloud step session':'Start local step session'}</button>:<><p className="device-caption">Session since {new Date(session.startTime).toLocaleString()} · {session.source} · {session.epochId?'cloud rewards':'local readings'}</p><div className="device-actions"><button disabled={busy} onClick={()=>void run(readCurrent)}>Read steps</button>{session.epochId&&<button disabled={busy||!userId} onClick={()=>void run(syncSteps)}>Sync step rewards</button>}<button disabled={busy} onClick={()=>void run(finishSession)}>Finish step session</button></div></>}
    {reading&&<p className="device-reading"><strong>{reading.steps.toLocaleString()}</strong> steps observed during this session</p>}
    <p className="device-caption">Health Connect reads recorded activity. The sensor fallback does not guarantee background capture while this app is closed. After a reboot, finish the old counter session and start a new one.</p>
   </>}
  </section>
  <section className="device-card"><h3>Preview health records</h3><p>Read steps, sleep duration, active energy and weight for a day. Missing values stay empty. Importing does not automatically upload data.</p>
   <div className="device-fields"><label>Day<input type="date" value={date} max={localDay()} onChange={e=>{setDate(e.target.value);setPreview(null);setImported(false);}}/></label><button disabled={busy||!availability?.healthConnect} onClick={()=>void run(previewHealth)}>Read Health Connect</button></div>
   {preview&&<><dl className="device-metrics"><div><dt>Steps</dt><dd>{preview.steps.toLocaleString()}</dd></div><div><dt>Sleep</dt><dd>{preview.sleepMinutes===null?'Unavailable':`${preview.sleepMinutes} min`}</dd></div><div><dt>Active energy</dt><dd>{preview.activeCalories===null?'Unavailable':`${Math.round(preview.activeCalories)} kcal`}</dd></div><div><dt>Weight</dt><dd>{preview.weightKg===null?'Unavailable':`${preview.weightKg.toFixed(1)} kg`}</dd></div></dl><p className="device-caption">Sources: {preview.sources.join(', ')||'Health Connect aggregate'}</p>
    {onActivityImport?<button disabled={busy||imported} onClick={()=>void run(async()=>{await onActivityImport(preview);setImported(true);setMessage('The reviewed health snapshot was saved to your journal.');})}>{imported?'Saved to journal':'Save this snapshot to journal'}</button>:<p className="device-caption">Preview only: this screen is not connected to journal import in this build.</p>}
   </>}
  </section>
  <section className="device-card"><h3>Linked devices</h3><p className="device-notice">This build stores the playable adventure locally. Cloud linking and the step wallet are available only with a configured Supabase project; full adventure and journal synchronization is not connected. Existing local saves are never merged or replaced here.</p>
   {!gameSync.configured?<p>Cloud unavailable: the project’s Supabase URL and public key have not been configured.</p>:<><label>Device name<input maxLength={60} value={deviceName} onChange={e=>setDeviceName(e.target.value)}/></label><button disabled={busy} onClick={()=>void run(connect)}>{userId?'Refresh cloud connection':'Connect device account'}</button>
    {userId&&<><div className="device-fields"><label>Cloud record<select value={saveId} onChange={e=>setSaveId(e.target.value)}><option value="">No cloud record selected</option>{saves.map(s=><option key={s.id} value={s.id}>{s.id.slice(0,8)} · {s.coins} cloud coins</option>)}</select></label><button disabled={busy} onClick={()=>void run(async()=>{const r=await gameSync.createSave(deviceName);if(r.ok===false)throw new Error(r.error);await refreshSaves();setSaveId(r.data.saveId);setMessage('Cloud record ready. This did not upload your local adventure.');})}>Create cloud record</button></div>
     <h4>On the device you want to link</h4><button disabled={busy} onClick={()=>void run(async()=>{const r=await gameSync.createPairCode(deviceName);if(r.ok===false)throw new Error(r.error);setPairCode(r.data.code);setExpiresAt(r.data.expiresAt);})}>Show temporary link code</button>
     {pairCode&&<p className="device-code"><strong>{pairCode}</strong><span>Expires {new Date(expiresAt).toLocaleTimeString()}</span></p>}
     <h4>On the owner’s device</h4><label>Code from the other device<input maxLength={8} value={approveCode} placeholder="8-character code" autoComplete="off" onChange={e=>setApproveCode(e.target.value.toUpperCase())}/></label><label className="device-consent"><input type="checkbox" checked={shareConsent} onChange={e=>setShareConsent(e.target.checked)}/>I authorize this device to access this cloud record and its nutrition journal. All linked devices can read and edit that journal.</label>
     <button disabled={busy||!saveId||!shareConsent||approveCode.length!==8} onClick={()=>void run(async()=>{const r=await gameSync.approvePairCode(saveId,approveCode);if(r.ok===false)throw new Error(r.error);setApproveCode('');setShareConsent(false);setMessage(`${r.data.deviceName} linked to the cloud record. Refresh the connection on that device. Local adventure data has not been uploaded.`);})}>Authorize linked device</button>
    </>}
   </>}
  </section>
  {message&&<p role="status" className="device-message">{message}{session&&message.includes('STEP_COUNTER_RESET')&&<button onClick={()=>{setSession(null);setReading(null);localStorage.removeItem(sessionKey);setMessage('Counter session reset. Previously credited rewards are kept; start a new session for post-reboot steps.');}}>Start fresh after reboot</button>}</p>}
 </div>;
}
