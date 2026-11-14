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
export function paintMap(map:WorldMap){
 const c=document.createElement('canvas');c.width=map.width;c.height=map.height;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;
 const box=(x:number,y:number,w:number,h:number,color:string)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),w,h);};
 if(map.kind==='interior'){
  box(0,0,c.width,c.height,'#382a35');box(16,16,352,256,'#d2b784');box(16,47,352,225,'#957052');
  for(let y=48;y<272;y+=16)for(let x=16;x<368;x+=32){box(x,y,31,15,(x+y)%3?'#aa805a':'#b78d62');box(x+3,y+3,22,1,'#c29c70');}
  box(20,18,344,27,'#f0d9a5');box(20,42,344,6,'#5d473b');
  // Warm window, bed, desk, chair, bookshelf and rug. Each retains a matching collision.
  box(164,18,54,26,'#624b47');box(168,20,46,20,'#77bfc2');box(171,22,18,17,'#afd7cf');box(190,20,3,22,'#ead09a');
  box(36,54,72,58,'#493e45');box(40,58,64,48,'#f4e3b8');box(43,77,58,28,map.id.includes('gym')?'#b76853':'#587d7b');box(44,61,23,12,'#fff0cc');
  box(266,54,70,32,'#513b35');box(269,57,64,26,'#b98b5c');for(let i=0;i<7;i++)box(272+i*8,60,5,20,['#839970','#bd795b','#e5ca8d'][i%3]);
  box(46,154,60,36,'#5c4437');box(44,151,64,25,'#c19867');box(53,155,23,13,'#ece0b1');box(62,154,1,15,'#947d5d');
  box(150,162,85,53,map.id.includes('gym')?'#ad604e':'#657e78');box(154,166,77,45,map.id.includes('gym')?'#c78b68':'#8ba59a');box(160,172,65,33,map.id.includes('gym')?'#995648':'#607d74');
  box(168,267,48,21,'#e6c58b');box(174,272,36,3,'#705744');
  if(map.id==='starter_house'){box(304,112,32,24,'#ead7a5');for(let y=114;y<136;y+=5)box(305,y,30,2,'#85644c');}
  for(const x of [122,246]){box(x,27,6,8,'#ffdf8a');box(x-2,34,10,3,'#99704f');}
  if(map.id.startsWith('gym_')||map.id==='rival_arena'){
   const accent=map.id==='gym_leg'?'#9b7e48':map.id==='gym_arm'?'#b86a55':map.id==='gym_back'?'#6e9ba3':'#8d7ca2';
   box(36,54,72,58,'#684e40');box(40,60,64,3,'#c9af7a');box(44,64,5,43,'#cfb58a');box(96,64,5,43,'#cfb58a');
   for(let y=71;y<103;y+=10)box(48,y,48,3,accent);box(46,154,60,36,'#705846');box(54,164,44,5,'#c9c4b4');box(53,156,8,22,'#45454c');box(91,156,8,22,'#45454c');
   box(153,164,80,50,accent);box(163,174,60,30,'#e0c397');box(170,180,46,18,accent);
  }else if(map.id==='general_store'){
   box(36,54,72,58,'#644c39');for(let y=58;y<110;y+=18){box(39,y,66,3,'#c9a370');for(let x=42;x<101;x+=17){box(x,y+5,10,11,'#bc8f60');box(x+3,y+6,4,4,'#e1c88b');}}
   box(46,154,60,36,'#855d3f');box(42,151,68,10,'#d3ae76');box(52,139,18,13,'#bfa876');box(57,142,8,5,'#596853');
  }else if(map.id==='alchemy_lab'){
   box(36,54,72,58,'#594953');for(let x=43;x<98;x+=16){box(x,66,9,15,'#85b5a9');box(x+2,61,5,6,'#c7d8b2');box(x,89,9,15,'#b793b4');box(x+2,84,5,6,'#d8c6a3');}
   box(47,154,59,36,'#493e49');box(49,154,55,8,'#baa9b3');box(54,158,45,5,'#87bcb1');box(57,190,6,6,'#725043');box(92,190,6,6,'#725043');
  }else if(map.id==='mentor_house'||map.id==='willow_house'){
   box(36,54,72,58,'#604941');for(let y=59;y<110;y+=16){box(39,y,66,2,'#c5a279');for(let x=42;x<101;x+=8)box(x,y+3,5,11,['#a9ac7d','#b88073','#94acac'][(x+y)%3]);}
  }
 }else{
  const grass=map.kind==='summit'?'#73918c':map.kind==='route'?'#4f805d':'#83a86f';box(0,0,c.width,c.height,grass);
  for(let y=12;y<c.height;y+=24)for(let x=12;x<c.width;x+=24){const n=(x*31+y*17)%13;box(x+n,y+n,2,3,map.kind==='route'?'#709967':'#a5b77d');if(n%4===0)box(x+n+3,y+n+2,2,2,'#e5ca91');}
  const path=(x:number,y:number,w:number,h:number)=>{box(x-3,y-3,w+6,h+6,'#697c58');box(x,y,w,h,map.kind==='summit'?'#b0b3a1':'#c3b285');for(let yy=y+5;yy<y+h;yy+=14)for(let xx=x+4;xx<x+w;xx+=20)box(xx,yy,7,2,'#d7c69a');};
  if(map.kind==='town'){path(620,48,40,900);for(const y of [270,490,750,920])path(160,y,760,32);for(const x of [180,460,860])path(x,240,36,680);path(590,460,112,112);}
  if(map.kind==='summit'){path(458,35,44,660);path(150,350,640,36);path(180,310,30,52);path(742,310,30,52);path(370,390,220,105);}
  if(map.kind==='route'){path(365,35,40,1080);path(285,280,180,34);path(285,280,34,460);path(285,706,120,34);path(395,910,160,34);}
  for(const o of map.obstacles){if(map.buildings.some(b=>Math.abs(b.x+5-o.x)<4))continue;box(o.x,o.y,o.w,o.h,'#47777a');box(o.x+6,o.y+6,o.w-12,o.h-12,'#659a99');for(let y=o.y+16;y<o.y+o.h;y+=25)box(o.x+12,y,30,2,'#a3c8b1');}
  // Boundary forest has a clear break at every route entrance.
  const tree=(x:number,y:number)=>{box(x-3,y,6,14,'#66513b');box(x-14,y-16,28,18,'#315a49');box(x-10,y-28,20,20,'#456f50');box(x-5,y-35,10,16,'#648558');box(x-8,y-20,5,3,'#7b995e');};
  for(let x=24;x<c.width-20;x+=30){if(!map.portals.some(p=>Math.abs(p.x+p.w/2-x)<55&&p.y<70))tree(x,45);if(!map.portals.some(p=>Math.abs(p.x+p.w/2-x)<55&&p.y>c.height-70))tree(x,c.height-9);}
  for(let y=90;y<c.height-20;y+=32){tree(13,y);tree(c.width-13,y);}
  if(map.kind==='route')for(let y=140;y<1000;y+=130){tree(95,y);tree(650,y+45);tree(125,y+20);tree(675,y+60);}
 }
 return c;
}
