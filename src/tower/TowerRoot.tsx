import {useEffect,useState} from 'react';
import TowerApp from './TowerApp';
import Journal from '../nutrition/Journal';
import {defaultNutrition,type NutritionState} from '../nutrition/engine';
import {readSave,writeSave} from '../services/storage';
import {useNutritionSync} from '../services/useNutritionSync';
import NutritionSyncStatus from '../services/NutritionSyncStatus';
import './support.css';
import './camera-layout.css';
function Diary({id,close}:{id:string;close:()=>void}){
 const [local,setLocal]=useState<NutritionState>(defaultNutrition),[ready,setReady]=useState(false),[cloudId,setCloudId]=useState<string|null>(null),[shared,setShared]=useState(false);
 const sync=useNutritionSync(shared?cloudId:null);
 useEffect(()=>{void Promise.all([readSave<NutritionState>(`nutrition:${id}`),readSave<Array<{slot:number;cloudId?:string}>>('battle-tower:slots:v1')]).then(([v,slots])=>{if(v)setLocal(v);const slot=Number(id.replace('tower-slot-',''));setCloudId(slots?.find(v=>v.slot===slot)?.cloudId??null);setReady(true);});},[id]);
 if(!ready)return <div className="tower-support">Loading journal…</div>;
 return <div className="tower-support"><div className="tower-support-bar"><button onClick={close}>Back to Battle Tower</button>{cloudId&&<button onClick={()=>setShared(v=>!v)}>{shared?'Open local journal':'Open shared cloud journal'}</button>}<span>{shared?'Shared cloud journal':'Local journal · not uploaded automatically'}</span></div>{shared&&!sync.ready?<p>{sync.status}</p>:<Journal state={shared?sync.state:local} onChange={s=>{if(shared)sync.update(s);else{setLocal(s);void writeSave(`nutrition:${id}`,s);}}} onClose={close} onDiscover={()=>{}} storageScope={shared?'cloud':'local'} syncPanel={shared?<NutritionSyncStatus sync={sync}/>:undefined} onDeleteJournal={shared?sync.deleteAll:undefined}/>}</div>;
}
export default function TowerRoot(){const [journal,setJournal]=useState<string|null>(null);return <><div hidden={journal!==null}><TowerApp onJournal={setJournal}/></div>{journal&&<Diary id={journal} close={()=>setJournal(null)}/>}</>;}
