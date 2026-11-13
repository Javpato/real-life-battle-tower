import {it,expect} from 'vitest';
import {mifflin,katch,energy,defaultNutrition,recipe,total,reconcile} from '../src/nutrition/engine';
it('reference equations without intermediate rounding',()=>{expect(mifflin(80,180,30,'male')).toBe(1780);expect(katch(80,20)).toBeCloseTo(1752.4,8)});
it('missing data and adult eligibility',()=>{expect(energy(defaultNutrition().profile)).toBeNull();expect(energy({...defaultNutrition().profile,age:16,eligible:true,height:180,weight:80,sex:'male'})).toBeNull()});
it('unknown nutrients stay unknown',()=>{expect(total([{id:'1',food:{id:'1',name:'label',source:'user',per100:{kcal:100,protein:null,carbs:10,fat:2}},amount:50,date:'2026-01-01',meal:'Lunch',planned:false,createdAt:''}]).protein).toBeNull()});
it('recipe cooked weight changes density not energy',()=>{const e={id:'1',food:{id:'f',name:'ingredient',source:'user',per100:{kcal:100,protein:10,carbs:10,fat:2}},amount:200,date:'',meal:'',planned:false,createdAt:''};expect(recipe('dish',[e],400).per100.kcal).toBe(50)});
it('overlapping activities count once',()=>{const a={id:'1',name:'run',date:'2026-01-01',start:'2026-01-01T10:00:00Z',minutes:30,met:5,source:'manual',included:true};expect(reconcile([a,{...a,id:'2'}]).filter(x=>x.included)).toHaveLength(1)});
