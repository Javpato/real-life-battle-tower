import {useEffect,useRef,useState} from 'react';
import Phaser from 'phaser';
import type {WorldProps} from '../core/contracts';
import {WORLD_MAPS,ROOM_DETAILS,resolveWorldPosition,isWalkable,type Facing,type Resident,type Portal,type Furniture} from '../core/worldMaps';
import {paintMap} from './art';
import {ASSET_MANIFEST,assetUrl,characterArt,frameRect,type SheetId} from './assets';
import {PortalInteraction} from './portalInteraction';
import './world.css';

type ExtendedProps=Omit<WorldProps,'onTransition'>&{
 onTransition?:(id:string)=>Promise<boolean>|boolean|void;
 onInspect?:(id:string)=>void;
 tutorialStage?:number;quests?:Record<string,number>;defeated?:string[];
};
type Target={id:string;label:string;x:number;y:number;labelY:number;kind:'resident'|'portal'|'detail';resident?:Resident;portal?:Portal;furniture?:Furniture};
type ScreenAnchor={id:string;x:number;y:number};
const directions:Facing[]=['down','left','right','up'];
const icons=['heal','shop','alchemy','gym','battle','quest','story'];
const sheets:SheetId[]=['traveler','femaleWalk','battleCast','villagers','indicators','buildings','scenery','terrain','furniture'];

