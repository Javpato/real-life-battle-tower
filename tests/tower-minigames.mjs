import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const output=process.env.QA_DIR||'art-production/v2/game-captures/minigames';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[],failed=[],oldAssetRequests=[],completed=[],batches=[],screenshots=[],assets=new Set();
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{const url=r.url();if(/\/assets\/tower\//.test(url))oldAssetRequests.push(url);if(url.includes('/assets/tower-v2/'))assets.add(new URL(url).pathname)});
page.on('response',r=>{if(r.status()>=400&&!r.url().includes('supabase'))failed.push(`${r.status()} ${r.url()}`)});
async function click(name){await page.getByRole('button',{name,exact:true}).click()}
async function capture(name){const file=`${name}.png`;await page.screenshot({path:`${output}/${file}`});screenshots.push(file)}
async function clearRoutine(){while(await page.locator('.bt-routine-row').count())await page.getByRole('button',{name:/Remove exercise/}).last().click()}
let skills=[],passed=false;
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174');await page.waitForTimeout(1900);
 await click('PRESS ANYTHING TO START');await click('Explore a local preview');
 await page.getByRole('button',{name:/Custom Workout Build/}).click();
 await clearRoutine();await click('+ Add exercise');
 // Discover the actual playable catalogue through the routine selector. No copied ID list.
 const options=await page.locator('.bt-routine-row select option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,name:n.textContent.trim()})));
 const cards=await page.locator('.bt-training-card').evaluateAll(nodes=>nodes.map(n=>({name:n.querySelector('h3').textContent.trim(),type:[...n.classList].find(c=>c.startsWith('discipline-')).slice(11),manualOnly:n.querySelector('small').textContent.includes('Guided / manual')})));
 skills=options.map(option=>({...option,...cards.find(card=>card.name===option.name)}));
 expect(skills).toHaveLength(90);expect(new Set(skills.map(s=>s.id)).size).toBe(90);expect(new Set(skills.map(s=>s.type)).size).toBe(6);
 const capturedTypes=new Set();
 for(let batch=0;batch<9;batch++){
  if(batch)await page.getByRole('button',{name:/Custom Workout Build/}).click();
  await clearRoutine();const group=skills.slice(batch*10,batch*10+10);
  for(let index=0;index<group.length;index++){
   await click('+ Add exercise');const row=page.locator('.bt-routine-row').nth(index);
   await row.locator('select').selectOption(group[index].id);await row.locator('input').fill('2');
  }
  await page.getByLabel('Rest between series').selectOption('0');await page.getByLabel('Routine name').fill(`Catalogue QA ${batch+1} / 9`);await click('Save & start training');
  for(let index=0;index<group.length;index++){
   const skill=group[index],canvas=page.locator(`[data-scene="${skill.id}"] canvas`);
   await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('aria-label',/0 of 2 accepted units$/);
   await expect(page.locator('.bt-camera-pane>.bt-row>strong')).toHaveText(skill.name);
   const guide=await page.locator('.bt-technique p').allTextContents();expect(guide).toHaveLength(3);expect(guide.every(text=>text.trim().length>15)).toBe(true);
   if(skill.manualOnly){await expect(page.getByRole('button',{name:'Camera',exact:true})).toBeDisabled();await expect(page.getByText('This movement variation uses manual confirmation. It is recorded as unverified.',{exact:true})).toBeVisible()}
   await click('Manual');await expect(page.getByText('Manual units are saved separately from camera-verified units.',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:/Confirm one (repetition|held second)/}).click();await expect(canvas).toHaveAttribute('aria-label',/1 of 2 accepted units$/);
   await page.waitForTimeout(600);
   const pixels=await canvas.evaluate(el=>{const data=el.getContext('2d').getImageData(0,0,el.width,el.height).data;let opaque=0;const palette=new Set();for(let i=0;i<data.length;i+=4){if(data[i+3])opaque++;if(i%64===0)palette.add(`${data[i]},${data[i+1]},${data[i+2]}`)}return {width:el.width,height:el.height,opaque,sampledColors:palette.size}});
   expect(pixels.width).toBe(480);expect(pixels.height).toBe(270);expect(pixels.opaque).toBe(480*270);expect(pixels.sampledColors).toBeGreaterThan(32);
   if(!capturedTypes.has(skill.type)){await capture(`minigame-${skill.type}-${skill.id}`);capturedTypes.add(skill.type)}
   await page.getByRole('button',{name:/Confirm one (repetition|held second)/}).click();
   if(index<group.length-1){await expect(canvas).toHaveAttribute('aria-label',/2 of 2 accepted units$/);await click('Continue training')}
   completed.push({id:skill.id,name:skill.name,type:skill.type,manualOnly:skill.manualOnly,target:2,acceptedManualUnits:2,cameraVerifiedUnits:0,pixels,guideAvailable:true});
  }
  await expect(page.getByText('Every movement counts.',{exact:true})).toBeVisible();await expect(page.getByText('10 series complete · 0 skipped',{exact:true})).toBeVisible();await expect(page.getByText('0 verified units · 20 manual units',{exact:true})).toBeVisible();
  const resultLines=page.locator('.bt-result-line');await expect(resultLines).toHaveCount(10);
  for(let index=0;index<10;index++){await expect(resultLines.nth(index).locator('strong')).toHaveText(group[index].name);await expect(resultLines.nth(index)).toContainText('2 / 2 · complete · 0 camera / 2 manual');await expect(resultLines.nth(index)).toContainText('Technical stars unavailable for manual / mixed effort')}
  batches.push({batch:batch+1,completed:10,skipped:0,manualUnits:20,verifiedUnits:0});console.log(`PASS batch ${batch+1}/9: ${completed.length}/90 minigames complete.`);
  await click('View training record');await page.getByRole('button',{name:'Back to tower plaza'}).click();
 }
 expect(completed).toHaveLength(90);expect(screenshots).toHaveLength(6);expect(errors).toEqual([]);expect(failed).toEqual([]);expect(oldAssetRequests).toEqual([]);
 for(let zone=0;zone<6;zone++)expect([...assets].some(path=>path.endsWith(`/arena-${zone}.png`))).toBe(true);
 passed=true;console.log('PASS all 90 generated-art minigames: 180 exact manual units, six types, nine complete routines, zero skips, old assets or runtime/resource errors. Physical detection not validated.');
}catch(error){await capture('failure');throw error}
finally{
 await writeFile(`${output}/minigames-report.json`,JSON.stringify({passed,skillsDiscovered:skills.length,completedCount:completed.length,manualUnits:completed.length*2,cameraVerifiedUnits:0,batches,completed,screenshots,generatedAssets:[...assets].sort(),oldAssetRequests,errors,failed,physicalDetectionTested:false,phonePairingTested:false},null,2));
 await browser.close();
}
