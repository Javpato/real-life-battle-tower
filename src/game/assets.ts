import manifest from '../../public/assets/manifest.json';
export const ASSET_MANIFEST=manifest;
export type SheetId=keyof typeof manifest.sheets;
export type CharacterId=keyof typeof manifest.characters;
export const assetUrl=(sheet:SheetId)=>`${import.meta.env.BASE_URL}${manifest.sheets[sheet].path}`;
/** Rounded boundaries partition even non-divisible source sizes without overlap. */
export function frameRect(sheet:SheetId,index:number){
 const s=manifest.sheets[sheet],col=index%s.columns,row=Math.floor(index/s.columns);
 const x=Math.round(col*s.width/s.columns),y=Math.round(row*s.height/s.rows);
 return {x,y,width:Math.round((col+1)*s.width/s.columns)-x,height:Math.round((row+1)*s.height/s.rows)-y};
}
export function characterArt(id:string,variant:'front'|'back'='front'):{sheet:SheetId;frame:number;name:string}{
 if(id==='hero-female'&&variant==='back')return {sheet:'female',frame:1,name:'The traveler'};
 if(id==='hero'&&variant==='back')return {sheet:'heroBack',frame:0,name:'The traveler'};
 const entry=manifest.characters[id as CharacterId]??manifest.characters.hero;
 return {...entry,sheet:entry.sheet as SheetId};
}

export const battlefieldUrl=()=>`${import.meta.env.BASE_URL}${manifest.battlefield.path}`;
