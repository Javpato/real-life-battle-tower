import {expect,it} from 'vitest';
import {initialAdventure,normalizeAdventure} from './commands';
import {validateLocalImport} from './importSave';
it('imports full local progression without replaying rewards',()=>{const s=normalizeAdventure(initialAdventure(),false);s.player.coins=123;s.player.badges=['arm'];s.journey!.avatar='female';expect(validateLocalImport(s)).toEqual(s);});
it('rejects corrupt stats, inventory and active sessions',()=>{const s=initialAdventure();s.player.coins=-1;expect(()=>validateLocalImport(s)).toThrow();s.player.coins=50;s.player.upgrades={fake:100};expect(()=>validateLocalImport(s)).toThrow();s.player.upgrades={};s.quest={id:'q',exercise:'squat',target:3,progress:0,seen:[]};expect(()=>validateLocalImport(s)).toThrow('FINISH_CURRENT_ACTIVITY');});
