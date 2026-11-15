import type {Food} from './engine';
// Actual OFF responses retrieved 2026-11-13. Database: ODbL; individual contents: DbCL.
// Source queries and licensing: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/
// https://world.openfoodfacts.org/api/v2/product/3017620422003.json
// https://world.openfoodfacts.org/cgi/search.pl?search_terms=rolled%20oats&search_simple=1&action=process&json=1&page_size=3
// This attributed extract is distributed under ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
export const INITIAL_FOODS:Food[]=[
 {id:'20003166',barcode:'20003166',name:"FLOCONS D'AVOINE",brand:'Crownfield',basis:'g',source:'Open Food Facts · offline snapshot 2026-11-13 · ODbL / DbCL · check packaging',per100:{kcal:372,protein:13.5,carbs:58.7,fat:7,fiber:10}},
 {id:'3168930003632',barcode:'3168930003632',name:'Quaker Oats',brand:'Quaker',basis:'g',source:'Open Food Facts · offline snapshot 2026-11-13 · ODbL / DbCL · check packaging',per100:{kcal:375,protein:11,carbs:60,fat:8,fiber:9}},
 {id:'3017620422003',barcode:'3017620422003',name:'Nutella',brand:'Ferrero, Nutella',basis:'g',source:'Open Food Facts · offline snapshot 2026-11-13 · ODbL / DbCL · check packaging',per100:{kcal:539,protein:6.3,carbs:57.5,fat:30.9,fiber:0}},
];
const normalized = (value:string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
export function matchesFood(food:Food,query:string){return normalized(`${food.name} ${food.brand??''} ${food.barcode??''}`).includes(normalized(query));}
export function localFoodSearch(query:string){return INITIAL_FOODS.filter(f=>matchesFood(f,query));}
type RawProduct={code?:unknown;product_name?:unknown;product_name_en?:unknown;product_name_es?:unknown;product_name_fr?:unknown;brands?:unknown;nutriments?:Record<string,unknown>;nutrition_data_per?:unknown;image_front_small_url?:unknown};
export function mapFoodProduct(p:RawProduct,date:string):Food|null{
 if(!p||typeof p!=='object')return null;
 const name=[p.product_name,p.product_name_en,p.product_name_es,p.product_name_fr].find(v=>typeof v==='string'&&v.trim());
 if(typeof p.code!=='string'||typeof name!=='string')return null;
 const n=p.nutriments??{},get=(key:string)=>typeof n[key]==='number'&&Number.isFinite(n[key])&&(n[key] as number)>=0?n[key] as number:null;
 const brands=Array.isArray(p.brands)?p.brands.filter((v):v is string=>typeof v==='string').map(v=>v.trim()).join(', '):typeof p.brands==='string'?p.brands:undefined;
 return {id:p.code,barcode:p.code,name:name.trim(),brand:brands,basis:p.nutrition_data_per==='100ml'?'ml':'g',source:`Open Food Facts · retrieved ${date} · ODbL / DbCL · check packaging`,...(typeof p.image_front_small_url==='string'?{image:p.image_front_small_url}:{}),per100:{kcal:get('energy-kcal_100g'),protein:get('proteins_100g'),carbs:get('carbohydrates_100g'),fat:get('fat_100g'),fiber:get('fiber_100g')}};
}
export function normalizeBarcode(code:string):string {
 const clean=code.replace(/[\s-]/g,'');
 if(!/^(?:\d{8}|\d{12,14})$/.test(clean))throw Error('Enter an 8, 12, 13 or 14 digit product barcode.');
 return clean;
}
export function isBarcodeQuery(query:string){return /^[\d\s-]{8,}$/.test(query.trim());}
const cache=new Map<string,{at:number;foods:Food[]}>();
const cached=(key:string)=>{const item=cache.get(key);return item&&Date.now()-item.at<300_000?structuredClone(item.foods):null;};
const remember=(key:string,foods:Food[])=>{if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),foods:structuredClone(foods)});return foods;};
/** User cancellation and deadline both propagate to fetch, including older Safari. */
async function fetchJson(url:string,options:RequestInit,signal?:AbortSignal){
 const controller=new AbortController(),cancel=()=>controller.abort();
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,12000);
 try{
  const response=await fetch(url,{...options,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  let data;try{data=await response.json();}catch{throw Error('The food service is temporarily unavailable. Try again or enter the label.');}
  if(!response.ok&&!(response.status===404&&data.status===0))throw Error(typeof data.error==='string'?data.error:response.status===429?'Food search is busy. Please wait before trying again.':'The food service is unavailable. Try again or enter the label.');
  return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
export async function lookupBarcode(value:string,signal?:AbortSignal):Promise<Food>{
 const code=normalizeBarcode(value),key=`barcode:${code}`,saved=cached(key);if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(saved?.[0])return saved[0];
 const params=new URLSearchParams({fields:'code,product_name,product_name_en,product_name_es,product_name_fr,brands,nutriments,image_front_small_url,nutrition_data_per'});
 const data=await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?${params}`,{},signal);
 if(data.status!==1||!data.product)throw Error(`Barcode ${code} was read, but this product is not in Open Food Facts. Search its name or enter the label.`);
 const product=mapFoodProduct({...data.product,code,product_name:data.product.product_name||data.product.product_name_en||data.product.product_name_es||data.product.product_name_fr||'Unnamed product'},new Date().toISOString().slice(0,10));
 if(!product)throw Error('This product record is incomplete. Please enter its label.');
 remember(key,[product]);return product;
}
export async function searchFoods(query:string,signal?:AbortSignal):Promise<Food[]>{
 const term=query.trim();if(term.length<2||term.length>120)throw Error('Enter a food name or brand between 2 and 120 characters.');
 if(isBarcodeQuery(term))return [await lookupBarcode(term,signal)];
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const key=`search:${normalized(term)}`,saved=cached(key);if(saved)return saved;
 const env=import.meta.env;
 if(!env.VITE_SUPABASE_URL)throw Error('Online food search is not configured. You can scan a barcode or enter a label.');
 const publicKey=env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY;
 const data=await fetchJson(`${env.VITE_SUPABASE_URL}/functions/v1/food-search`,{method:'POST',headers:{'Content-Type':'application/json',...(publicKey?{apikey:publicKey}:{})},body:JSON.stringify({query:term})},signal);
 if(!Array.isArray(data.products))throw Error('The food service returned an unexpected response.');
 const date=new Date().toISOString().slice(0,10);return remember(key,data.products.map((p:RawProduct)=>mapFoodProduct(p,date)).filter((p:Food|null):p is Food=>p!==null));
}
