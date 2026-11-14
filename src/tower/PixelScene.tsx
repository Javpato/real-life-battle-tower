import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {SKILLS,SKILL_BY_ID} from './catalog';
import {TYPES,TYPE_NAMES} from './typeChart';
import {ART_ROOT,PixelCharacter} from './CharacterSprite';
import type {CharacterAction} from './CharacterSprite';
import './pixel-scene.css';
export {PixelCharacter,PixelIcon} from './CharacterSprite';
export const TOWER_ART_URL=ART_ROOT;
export const MINIGAME_SCENES=Object.fromEntries(SKILLS.map(s=>[s.id,{id:s.id,title:`${s.name} · ${TYPE_NAMES[s.type]} Practice`,instruction:`Collect crystals with accepted ${s.unit==='seconds'?'held seconds':'repetitions'}. Rest whenever you need.`,zone:TYPES.indexOf(s.type)}])) as Record<string,{id:string;title:string;instruction:string;zone:number}>;
export type PixelSceneProps={scene:'hub'|'battle'|'title'|'minigame';hero?:'male'|'female';enemy?:string;zone?:number;skillId?:string;progress?:number;target?:number;side?:'left'|'right';paused?:boolean;className?:string;outcome?:'won'|'lost'|'transform'|'enemy'|string};
const imageCache=new Map<string,HTMLImageElement>();
function asset(path:string){let img=imageCache.get(path);if(!img){img=new Image();img.src=ART_ROOT+path;imageCache.set(path,img);}return img;}
function TrainingScene({hero='male',skillId='squat',progress=0,target=8,side,paused=false}:PixelSceneProps){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({progress,target,side,paused});latest.current={progress,target,side,paused};
 const info=MINIGAME_SCENES[skillId]??MINIGAME_SCENES.squat;
 useEffect(()=>{const g=canvas.current?.getContext('2d');if(!g)return;g.imageSmoothingEnabled=false;let raf=0,last=performance.now(),shown=latest.current.progress,queued=shown,elapsed=0,active=false;
 const bg=asset(`arena-${info.zone}.png`),idle=asset(`characters/hero-${hero}/idle.png`),attack=asset(`characters/hero-${hero}/attack.png`),crystal=asset('icon-crystal.png'),trophy=asset('icon-trophy.png');
 const render=(now:number)=>{const p=latest.current;const delta=Math.min(50,now-last);last=now;if(p.progress<shown){shown=p.progress;queued=p.progress;}queued=Math.max(queued,p.progress);if(!p.paused){if(!active&&shown<queued){active=true;elapsed=0;}if(active){elapsed+=delta;if(elapsed>=540){shown++;active=false;elapsed=0;}}}
 g.clearRect(0,0,480,270);if(bg.complete&&bg.naturalWidth)g.drawImage(bg,0,0,480,270);const count=Math.min(12,p.target),fraction=Math.min(1,(shown+(active?elapsed/540:0))/Math.max(1,p.target));
 // Generated gems are collected only by accepted exercise events. Presentation owns no counter.
 for(let i=0;i<count;i++){const x=75+i*330/Math.max(1,count-1),y=204-Math.sin(i/Math.max(1,count-1)*Math.PI)*35;g.globalAlpha=i/count<fraction?0.25:1;if(crystal.complete&&crystal.naturalWidth)g.drawImage(crystal,x-10,y-28,20,20);}g.globalAlpha=1;
 const sprite=active?attack:idle,frame=active?Math.min(3,Math.floor(elapsed/140)):Math.floor(now/240)%4,x=48+fraction*320,y=239-Math.sin(fraction*Math.PI)*36;
 if(sprite.complete&&sprite.naturalWidth)g.drawImage(sprite,frame*128,0,128,128,Math.round(x-40),Math.round(y-76),80,80);
 if(trophy.complete&&trophy.naturalWidth)g.drawImage(trophy,402,155,40,40);
 if(p.paused){g.fillStyle='#14223988';g.fillRect(0,0,480,270);}raf=requestAnimationFrame(render);};render(last);return()=>cancelAnimationFrame(raf)
 },[hero,skillId,info.zone]);
 return <figure className={`pixel-scene pixel-minigame ${paused?'is-paused':''}`} data-scene={skillId}><canvas ref={canvas} width={480} height={270} role="img" aria-label={`${info.title}: ${progress} of ${target} accepted units`}/><figcaption><strong>{info.title}</strong><span>{info.instruction}</span></figcaption><span className="pixel-training-count">{progress} / {target} {SKILL_BY_ID[skillId]?.unit}{side?` · ${side}`:''}</span></figure>;
}
export default function PixelScene(props:PixelSceneProps){
 const {scene,hero='male',enemy,zone=0,progress=0,paused=false,className='',outcome}=props;
 const sceneElement=useRef<HTMLDivElement>(null),previous=useRef(progress),[striking,setStriking]=useState(false),[plane,setPlane]=useState({width:480,height:270});
 useLayoutEffect(()=>{const el=sceneElement.current;if(!el)return;const update=()=>{const scale=Math.min(el.clientWidth/480,el.clientHeight/270);setPlane({width:480*scale,height:270*scale})};update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect()},[scene]);
 useEffect(()=>{const increased=progress>previous.current;previous.current=progress;if(scene!=='battle'||paused||!increased)return;setStriking(true);const timer=setTimeout(()=>setStriking(false),560);return()=>clearTimeout(timer)},[progress,scene,paused]);
 if(scene==='minigame')return <TrainingScene {...props}/>;
 const playerAction:CharacterAction=outcome==='won'?'victory':outcome==='lost'||outcome==='enemy'?'impact':striking?'attack':'idle';
 const enemyAction:CharacterAction=outcome==='transform'?'transform':outcome==='enemy'?'attack':striking||outcome==='won'?'impact':'idle';
 return <div ref={sceneElement} className={`pixel-scene pixel-scene-${scene} ${striking?'is-striking':''} ${className}`} data-scene={scene} role="img" aria-label={scene==='battle'?'Battle Tower arena':scene==='hub'?'Battle Tower and the surrounding valley':'Battle Tower title landscape'}><div className="pixel-scene-plane" style={{width:plane.width,height:plane.height}}><img className="pixel-scene-background" src={`${ART_ROOT}${scene==='battle'?`arena-${Math.abs(zone)%6}`:scene}.png`} alt=""/>{scene==='battle'?<><span className="pixel-combatant pixel-combatant-hero"><PixelCharacter hero={hero} variant="back" action={playerAction}/></span><span className="pixel-combatant pixel-combatant-enemy"><PixelCharacter id={enemy} action={enemyAction}/></span></>:scene==='title'?<div className="pixel-title-party"><PixelCharacter hero="male" variant="title"/><PixelCharacter hero="female" variant="title"/></div>:<span className="pixel-hub-hero"><PixelCharacter hero={hero}/></span>}</div></div>;
}
