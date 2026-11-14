import {describe,it,expect} from 'vitest';
import {SKILLS,SKILL_BY_ID,CHALLENGES} from '../src/tower/catalog';
import {ADDITIONAL_SKILLS} from '../src/tower/expandedCatalog';
import {SKILL_GUIDES} from '../src/tower/skillGuides';
const types=['leg','arm','back','core','cardio','mobility'];
describe('six-discipline exercise catalogue',()=>{
 it('has ninety unique exercises with fifteen primary entries per discipline',()=>{
  expect(SKILLS).toHaveLength(90);expect(new Set(SKILLS.map(s=>s.id)).size).toBe(90);
  for(const type of types)expect(SKILLS.filter(s=>s.type===type),type).toHaveLength(15);
  expect(ADDITIONAL_SKILLS).toHaveLength(60);
 });
 it('keeps bounded unique types, reasonable series and exact exercise instructions',()=>{
  expect(Object.keys(SKILL_GUIDES).sort()).toEqual(SKILLS.map(s=>s.id).sort());
  for(const s of SKILLS){
   expect(s.types?.[0],s.id).toBe(s.type);expect(s.types!.length).toBeGreaterThanOrEqual(1);expect(s.types!.length).toBeLessThanOrEqual(2);
   expect(new Set(s.types).size,s.id).toBe(s.types!.length);
   for(const type of s.types!)expect(types).toContain(type);
   expect(s.units,s.id).toBeGreaterThan(0);expect(s.units,s.id).toBeLessThanOrEqual(s.unit==='seconds'?30:12);
   if(s.alternating){expect(s.units%2,s.id).toBe(0);expect(s.trialTarget%2,s.id).toBe(0);}
   expect(SKILL_GUIDES[s.id].setup.length,s.id).toBeGreaterThan(25);
   expect(SKILL_GUIDES[s.id].movement.length,s.id).toBeGreaterThan(70);
  }
  expect(new Set(ADDITIONAL_SKILLS.map(s=>SKILL_GUIDES[s.id].movement)).size).toBe(60);
 });
 it('labels new unvalidated movements manual rather than inheriting camera credentials',()=>{
  for(const s of ADDITIONAL_SKILLS){expect(s.detector,s.id).toBe('manual');expect(s.detectorStatus).toBe('pending');expect(s.qualityMetric).toBe('none');expect(SKILL_GUIDES[s.id].camera).toContain('does not verify');expect(s.demonstration).toBe(s.id);}
 });
 it('has no missing or cyclic prerequisites and scales trials by actual branch depth',()=>{
  for(const skill of SKILLS){const seen=new Set([skill.id]);let ancestor=skill.prerequisite,depth=0;
   while(ancestor){expect(SKILL_BY_ID[ancestor],skill.id).toBeDefined();expect(seen.has(ancestor),skill.id).toBe(false);seen.add(ancestor);depth++;ancestor=SKILL_BY_ID[ancestor].prerequisite;}
   expect(skill.trialTarget,skill.id).toBe((skill.unit==='seconds'?[6,10,15]:[4,6,8])[Math.min(depth,2)]);
  }
 });
 it('provides low-impact alternatives for every impact movement and stable equipment tags',()=>{
  for(const s of SKILLS){expect(['none','wall','chair','support']).toContain(s.equipment);expect(['none','low','jump']).toContain(s.impact);
   if(s.impact==='jump'){expect(s.alternativeId).toBeTruthy();expect(SKILL_BY_ID[s.alternativeId!].impact).not.toBe('jump');}
  }
 });
 it('has one four-skill specialization challenge per type with existing eligible skills',()=>{
  for(const type of types){const c=CHALLENGES.find(c=>c.specialization===type);expect(c,type).toBeDefined();expect(c!.skillIds).toHaveLength(4);expect(new Set(c!.skillIds).size).toBe(4);for(const id of c!.skillIds)expect(SKILL_BY_ID[id].type).toBe(type);}
 });
});
