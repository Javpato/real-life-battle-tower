import {readFile,writeFile} from 'node:fs/promises';
const text='// GENERATED from src/companion/protocol.ts by scripts/sync-companion.mjs\n'+await readFile(new URL('../src/companion/protocol.ts',import.meta.url),'utf8');
const target=new URL('../supabase/functions/camera-pair/protocol.ts',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==text)throw Error('Companion protocol differs. Run node scripts/sync-companion.mjs.');}else await writeFile(target,text);
console.log('Companion signaling protocol parity verified.');
