import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {buildOffline,workerSource} from '../scripts/build-offline.mjs';
function harness(){
 const handlers={},stored=new Map(),deleted=[],network=[],scope='https://example.test/game/';
 const cache={put:async(k,v)=>stored.set(k,v),match:async k=>stored.get(k)};
 const prefix='everstride-public-'+encodeURIComponent(scope)+'-';
 const context={URL,Request,Response,Set,Promise,Error,self:{registration:{scope},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:()=>{}},caches:{open:async()=>cache,keys:async()=>[prefix+'old','another-app-cache','everstride-public-another-scope-old',prefix+'v1'],delete:async key=>{deleted.push(key);return true;}},fetch:async req=>{network.push(req);return new Response('public asset',{headers:{'content-type':req.url.endsWith('.html')?'text/html':'text/javascript'}});}};
 runInNewContext(workerSource({version:'v1',core:['index.html','assets/app.js'],optional:['models/pose.task']}),context);
 function fetchEvent(request){let promise;handlers.fetch({request,respondWith:p=>promise=p});return promise;}
 return {handlers,stored,deleted,network,context,fetchEvent,prefix};
}
describe('offline build manifest',()=>{
 it('hashes static build content and leaves model assets optional',async()=>{const dir=await mkdtemp(join(tmpdir(),'everstride-offline-'));try{await mkdir(join(dir,'assets'));await mkdir(join(dir,'models'));await writeFile(join(dir,'index.html'),'<html>shell</html>');await writeFile(join(dir,'assets/app.js'),'export {}');await writeFile(join(dir,'models/pose.task'),'model');await writeFile(join(dir,'private.json'),'private');await writeFile(join(dir,'.env'),'secret');const first=await buildOffline(dir);expect(first.core).toEqual(['assets/app.js','index.html']);expect(first.optional).toEqual(['models/pose.task']);const again=await buildOffline(dir);expect(again.version).toBe(first.version);await writeFile(join(dir,'assets/app.js'),'export { changed }');expect((await buildOffline(dir)).version).not.toBe(first.version);expect(await readFile(join(dir,'sw.js'),'utf8')).not.toContain('private.json');}finally{await rm(dir,{recursive:true,force:true});}});
 it('requires an actual built app shell',async()=>{const dir=await mkdtemp(join(tmpdir(),'everstride-offline-'));try{await expect(buildOffline(dir)).rejects.toThrow('index.html');}finally{await rm(dir,{recursive:true,force:true});}});
});
describe('generated worker boundaries',()=>{
 it('installs only core assets using requests without credentials',async()=>{const h=harness();let pending;h.handlers.install({waitUntil:p=>pending=p});await pending;expect(h.stored.size).toBe(2);expect(h.network.every(r=>r.credentials==='omit')).toBe(true);expect(h.network.some(r=>r.url.includes('pose.task'))).toBe(false);});
 it('never intercepts external services, private APIs, authorization or query strings',()=>{const h=harness();for(const url of ['https://world.openfoodfacts.org/api/v2/search','https://project.supabase.co/rest/v1/profiles','https://example.test/game/api/health','https://example.test/game/auth/callback','https://example.test/game/assets/app.js?token=secret','https://example.test/game/private.json'])expect(h.fetchEvent(new Request(url))).toBeUndefined();expect(h.fetchEvent(new Request('https://example.test/game/assets/app.js',{headers:{authorization:'Bearer private'}}))).toBeUndefined();expect(h.fetchEvent(new Request('https://example.test/game/assets/app.js',{method:'POST'}))).toBeUndefined();});
 it('uses the cached app shell for offline app navigation without caching responses',async()=>{const h=harness();h.stored.set('https://example.test/game/index.html',new Response('saved shell'));h.context.fetch=async()=>{throw Error('offline');};const request={url:'https://example.test/game/village',method:'GET',headers:new Headers(),mode:'navigate'};const response=await h.fetchEvent(request);expect(await response.text()).toBe('saved shell');expect(h.stored.size).toBe(1);});
 it('caches optional assets only after a successful public fetch',async()=>{const h=harness();await h.fetchEvent(new Request('https://example.test/game/models/pose.task'));expect(h.stored.has('https://example.test/game/models/pose.task')).toBe(true);});
 it('does not cache private or no-store responses',async()=>{const h=harness();h.context.fetch=async()=>new Response('not public',{headers:{'cache-control':'private, no-store'}});await h.fetchEvent(new Request('https://example.test/game/assets/app.js'));expect(h.stored.size).toBe(0);});
 it('does not cache SPA HTML returned for a missing binary',async()=>{const h=harness();h.context.fetch=async()=>new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}});await h.fetchEvent(new Request('https://example.test/game/models/pose.task'));expect(h.stored.size).toBe(0);});
 it('invalidates only previous caches belonging to this app and scope',async()=>{const h=harness();let pending;h.handlers.activate({waitUntil:p=>pending=p});await pending;expect(h.deleted).toEqual([h.prefix+'old']);});
});
