/** Map geometry is independent of the replaceable bitmap artwork. */
export const MAP_W=768,MAP_H=576;
export type Obstacle={x:number;y:number;w:number;h:number};
export const buildings=[
 {x:60,y:94,w:98,h:80,frame:0,name:'REST HOUSE'},
 {x:240,y:83,w:104,h:80,frame:1,name:'GENERAL STORE'},
 {x:68,y:233,w:104,h:78,frame:2,name:'ALCHEMY'},
 {x:552,y:99,w:112,h:88,frame:3,name:'WIND SANCTUM'},
 {x:73,y:380,w:112,h:88,frame:4,name:'ROOT DOJO'},
 {x:558,y:363,w:112,h:88,frame:5,name:'EMBER HALL'},
 {x:470,y:459,w:69,h:60,frame:6,name:''},
 {x:203,y:474,w:65,h:57,frame:6,name:''},
];
export function createWorldArt(terrain:HTMLImageElement){
 const c=document.createElement('canvas');c.width=MAP_W*2;c.height=MAP_H*2;
 const ctx=c.getContext('2d')!;ctx.scale(2,2);ctx.imageSmoothingEnabled=false;
 const obstacles:Obstacle[]=[],trees:{x:number;y:number}[]=[];
 const box=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const material=(frame:number,x:number,y:number,w:number,h:number)=>{
  const size=627,tile=96,sx=frame%2*size,sy=Math.floor(frame/2)*size;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  for(let yy=Math.floor(y/tile)*tile;yy<y+h;yy+=tile)for(let xx=Math.floor(x/tile)*tile;xx<x+w;xx+=tile)ctx.drawImage(terrain,sx,sy,size,size,xx,yy,tile,tile);
  ctx.restore();
 };
 material(0,0,0,MAP_W,MAP_H);
 const path=(x:number,y:number,w:number,h:number)=>{box(x-3,y-3,w+6,h+6,'#738858');box(x-1,y-1,w+2,h+2,'#b8aa7d');material(1,x,y,w,h);};
 [[366,55,36,354],[106,285,532,32],[111,164,28,240],[608,180,28,204],[122,195,256,22],[387,207,235,22],[125,346,490,24],[272,148,24,59],[241,356,23,128],[500,358,22,112]].forEach(p=>path(p[0],p[1],p[2],p[3]));
 box(319,245,130,111,'#758657');box(322,248,124,105,'#a6a989');material(2,324,250,120,101);
 box(302,426,141,79,'#566b55');box(291,440,164,49,'#566b55');box(305,429,135,73,'#aeae82');box(294,443,158,43,'#aeae82');material(3,308,432,129,67);material(3,297,446,152,37);
 obstacles.push({x:295,y:434,w:151,h:64});
 box(350,405,32,41,'#624d41');for(let y=408;y<443;y+=5){box(351,y,30,3,'#c6a274');box(353,y,25,1,'#dfbb86');}box(348,404,3,42,'#88734f');box(382,404,3,42,'#88734f');
 for(const b of buildings)obstacles.push({x:b.x+4,y:b.y+25,w:b.w-8,h:b.h-28});
 for(let x=277;x<493;x+=13){if(x>344&&x<421)continue;box(x,97,4,17,'#d2c89e');box(x-2,103,13,3,'#a29f76');}obstacles.push({x:273,y:99,w:75,h:11},{x:421,y:99,w:78,h:11});
 for(let x=9;x<MAP_W;x+=29)trees.push({x,y:29},{x:x+7,y:MAP_H-3});
 for(let y=54;y<MAP_H-25;y+=31)trees.push({x:17,y},{x:MAP_W-15,y:y+8});
 for(const [x,y]of [[210,94],[190,126],[468,139],[486,161],[705,99],[708,144],[52,349],[214,433],[270,403],[465,411],[548,276],[687,289],[708,493],[575,524],[150,526],[283,241],[489,257]])trees.push({x,y});
 trees.forEach(t=>obstacles.push({x:t.x-5,y:t.y-7,w:11,h:10}));
 return {canvas:c,obstacles,trees};
}

