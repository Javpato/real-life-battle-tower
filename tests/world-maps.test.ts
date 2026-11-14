import {describe,it,expect} from 'vitest';
import {WORLD_MAPS,initialSpawn,isWalkable,resolveWorldPosition,resolvePortal} from '../src/core/worldMaps';
describe('persistent world maps',()=>{
 it('has three connected exteriors and fourteen interiors',()=>{expect(Object.values(WORLD_MAPS).filter(m=>m.kind!=='interior')).toHaveLength(3);expect(Object.values(WORLD_MAPS).filter(m=>m.kind==='interior')).toHaveLength(14);expect(initialSpawn()).toEqual({mapId:'starter_house_bedroom',x:192,y:144,facing:'down'});});
 it('all named spawn points are safe and all portals lead to real safe spawns',()=>{for(const m of Object.values(WORLD_MAPS)){for(const s of Object.values(m.spawns))expect(isWalkable(m.id,s.x,s.y),m.id+JSON.stringify(s)).toBe(true);for(const p of m.portals){const target=WORLD_MAPS[p.to];expect(target,p.id).toBeDefined();expect(target.spawns[p.spawn],p.id).toBeDefined();expect(isWalkable(target.id,target.spawns[p.spawn].x,target.spawns[p.spawn].y),p.id).toBe(true);expect(target.portals.some(q=>q.to===m.id),p.id+' reciprocal exit').toBe(true);}}});
 it('each portal can be reached on foot from the safe spawn',()=>{for(const m of Object.values(WORLD_MAPS)){const start=m.spawns.safe;const queue=[start];const visited=new Set<string>();const reached=new Set<string>();for(let i=0;i<queue.length;i++){const p=queue[i];for(const portal of m.portals)if(Math.hypot(p.x-portal.x-portal.w/2,p.y-portal.y-portal.h/2)<40)reached.add(portal.id);for(const [dx,dy]of[[8,0],[-8,0],[0,8],[0,-8]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(!visited.has(key)&&isWalkable(m.id,x,y)){visited.add(key);queue.push({x,y,facing:'down'});}}}expect([...m.portals.filter(p=>!reached.has(p.id)).map(p=>p.id)],m.id).toEqual([]);}});
 it('keeps a valid saved position and repairs invalid/legacy positions',()=>{expect(resolveWorldPosition({mapId:'training_route',x:384,y:300,facing:'left'})).toEqual({mapId:'training_route',x:384,y:300,facing:'left'});for(const p of[{mapId:'gone',x:-100,y:Infinity},{mapId:'starter_house',x:40,y:60},{x:383,y:262}]){const v=resolveWorldPosition(p);expect(isWalkable(v.mapId,v.x,v.y)).toBe(true);}});
 it('blocks remote or locked arena transitions',()=>{const p=WORLD_MAPS.rival_town.portals.find(p=>p.to==='rival_arena')!;const at={mapId:'rival_town',x:p.x+p.w/2,y:p.y+p.h/2,facing:'up' as const};expect(()=>resolvePortal(at,p.id,[])).toThrow('RIVAL_LOCKED');expect(resolvePortal(at,p.id,['leg','arm','back']).mapId).toBe('rival_arena');expect(()=>resolvePortal({...at,x:30,y:700},p.id,['leg','arm','back'])).toThrow('PORTAL_TOO_FAR');});
});

describe('distinct furnished interiors',()=>{
 it('renders and collides from the same furniture records, with a unique layout in every room',()=>{
  const rooms=Object.values(WORLD_MAPS).filter(m=>m.kind==='interior');
  const shapes=rooms.map(m=>JSON.stringify(m.furniture.map(f=>[f.frame,f.x,f.y,f.width])));
  expect(new Set(shapes).size).toBe(14);
  for(const room of rooms){expect(room.furniture.length).toBeGreaterThanOrEqual(3);expect(room.roomStyle).toBeDefined();for(const f of room.furniture){expect(room.obstacles).toContainEqual(f.footprint);expect(f.width).toBeGreaterThan(0);expect(f.detailId).toBeTruthy();}for(const npc of room.npcs)expect(isWalkable(room.id,npc.x,npc.y,false),room.id+' '+npc.id).toBe(true);}
 });
 it('can reach every resident and inspectable furnishing from the entry door',()=>{
  for(const map of Object.values(WORLD_MAPS).filter(m=>m.kind==='interior')){
   const start=map.spawns.entry,queue=[start],visited=new Set<string>(),reached=new Set<string>();
   const targets=[...map.npcs.map(n=>({id:n.id,x:n.x,y:n.y})),...map.furniture.map(f=>({id:f.id,x:f.x,y:f.footprint.y+f.footprint.h+15}))];
   for(let i=0;i<queue.length;i++){const p=queue[i];for(const target of targets)if(Math.hypot(p.x-target.x,p.y-target.y)<34)reached.add(target.id);for(const [dx,dy]of[[8,0],[-8,0],[0,8],[0,-8]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(!visited.has(key)&&isWalkable(map.id,x,y)){visited.add(key);queue.push({x,y,facing:'down'});}}}
   expect(targets.filter(t=>!reached.has(t.id)).map(t=>t.id),map.id).toEqual([]);
  }
 });
});

describe('ordered exterior streets',()=>{
 it('connects every exterior doorway and route opening using the actual road network',()=>{
  for(const m of Object.values(WORLD_MAPS).filter(m=>m.kind!=='interior')){
   const roads=m.ground.filter(r=>r.kind==='road'||r.kind==='plaza');
   const onRoad=(x:number,y:number)=>roads.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)&&isWalkable(m.id,x,y);
   const start=Object.values(m.spawns).find(p=>onRoad(p.x,p.y))!;expect(start,m.id).toBeDefined();
   const queue=[start],visited=new Set<string>(),reached=new Set<string>();
   for(let i=0;i<queue.length;i++){const p=queue[i];for(const door of m.portals)if(Math.hypot(p.x-door.x-door.w/2,p.y-door.y-door.h/2)<40)reached.add(door.id);
    for(const [dx,dy]of[[8,0],[-8,0],[0,8],[0,-8]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(!visited.has(key)&&onRoad(x,y)){visited.add(key);queue.push({x,y,facing:'down'});}}
   }
   expect(m.portals.filter(p=>!reached.has(p.id)).map(p=>p.id),m.id).toEqual([]);
  }
 });
 it('keeps water visible and collidable, with consistent exterior building footprints',()=>{
  for(const m of Object.values(WORLD_MAPS).filter(m=>m.kind!=='interior')){
   for(const r of m.ground.filter(r=>r.kind==='water')){expect(m.obstacles).toContainEqual({x:r.x,y:r.y,w:r.w,h:r.h});expect(isWalkable(m.id,r.x+r.w/2,r.y+r.h/2)).toBe(false);}
   for(const b of m.buildings){expect(b.w).toBe(128);expect(b.h).toBe(104);}
  }
 });
 it('repairs saved coordinates from the previous larger layouts without changing map identity',()=>{
  for(const old of [{mapId:'starter_town',x:1040,y:830},{mapId:'starter_town',x:200,y:932},{mapId:'training_route',x:384,y:1070},{mapId:'rival_town',x:760,y:342}]){
   const next=resolveWorldPosition({...old,facing:'left'});expect(next.mapId).toBe(old.mapId);expect(isWalkable(next.mapId,next.x,next.y)).toBe(true);
  }
 });
});
