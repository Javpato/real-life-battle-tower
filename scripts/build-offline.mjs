/** Post-Vite: node scripts/build-offline.mjs [dist-directory]. No runtime dependencies.
 * The generated worker caches only this build's explicit public-file allowlist.
 * Pose binaries are optional, on-demand assets. No runtime/API response cache exists.
 */
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const EXTENSIONS=new Set(['.html','.js','.css','.wasm','.task','.svg','.png','.jpg','.jpeg','.webp','.ico','.woff','.woff2','.mp3','.ogg','.wav','.webmanifest']);
export async function buildOffline(directory='dist'){
 const root=resolve(directory),files=[];
 async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.name==='sw.js')continue;const path=resolve(folder,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile()&&EXTENSIONS.has(extname(entry.name).toLowerCase()))files.push(relative(root,path).split(sep).join('/'));}}
 await walk(root);files.sort();if(!files.includes('index.html'))throw Error('Build the app first: dist/index.html is missing.');
 const digest=createHash('sha256');for(const file of files){digest.update(file);digest.update(await readFile(resolve(root,file)));}
 const version=digest.digest('hex').slice(0,16),optional=files.filter(f=>/\.(wasm|task)$/i.test(f)||/^(models|mediapipe)\//.test(f)),core=files.filter(f=>!optional.includes(f));
 const source=workerSource({version,core,optional});await writeFile(resolve(root,'sw.js'),source);return {version,core,optional,worker:resolve(root,'sw.js')};
}
export function workerSource({version,core,optional}){return `/* Everstride public shell ${version}. Generated: do not edit dist/sw.js. */
'use strict';
const PREFIX='everstride-public-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+'${version}';
const CORE=${JSON.stringify(core)};
const OPTIONAL=${JSON.stringify(optional)};
const absolute=path=>new URL(path,self.registration.scope).href;
const PUBLIC=new Set([...CORE,...OPTIONAL].map(absolute));
const PRIVATE_PATH=/(?:^|\\/)(?:api|auth|rest|functions|graphql|health|storage)(?:\\/|$)/i;
function cacheable(response,url){
 if(response.status!==200||response.redirected||response.type==='opaque')return false;
 if(/(?:private|no-store)/i.test(response.headers.get('cache-control')||''))return false;
 const mime=response.headers.get('content-type')||'';
 if(!url.endsWith('.html')&&mime.includes('text/html'))return false;
 return true;
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{await Promise.all(CORE.map(async path=>{const url=absolute(path);const response=await fetch(new Request(url,{credentials:'omit',cache:'reload'}));if(!cacheable(response,url))throw Error('Public shell asset unavailable');await cache.put(url,response);}));}
  catch(error){await caches.delete(CACHE);throw error;}
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('message',event=>{if(event.data?.type==='EVERSTRIDE_ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 // Private, cross-origin, non-GET, authenticated and parameterized requests bypass the worker.
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||request.headers.has('authorization')||url.search||PRIVATE_PATH.test(url.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.status<500)return response;}catch{}const cache=await caches.open(CACHE);return (await cache.match(absolute('index.html')))||new Response('You are offline. Reconnect once to prepare the adventure for offline use.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});})());return;
 }
 if(!PUBLIC.has(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),saved=await cache.match(url.href);if(saved)return saved;
  const response=await fetch(new Request(request,{credentials:'omit'}));
  if(cacheable(response,url.href))await cache.put(url.href,response.clone());
  return response;
 })());
});
`;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 buildOffline(process.argv[2]??'dist').then(result=>console.log(`Offline shell ${result.version}: ${result.core.length} required assets; ${result.optional.length} optional pose assets.`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
