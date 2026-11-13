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