import type {WorldMap} from '../core/worldMaps';
/** Native pixel terrain: deterministic decoration never changes collision geometry. */
export function paintMap(map:WorldMap,terrain?:HTMLImageElement){
 const c=document.createElement('canvas');c.width=map.width;c.height=map.height;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;
 const box=(x:number,y:number,w:number,h:number,color:string)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),w,h);};
 const material=(frame:number,x:number,y:number,w:number,h:number)=>{if(!terrain)return;const size=terrain.width/2,tile=64;g.save();g.beginPath();g.rect(x,y,w,h);g.clip();for(let yy=Math.floor(y/tile)*tile;yy<y+h;yy+=tile)for(let xx=Math.floor(x/tile)*tile;xx<x+w;xx+=tile)g.drawImage(terrain,(frame%2)*size,Math.floor(frame/2)*size,size,size,xx,yy,tile,tile);g.restore();};
 if(map.kind==='interior'){
  const style=map.roomStyle;
  box(0,0,c.width,c.height,'#382a35');box(16,16,352,256,style?.wall??'#d2b784');box(16,47,352,225,'#957052');
  if(style?.floor==='stone'){material(2,16,48,352,224);for(let y=48;y<272;y+=24)box(16,y,352,1,'#727b6955');}
  else for(let y=48;y<272;y+=16)for(let x=16;x<368;x+=32){box(x,y,31,15,(x+y)%3?'#aa805a':'#b78d62');box(x+3,y+3,22,1,'#c29c70');}
  box(20,18,344,27,style?.wall??'#f0d9a5');box(20,42,344,6,style?.trim??'#5d473b');
  // Warm window, bed, desk, chair, bookshelf and rug. Each retains a matching collision.
  box(164,18,54,26,'#624b47');box(168,20,46,20,'#77bfc2');box(171,22,18,17,'#afd7cf');box(190,20,3,22,'#ead09a');
  const rug=style?.rugBounds??{x:150,y:162,w:85,h:53};box(rug.x,rug.y,rug.w,rug.h,style?.rug??'#657e78');box(rug.x+4,rug.y+4,rug.w-8,rug.h-8,'#e2cda2');box(rug.x+7,rug.y+7,rug.w-14,rug.h-14,style?.rug??'#607d74');
  for(let x=rug.x+4;x<rug.x+rug.w-4;x+=8){box(x,rug.y-2,3,2,'#d9c295');box(x,rug.y+rug.h,3,2,'#d9c295');}
  box(168,267,48,21,'#e6c58b');box(174,272,36,3,'#705744');
  if(map.id==='starter_house'){box(304,112,32,24,'#ead7a5');for(let y=114;y<136;y+=5)box(305,y,30,2,'#85644c');}
  for(const x of [122,246]){box(x,27,6,8,'#ffdf8a');box(x-2,34,10,3,'#99704f');}

 }else{
  const grass=map.kind==='summit'?'#73918c':map.kind==='route'?'#4f805d':'#83a86f';box(0,0,c.width,c.height,grass);material(0,0,0,c.width,c.height);
  for(let y=12;y<c.height;y+=24)for(let x=12;x<c.width;x+=24){const n=(x*31+y*17)%13;box(x+n,y+n,2,3,map.kind==='route'?'#709967':'#a5b77d');if(n%4===0)box(x+n+3,y+n+2,2,2,'#e5ca91');}
  // Shared rectangular regions create consistent 16px-aligned streets and planted blocks.
  for(const r of map.ground.filter(r=>r.kind==='meadow')){
   box(r.x,r.y,r.w,r.h,map.kind==='summit'?'#638879':'#4f794a');
   for(let y=r.y+4;y<r.y+r.h;y+=8)for(let x=r.x+4;x<r.x+r.w;x+=8){box(x,y,2,4,'#739653');box(x+3,y-1,2,4,'#7da65b');}
  }
  for(const r of map.ground.filter(r=>r.kind==='flowers')){box(r.x-2,r.y-2,r.w+4,r.h+4,'#778b5e');box(r.x,r.y,r.w,r.h,'#647951');}
  // Paint all street edges first; intersections never retain a seam across the road.
  const roads=map.ground.filter(r=>r.kind==='road'||r.kind==='plaza');
  for(const r of roads){box(r.x-3,r.y-3,r.w+6,r.h+6,'#738456');box(r.x-1,r.y-1,r.w+2,r.h+2,'#c1b282');}
  for(const r of roads){material(r.kind==='plaza'||map.kind==='summit'?2:1,r.x,r.y,r.w,r.h);}
  for(const r of map.ground.filter(r=>r.kind==='plaza')){
   for(let x=r.x+8;x<r.x+r.w;x+=16){box(x,r.y+5,8,2,'#c9c9a4');box(x,r.y+r.h-7,8,2,'#c9c9a4');}
  }
  for(const r of map.ground.filter(r=>r.kind==='water')){
   box(r.x-6,r.y-6,r.w+12,r.h+12,'#738456');box(r.x-3,r.y-3,r.w+6,r.h+6,'#b0b68d');material(3,r.x,r.y,r.w,r.h);
   for(let y=r.y+14;y<r.y+r.h;y+=24)for(let x=r.x+12;x<r.x+r.w-16;x+=40)box(x,y,20,2,'#aed2c5');
  }
  // Foliage and landmarks use the original transparent scenery atlas in World.

 }
 return c;
}
