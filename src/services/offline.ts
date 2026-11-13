/** Static-shell offline support. IndexedDB/localStorage remain owned by their services.
 * This worker never queues health data, synchronizes saves, caches API responses or
 * claims camera models are available before those models have downloaded once.
 */
export type OfflineStatus={supported:boolean;online:boolean;ready:boolean;updateAvailable:boolean;message:string};
let status:OfflineStatus={supported:typeof navigator!=='undefined'&&'serviceWorker' in navigator,online:typeof navigator==='undefined'||navigator.onLine,ready:false,updateAvailable:false,message:''};
let registration:ServiceWorkerRegistration|undefined,started=false;
const listeners=new Set<(state:OfflineStatus)=>void>();
function message(s:OfflineStatus){if(!s.online)return s.ready?'You’re offline. Your saved adventure and journal remain on this device. Product lookups and cloud sync need a connection.':'You’re offline. Open screens remain available, but offline reload support has not been prepared.';if(s.updateAvailable)return 'An update is ready. Finish your encounter before applying it.';if(s.ready)return 'Offline adventure shell is ready on this device. Camera models need one successful download before offline use.';return s.supported?'Preparing this device for offline access…':'Offline installation is unavailable in this browser. Your local save still works.';}
function publish(patch:Partial<OfflineStatus>={}){status={...status,...patch};status.message=message(status);listeners.forEach(listener=>listener({...status}));return {...status};}
export function getOfflineStatus():OfflineStatus{return {...status,message:status.message||message(status)};}
export function subscribeOfflineStatus(listener:(state:OfflineStatus)=>void){listeners.add(listener);listener(getOfflineStatus());return()=>{listeners.delete(listener);};}
/** Register once after app startup. Production only; requires HTTPS or localhost. */
export async function registerOfflineSupport():Promise<OfflineStatus>{
 if(started)return getOfflineStatus();started=true;
 if(typeof window==='undefined'||!('serviceWorker' in navigator))return publish({supported:false});
 window.addEventListener('online',()=>publish({online:true}));window.addEventListener('offline',()=>publish({online:false}));
 if(!import.meta.env.PROD){status={...status,message:'Offline installation is enabled in production builds.'};return getOfflineStatus();}
 if(!window.isSecureContext){status={...status,supported:false,message:'Offline installation requires HTTPS or localhost.'};return getOfflineStatus();}
 try{
  const base=new URL(import.meta.env.BASE_URL,document.baseURI);
  registration=await navigator.serviceWorker.register(new URL('sw.js',base).href,{scope:base.pathname});
  publish({ready:Boolean(registration.active),updateAvailable:Boolean(registration.waiting)});
  const watch=(worker:ServiceWorker|null)=>worker?.addEventListener('statechange',()=>{if(worker.state==='installed')publish({updateAvailable:Boolean(navigator.serviceWorker.controller),ready:Boolean(registration?.active)});if(worker.state==='activated')publish({ready:true});if(worker.state==='redundant'&&!registration?.active){status={...status,message:'Offline preparation could not finish. Your local save is unaffected; reconnect and reload to retry.'};listeners.forEach(listener=>listener({...status}));}});
  watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration?.installing??null));
  void navigator.serviceWorker.ready.then(()=>publish({ready:true}));return getOfflineStatus();
 }catch{
  status={...status,message:'Offline preparation is unavailable right now. Your local save is unaffected; reconnect and reload to retry.'};listeners.forEach(listener=>listener({...status}));return {...status};
 }
}
/** Call only from an explicit, safe user action: activates the waiting worker and reloads. */
export function applyOfflineUpdate():boolean{
 if(!registration?.waiting)return false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});registration.waiting.postMessage({type:'EVERSTRIDE_ACTIVATE_UPDATE'});return true;
}
