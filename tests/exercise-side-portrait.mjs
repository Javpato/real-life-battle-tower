/** Presentation-only fixture. No movement or recognition is simulated. */
import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5204');
 const results=await page.evaluate(async()=>{
  const source=await(await fetch('/src/exercises/ExerciseHUD.tsx')).text(),main=await(await fetch('/src/main.tsx')).text();
  const reactUrl=source.match(/["'](\/node_modules\/\.vite\/deps\/react\.js[^"']*)["']/)?.[1], domUrl=main.match(/["'](\/node_modules\/\.vite\/deps\/react-dom_client\.js[^"']*)["']/)?.[1];
  if(!reactUrl||!domUrl)throw Error('Exact Vite React module URLs missing');
  const React=(await import(reactUrl)).default,dm=await import(domUrl),{default:HUD}=await import('/src/exercises/ExerciseHUD.tsx');
  const fixture=document.createElement('div');fixture.className='immersive-game';fixture.style.cssText='position:fixed;inset:0;z-index:100000;background:#09251e;padding:14px;display:flex;align-items:center';
  const mount=document.createElement('div');mount.style.cssText='width:362px;height:225px';fixture.append(mount);document.body.append(fixture);const root=(dm.default??dm).createRoot(mount),results=[];
  for(const nextSide of [undefined,'left','right']){
   root.render(React.createElement(HUD,{exerciseId:'birddog',progress:12,target:20,status:'no-body',message:'Move into the camera view.',quality:null,paused:false,active:true,muted:true,nextSide}));
   await new Promise(resolve=>setTimeout(resolve,80));
   const e=fixture.querySelector('.exercise-next-side strong'),r=e.getBoundingClientRect(),parent=e.parentElement.getBoundingClientRect(),hud=fixture.querySelector('.exercise-hud').getBoundingClientRect(),counter=fixture.querySelector('[data-testid="exercise-count"]');
   results.push({label:e.textContent,width:r.width,parentWidth:parent.width,unclipped:e.scrollWidth<=e.clientWidth+1,contained:r.left>=parent.left-1&&r.right<=parent.right+1&&r.right<=hud.right+1,counterFont:parseFloat(getComputedStyle(counter).fontSize)});
  }
  return results;
 });
 for(const r of results){expect(r.unclipped,`${r.label} text unclipped`).toBe(true);expect(r.contained,`${r.label} within parent`).toBe(true);expect(r.counterFont).toBeGreaterThanOrEqual(80);}
 console.log(JSON.stringify({passed:true,viewport:'390x844',results}));
 await page.screenshot({path:'/tmp/everstride-side-portrait.png'});
}finally{await browser.close()}
