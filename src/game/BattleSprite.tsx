import type {CSSProperties} from 'react';
import {ASSET_MANIFEST,assetUrl,characterArt,type SheetId} from './assets';
function AtlasSprite({sheet,frame,label,className}:{sheet:SheetId;frame:number;label:string;className?:string}){
 const s=ASSET_MANIFEST.sheets[sheet],col=frame%s.columns,row=Math.floor(frame/s.columns);
 const style:CSSProperties={display:'block',width:'100%',height:'100%',backgroundImage:`url("${assetUrl(sheet)}")`,backgroundSize:`${s.columns*100}% ${s.rows*100}%`,backgroundPosition:`${s.columns>1?col/(s.columns-1)*100:0}% ${s.rows>1?row/(s.rows-1)*100:0}%`,backgroundRepeat:'no-repeat',imageRendering:'pixelated'};
 return <span className={className} role="img" aria-label={label} data-art-sheet={sheet} data-art-frame={frame}><span aria-hidden="true" style={style}/></span>;
}
export default function BattleSprite({id,variant='front',className}:{id:string;variant?:'front'|'back';className?:string}){
 const art=characterArt(id,variant);return <AtlasSprite {...art} label={art.name} className={className}/>;
}
export function ItemSprite({id,className}:{id:string;className?:string}){
 const frame=ASSET_MANIFEST.items[id as keyof typeof ASSET_MANIFEST.items]??0;
 return <AtlasSprite sheet="items" frame={frame} label={id} className={className}/>;
}
