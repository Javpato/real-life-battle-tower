import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {mapFoodProduct,lookupBarcode,normalizeBarcode,searchFoods,matchesFood} from '../src/nutrition/foodSearchService';
describe('food lookup and mapping',()=>{
 beforeEach(()=>vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co'));
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 it('maps search-array brands and translated names without making up missing nutrients',()=>{
  const food=mapFoodProduct({code:'12345678',product_name_es:'Avena',brands:[' Brand ','Company'],nutrition_data_per:'100ml',nutriments:{'energy-kcal_100g':0,proteins_100g:-2}},'2026-11-15')!;
  expect(food.brand).toBe('Brand, Company');expect(food.name).toBe('Avena');expect(food.basis).toBe('ml');expect(food.per100).toMatchObject({kcal:0,protein:null});expect(matchesFood({...food,name:'Café'},'cafe')).toBe(true);
 });
 it('normalizes printed barcode spacing and routes numeric search directly to product lookup',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({status:1,product:{code:'1234567890128',product_name:'Fixture bar',nutriments:{'energy-kcal_100g':300}}}));vi.stubGlobal('fetch',fetcher);
  expect(normalizeBarcode('1 234567 890128')).toBe('1234567890128');expect(()=>normalizeBarcode('oats')).toThrow('barcode');
  const foods=await searchFoods('1 234567 890128');expect(foods[0].name).toBe('Fixture bar');expect(fetcher.mock.calls[0][0]).toContain('/api/v2/product/1234567890128.json');await lookupBarcode('1234567890128');expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('reports a decoded but unknown barcode clearly and preserves cancellation',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({status:0},{status:404}));vi.stubGlobal('fetch',fetcher);await expect(lookupBarcode('0000000000000')).rejects.toThrow('was read');
  const cancel=new AbortController();cancel.abort();await expect(searchFoods('never send this',cancel.signal)).rejects.toMatchObject({name:'AbortError'});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('passes a cancellation signal to remote searches and sends only the query',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({products:[]}));vi.stubGlobal('fetch',fetcher);const controller=new AbortController();await searchFoods('cancellation fixture',controller.signal);const options=fetcher.mock.calls[0][1];expect(options.signal).toBeInstanceOf(AbortSignal);expect(JSON.parse(options.body)).toEqual({query:'cancellation fixture'});expect(options.credentials).toBe('omit');
 });
});
