import {useEffect,useRef,useState} from 'react';
import Phaser from 'phaser';
import type {WorldProps} from '../core/contracts';
import {buildings,createWorldArt,MAP_W,MAP_H,type Obstacle} from './art';

import {ASSET_MANIFEST,assetUrl,characterArt,frameRect,type SheetId} from './assets';

type Villager={id:string;name:string;x:number;y:number;color:string;hat?:string;symbol:string};
const villagers:Villager[]=[
 {id:'healer',name:'Rest House · free healing',x:110,y:187,color:'#f0e6c9',hat:'#df796d',symbol:'+'},
 {id:'shop',name:'Jun · general store',x:291,y:179,color:'#d9ad61',hat:'#ad7e4e',symbol:'$'},
 {id:'alchemy',name:'Mira · alchemy laboratory',x:120,y:328,color:'#ac94cf',hat:'#8b75ad',symbol:'✧'},
 {id:'leader-leg',name:'Terra · Root Dojo',x:132,y:483,color:'#c48c60',symbol:'I'},
 {id:'leader-arm',name:'Flint · Ember Hall',x:615,y:465,color:'#d57f89',symbol:'II'},
 {id:'leader-back',name:'Zephyr · Wind Sanctum',x:610,y:202,color:'#80b4c0',symbol:'III'},
 {id:'rival',name:'Rowan · the final challenge',x:384,y:106,color:'#77728e',hat:'#424d61',symbol:'★'},
 {id:'trainer-1',name:'Moss · first steps',x:426,y:338,color:'#e6b363',symbol:'!'},
 {id:'trainer-2',name:'Pip · riverside trainer',x:279,y:411,color:'#8ab9b2',symbol:'!'},
 {id:'trainer-3',name:'Fern · garden trainer',x:532,y:275,color:'#be8fa4',symbol:'!'},
 {id:'quest-squat',name:'Ollie · squat challenge',x:193,y:202,color:'#a4bc6d',symbol:'?'},
 {id:'quest-pushup',name:'Ada · push-up challenge',x:548,y:349,color:'#c58a74',symbol:'?'},
 {id:'quest-birddog',name:'Noor · balance challenge',x:464,y:221,color:'#b69aca',symbol:'?'},
 {id:'quest-lunge',name:'Finn · lunge challenge',x:218,y:352,color:'#79abb1',symbol:'?'},
];
const initialPosition={x:383,y:262};

