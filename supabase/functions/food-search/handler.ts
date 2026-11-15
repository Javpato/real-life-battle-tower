/** Read-only, fixed-upstream food search. No accounts, diary entries or credentials. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,apikey',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const answer = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers: CORS});
const FIELDS = 'code,product_name,product_name_en,product_name_es,product_name_fr,brands,nutriments,nutrition_data_per';
async function readSmallBody(req:Request){
  if(!req.body)return '';
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();return null;}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
export function createFoodSearchHandler(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, {at: number; products: unknown[]}>();
  // Bounded, per-instance burst protection complements the upstream's own limits.
  const callers = new Map<string, number[]>();
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
    if (req.method !== 'POST') return answer({error: 'Use POST to search foods.'}, 405);
    try {
      if (Number(req.headers.get('content-length')) > 1024) return answer({error: 'Search request is too large.'}, 413);
      const body = await readSmallBody(req);
      if (body===null) return answer({error: 'Search request is too large.'}, 413);
      let input: unknown;
      try { input = JSON.parse(body); } catch { return answer({error: 'Enter a food name or brand.'}, 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => k !== 'query')) return answer({error: 'Only a food search query is accepted.'}, 400);
      const value = (input as {query?: unknown}).query;
      if (typeof value !== 'string') return answer({error: 'Enter a food name or brand.'}, 400);
      const query = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
      if (query.length < 2 || query.length > 120 || !/[\p{L}\p{N}]/u.test(query) || /https?:\/\/|www\.|[\u0000-\u001f]/i.test(query)) return answer({error: 'Use a food name or brand between 2 and 120 characters.'}, 400);
      const key = query.toLocaleLowerCase(), timestamp = now(), saved = cache.get(key);
      if (saved && timestamp - saved.at < 300_000) return answer({products: saved.products});
      const caller = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
      const recent = (callers.get(caller) ?? []).filter(t => timestamp - t < 60_000);
      if (recent.length >= 10) return answer({error: 'Food search is busy. Wait a moment before searching again.'}, 429);
      if (callers.size >= 512 && !callers.has(caller)) callers.delete(callers.keys().next().value!);
      callers.set(caller, [...recent, timestamp]);
      // Escape Lucene operators: a product name is text, never an unrestricted query.
      const term = query.replace(/([+\-!(){}\[\]^"~*?:\\/|&])/g, '\\$1');
      const params = new URLSearchParams({q: term, page_size: '12', fields: FIELDS, langs: 'en,es,fr', boost_phrase: 'true'});
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetcher(`https://search.openfoodfacts.org/search?${params}`, {
          signal: controller.signal,
          headers: {'Accept': 'application/json', 'User-Agent': 'RealLifeBattleTower/0.1 (https://github.com/Javpato/real-life-battle-tower)'},
          redirect: 'error',
        });
        if (!response.ok) return answer({error: response.status === 429 ? 'Food search is busy. Please try again shortly.' : 'Food search is temporarily unavailable. Try again or enter the label.'}, response.status === 429 ? 429 : 502);
        const data = await response.json();
        if (!Array.isArray(data.hits)) return answer({error: 'Food search returned an unexpected response.'}, 502);
        const products = data.hits.slice(0, 12).filter((p: unknown) => p && typeof p === 'object').map((p: Record<string, unknown>) => Object.fromEntries(FIELDS.split(',').filter(k => k in p).map(k => [k, p[k]])));
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        cache.set(key, {at: timestamp, products});
        return answer({products});
      } finally { clearTimeout(timeout); }
    } catch (error) {
      const timeout = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
      return answer({error: timeout ? 'Food search took too long. Please retry or enter the label.' : 'Food search is temporarily unavailable. Please try again.'}, timeout ? 504 : 502);
    }
  };
}
