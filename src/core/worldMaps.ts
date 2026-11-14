/** Shared, deterministic world geometry. Rendering and server transitions use this registry. */
export type MapId=string;
export type Facing='down'|'left'|'right'|'up';
export type WorldPosition={mapId:MapId;x:number;y:number;facing:Facing};
export type Rect={x:number;y:number;w:number;h:number};
export type Portal=Rect&{id:string;to:string;spawn:string;label:string;badges?:number};
export type Resident={id:string;name:string;x:number;y:number;activity:'stand'|'read'|'cook'|'train'|'walk'|'rest';icon:'heal'|'shop'|'alchemy'|'gym'|'battle'|'quest'|'story'};
export type Decoration={frame:number;x:number;y:number;width:number};
export type Building=Rect&{frame:number;name:string};
export type WorldMap={id:string;name:string;region:string;kind:'town'|'route'|'summit'|'interior';width:number;height:number;spawns:Record<string,{x:number;y:number;facing:Facing}>;obstacles:Rect[];portals:Portal[];npcs:Resident[];buildings:Building[];decorations:Decoration[]};
const maps:Record<string,WorldMap>={};
const spawn=(x:number,y:number,facing:Facing='down')=>({x,y,facing});
function outdoor(id:string,name:string,kind:WorldMap['kind'],width:number,height:number){const m:WorldMap={id,name,region:'GREENHAVEN VALLEY',kind,width,height,spawns:{safe:spawn(width/2,height/2)},obstacles:[],portals:[],npcs:[],buildings:[],decorations:[]};maps[id]=m;return m;}
const town=outdoor('starter_town','Willowmere','town',1152,960);
const route=outdoor('training_route','Fernway Trail','route',768,1152);
const summit=outdoor('rival_town','Summit Hollow','summit',960,768);
function room(id:string,name:string){const m=outdoor(id,name,'interior',384,288);m.spawns={safe:spawn(192,216),entry:spawn(192,232,'up')};m.obstacles=[{x:0,y:0,w:384,h:47},{x:0,y:0,w:16,h:288},{x:368,y:0,w:16,h:288},{x:0,y:272,w:167,h:16},{x:217,y:272,w:167,h:16},{x:36,y:54,w:72,h:58},{x:266,y:54,w:70,h:32},{x:46,y:154,w:60,h:36}];return m;}
function doorway(parent:WorldMap,id:string,name:string,x:number,y:number,frame:number){const inside=room(id,name);parent.buildings.push({x:x-64,y:y-104,w:128,h:104,frame,name});parent.obstacles.push({x:x-59,y:y-80,w:118,h:67});parent.spawns[id]=spawn(x,y+32);inside.portals.push({id:`${id}:exit`,x:168,y:258,w:48,h:28,to:parent.id,spawn:id,label:'Outside'});parent.portals.push({id:`${id}:enter`,x:x-18,y:y-5,w:36,h:24,to:id,spawn:'entry',label:name});return inside;}
const home=doorway(town,'starter_house','Your home',200,230,6);
const bedroom=room('starter_house_bedroom','Your room');bedroom.spawns.new_game=spawn(192,144);bedroom.spawns.safe=spawn(192,144);home.spawns.stairs=spawn(318,140);home.portals.push({id:'bedroom:enter',x:304,y:112,w:32,h:24,to:bedroom.id,spawn:'entry',label:'Your room'});bedroom.portals.push({id:'bedroom:exit',x:168,y:258,w:48,h:28,to:home.id,spawn:'stairs',label:'Downstairs'});
const mentor=doorway(town,'mentor_house','Trail House',480,230,6);
const rest=doorway(town,'rest_house','Rest House',800,230,0);
const shop=doorway(town,'general_store','General Store',200,450,1);
const lab=doorway(town,'alchemy_lab','Alchemy',480,450,2);
const leg=doorway(town,'gym_leg','Root Dojo',880,450,4);
const arm=doorway(town,'gym_arm','Ember Hall',200,710,5);
const back=doorway(town,'gym_back','Wind Sanctum',480,710,3);
const oak=doorway(town,'oak_house','Oak Cottage',880,710,6);
const willow=doorway(town,'willow_house','Willow Cottage',200,900,6);
const summitRest=doorway(summit,'summit_rest','Summit Rest',180,310,0);
const summitHouse=doorway(summit,'summit_house','Lookout Cottage',760,310,6);
const arena=doorway(summit,'rival_arena','Summit Arena',480,240,7);summit.portals.find(p=>p.to==='rival_arena')!.badges=3;
function resident(m:WorldMap,id:string,name:string,x:number,y:number,activity:Resident['activity'],icon:Resident['icon']){m.npcs.push({id,name,x,y,activity,icon});}
resident(town,'trainer-1','Moss',280,292,'walk','story');resident(route,'trainer-2','Pip',430,400,'train','battle');resident(route,'trainer-3','Fern',270,790,'walk','battle');
resident(rest,'healer','The healer',192,118,'stand','heal');resident(shop,'shop','Jun',192,118,'stand','shop');resident(lab,'alchemy','Mira',192,118,'cook','alchemy');
resident(leg,'leader-leg','Terra',192,118,'train','gym');resident(arm,'leader-arm','Flint',192,118,'train','gym');resident(back,'leader-back','Zephyr',192,118,'train','gym');resident(arena,'rival','Rowan',192,118,'stand','story');
resident(oak,'quest-squat','Ollie',192,118,'train','quest');resident(willow,'quest-pushup','Ada',192,118,'read','quest');resident(mentor,'quest-birddog','Noor',192,118,'read','quest');resident(summitHouse,'quest-lunge','Finn',192,118,'rest','quest');
// Rest point reuses the healer interaction; it does not create another character identity.
// Summit Rest uses its bed as a rest interaction in the renderer.
function connect(a:WorldMap,b:WorldMap,ax:number,ay:number,bx:number,by:number){a.spawns[b.id]=spawn(ax,ay-40,'up');b.spawns[a.id]=spawn(bx,by+40,'down');a.portals.push({id:`${a.id}:${b.id}`,x:ax-28,y:ay-12,w:56,h:28,to:b.id,spawn:a.id,label:b.name});b.portals.push({id:`${b.id}:${a.id}`,x:bx-28,y:by-12,w:56,h:28,to:a.id,spawn:b.id,label:a.name});}
connect(town,route,640,930,384,40);connect(route,summit,384,1110,480,40);
// Route pools and groves make two traversable alternatives around a central glade.
route.obstacles.push({x:90,y:440,w:180,h:210},{x:510,y:610,w:160,h:240});
town.spawns.safe=spawn(640,520);summit.spawns.safe=spawn(480,430);
// Detailed original foliage and landmarks have matching compact foot collisions.
function decorate(m:WorldMap,frame:number,x:number,y:number,width:number,solid=false){m.decorations.push({frame,x,y,width});if(solid)m.obstacles.push({x:x-6,y:y-9,w:12,h:10});}
for(const m of [town,route,summit]){for(let x=34;x<m.width-25;x+=48){if(!m.portals.some(p=>Math.abs(p.x+p.w/2-x)<70&&p.y<75))decorate(m,x%3?0:1,x,45,72);if(!m.portals.some(p=>Math.abs(p.x+p.w/2-x)<70&&p.y>m.height-80))decorate(m,x%3?0:1,x,m.height-7,72);}for(let y=100;y<m.height-50;y+=53){decorate(m,0,17,y,70);decorate(m,1,m.width-17,y,70);}}
for(const b of town.buildings){decorate(town,3,b.x-18,b.y+b.h-5,34);decorate(town,3,b.x+b.w+17,b.y+b.h-5,34);decorate(town,5,b.x+b.w+34,b.y+b.h+24,32);}
for(const [x,y]of [[80,325],[85,580],[355,340],[365,570],[365,830],[725,310],[735,610],[1030,340],[1040,560],[1040,830],[740,835],[95,810]])decorate(town,0,x,y,85,true);
for(const [x,y]of [[580,550],[700,550],[580,650],[700,650]])decorate(town,3,x,y,42);
decorate(town,4,640,600,70,true);decorate(town,5,565,610,42);decorate(town,5,715,610,42);
for(let y=150;y<1050;y+=98)for(const x of [75,145,600,685])decorate(route,(y+x)%3===0?1:0,x,y+(x%3)*9,80,true);
for(const [x,y]of [[240,230],[500,340],[460,540],[275,875],[510,965]])decorate(route,3,x,y,42);
decorate(route,5,480,315,42);decorate(route,6,530,980,55);
for(const [x,y]of [[90,430],[265,470],[710,460],[870,440],[280,620],[680,620]])decorate(summit,2,x,y,82,true);
decorate(summit,4,480,510,75,true);decorate(summit,5,365,500,46);decorate(summit,5,595,500,46);
export const WORLD_MAPS:Readonly<Record<string,WorldMap>>=maps;
export const initialSpawn=():WorldPosition=>({mapId:bedroom.id,...bedroom.spawns.new_game});
export function isWalkable(mapId:string,x:number,y:number,includeNPCs=true){const m=maps[mapId];return Boolean(m&&Number.isFinite(x)&&Number.isFinite(y)&&x>=20&&y>=52&&x<=m.width-20&&y<=m.height-20&&!m.obstacles.some(o=>x+6>o.x&&x-6<o.x+o.w&&y>o.y&&y-6<o.y+o.h)&&(!includeNPCs||!m.npcs.some(n=>Math.abs(n.x-x)<13&&Math.abs(n.y-y)<12)));}
export function resolveWorldPosition(p:Partial<WorldPosition>|undefined):WorldPosition{if(!p)return initialSpawn();const map=maps[p.mapId??'starter_town']??town;const facing:Facing=['down','left','right','up'].includes(p.facing??'')?p.facing!:'down';if(isWalkable(map.id,p.x!,p.y!))return {mapId:map.id,x:p.x!,y:p.y!,facing};const candidates=Object.values(map.spawns).filter(s=>isWalkable(map.id,s.x,s.y));candidates.sort((a,b)=>Math.hypot(a.x-(p.x??0),a.y-(p.y??0))-Math.hypot(b.x-(p.x??0),b.y-(p.y??0)));return {mapId:map.id,...(candidates[0]??map.spawns.safe)};}
export function resolvePortal(p:WorldPosition,portalId:string,badges:readonly string[]=[]):WorldPosition{const portal=maps[p.mapId]?.portals.find(v=>v.id===portalId);if(!portal)throw new Error('INVALID_PORTAL');if(Math.hypot(p.x-(portal.x+portal.w/2),p.y-(portal.y+portal.h/2))>64)throw new Error('PORTAL_TOO_FAR');if((portal.badges??0)>badges.length)throw new Error('RIVAL_LOCKED');return resolveWorldPosition({mapId:portal.to,...maps[portal.to].spawns[portal.spawn]});}
