/** Original, deterministic pixel artwork. All dimensions are logical pixels. */
export const MAP_W = 768;
export const MAP_H = 576;
export type Obstacle = {x:number;y:number;w:number;h:number};
export type Building = {x:number;y:number;w:number;h:number;roof:string;name:string;mark:string};
export const buildings:Building[] = [
  {x:60,y:94,w:98,h:80,roof:'#df796d',name:'REST HOUSE',mark:'+'},
  {x:240,y:83,w:104,h:80,roof:'#e8b65a',name:'GENERAL STORE',mark:'$'},
  {x:68,y:233,w:104,h:78,roof:'#a08dc9',name:'ALCHEMY',mark:'✧'},
  {x:552,y:99,w:112,h:88,roof:'#6d9fab',name:'WIND SANCTUM',mark:'III'},
  {x:73,y:380,w:112,h:88,roof:'#ca885d',name:'ROOT DOJO',mark:'I'},
  {x:558,y:363,w:112,h:88,roof:'#be7686',name:'EMBER HALL',mark:'II'},
  {x:470,y:459,w:69,h:60,roof:'#86a1a3',name:'',mark:''},
  {x:203,y:474,w:65,h:57,roof:'#cda264',name:'',mark:''},
];
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function random(seed:number){let value=seed;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};}
export function createWorldArt(){
  const c=canvas(MAP_W,MAP_H),ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  const obstacles:Obstacle[]=[];const trees:{x:number;y:number}[]=[];const rng=random(7891);
  const box=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  box(0,0,MAP_W,MAP_H,'#79a66c');
  for(let i=0;i<5500;i++){const x=Math.floor(rng()*MAP_W),y=Math.floor(rng()*MAP_H);box(x,y,2+rng()*3,1,rng()>.5?'#84b274':'#6b9c62');}
  const path=(x:number,y:number,w:number,h:number)=>{box(x-3,y-3,w+6,h+6,'#6b925c');box(x-1,y-1,w+2,h+2,'#cfbc83');box(x,y,w,h,'#e5cf96');for(let i=0;i<w*h/70;i++)box(x+Math.floor(rng()*w),y+Math.floor(rng()*h),2,1,'#d4bd84');};
  path(366,55,36,354);path(106,285,532,32);path(111,164,28,240);path(608,180,28,204);
  path(122,195,256,22);path(387,207,235,22);path(125,346,490,24);path(272,148,24,59);
  path(241,356,23,128);path(500,358,22,112);
  // Village square: hand-laid stone and a planted border.
  box(319,245,130,111,'#789461');box(324,250,120,101,'#b9b9a0');
  for(let yy=253;yy<350;yy+=10)for(let xx=326;xx<443;xx+=15){box(xx+(yy%20===3?2:0),yy,12,7,(xx+yy)%3?'#d7d4b7':'#c8c8ac');}
  for(const [x,y] of [[313,246],[447,246],[312,343],[448,343]]){box(x-5,y,10,7,'#aa8864');box(x-7,y-4,14,7,'#4f845b');box(x-5,y-6,10,3,'#8aaa65');box(x-4,y-5,3,2,'#efb49e');box(x+2,y-3,3,2,'#f4d896');}
  // Cloth banners and a small market cart at the town square.
  for(const [x,y,color]of [[304,236,'#c77f6d'],[462,236,'#82afb0']] as const){box(x,y,2,30,'#73684f');box(x+2,y+2,12,15,color);box(x+2,y+15,6,4,color);box(x+5,y+5,5,5,'#efd6a2');}
  box(257,244,32,17,'#8e7654');box(259,246,28,11,'#d8ae75');box(254,238,38,5,'#e8cd98');
  for(let i=0;i<5;i++)box(255+i*7,235,4,7,i%2?'#f5e7b8':'#bf7d68');
  box(260,261,5,5,'#555b49');box(281,261,5,5,'#555b49');box(260,249,7,4,'#aaaf67');box(270,248,7,5,'#dca473');box(280,248,6,5,'#c67367');
  // Stream and pond, with stepped pixel shore.
  box(302,426,141,79,'#507f72');box(291,440,164,49,'#507f72');box(307,430,131,71,'#75b8b3');box(296,445,154,39,'#75b8b3');
  box(310,436,125,59,'#64a4a9');box(303,451,141,27,'#64a4a9');
  for(let i=0;i<60;i++){const x=311+rng()*121,y=440+rng()*52;box(x,y,4+rng()*8,1,rng()>.5?'#8fc7bd':'#528e99');}
  obstacles.push({x:295,y:434,w:151,h:64});
  for(const [x,y] of [[317,444],[415,479],[334,484]]){box(x,y,9,4,'#54875c');box(x+3,y-2,3,3,'#e5b8bb');}
  // Wooden footbridge and bank details.
  box(350,405,32,41,'#624d41');for(let y=408;y<443;y+=5)box(351,y,30,3,'#c6a274');box(348,404,3,42,'#88734f');box(382,404,3,42,'#88734f');
  for(const b of buildings){
    const {x,y,w,h}=b;box(x+5,y+h-9,w+7,15,'#5f855e');
    box(x+6,y+30,w-12,h-25,'#665744');box(x+8,y+32,w-16,h-29,'#e9d6a6');
    box(x+8,y+h-12,w-16,9,'#b79e78');
    for(let yy=y+40;yy<y+h-13;yy+=10)for(let xx=x+10;xx<x+w-12;xx+=15)box(xx,yy,10,1,'#d7bf94');
    // Layered gable, terracotta tiles, deep eaves.
    box(x,y+25,w,9,'#65534a');box(x+3,y+17,w-6,12,b.roof);box(x+10,y+9,w-20,12,b.roof);box(x+20,y+2,w-40,10,b.roof);
    box(x+21,y+2,w-42,2,'#f0dbad');
    for(let yy=y+12;yy<y+29;yy+=7){box(x+8,yy,w-16,1,'#fff1c131');for(let xx=x+12;xx<x+w-10;xx+=12)box(xx+(yy%2?4:0),yy,1,6,'#403e4828');}
    box(x+w-23,y-3,10,17,'#8e7565');box(x+w-25,y-4,14,4,'#c4ae87');
    const doorX=x+Math.floor(w/2)-8;box(doorX-2,y+h-31,20,28,'#8e7453');box(doorX,y+h-30,16,26,'#43585c');box(doorX+2,y+h-28,12,23,'#62757a');box(doorX+12,y+h-16,2,2,'#efce81');
    box(doorX-5,y+h-4,26,5,'#d3bd8e');
    for(const wx of [x+17,x+w-33]){box(wx-2,y+42,18,19,'#987d59');box(wx,y+44,14,13,'#70a9ad');box(wx+1,y+45,5,4,'#c4e0cd');box(wx+6,y+44,2,13,'#e0c896');box(wx,y+50,14,2,'#e0c896');box(wx-3,y+59,20,3,'#877451');box(wx,y+60,14,4,'#61925b');box(wx+2,y+59,3,2,'#f2d88b');box(wx+10,y+60,3,2,'#efac9b');}
    if(b.mark){box(x+w/2-9,y+29,18,15,'#f1deb3');ctx.fillStyle='#70624b';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(b.mark,x+w/2,y+40);}
    obstacles.push({x:x+4,y:y+25,w:w-8,h:h-28});
  }
  // Small furnishing makes each district feel inhabited.
  for(const [x,y] of [[181,266],[179,285],[227,170],[319,175],[548,208],[680,417]]){box(x,y,11,12,'#6f654a');box(x+1,y+1,9,9,'#bf9d68');box(x+2,y+3,7,1,'#e1bf80');box(x+5,y+1,1,9,'#8c764f');}
  for(const [x,y] of [[283,271],[456,318],[194,340],[554,327]]){box(x,y+3,22,4,'#705f4a');box(x,y,22,3,'#c6a475');box(x+2,y+7,3,3,'#705f4a');box(x+17,y+7,3,3,'#705f4a');}
  // Final garden gate.
  box(350,72,7,44,'#899782');box(411,72,7,44,'#899782');box(346,69,15,7,'#c6ccb0');box(407,69,15,7,'#c6ccb0');box(350,60,68,7,'#b8c3a2');box(358,56,52,4,'#d8d9b6');
  for(let x=277;x<493;x+=13){if(x>344&&x<421)continue;box(x,97,4,17,'#d2c89e');box(x-2,103,13,3,'#b2ad82');}obstacles.push({x:273,y:99,w:75,h:11},{x:421,y:99,w:78,h:11});
  // Wild flowers; avoid the navigable streets and architecture.
  for(let i=0;i<180;i++){const x=Math.floor(rng()*MAP_W),y=Math.floor(rng()*MAP_H);if((x>90&&x<650&&y>80&&y<520))continue;box(x,y,1,4,'#4e8056');box(x-1,y-1,3,2,['#f4d98b','#ecc0b2','#c6d5e9'][i%3]);}
  for(let x=9;x<MAP_W;x+=29){trees.push({x,y:29},{x:x+7,y:MAP_H-3});}
  for(let y=54;y<MAP_H-25;y+=31){trees.push({x:17,y},{x:MAP_W-15,y:y+8});}
  for(const [x,y]of [[210,94],[190,126],[468,139],[486,161],[705,99],[708,144],[52,349],[214,433],[270,403],[465,411],[548,276],[687,289],[708,493],[575,524],[150,526],[283,241],[489,257]])trees.push({x,y});
  trees.forEach(t=>{box(t.x-10,t.y-3,25,8,'#608457');obstacles.push({x:t.x-5,y:t.y-7,w:11,h:10});});
  return {canvas:c,obstacles,trees};
}
export function createTreeArt(){
  const c=canvas(40,48),g=c.getContext('2d')!;const b=(x:number,y:number,w:number,h:number,color:string)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
  b(17,29,7,18,'#6c6447');b(18,30,2,15,'#ad9762');b(11,39,7,3,'#6c6447');
  b(8,9,26,25,'#3e7052');b(3,17,34,15,'#3e7052');b(12,3,17,7,'#3e7052');b(7,12,26,17,'#52865c');b(12,6,16,20,'#629765');b(6,19,8,8,'#679e66');b(15,6,10,3,'#8bb275');b(24,12,6,3,'#83ad6f');b(11,16,4,3,'#92b878');b(16,28,15,4,'#487951');b(30,22,4,5,'#639667');return c;
}
export function createCharacterArt(shirt:string,hair='#5e4947',hat?:string){
  const c=canvas(192,24),g=c.getContext('2d')!;
  for(let direction=0;direction<4;direction++)for(let f=0;f<3;f++){
    const ox=(direction*3+f)*16,bob=f===1?1:0;const b=(x:number,y:number,w:number,h:number,color:string)=>{g.fillStyle=color;g.fillRect(ox+x,y+bob,w,h);};
    b(4,19,9,3,'#39555255');b(5,17,3,4,'#3e4b56');b(9,17+(f===2?-1:0),3,4,'#3e4b56');b(4,20-(f===2?1:0),4,2,'#6a5550');b(9,20-(f===1?1:0),4,2,'#6a5550');
    b(4,10,9,9,'#3c5554');b(5,10,7,8,shirt);b(3,11,2,6,'#e7b88e');b(12,11,2,6,'#e7b88e');b(6,11,5,1,'#fff2c77a');
    b(4,3,9,8,hair);b(5,5,7,6,'#efc39a');b(5,3,7,3,hair);b(4,5,2,3,hair);
    if(direction===3){b(5,5,7,6,hair);b(6,10,5,3,'#dec898');b(5,13,7,4,'#a4865e');}
    else if(direction===1){b(4,7,2,2,'#3f4850');b(11,5,2,5,hair);}
    else if(direction===2){b(11,7,2,2,'#3f4850');b(4,5,2,5,hair);}
    else{b(6,7,1,2,'#3f4850');b(10,7,1,2,'#3f4850');b(8,10,2,1,'#c78b70');}
    if(hat){b(3,2,11,3,hat);b(5,0,7,3,hat);b(3,4,12,1,'#f4dc9f');}
  }return c;
}
