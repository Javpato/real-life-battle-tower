import {useId} from 'react';
import {ASSET_MANIFEST,assetUrl,characterArt,frameRect,type SheetId} from './assets';
function AtlasSprite({sheet,frame,label,className}:{sheet:SheetId;frame:number;label:string;className?:string}){
 const clipId='sprite-'+useId().replace(/:/g,'');
 const s=ASSET_MANIFEST.sheets[sheet],all=ASSET_MANIFEST.visualBounds as Record<string,{x:number;y:number;width:number;height:number}[]>;const f=all[sheet]?.[frame]??frameRect(sheet,frame);
 return <span className={className} role="img" aria-label={label} data-art-sheet={sheet} data-art-frame={frame} style={{display:'block'}}><svg className="sprite-art" aria-hidden="true" viewBox={`${f.x} ${f.y} ${f.width} ${f.height}`} preserveAspectRatio="xMidYMax meet" style={{display:'block',width:'100%',height:'100%',overflow:'hidden',imageRendering:'pixelated'}}><defs><clipPath id={clipId}><rect x={f.x} y={f.y} width={f.width} height={f.height}/></clipPath></defs><g clipPath={`url(#${clipId})`}><image href={assetUrl(sheet)} width={s.width} height={s.height}/></g></svg></span>;
}
export default function BattleSprite({id,variant='front',className}:{id:string;variant?:'front'|'back';className?:string}){const art=characterArt(id,variant);return <AtlasSprite {...art} label={art.name} className={className}/>;}
export function ItemSprite({id,className}:{id:string;className?:string}){const frame=ASSET_MANIFEST.items[id as keyof typeof ASSET_MANIFEST.items]??0;return <AtlasSprite sheet="items" frame={frame} label={id} className={className}/>;}
