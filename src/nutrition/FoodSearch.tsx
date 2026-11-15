import {useEffect,useRef,useState} from 'react';
import type {Food} from './engine';
import {INITIAL_FOODS,localFoodSearch,matchesFood,searchFoods,isBarcodeQuery} from './foodSearchService';

export default function FoodSearch({onSelect,savedFoods=[]}:{onSelect:(food:Food)=>void;savedFoods?:Food[]}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Food[]>([]),[status,setStatus]=useState('Search a name, brand or barcode. Saved foods appear immediately.'),[busy,setBusy]=useState(false);
 const request=useRef<AbortController|null>(null);
 const cancel=()=>{request.current?.abort();request.current=null;setBusy(false);};
 useEffect(()=>()=>request.current?.abort(),[]);
 async function search(){
  if(query.trim().length<2){setStatus('Enter at least two characters.');return;}
  cancel();const controller=new AbortController();request.current=controller;
  setBusy(true);setResults([]);setStatus(isBarcodeQuery(query)?'Looking up this barcode…':'Searching food names and brands…');
  try{
   const foods=await searchFoods(query,controller.signal);if(request.current!==controller)return;
   setResults(foods);setStatus(foods.length?`${foods.length} ${foods.length===1?'product':'products'} found. Choose one, then check the label and portion.`:'No matches. Try the brand or a shorter name, scan the barcode, or enter the label.');
  }catch(e){
   if(request.current!==controller)return;
   setResults([]);setStatus((e as Error).name==='AbortError'?'Search took too long. Retry, scan a barcode or enter the label.':(e as Error).message==='Failed to fetch'?'Could not reach food search. Check your connection and retry.':(e as Error).message);
  }finally{if(request.current===controller){request.current=null;setBusy(false);}}
 }
 const saved=Array.from(new Map(savedFoods.filter(f=>matchesFood(f,query)).map(f=>[f.id,f])).values());
 const choose=(food:Food)=>{cancel();onSelect(structuredClone(food));};
 return <section aria-label="Search the food database" data-guide="journal-search">
  <form className="search-field" onSubmit={e=>{e.preventDefault();void search();}}>
   <input aria-label="Food name, brand or barcode" value={query} maxLength={120} placeholder="Food name, brand or barcode…" onChange={e=>{cancel();setQuery(e.target.value);setResults([]);setStatus('Press Search or Enter to find matching products.');}}/>
   <button type="submit" disabled={busy}>{busy?'Searching…':'Search foods'}</button>
  </form>
  <p className="tiny" role="status" aria-live="polite">{status}</p>
  {busy&&<button type="button" className="text-button" onClick={()=>{cancel();setStatus('Search cancelled. Enter another name or scan a barcode.');}}>Cancel search</button>}
  {saved.length>0&&<><h4>From your journal</h4><div className="saved-foods" aria-label="Saved food matches">{saved.map(f=><button type="button" key={f.id} onClick={()=>choose(f)}><strong>{f.name}</strong><small>{f.brand} · {f.per100.kcal??'Unknown'} kcal / 100 {f.basis??'g'}</small></button>)}</div></>}
  {results.length>0&&<div className="saved-foods" aria-label="Food search results">{results.map(f=><button type="button" key={f.id} onClick={()=>choose(f)}><strong>{f.name}</strong><small>{f.brand} · {f.per100.kcal??'Unknown'} kcal / 100 {f.basis??'g'}</small></button>)}</div>}
  <details className="food-offline-examples"><summary>Offline product examples</summary><p className="tiny">Dated product snapshots; check the current package label.</p><div className="saved-foods">{(query?localFoodSearch(query):INITIAL_FOODS).map(f=><button type="button" key={f.id} onClick={()=>choose(f)}><strong>{f.name}</strong><small>{f.brand} · {f.per100.kcal??'Unknown'} kcal / 100 {f.basis??'g'}</small></button>)}</div></details>
  <p className="tiny">Search sends only the entered product name or barcode. Data: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>, individual contents DbCL. Community records can be incomplete. Selecting a product does not log consumption.</p>
 </section>;
}
