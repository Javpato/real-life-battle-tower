import {describe,it,expect} from 'vitest';
import {initialPlayer,available,attacks} from '../src/core/game';
import {initialAdventure,normalizeAdventure,applyAdventureCommand as send} from '../src/core/commands';
import {validateLocalImport} from '../src/core/importSave';
describe('earned moves',()=>{
 it('starts with exactly three accessible basics',()=>expect(available(initialPlayer()).map(a=>a.id)).toEqual(['squat','sitstand','wallpushup']));
 it('rejects locked equipment and upgrades at the canonical boundary',()=>{const s=initialAdventure();expect(()=>send(s,{kind:'equip',attackIds:['diamond']})).toThrow('INVALID_LOADOUT');expect(()=>send(s,{kind:'upgradeAttack',attackId:'bridge'})).toThrow('ATTACK_LOCKED');});
 it('awards moves through existing persistent outcomes',()=>{const p=initialPlayer();p.defeated.push('tutorial-moss');p.quests={squat:1,pushup:1,birddog:1,lunge:1};p.badges=['leg','arm','back'];expect(new Set(available(p).map(a=>a.id))).toEqual(new Set(attacks.map(a=>a.id)));});
 it('preserves every previously available move and old upgrades on migration',()=>{const s=initialAdventure();delete s.player.unlockedAttacks;s.player.equipped=['diamond','birddog'];s.player.upgrades.bridge=2;const n=normalizeAdventure(s);expect(available(n.player)).toHaveLength(9);expect(n.player.equipped).toEqual(s.player.equipped);expect(n.player.upgrades).toEqual(s.player.upgrades);expect(s.player.unlockedAttacks).toBeUndefined();});
 it('does not make a normal player admin by name and blocks test imports',()=>{const s=send(initialAdventure(),{kind:'rename',name:'admin'});expect(available(s.player)).toHaveLength(3);s.testOnly=true;expect(()=>validateLocalImport(s)).toThrow('TEST_SAVE_LOCAL_ONLY');});
});
