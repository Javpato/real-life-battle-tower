// Run Vite locally; all annotated landmark JSON remains local. This is not a physical accuracy benchmark.
// node tests/evaluate-pose-clips.mjs /absolute/path/labelled-clips.json http://127.0.0.1:5188
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const [path,base='http://127.0.0.1:5188']=process.argv.slice(2);
if(!path)throw Error('Provide a JSON array of labelled real landmark clips; see docs/DETECTION_RESEARCH.md');
const clips=JSON.parse(await readFile(path,'utf8'));
if(!Array.isArray(clips)||!clips.length)throw Error('Expected a nonempty labelled clip array');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
try{const page=await browser.newPage();await page.goto(base+'/tests/fixtures/camera.html');const results=await page.evaluate(async clips=>{const {evaluatePoseClip}=await import('/src/exercises/evaluation.ts');return clips.map(evaluatePoseClip);},clips);console.log(JSON.stringify({kind:'local-landmark-replay',clips:results,totalExpected:results.reduce((n,r)=>n+r.expected,0),totalMissed:results.reduce((n,r)=>n+r.missed,0),totalUnmatchedDetections:results.reduce((n,r)=>n+r.unmatchedDetections,0)},null,2));}finally{await browser.close();}
