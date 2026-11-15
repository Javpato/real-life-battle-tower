import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {createFoodSearchHandler} from '../supabase/functions/food-search/handler';
const request=(body:unknown)=>new Request('https://example.test/food-search',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
describe('read-only food search proxy',()=>{
 it('uses the official full-text endpoint, escapes operators and returns only product fields',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({hits:[{code:'12345678',product_name:'Oats',brands:['Quaker'],nutriments:{'energy-kcal_100g':100},private:'never forwarded'}]}));
  const handle=createFoodSearchHandler(fetcher);const response=await handle(request({query:'oats & milk'}));
  expect(response.status).toBe(200);expect(response.headers.get('access-control-allow-origin')).toBe('*');
  const url=new URL(fetcher.mock.calls[0][0]);expect(url.origin).toBe('https://search.openfoodfacts.org');expect(url.pathname).toBe('/search');expect(url.searchParams.get('q')).toBe('oats \\& milk');expect(url.searchParams.get('page_size')).toBe('12');
  expect(await response.json()).toEqual({products:[{code:'12345678',product_name:'Oats',brands:['Quaker'],nutriments:{'energy-kcal_100g':100}}]});
  await handle(request({query:'OATS & MILK'}));expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rejects custom URLs, unrelated data, oversized and malformed queries before network work',async()=>{
  const fetcher=vi.fn(),handle=createFoodSearchHandler(fetcher);
  for(const body of [{query:'https://example.test/data'},{query:'a'.repeat(121)},{query:'x'},{query:'oats',url:'https://other.test'},[],null])expect((await handle(request(body))).status).toBe(400);
  expect((await handle(request({query:'a'.repeat(2000)}))).status).toBe(413);expect(fetcher).not.toHaveBeenCalled();
 });
 it('normalizes upstream errors and bounds repeated uncached requests',async()=>{
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({hits:[]})));const handle=createFoodSearchHandler(fetcher,()=>1000);
  for(let i=0;i<10;i++)expect((await handle(request({query:`food ${i}`}))).status).toBe(200);
  expect((await handle(request({query:'one more'}))).status).toBe(429);expect(fetcher).toHaveBeenCalledTimes(10);
  const failed=createFoodSearchHandler(vi.fn().mockResolvedValue(new Response('<html>unavailable</html>',{status:503})));
  const response=await failed(request({query:'bread'}));expect(response.status).toBe(502);expect((await response.json()).error).toContain('unavailable');
 });
 it('allows preflight and rejects GET',async()=>{
  const handle=createFoodSearchHandler(vi.fn());expect((await handle(new Request('https://example.test',{method:'OPTIONS'}))).status).toBe(204);expect((await handle(new Request('https://example.test'))).status).toBe(405);
 });
});
