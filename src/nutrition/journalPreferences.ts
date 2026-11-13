import {energy,profileForDate,today,reconcile,incrementalEnergy,total,type NutritionState} from './engine';
export type Units='metric'|'imperial';
export type DayPlan={kind:'default'|'rest'|'training';kcal?:number};
export type Reminder={id:string;label:string;time:string;enabled:boolean};
export type JournalSettingsData={units:Units;weekly:Record<string,DayPlan>;overrides:Record<string,DayPlan>;reminders:Reminder[]};
export type AdvancedJournalState=NutritionState&{journalSettings?:JournalSettingsData};
export type LocalPreferences={theme:'light'|'dark';units:Units};
const KEY='everstride-journal-preferences-v1';
export const PREFERENCE_EVENT='everstride-journal-preferences';
export const defaults=():JournalSettingsData=>({units:'metric',weekly:{},overrides:{},reminders:[]});
export function settings(s:NutritionState):JournalSettingsData{const saved=(s as AdvancedJournalState).journalSettings;return {...defaults(),...saved,weekly:saved?.weekly??{},overrides:saved?.overrides??{},reminders:saved?.reminders??[]};}
export const kgToLb=(kg:number)=>kg/0.45359237;
export const lbToKg=(lb:number)=>lb*0.45359237;
export const cmToIn=(cm:number)=>cm/2.54;
export const inToCm=(inches:number)=>inches*2.54;
export const gramsToOunces=(g:number)=>g/28.349523125;
export const ouncesToGrams=(oz:number)=>oz*28.349523125;
export function displayWeight(kg:number,units:Units){return `${(units==='imperial'?kgToLb(kg):kg).toFixed(1)} ${units==='imperial'?'lb':'kg'}`;}
export function readLocalPreferences():LocalPreferences{try{const raw=JSON.parse(localStorage.getItem(KEY)??'{}');return {theme:raw.theme==='dark'?'dark':'light',units:raw.units==='imperial'?'imperial':'metric'};}catch{return {theme:'light',units:'metric'};}}
export function applyJournalPreferences(p:LocalPreferences){
 if(typeof document==='undefined')return;
 document.documentElement.dataset.journalTheme=p.theme;
 let style=document.getElementById('everstride-journal-theme');if(!style){style=document.createElement('style');style.id='everstride-journal-theme';document.head.appendChild(style);}
 style.textContent=`html[data-journal-theme="dark"] .journal{color:#e2e9de!important;background:#17231f!important;color-scheme:dark}html[data-journal-theme="dark"] .journal :is(.journal-main,.journal-top){background:#17231f!important;color:#e2e9de!important}html[data-journal-theme="dark"] .journal :is(.card,.journal-nav,.modal,.food-modal){background:#22322b!important;border-color:#3a4c40!important;color:#e2e9de!important}html[data-journal-theme="dark"] .journal :is(h1,h2,h3,strong,label,.brand){color:#e7eddf!important}html[data-journal-theme="dark"] .journal :is(.muted,.tiny,p,small,.eyebrow){color:#b6c5b3!important}html[data-journal-theme="dark"] .journal :is(input,select,textarea){background:#18271f!important;color:#e4eddf!important;border-color:#52644f!important}html[data-journal-theme="dark"] .journal :is(.soft-callout,.notice,.secondary,.journal-note,.energy-details,.calorie-ring>div){background:#2b4032!important;color:#e1e9d8!important}html[data-journal-theme="dark"] .journal :is(.food-row,.meal-section,.card-foot,.journal-top){border-color:#40513e!important}html[data-journal-theme="dark"] .journal a{color:#c0dca6}html[data-journal-theme="dark"] .journal .selected{background:#3b5541!important;color:#eff4df!important}`;
}
export function saveLocalPreferences(p:LocalPreferences){try{localStorage.setItem(KEY,JSON.stringify(p));}catch{/* Preferences still apply for this session. */}applyJournalPreferences(p);if(typeof window!=='undefined')window.dispatchEvent(new Event(PREFERENCE_EVENT));}
export function resolveDailyTarget(s:NutritionState,date:string,baseTarget:number|null){
 // Weekly preferences were not versioned: do not rewrite past days using today's template.
 const cfg=settings(s),day=new Date(date+'T12:00:00').getDay(),override=cfg.overrides[date],weekly=date<today()?undefined:cfg.weekly[String(day)],plan=override??weekly??{kind:'default' as const};
 const source=override?'date override':weekly?'weekly template':'profile';
 const profile=profileForDate(s,date);
 if(!profile)return {target:null,kind:plan.kind,source,reason:'No historical personalized profile exists for this date.'};
 if(plan.kcal===undefined)return {target:baseTarget,kind:plan.kind,source};
 const calc=energy(profile);if(!calc||!profile.eligible)return {target:baseTarget,kind:plan.kind,source,reason:'A personalized target requires an eligible adult profile for this date.'};
 const floor=Math.max(calc.rmr,calc.tdee-Math.min(calc.tdee*.2,500)),ceiling=Math.min(6000,calc.tdee*1.5);
 if(!Number.isFinite(plan.kcal)||plan.kcal<floor||plan.kcal>ceiling)return {target:baseTarget,kind:plan.kind,source,reason:'This override falls outside the app’s existing goal limits; the profile target is used.'};
 return {target:plan.kcal,kind:plan.kind,source};
}
/** Historical calculations must use one dated profile consistently, including activity credit. */
export function dailyEnergySummary(s:NutritionState,date:string){
 const profile=profileForDate(s,date),calc=profile?energy(profile):null;
 const activities=reconcile(s.activities.filter(a=>a.date===date));
 const additionalEnergy=activities.filter(a=>a.included&&((a as typeof a&{additional?:boolean}).additional??((profile?.exerciseCredit??0)>0))).reduce((sum,a)=>sum+incrementalEnergy(a,profile?.weight??0),0);
 const activityCredit=additionalEnergy*(profile?.exerciseCredit??0);
 const resolution=resolveDailyTarget(s,date,calc?calc.target+activityCredit:null);
 // Food-credit policy changes the intake budget, not the estimate of expenditure.
 const expenditure=calc?calc.tdee+additionalEnergy:null;
 const logged=total(s.entries.filter(e=>e.date===date&&!e.planned));
 const balance=expenditure!==null&&s.completeDays.includes(date)&&logged.kcal!==null?expenditure-logged.kcal:null;
 return {profile,calc,activities,additionalEnergy,activityCredit,target:resolution.target,targetReason:resolution.reason,targetSource:resolution.source,expenditure,balance};
}
export function dueReminders(cfg:JournalSettingsData,now:Date,dismissed:string[]=[]){const day=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,minutes=now.getHours()*60+now.getMinutes();return cfg.reminders.filter(r=>{if(!r.enabled||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))return false;const [h,m]=r.time.split(':').map(Number);return minutes>=h*60+m&&!dismissed.includes(`${day}:${r.id}`);});}