export default function World(props:ExtendedProps){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props);
 const labelNodes=useRef<Record<string,HTMLSpanElement|null>>({});
 const targetLabel=useRef<HTMLButtonElement>(null);
 const controls=useRef({up:false,down:false,left:false,right:false,interact:false});
 latest.current=props;
 const [nearby,setNearby]=useState<{id:string;label:string;kind:Target['kind']}|null>(null);
 const [ready,setReady]=useState(false),[loadError,setLoadError]=useState(false),[transition,setTransition]=useState(false);
 const [portalStatus,setPortalStatus]=useState('');
 const map=WORLD_MAPS[props.mapId??'starter_town']??WORLD_MAPS.starter_town;

 useEffect(()=>{
  if(!host.current)return;
  let alive=true,portalMessage='';
  const status=(message:string)=>{portalMessage=message;if(alive)setPortalStatus(message);};
  setReady(false);setNearby(null);setPortalStatus('');setTransition(true);
  const arrivalTimer=setTimeout(()=>{if(alive)setTransition(false);},200);
  class AdventureWorld extends Phaser.Scene{
   player!:Phaser.GameObjects.Sprite;keys!:Record<string,Phaser.Input.Keyboard.Key>;
   direction=0;walking=0;lastSave=0;lastInteract=-500;lastNear='';wasMoving=false;
   pending=false;wasPaused=false;interactionPending=false;portalGate=new PortalInteraction();
   anchors:ScreenAnchor[]=[];
   residents:{data:Resident;sprite:Phaser.GameObjects.Sprite;icon:Phaser.GameObjects.Image;row:number;baseScale:number}[]=[];

   doorGuide?:Phaser.GameObjects.Ellipse;
   preload(){
    for(const sheet of sheets)this.load.image(sheet,assetUrl(sheet));
    this.load.on('loaderror',()=>{if(alive)setLoadError(true);});
   }
   registerAtlas(sheet:SheetId){
    const texture=this.textures.get(sheet),source=texture.getSourceImage() as HTMLImageElement;
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
    const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(source,0,0);
    const pixels=g.getImageData(0,0,c.width,c.height).data;
    const spec=ASSET_MANIFEST.sheets[sheet];
    for(let i=0;i<spec.columns*spec.rows;i++){
     const f=frameRect(sheet,i);let l=f.width,t=f.height,r=-1,b=-1;
     for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)if(pixels[((f.y+y)*c.width+f.x+x)*4+3]>128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
     if(r<0){l=0;t=0;r=f.width-1;b=f.height-1;}
     texture.add(i,0,f.x+l,f.y+t,r-l+1,b-t+1);
    }
   }
   create(){
    for(const sheet of sheets)this.registerAtlas(sheet);
    this.textures.addCanvas('ground',paintMap(map,this.textures.get('terrain').getSourceImage() as HTMLImageElement));
    this.add.image(0,0,'ground').setOrigin(0);
    map.buildings.forEach((b,index)=>{
     const image=this.add.image(b.x+b.w/2,b.y+b.h,'buildings',b.frame).setOrigin(.5,1).setDepth(b.y+b.h-15);
     image.setScale(b.w/image.width);
     this.anchors.push({id:`building-${index}`,x:image.x,y:image.y-image.displayHeight-7});
    });
    for(const item of map.furniture){
     const image=this.add.image(item.x,item.y,'furniture',item.frame).setOrigin(.5,1).setDepth(item.y);
     image.setScale(item.width/image.width);
     if(item.detailId||item.action)image.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
      const target=this.detailTarget(item);
      if(this.player&&Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y)<46)void this.interact(target);
     });
    }
    for(const d of map.decorations){const image=this.add.image(d.x,d.y,'scenery',d.frame).setOrigin(.5,1).setDepth(d.y);image.setScale(d.width/image.width);}
    if(map.id==='starter_house_bedroom'){this.doorGuide=this.add.ellipse(192,248,26,11,0xe9d083,.24).setStrokeStyle(2,0xf6e0a2,.85).setDepth(1);this.tweens.add({targets:this.doorGuide,alpha:.35,scaleX:1.15,scaleY:1.15,duration:900,yoyo:true,repeat:-1});}
    for(const portal of map.portals){const x=portal.x+portal.w/2,y=portal.y+portal.h/2;this.add.rectangle(x,y,portal.w-8,4,0xe5c782,.65).setDepth(y-1);}
    for(const resident of map.npcs){
     const art=characterArt(resident.id);
     const sprite=this.add.sprite(resident.x,resident.y,art.sheet,art.frame).setOrigin(.5,1).setDepth(resident.y).setInteractive({useHandCursor:true});
     const baseScale=40/sprite.height;sprite.setScale(baseScale);
     const icon=this.add.image(resident.x,resident.y-46,'indicators',icons.indexOf(resident.icon)).setOrigin(.5).setDepth(resident.y+1);
     sprite.on('pointerdown',()=>{if(this.player&&Phaser.Math.Distance.Between(this.player.x,this.player.y,sprite.x,sprite.y)<48)void this.interact(this.residentTarget(resident,sprite));});
     this.residents.push({data:resident,sprite,icon,row:art.frame,baseScale});
     if(['read','cook','rest'].includes(resident.activity)){
      const g=this.add.graphics();g.fillStyle(resident.activity==='cook'?0x483f3e:0xe5d4a1);g.fillRect(-8,-14,16,9);g.lineStyle(1,0x725947);g.lineBetween(0,-14,0,-5);
      const prop=this.add.container(resident.x,resident.y,[g]).setDepth(resident.y+2);
      if(resident.activity==='cook'){const steam=this.add.rectangle(0,-20,2,3,0xf2e5be,.5);prop.add(steam);this.tweens.add({targets:steam,y:-27,alpha:0,duration:1500,repeat:-1});}
     }
    }
    const position=resolveWorldPosition({mapId:map.id,...latest.current.position,facing:latest.current.facing});
    this.direction=directions.indexOf(position.facing);
    this.player=this.add.sprite(position.x,position.y,latest.current.avatar==='female'?'femaleWalk':'traveler',this.direction*4).setOrigin(.5,1).setDepth(position.y);
    this.player.setScale(40/this.player.height);
    this.cameras.main.setBounds(0,0,map.width,map.height).startFollow(this.player,true,.15,.15).setRoundPixels(true);
    const resize=()=>{
     const w=this.scale.width,h=this.scale.height,camera=this.cameras.main;
     camera.setZoom(map.kind==='interior'?Math.max(1,Math.min(w/420,h/310)):Math.max(1.4,Math.min(w/540,h/340)));
     if(map.kind==='interior'){camera.stopFollow();camera.removeBounds();camera.centerOn(map.width/2,map.height/2);}
    };
    resize();this.scale.on('resize',resize);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ENTER,SHIFT',false) as Record<string,Phaser.Input.Keyboard.Key>;
    const queue=(event:KeyboardEvent)=>{
     const target=event.target;
     const editing=target instanceof HTMLElement&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||(target.tagName==='BUTTON'&&event.key==='Enter'));
     if(!latest.current.paused&&!event.repeat&&!editing)this.pending=true;
    };
    this.input.keyboard!.on('keydown-E',queue);this.input.keyboard!.on('keydown-ENTER',queue);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.scale.off('resize',resize);this.input.keyboard?.off('keydown-E',queue);this.input.keyboard?.off('keydown-ENTER',queue);});
    if(alive)setReady(true);
   }
   residentTarget(data:Resident,sprite:Phaser.GameObjects.Sprite):Target{return {id:data.id,label:data.name,x:sprite.x,y:sprite.y,labelY:sprite.y-58,kind:'resident',resident:data};}
   portalTarget(portal:Portal):Target{return {id:portal.id,label:portal.label,x:portal.x+portal.w/2,y:portal.y+portal.h/2,labelY:portal.y-12,kind:'portal',portal};}
   detailTarget(item:Furniture):Target{return {id:item.detailId??item.id,label:item.action==='heal'?'Rest and recover':ROOM_DETAILS[item.detailId??'']?.title??'Look closer',x:item.x,y:item.footprint.y+item.footprint.h+15,labelY:item.y-35,kind:'detail',furniture:item};}
   save(){
    if(this.portalGate.pending||this.interactionPending||latest.current.paused)return;
    const position={x:Math.round(this.player.x),y:Math.round(this.player.y),facing:directions[this.direction]};
    if(latest.current.onPosition)latest.current.onPosition(position);else latest.current.onMove?.(position);
   }
   async interact(target:Target){
    if(latest.current.paused||this.portalGate.pending||this.time.now-this.lastInteract<350)return;
    if(target.portal&&this.portalGate.latchedId===target.id)return;
    this.lastInteract=this.time.now;this.pending=false;controls.current.interact=false;
    this.save();this.wasMoving=false;
    if(target.portal){
     status('Entering…');
     const accepted=await this.portalGate.request(target.id,async()=>{
      if((target.portal!.badges??0)>latest.current.badges.length)return false;
      return (await latest.current.onTransition?.(target.id))===true;
     });
     if(!alive)return;
     if(accepted){setTransition(true);status('');}
     else {status((target.portal.badges??0)>latest.current.badges.length?'The arena needs all three badges. You can still explore.':'The doorway is unavailable. Step away to try again.');this.wasMoving=false;this.save();}
     return;
    }
    this.interactionPending=true;this.input.keyboard?.resetKeys();
    if(target.furniture?.action==='heal')latest.current.onInteract('healer');
    else if(target.furniture?.detailId)latest.current.onInspect?.(target.furniture.detailId);
    else latest.current.onInteract(target.id);
   }
   positionLabel(node:HTMLElement|null|undefined,x:number,y:number,context=false){
    if(!node)return;
    const camera=this.cameras.main,point={x:(x-camera.worldView.x)*camera.zoom+camera.x,y:(y-camera.worldView.y)*camera.zoom+camera.y};
    const visible=point.x>0&&point.x<this.scale.width&&point.y>40&&point.y<this.scale.height-30;
    node.style.visibility=visible?'visible':'hidden';
    node.style.left=`${Math.round(Math.max(100,Math.min(this.scale.width-100,point.x)))}px`;
    node.style.top=`${Math.round(context?Math.min(this.scale.height-115,Math.max(60,point.y)):point.y)}px`;
   }
   update(time:number,delta:number){
    if(!this.player)return;
    this.doorGuide?.setVisible((latest.current.tutorialStage??6)===0);
    const focus=document.activeElement;
    const typing=focus instanceof HTMLElement&&(['INPUT','TEXTAREA','SELECT'].includes(focus.tagName)||focus.isContentEditable);
    if(latest.current.paused||(this.interactionPending&&time-this.lastInteract>1200))this.interactionPending=false;
    const paused=latest.current.paused||typing||this.interactionPending;
    if(paused||this.wasPaused){this.pending=false;controls.current.interact=false;this.input.keyboard?.resetKeys();}
    this.wasPaused=paused;
    let dx=0,dy=0;
    if(!paused){dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown||controls.current.right)-Number(this.keys.A.isDown||this.keys.LEFT.isDown||controls.current.left);dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown||controls.current.down)-Number(this.keys.W.isDown||this.keys.UP.isDown||controls.current.up);}
    const free=(x:number,y:number)=>isWalkable(map.id,x,y,false)&&!this.residents.some(n=>Math.abs(n.sprite.x-x)<13&&Math.abs(n.sprite.y-y)<12);
    if(dx||dy){
     if(document.activeElement instanceof HTMLButtonElement)document.activeElement.blur();
     const distance=(this.keys.SHIFT.isDown?132:78)*Math.min(delta,45)/1000/Math.hypot(dx,dy);
     if(free(this.player.x+dx*distance,this.player.y))this.player.x+=dx*distance;
     if(free(this.player.x,this.player.y+dy*distance))this.player.y+=dy*distance;
     this.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);this.walking+=delta;
    }
    this.player.setFrame(this.direction*4+(dx||dy?Math.floor(this.walking/145)%4:0)).setDepth(this.player.y);
    if((time-this.lastSave>1200&&(dx||dy))||(this.wasMoving&&!dx&&!dy)){this.lastSave=time;this.save();}this.wasMoving=Boolean(dx||dy);
    const latched=map.portals.find(p=>p.id===this.portalGate.latchedId);
    const inside=Boolean(latched&&this.player.x>=latched.x-9&&this.player.x<=latched.x+latched.w+9&&this.player.y>=latched.y-9&&this.player.y<=latched.y+latched.h+9);
    this.portalGate.leaveThreshold(inside);
    if(!this.portalGate.latchedId&&portalMessage)status('');
    let nearest:Target|undefined,dist=48;
    for(const n of this.residents){
     const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,n.sprite.x,n.sprite.y),walking=n.data.activity==='walk'&&!paused&&d>65;
     if(walking){n.sprite.x=n.data.x+Math.sin(time/1700+n.data.x)*18;n.sprite.setFlipX(Math.cos(time/1700+n.data.x)<0);n.sprite.y=n.data.y+Math.sin(time/130)*1.1;n.sprite.setAngle(Math.sin(time/230)*2);}
     else if(d<65){n.sprite.setFlipX(this.player.x<n.sprite.x);n.sprite.setAngle(0);n.sprite.y=n.data.y;}
     else{n.sprite.setFrame(n.row);n.sprite.y=n.data.y+(n.data.activity==='train'?Math.sin(time/450)*2:0);n.sprite.setScale(n.baseScale,n.baseScale*(1+Math.sin(time/(n.data.activity==='train'?450:1400))*.018));n.sprite.setAngle(n.data.activity==='read'?Math.sin(time/1800)*2:0);}
     n.sprite.setDepth(n.sprite.y);n.icon.setPosition(n.sprite.x,n.sprite.y-46+Math.sin(time/700)*1.5).setDepth(n.sprite.y+1);
     n.icon.setVisible(!latest.current.defeated?.includes(n.data.id)&&!(n.data.icon==='quest'&&(latest.current.quests?.[n.data.id.replace('quest-','')]??0)>0));
     if(d<dist){nearest=this.residentTarget(n.data,n.sprite);dist=d;}
    }
    for(const item of map.furniture){const target=this.detailTarget(item),d=Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y);if(d<Math.min(dist,36)&&nearest?.kind!=='resident'){nearest=target;dist=d;}}
    for(const portal of map.portals){const target=this.portalTarget(portal),d=Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y);if(d<dist){nearest=target;dist=d;}}
    const id=nearest?.id??'';
    if(id!==this.lastNear){this.lastNear=id;if(alive)setNearby(nearest?{id:nearest.id,label:nearest.label,kind:nearest.kind}:null);}
    for(const anchor of this.anchors){const node=labelNodes.current[anchor.id];this.positionLabel(node,anchor.x,anchor.y);if(node&&nearest?.kind==='portal'&&map.buildings[Number(anchor.id.split('-')[1])]?.name===nearest.label)node.style.visibility='hidden';}
    if(nearest){
     this.positionLabel(targetLabel.current,nearest.x,nearest.labelY,true);
     const portal=nearest.portal,entering=portal&&time>800&&(dx||dy)&&this.player.x>=portal.x&&this.player.x<=portal.x+portal.w&&this.player.y>=portal.y&&this.player.y<=portal.y+portal.h;
     if(!paused&&(this.pending||controls.current.interact||entering))void this.interact(nearest);
    }else{this.pending=false;controls.current.interact=false;}
   }
  }
  const game=new Phaser.Game({type:Phaser.CANVAS,parent:host.current,width:host.current.clientWidth,height:host.current.clientHeight,pixelArt:true,roundPixels:true,backgroundColor:'#263c38',antialias:false,scene:AdventureWorld,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},input:{activePointers:3}});
  const observer=new ResizeObserver(entries=>{const b=entries[0]?.contentRect;if(b?.width&&b.height)game.scale.resize(Math.round(b.width),Math.round(b.height));});observer.observe(host.current);
  const clear=()=>{controls.current={up:false,down:false,left:false,right:false,interact:false};};window.addEventListener('blur',clear);
  return()=>{alive=false;clearTimeout(arrivalTimer);observer.disconnect();window.removeEventListener('blur',clear);game.destroy(true);};
 },[map.id,props.avatar]);
 useEffect(()=>{if(props.paused)controls.current={up:false,down:false,left:false,right:false,interact:false};},[props.paused]);
 const hold=(direction:'up'|'down'|'left'|'right')=>({onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);controls.current[direction]=true;},onPointerUp:()=>{controls.current[direction]=false;},onPointerCancel:()=>{controls.current[direction]=false;},onLostPointerCapture:()=>{controls.current[direction]=false;}});
 return <div className="adventure-world" aria-label="Everstride game world" data-map-id={map.id}>
  <div ref={host} className="world-canvas"/>
  <div className="world-label-layer" aria-hidden={props.paused} style={{visibility:props.paused?'hidden':undefined}}>
   {map.buildings.map((building,index)=><span className="world-map-label" ref={node=>{labelNodes.current[`building-${index}`]=node;}} key={`building-${index}`}>{building.name}</span>)}
   {nearby&&!props.paused&&<button ref={targetLabel} data-guide={nearby.kind==='portal'?'world-door':undefined} className="world-nearby-label" onClick={()=>{controls.current.interact=true;}}><kbd>E</kbd><span>{nearby.label}</span></button>}
  </div>
  <div className="world-region-label"><span>{map.region}</span><strong>{map.name}</strong></div>
  {!ready&&<div className="world-loading">{loadError?'Artwork could not load. Please reconnect and reload.':'Opening the world…'}</div>}
  {!props.paused&&<>
   <div className="world-touch-pad" data-guide="world-move"><span/><button aria-label="Move up" {...hold('up')}>↑</button><span/><button aria-label="Move left" {...hold('left')}>←</button><button aria-label="Move down" {...hold('down')}>↓</button><button aria-label="Move right" {...hold('right')}>→</button></div>
   <button className="world-interact" data-guide="world-interact" disabled={!nearby} onClick={()=>{controls.current.interact=true;}}>{nearby?`${nearby.kind==='detail'?'Inspect':'Interact'} · ${nearby.label}`:'WASD / arrows · Shift to run'}</button>
  </>}
  {portalStatus&&<div className="world-portal-status" role="status">{portalStatus}</div>}
  <div className="world-arrival" aria-hidden="true" style={{opacity:transition?1:0}}/>
 </div>;
}
