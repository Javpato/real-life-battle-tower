import {it,expect} from 'vitest';
import {SKILLS} from '../src/tower/catalog';
import {SKILL_GUIDES,skillGuide} from '../src/tower/skillGuides';
it('covers every selectable physical variant without falling back to its detector family',()=>{
 expect(Object.keys(SKILL_GUIDES).sort()).toEqual(SKILLS.map(s=>s.id).sort());
 for(const skill of SKILLS){const guide=skillGuide(skill.id);for(const field of ['title','setup','movement','camera','note'] as const)expect(guide[field].length,skill.id+' '+field).toBeGreaterThan(4);}
 expect(()=>skillGuide('unknown')).toThrow('UNKNOWN_SKILL_GUIDE');expect(()=>skillGuide('__proto__')).toThrow();
});
it('explains manual-only and experimental recognition limitations for the corresponding skills',()=>{
 for(const skill of SKILLS){const note=skillGuide(skill.id).note;if(skill.detector==='manual')expect(note).toMatch(/Manual/);if(skill.detectorStatus==='experimental')expect(note).toMatch(/Experimental/);}
});
it('distinguishes holds and physical variants that share a tracking family',()=>{
 expect(skillGuide('wall-sit').movement).toContain('hold');expect(skillGuide('high-plank').movement).toContain('Hold');
 expect(skillGuide('back-extension').movement).toContain('lift-and-lower');expect(skillGuide('superman').note).toContain('seconds');
 expect(skillGuide('reverse-lunge').movement).toContain('backward');expect(skillGuide('lunge').movement).toContain('forward');
 expect(skillGuide('advanced-birddog').movement).not.toEqual(skillGuide('birddog').movement);
});
