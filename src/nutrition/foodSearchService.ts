import type {Food} from './engine';
// Actual OFF responses retrieved 2026-11-14. Database: ODbL; individual contents: DbCL.
// Source queries and licensing: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/
// https://world.openfoodfacts.org/api/v2/product/3017620422003.json
// https://world.openfoodfacts.org/cgi/search.pl?search_terms=rolled%20oats&search_simple=1&action=process&json=1&page_size=3
// This attributed extract is distributed under ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
export const INITIAL_FOODS:Food[]=[
 {id:'20003166',barcode:'20003166',name:"FLOCONS D'AVOINE",brand:'Crownfield',basis:'g',source:'Open Food Facts · offline snapshot 2026-11-14 · ODbL / DbCL · check packaging',per100:{kcal:372,protein:13.5,carbs:58.7,fat:7,fiber:10}},
 {id:'3168930003632',barcode:'3168930003632',name:'Quaker Oats',brand:'Quaker',basis:'g',source:'Open Food Facts · offline snapshot 2026-11-14 · ODbL / DbCL · check packaging',per100:{kcal:375,protein:11,carbs:60,fat:8,fiber:9}},
 {id:'3017620422003',barcode:'3017620422003',name:'Nutella',brand:'Ferrero, Nutella',basis:'g',source:'Open Food Facts · offline snapshot 2026-11-14 · ODbL / DbCL · check packaging',per100:{kcal:539,protein:6.3,carbs:57.5,fat:30.9,fiber:0}},
];
export function localFoodSearch(query:string){const q=query.toLocaleLowerCase().trim();return INITIAL_FOODS.filter(f=>`${f.name} ${f.brand} ${f.barcode}`.toLocaleLowerCase().includes(q));}
type RawProduct={code?:unknown;product_name?:unknown;brands?:unknown;nutriments?:Record<string,unknown>;nutrition_data_per?:unknown;nutrition_data?:unknown};
export function mapFoodProduct(p:RawProduct,date:string):Food|null{
 if(typeof p.code!=='string'||typeof p.product_name!=='string'||!p.product_name.trim())return null;
 const n=p.nutriments??{},get=(key:string)=>typeof n[key]==='number'&&Number.isFinite(n[key])&&(n[key] as number)>=0?n[key] as number:null;
 // OFF retains the _100g field suffix for volume-labelled products; the explicit basis distinguishes these.
 const basis=p.nutrition_data_per==='100ml'?'ml':'g';
 return {id:p.code,barcode:p.code,name:p.product_name,brand:typeof p.brands==='string'?p.brands:undefined,basis,source:`Open Food Facts · retrieved ${date} · ODbL / DbCL · check packaging`,per100:{kcal:get('energy-kcal_100g'),protein:get('proteins_100g'),carbs:get('carbohydrates_100g'),fat:get('fat_100g'),fiber:get('fiber_100g')}};
}
export async function searchFoods(query:string,signal?:AbortSignal):Promise<Food[]>{
 const term=query.trim();if(term.length<2)throw Error('Enter at least two characters to search foods.');
 const params=new URLSearchParams({search_terms:term,search_simple:'1',action:'process',json:'1',page_size:'12',fields:'code,product_name,brands,nutriments,nutrition_data_per',app_name:'Everstride'});
 const response=await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`,{signal:signal??AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===429?'Food search is busy. Please wait before searching again.':'Food search is unavailable. Try the offline examples or enter a label.');
 const json=await response.json();if(!Array.isArray(json.products))throw Error('The product service returned an unexpected response.');
 const date=new Date().toISOString().slice(0,10);return json.products.map((p:RawProduct)=>mapFoodProduct(p,date)).filter((p:Food|null):p is Food=>p!==null);
}