export default function World(props:WorldProps){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),controls=useRef({up:false,down:false,left:false,right:false,interact:false});latest.current=props;
 const [nearby,setNearby]=useState<string|null>(null),[ready,setReady]=useState(false),[loadError,setLoadError]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  let alive=true;
  class Village extends Phaser.Scene{
   player!:Phaser.GameObjects.Sprite;keys!:Record<string,Phaser.Input.Keyboard.Key>;obstacles:Obstacle[]=[];direction=0;walking=0;lastSave=0;lastNear='';lastInteract=-500;wasMoving=false;pendingInteract=false;wasPaused=false;
   marker!:Phaser.GameObjects.Text;gate!:Phaser.GameObjects.Text;
   preload(){
    for(const sheet of ['traveler','battleCast','villagers','buildings','scenery','terrain'] as SheetId[])this.load.image(sheet,assetUrl(sheet));
    this.load.on('loaderror',()=>{if(alive)setLoadError(true);});
   }
   registerAtlas(sheet:SheetId){
    const texture=this.textures.get(sheet),source=texture.getSourceImage() as HTMLImageElement,s=ASSET_MANIFEST.sheets[sheet];
    const canvas=document.createElement('canvas');canvas.width=s.width;canvas.height=s.height;const g=canvas.getContext('2d',{willReadFrequently:true})!;g.drawImage(source,0,0);
    const pixels=g.getImageData(0,0,s.width,s.height).data;
    for(let i=0;i<s.columns*s.rows;i++){
     const f=frameRect(sheet,i);let left=f.width,top=f.height,right=0,bottom=0;
     // Ignore almost-transparent background dust when finding the visual foot anchor.
     for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)if(pixels[((f.y+y)*s.width+f.x+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
     const pad=2;left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(f.width-1,right+pad);bottom=Math.min(f.height-1,bottom+pad);
     texture.add(i,0,f.x+left,f.y+top,right-left+1,bottom-top+1);
    }
   }
   scenery(sheet:SheetId,frame:number,x:number,y:number,width:number){
    const image=this.add.image(x,y,sheet,frame).setOrigin(.5,1).setDepth(y);image.setScale(width/image.width);return image;
   }
   create(){
    if(!this.textures.exists('terrain'))return;
    for(const sheet of ['traveler','battleCast','villagers','buildings','scenery'] as SheetId[])this.registerAtlas(sheet);
    const art=createWorldArt(this.textures.get('terrain').getSourceImage() as HTMLImageElement);this.obstacles=art.obstacles;
    this.textures.addCanvas('village',art.canvas);this.add.image(0,0,'village').setOrigin(0).setScale(.5);
    buildings.forEach(b=>{this.scenery('buildings',b.frame,b.x+b.w/2,b.y+b.h,b.w+12);if(b.name)this.add.text(b.x+b.w/2,b.y+b.h+7,b.name,{fontFamily:'monospace',fontSize:'7px',color:'#fff1cf',backgroundColor:'#344a3ce8',padding:{x:3,y:2}}).setOrigin(.5).setDepth(b.y+b.h+1);});
    art.trees.forEach((t,i)=>{const nearPerson=villagers.some(v=>Math.abs(v.x-t.x)<27&&Math.abs(v.y-t.y)<8);this.scenery('scenery',i%11===0?2:i%5===0?1:0,t.x,t.y,nearPerson?27:i%5===0?39:46);});
    for(const [x,y] of [[313,246],[447,246],[312,349],[448,349],[180,287],[685,419]])this.scenery('scenery',3,x,y,28);
    for(const [x,y] of [[283,280],[456,329],[194,344],[554,333]])this.scenery('scenery',5,x,y,30);
    this.scenery('scenery',6,271,267,44);this.scenery('buildings',7,384,99,84);
    villagers.forEach(v=>{
      const a=characterArt(v.id);const sprite=this.add.sprite(v.x,v.y,a.sheet,a.frame).setOrigin(.5,1).setDepth(v.y).setInteractive({useHandCursor:true});sprite.setScale((v.id==='rival'?39:35)/sprite.height);
      sprite.on('pointerdown',()=>{if(!latest.current.paused&&Phaser.Math.Distance.Between(this.player.x,this.player.y,v.x,v.y)<42)this.interact(v);});
      const icon=this.add.text(v.x,v.y-43,v.symbol,{fontFamily:'monospace',fontSize:'8px',color:v.symbol==='?'?'#ffebaf':'#fff0cf',backgroundColor:'#354d4c',padding:{x:3,y:2}}).setOrigin(.5).setDepth(v.y+1);
      this.tweens.add({targets:icon,y:icon.y-2,duration:1100+v.x,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    });
    this.scenery('scenery',4,384,298,46);
    const glimmer=this.add.ellipse(384,277,12,3,0xd2f6e5,.4).setDepth(299);this.tweens.add({targets:glimmer,alpha:.1,duration:1100,yoyo:true,repeat:-1});
    this.obstacles.push({x:368,y:281,w:32,h:17});
    const start=latest.current.position??initialPosition;
    const sx=Number.isFinite(start.x)?Phaser.Math.Clamp(start.x,36,MAP_W-36):initialPosition.x;
    const sy=Number.isFinite(start.y)?Phaser.Math.Clamp(start.y,46,MAP_H-30):initialPosition.y;
    const usable=this.canMove(sx,sy)?{x:sx,y:sy}:initialPosition;
    this.player=this.add.sprite(usable.x,usable.y,'traveler',0).setOrigin(.5,1).setDepth(usable.y);this.player.setScale(36/this.player.height);
    this.cameras.main.setBounds(0,0,MAP_W,MAP_H).startFollow(this.player,true,.12,.12).setRoundPixels(true);
    const resizeView=()=>{const width=this.scale.width,height=this.scale.height;const immersive=Boolean(host.current?.closest('.immersive-game'));const zoom=immersive?Math.max(width<600?width/320:2,width/MAP_W,height/MAP_H):2;this.cameras.main.setZoom(zoom);};resizeView();this.scale.on('resize',resizeView);this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.scale.off('resize',resizeView));
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ENTER,SHIFT',false) as Record<string,Phaser.Input.Keyboard.Key>;
    // Persist a press until the next scene update: a key released between frames still counts.
    const queueInteraction=(event:KeyboardEvent)=>{const target=event.target;const editing=target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName));if(!latest.current.paused&&!editing&&!event.repeat&&!event.isComposing)this.pendingInteract=true;};
    this.input.keyboard!.on('keydown-E',queueInteraction);this.input.keyboard!.on('keydown-ENTER',queueInteraction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.input.keyboard?.off('keydown-E',queueInteraction);this.input.keyboard?.off('keydown-ENTER',queueInteraction);this.pendingInteract=false;});
    this.marker=this.add.text(0,0,'',{fontFamily:'monospace',fontSize:'8px',color:'#fff3d6',backgroundColor:'#354f48',padding:{x:5,y:4}}).setOrigin(.5,1).setDepth(10000);
    this.gate=this.add.text(384,41,'THE SUMMIT',{fontFamily:'monospace',fontSize:'9px',color:'#f6e4ad',backgroundColor:'#48674f',padding:{x:6,y:4}}).setOrigin(.5).setDepth(5);
    // Quiet firefly / pollen accents, kept behind interface.
    for(let i=0;i<12;i++){const spark=this.add.rectangle(60+i*59,180+(i*47)%330,1,1,0xffeac0,.5).setDepth(900);this.tweens.add({targets:spark,y:spark.y-18,x:spark.x+9,alpha:0,duration:3600+i*173,repeat:-1,yoyo:true});}
    if(alive)setReady(true);
   }
   canMove(x:number,y:number){return x>30&&x<MAP_W-30&&y>41&&y<MAP_H-19&&!this.obstacles.some(o=>x+5>o.x&&x-5<o.x+o.w&&y>o.y&&y-5<o.y+o.h);}
   interact(v:Villager){this.pendingInteract=false;controls.current.interact=false;if(latest.current.paused||this.time.now-this.lastInteract<500)return;this.lastInteract=this.time.now;latest.current.onMove?.({x:this.player.x,y:this.player.y});latest.current.onInteract(v.id);}
   update(time:number,delta:number){
    if(!this.player)return;
    const focus=document.activeElement;const typing=focus instanceof HTMLInputElement||focus instanceof HTMLTextAreaElement||focus instanceof HTMLSelectElement||(focus instanceof HTMLElement&&focus.isContentEditable);
    const paused=latest.current.paused||typing;
    if(paused||this.wasPaused){this.pendingInteract=false;controls.current.interact=false;this.input.keyboard?.resetKeys();}
    this.wasPaused=paused;
    let dx=0,dy=0;
    if(!paused){dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown||controls.current.right)-Number(this.keys.A.isDown||this.keys.LEFT.isDown||controls.current.left);dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown||controls.current.down)-Number(this.keys.W.isDown||this.keys.UP.isDown||controls.current.up);}
    if(dx||dy){const running=this.keys.SHIFT.isDown;const distance=(running?132:78)*Math.min(delta,45)/1000/Math.hypot(dx,dy);const nx=this.player.x+dx*distance,ny=this.player.y+dy*distance;if(this.canMove(nx,this.player.y))this.player.x=nx;if(this.canMove(this.player.x,ny))this.player.y=ny;this.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);this.walking+=delta;this.player.setFrame(this.direction*4+Math.floor(this.walking/(running?95:145))%4);}
    else this.player.setFrame(this.direction*4);
    this.player.setDepth(this.player.y);
    if((time-this.lastSave>1200&&(dx||dy))||(this.wasMoving&&!dx&&!dy)){this.lastSave=time;latest.current.onMove?.({x:Math.round(this.player.x),y:Math.round(this.player.y)});}
    this.wasMoving=Boolean(dx||dy);
    let nearest:Villager|undefined;let dist=42;
    for(const v of villagers){const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,v.x,v.y);if(d<dist){dist=d;nearest=v;}}
    const nearId=nearest?.id??'';
    if(nearId!==this.lastNear){this.lastNear=nearId;if(alive)setNearby(nearest?.name??null);}
    this.marker.setVisible(Boolean(nearest)&&!paused);
    if(nearest){this.marker.setPosition(nearest.x,nearest.y-54).setText('[E] '+nearest.name.split(' · ')[0]);if(!paused&&(this.pendingInteract||controls.current.interact))this.interact(nearest);}
    if(!nearest){this.pendingInteract=false;controls.current.interact=false;}
    this.gate.setText(latest.current.badges.length>=3?'THE SUMMIT · OPEN':'THE SUMMIT · 3 BADGES');
   }
  }
  const immersive=Boolean(host.current.closest('.immersive-game'));
  const game=new Phaser.Game({type:Phaser.AUTO,parent:host.current,width:immersive?host.current.clientWidth:960,height:immersive?host.current.clientHeight:540,pixelArt:true,roundPixels:true,backgroundColor:'#79a66c',antialias:false,scene:Village,scale:{mode:immersive?Phaser.Scale.RESIZE:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},input:{activePointers:3}});
  const observer=immersive?new ResizeObserver(entries=>{const box=entries[0]?.contentRect;if(box&&box.width>0&&box.height>0)game.scale.resize(Math.round(box.width),Math.round(box.height));}):null;observer?.observe(host.current);
  const clear=()=>{controls.current={up:false,down:false,left:false,right:false,interact:false};};
  window.addEventListener('blur',clear);
  return()=>{alive=false;observer?.disconnect();window.removeEventListener('blur',clear);game.destroy(true);};
 },[]);
 useEffect(()=>{if(props.paused)controls.current={up:false,down:false,left:false,right:false,interact:false};},[props.paused]);
 const hold=(direction:'up'|'down'|'left'|'right')=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);controls.current[direction]=true;},onPointerUp:()=>{controls.current[direction]=false;},onPointerCancel:()=>{controls.current[direction]=false;},onLostPointerCapture:()=>{controls.current[direction]=false;}});
 const buttonStyle:React.CSSProperties={width:35,height:35,border:'1px solid #f5e7be55',borderRadius:8,color:'#fff3cf',background:'#344e47dd',fontSize:16,touchAction:'none',cursor:'pointer',boxShadow:'0 2px 0 #203b35'};
 return <div aria-label="Everstride village game world" style={{width:'100%',height:'100%',minHeight:320,position:'relative',overflow:'hidden',background:'#345647',isolation:'isolate'}}>
  <div ref={host} style={{width:'100%',height:'100%',minHeight:320,imageRendering:'pixelated'}}/>
  <div className="world-region-label" style={{position:'absolute',left:16,top:14,pointerEvents:'none',color:'#fff1cd',textShadow:'0 2px #324c40',fontFamily:'monospace',fontSize:11,letterSpacing:2}}><span style={{fontSize:9,opacity:.8}}>GREENHAVEN VALLEY</span><br/><strong style={{fontSize:15,letterSpacing:1}}>Willowmere</strong></div>
  {!ready&&<div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',color:'#f6e7c1'}}>{loadError?'Artwork could not load. Please reload when connected.':'Opening the village…'}</div>}
  {!props.paused&&<>
   <div className="world-touch-pad" style={{position:'absolute',bottom:16,left:16,display:'grid',gridTemplateColumns:'repeat(3,35px)',gap:3,opacity:.87}}>
    <span/><button aria-label="Move up" style={buttonStyle} {...hold('up')}>↑</button><span/>
    <button aria-label="Move left" style={buttonStyle} {...hold('left')}>←</button><button aria-label="Move down" style={buttonStyle} {...hold('down')}>↓</button><button aria-label="Move right" style={buttonStyle} {...hold('right')}>→</button>
   </div>
   <button className="world-interact" disabled={!nearby} onClick={()=>{controls.current.interact=true;}} style={{position:'absolute',right:16,bottom:18,padding:'12px 17px',border:'1px solid #f3ddb566',borderRadius:10,background:nearby?'#f0d69b':'#344e47dd',color:nearby?'#354c40':'#f2e4c0',fontFamily:'inherit',fontSize:11,cursor:nearby?'pointer':'default',maxWidth:'55%',boxShadow:'0 3px 0 #273e34'}}>{nearby?`E · ${nearby}`:'WASD / arrows · Shift to run'}</button>
  </>}
 </div>;
}
