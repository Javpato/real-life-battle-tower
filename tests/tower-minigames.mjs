import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const ids=['mini-squat','squat','pause-squat','assisted-lunge','lunge','sumo-squat','wall-sit','reverse-lunge','tempo-squat','single-leg-squat','wall-pushup','incline-pushup','knee-pushup','high-plank','pushup','pause-pushup','diamond','eccentric-pushup','wide-pushup','archer-pushup','birddog','alternating-birddog','short-superman','superman','back-extension','snow-angels','pause-birddog','alternating-superman','tempo-extension','advanced-birddog'];
const b=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}),p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('/tmp/battle-tower-qa',{recursive:true});
 await p.goto('http://127.0.0.1:5174');await p.waitForTimeout(2000);
 await p.getByRole('button',{name:'PRESS ANYTHING TO START'}).click();
 await p.getByRole('button',{name:'Explore a local preview'}).click();
 for(let batch=0;batch<3;batch++){
  await p.getByRole('button',{name:/Custom Workout Build/}).click();
  while(await p.locator('.bt-routine-row').count())await p.getByRole('button',{name:/Remove exercise/}).last().click();
  const group=ids.slice(batch*10,batch*10+10);
  for(let i=0;i<group.length;i++){
   await p.getByRole('button',{name:'+ Add exercise',exact:true}).click();
   await p.locator('.bt-routine-row select').nth(i).selectOption(group[i]);
   await p.locator('.bt-routine-row input').nth(i).fill('2');
  }
  await p.getByLabel('Rest between series').selectOption('0');
  await p.getByLabel('Routine name').fill(`Ten worlds ${batch+1}`);
  await p.getByRole('button',{name:'Save & start training'}).click();
  for(const id of group){
   await p.getByRole('button',{name:'Manual',exact:true}).click();
   await p.getByRole('button',{name:/Confirm one (repetition|held second)/}).click();
   await p.waitForTimeout(500);await p.screenshot({path:`/tmp/battle-tower-qa/minigame-${id}.png`});
   await p.getByRole('button',{name:/Confirm one (repetition|held second)/}).click();
   if(id!==group.at(-1))await expect(p.locator(`[data-scene="${id}"] canvas`)).toHaveAttribute('aria-label',/2 of 2/);
   await p.waitForTimeout(900);
   const next=p.getByRole('button',{name:'Continue training',exact:true});if(await next.isVisible())await next.click();
  }
  await expect(p.getByText('Every movement counts.')).toBeVisible();
  await p.getByRole('button',{name:'View training record',exact:true}).click();
  await p.getByRole('button',{name:'Back to tower plaza'}).click();
 }
 expect(errors).toEqual([]);
 console.log('30 distinct minigames completed through real manual controls; exact2-unit targets, no runtime errors. Not physical detection validation.');
}finally{await b.close();}
