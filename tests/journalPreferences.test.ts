import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {defaultNutrition,energy} from '../src/nutrition/engine';
import {kgToLb,lbToKg,cmToIn,inToCm,gramsToOunces,ouncesToGrams,settings,resolveDailyTarget,dueReminders,type AdvancedJournalState} from '../src/nutrition/journalPreferences';
import {mapFoodProduct,searchFoods,INITIAL_FOODS,localFoodSearch} from '../src/nutrition/foodSearchService';
const state=():AdvancedJournalState=>({...defaultNutrition(),profile:{age:35,height:175,weight:80,sex:'male',method:'mifflin',factor:1.6,goal:'maintain',adjustment:10,eligible:true,exerciseCredit:0},journalSettings:{units:'metric',weekly:{'1':{kind:'training',kcal:2900}},overrides:{'2026-11-16':{kind:'rest',kcal:2600}},reminders:[]}});
describe('journal preferences',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));});
 afterEach(()=>vi.useRealTimers());
 it('round trips units without changing stored quantities',()=>{expect(lbToKg(kgToLb(81.3))).toBeCloseTo(81.3,12);expect(inToCm(cmToIn(175))).toBeCloseTo(175,12);expect(ouncesToGrams(gramsToOunces(130))).toBeCloseTo(130,12);});
 it('gives absolute date targets precedence without adding exercise twice',()=>{const s=state();expect(resolveDailyTarget(s,'2026-11-16',3200).target).toBe(2600);expect(resolveDailyTarget(s,'2026-11-23',3200).target).toBe(2900);expect(resolveDailyTarget(s,'2026-11-24',3200).target).toBe(3200);});
 it('falls back for invalid deficits and ineligible profiles',()=>{const s=state();s.journalSettings!.overrides['2026-11-16'].kcal=500;expect(resolveDailyTarget(s,'2026-11-16',2700).target).toBe(2700);s.profile.eligible=false;s.journalSettings!.overrides['2026-11-16'].kcal=2600;expect(resolveDailyTarget(s,'2026-11-16',null).target).toBeNull();});
 it('preserves optional defaults for existing saves',()=>expect(settings(defaultNutrition()).reminders).toEqual([]));
 it('reminders are local-time, optional and dismissible once per day',()=>{const cfg=settings(state());cfg.reminders=[{id:'a',time:'19:00',label:'Journal',enabled:true},{id:'b',time:'18:00',label:'Rest',enabled:false}];expect(dueReminders(cfg,new Date(2026,10,16,18,59))).toHaveLength(0);expect(dueReminders(cfg,new Date(2026,10,16,19,1))).toHaveLength(1);expect(dueReminders(cfg,new Date(2026,10,16,19,1),['2026-11-16:a'])).toHaveLength(0);expect(dueReminders(cfg,new Date(2026,10,17,19,1),['2026-11-16:a'])).toHaveLength(1);});
});
describe('food search',()=>{
 beforeEach(()=>vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co'));
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 it('keeps unknown nutrients unknown and respects volume basis',()=>{const f=mapFoodProduct({code:'12345678',product_name:'Example',nutrition_data_per:'100ml',nutriments:{'energy-kcal_100g':40,proteins_100g:0,fat_100g:-1}},'2026-11-14');expect(f?.basis).toBe('ml');expect(f?.per100).toMatchObject({kcal:40,protein:0,fat:null,carbs:null});});
 it('rejects unnamed results and leaves original snapshots intact',()=>{expect(mapFoodProduct({code:'123'},'2026-11-14')).toBeNull();expect(localFoodSearch('Quaker')[0].per100.kcal).toBe(375);expect(INITIAL_FOODS).toHaveLength(3);});
 it('uses the read-only full-text proxy and parses returned products',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({products:[{code:'12345678',product_name:'Fixture',nutriments:{'energy-kcal_100g':45}}]})});vi.stubGlobal('fetch',fetcher);const foods=await searchFoods('oats & milk');expect(fetcher.mock.calls[0][0]).toBe('https://example.supabase.co/functions/v1/food-search');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({query:'oats & milk'});expect(foods[0].per100.kcal).toBe(45);});
 it('reports unavailable service rather than inventing results',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:'Food search is unavailable'})}));await expect(searchFoods('oats')).rejects.toThrow('unavailable');});
});
