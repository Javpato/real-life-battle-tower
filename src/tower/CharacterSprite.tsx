import {useEffect,useId,useState} from 'react';
export const ART_ROOT=`${import.meta.env.BASE_URL}assets/tower-v2/`;
export type CharacterAction='idle'|'attack'|'impact'|'victory'|'transform';
const clips:Record<CharacterAction,number[]>={idle:[240,180,140,240],attack:[120,100,160,160],impact:[150,220],victory:[180,220,220,260],transform:[260,320]};
export function characterIdentity(id?:string){
 const aliases:Record<string,string>={male:'hero-male',female:'hero-female',hero:'hero-male',moss:'normal-leg-1',pip:'normal-arm-1',fern:'normal-back-1',terra:'boss-01',flint:'boss-02',zephyr:'boss-03',rowan:'boss-20',warden:'boss-19','trainer-1':'normal-leg-1','trainer-2':'normal-arm-1','trainer-3':'normal-back-1','leader-leg':'boss-01','leader-arm':'boss-02','leader-back':'boss-03',rival:'boss-20'};
 if(!id)return 'normal-leg-1';
 if(aliases[id])return aliases[id];
 if(/^(hero-(male|female)|normal-(leg|arm|back|core|cardio|mobility)-[1-6]|boss-(0[1-9]|1[0-9]|20)|instructor-[12])$/.test(id))return id;
 return 'normal-leg-1';
}
export function PixelCharacter({id,hero,variant='front',action='idle',className=''}:{id?:string;hero?:'male'|'female';variant?:'front'|'back'|'title';action?:CharacterAction;className?:string}){
 const who=hero?`hero-${hero}`:characterIdentity(id),back=variant==='back'&&who.startsWith('hero-');
 const clip=useId().replace(/:/g,''),[frame,setFrame]=useState(0),[reduced,setReduced]=useState(false);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update)},[]);
 useEffect(()=>{setFrame(0);if(reduced||variant==='title')return;let timer:ReturnType<typeof setTimeout>,current=0;const next=()=>{timer=setTimeout(()=>{current++;if(current>=clips[action].length){if(action!=='idle')return;current=0;}setFrame(current);next()},clips[action][current]);};next();return()=>clearTimeout(timer)},[who,action,back,reduced,variant]);
 const still=variant==='title'||reduced,path=still?(back?'back':'front'):`${back?'back-':''}${action}`;
 // Static portraits use the PNG directly, avoiding SVG bitmap resampling.
 if(still)return <img className={`pixel-character ${className}`} src={`${ART_ROOT}characters/${who}/${path}.png`} alt={hero?`${hero} adventurer`:who} width={128} height={128} draggable={false} data-character={who} data-character-view={back?'back':'front'} data-action={action}/>;
 return <svg className={`pixel-character ${className}`} viewBox="0 0 128 128" preserveAspectRatio="xMidYMax meet" role="img" aria-label={hero?`${hero} adventurer`:who} data-character={who} data-character-view={back?'back':'front'} data-action={action}><defs><clipPath id={`c${clip}`}><rect width="128" height="128"/></clipPath></defs><g clipPath={`url(#c${clip})`}><image href={`${ART_ROOT}characters/${who}/${path}.png`} x={still?0:-Math.min(frame,clips[action].length-1)*128} width={128*(still?1:clips[action].length)} height="128" style={{imageRendering:'pixelated'}}/></g></svg>;
}
export function PixelIcon({name,className=''}:{name:string;className?:string}){const names=['leg','arm','back','core','cardio','mobility','coin','potion','shield','star','tower','bag','settings','play','pause','trophy','training','skill','record','flash','lock','crystal','stairs','gloves'];return <img className={`pixel-icon ${className}`} src={`${ART_ROOT}icon-${names.includes(name)?name:'star'}.png`} alt="" aria-hidden="true"/>}
