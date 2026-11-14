import {describe,it,expect} from 'vitest';
import {applyAdventureCommand as send,normalizeAdventure,initialAdventure,GUIDE_BASICS} from '../src/core/commands';
import {WORLD_MAPS} from '../src/core/worldMaps';
describe('guided onboarding',()=>{
 it('starts fresh, records movement and turns, preserves completed legacy saves',()=>{
 let s=normalizeAdventure(initialAdventure(),false);expect(s.journey!.guide!.completed).toEqual([]);
 s=send(s,{kind:'location',mapId:'starter_house_bedroom',x:208,y:144,facing:'right'});expect(s.journey!.guide!.completed).toEqual(['move','turn']);
 expect(normalizeAdventure(initialAdventure()).journey!.guide!.completed).toEqual([...GUIDE_BASICS]);
 });
 it('opens the laboratory during onboarding but keeps the route gated',()=>{
 let s=normalizeAdventure(initialAdventure(),false);const town=WORLD_MAPS.starter_town;
 const door=town.portals.find(p=>p.to==='alchemy_lab')!;s.journey!.location={mapId:town.id,x:door.x+18,y:door.y+18,facing:'up'};
 s=send(s,{kind:'portal',portalId:door.id});expect(s.journey!.location.mapId).toBe('alchemy_lab');
 const trail=town.portals.find(p=>p.to==='training_route')!;s.journey!.location={mapId:town.id,x:trail.x+28,y:trail.y+14,facing:'down'};
 expect(()=>send(s,{kind:'portal',portalId:trail.id})).toThrow('COMPLETE_TUTORIAL_FIRST');
 });
 it.each(['squat','sitstand'])('offers equal short practice and prevents repeat rewards: %s',attackId=>{
 let s=normalizeAdventure(initialAdventure(),false);s=send(s,{kind:'startTutorialBattle'});s=send(s,{kind:'beginAttack',attackId});expect(s.battle!.attack!.units).toBe(3);
 s=send(s,{kind:'manualRemaining',sessionId:s.battle!.sessionId});s=send(s,{kind:'finishBattle'});expect(s.player.coins).toBe(60);expect(s.player.xp).toBe(20);
 expect(()=>send(s,{kind:'startTutorialBattle'})).toThrow('TUTORIAL_COMPLETED');
 s=send(s,{kind:'setTutorial',stage:5});expect(()=>send(s,{kind:'setTutorial',stage:6})).toThrow('COMPLETE_GUIDED_ACTIONS');
 s.journey!.guide!.completed=[...GUIDE_BASICS];s=send(s,{kind:'setTutorial',stage:6});expect(s.journey!.tutorialStage).toBe(6);
 });
 it('keeps guide progress slot-local, idempotent and without rewards',()=>{
 const original=normalizeAdventure(initialAdventure(),false);let a=send(original,{kind:'guideSeen',id:'shop-basics'});a=send(a,{kind:'guideSeen',id:'shop-basics'});
 expect(original.journey!.guide!.seen).toEqual([]);expect(a.journey!.guide!.seen).toEqual(['shop-basics']);expect(a.player).toEqual(original.player);expect(normalizeAdventure(a).journey!.guide).toEqual(a.journey!.guide);
 expect(()=>send(a,{kind:'guideEvent',event:'invented'})).toThrow('INVALID_GUIDE_EVENT');
 });
});
