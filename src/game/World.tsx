import {useEffect,useRef,useState} from 'react';
import Phaser from 'phaser';
import type {WorldProps} from '../core/contracts';
import {buildings,createWorldArt,createTreeArt,createCharacterArt,MAP_W,MAP_H,type Obstacle} from './art';

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
 const [nearby,setNearby]=useState<string|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  let alive=true;
  class Village extends Phaser.Scene{
   player!:Phaser.GameObjects.Sprite;keys!:Record<string,Phaser.Input.Keyboard.Key>;obstacles:Obstacle[]=[];direction=0;walking=0;lastSave=0;lastNear='';lastInteract=-500;wasMoving=false;pendingInteract=false;wasPaused=false;
   marker!:Phaser.GameObjects.Text;gate!:Phaser.GameObjects.Text;
   create(){
    const art=createWorldArt();this.obstacles=art.obstacles;
    this.textures.addCanvas('village',art.canvas);this.add.image(0,0,'village').setOrigin(0);
    buildings.filter(b=>b.name).forEach(b=>this.add.text(b.x+b.w/2,b.y+b.h+7,b.name,{fontFamily:'monospace',fontSize:'7px',color:'#fff1cf',backgroundColor:'#49674ed9',padding:{x:3,y:2}}).setOrigin(.5).setDepth(1));
    this.textures.addCanvas('tree',createTreeArt());art.trees.forEach(t=>this.add.image(t.x,t.y,'tree').setOrigin(.5,1).setDepth(t.y));
    const addCharacter=(key:string,color:string,hat?:string)=>{const t=this.textures.addCanvas(key,createCharacterArt(color,'#594b48',hat))!;for(let i=0;i<12;i++)t.add(i,0,i*16,0,16,24);};
    addCharacter('hero','#d37966','#eee0b4');
    villagers.forEach(v=>{
      addCharacter(v.id,v.color,v.hat);const sprite=this.add.sprite(v.x,v.y,v.id,0).setOrigin(.5,1).setDepth(v.y).setInteractive({useHandCursor:true});
      sprite.on('pointerdown',()=>{if(!latest.current.paused&&Phaser.Math.Distance.Between(this.player.x,this.player.y,v.x,v.y)<42)this.interact(v);});
      const icon=this.add.text(v.x,v.y-29,v.symbol,{fontFamily:'monospace',fontSize:'9px',color:v.symbol==='?'?'#ffebaf':'#fff0cf',backgroundColor:'#354d4c',padding:{x:3,y:2}}).setOrigin(.5).setDepth(v.y+1);
      this.tweens.add({targets:icon,y:icon.y-2,duration:1100+v.x,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    });
    // The central spring is a layered, animated landmark.
    this.add.ellipse(384,293,35,17,0x6b8171).setDepth(295);
    this.add.ellipse(384,290,31,16,0xd4d5b4).setDepth(296);
    const water=this.add.ellipse(384,288,24,11,0x79b9bf).setDepth(297);this.tweens.add({targets:water,alpha:.65,duration:1100,yoyo:true,repeat:-1});
    this.add.rectangle(384,283,6,13,0xb8c6ab).setDepth(298);this.add.ellipse(384,277,14,5,0xe7e5bc).setDepth(299);
    this.obstacles.push({x:368,y:281,w:32,h:17});
    const start=latest.current.position??initialPosition;
    const sx=Number.isFinite(start.x)?Phaser.Math.Clamp(start.x,36,MAP_W-36):initialPosition.x;
    const sy=Number.isFinite(start.y)?Phaser.Math.Clamp(start.y,46,MAP_H-30):initialPosition.y;
    const usable=this.canMove(sx,sy)?{x:sx,y:sy}:initialPosition;
    this.player=this.add.sprite(usable.x,usable.y,'hero',0).setOrigin(.5,1).setDepth(usable.y);
    this.cameras.main.setBounds(0,0,MAP_W,MAP_H).startFollow(this.player,true,.12,.12).setRoundPixels(true);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ENTER',false) as Record<string,Phaser.Input.Keyboard.Key>;
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
    if(dx||dy){const distance=78*Math.min(delta,45)/1000/Math.hypot(dx,dy);const nx=this.player.x+dx*distance,ny=this.player.y+dy*distance;if(this.canMove(nx,this.player.y))this.player.x=nx;if(this.canMove(this.player.x,ny))this.player.y=ny;this.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);this.walking+=delta;this.player.setFrame(this.direction*3+Math.floor(this.walking/145)%3);}
    else this.player.setFrame(this.direction*3);
    this.player.setDepth(this.player.y);
    if((time-this.lastSave>1200&&(dx||dy))||(this.wasMoving&&!dx&&!dy)){this.lastSave=time;latest.current.onMove?.({x:Math.round(this.player.x),y:Math.round(this.player.y)});}
    this.wasMoving=Boolean(dx||dy);
    let nearest:Villager|undefined;let dist=42;
    for(const v of villagers){const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,v.x,v.y);if(d<dist){dist=d;nearest=v;}}
    const nearId=nearest?.id??'';
    if(nearId!==this.lastNear){this.lastNear=nearId;if(alive)setNearby(nearest?.name??null);}
    this.marker.setVisible(Boolean(nearest)&&!paused);
    if(nearest){this.marker.setPosition(nearest.x,nearest.y-38).setText('[E] '+nearest.name.split(' · ')[0]);if(!paused&&(this.pendingInteract||controls.current.interact))this.interact(nearest);}
    if(!nearest){this.pendingInteract=false;controls.current.interact=false;}
    this.gate.setText(latest.current.badges.length>=3?'THE SUMMIT · OPEN':'THE SUMMIT · 3 BADGES');
   }
  }
  const game=new Phaser.Game({type:Phaser.AUTO,parent:host.current,width:480,height:270,pixelArt:true,roundPixels:true,backgroundColor:'#79a66c',antialias:false,scene:Village,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},input:{activePointers:3}});
  const clear=()=>{controls.current={up:false,down:false,left:false,right:false,interact:false};};
  window.addEventListener('blur',clear);
  return()=>{alive=false;window.removeEventListener('blur',clear);game.destroy(true);};
 },[]);
 useEffect(()=>{if(props.paused)controls.current={up:false,down:false,left:false,right:false,interact:false};},[props.paused]);
 const hold=(direction:'up'|'down'|'left'|'right')=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);controls.current[direction]=true;},onPointerUp:()=>{controls.current[direction]=false;},onPointerCancel:()=>{controls.current[direction]=false;},onLostPointerCapture:()=>{controls.current[direction]=false;}});
 const buttonStyle:React.CSSProperties={width:35,height:35,border:'1px solid #f5e7be55',borderRadius:8,color:'#fff3cf',background:'#344e47dd',fontSize:16,touchAction:'none',cursor:'pointer',boxShadow:'0 2px 0 #203b35'};
 return <div aria-label="Everstride village game world" style={{width:'100%',height:'100%',minHeight:320,position:'relative',overflow:'hidden',background:'#345647',isolation:'isolate'}}>
  <div ref={host} style={{width:'100%',height:'100%',minHeight:320,imageRendering:'pixelated'}}/>
  <div style={{position:'absolute',left:16,top:14,pointerEvents:'none',color:'#fff1cd',textShadow:'0 2px #324c40',fontFamily:'monospace',fontSize:11,letterSpacing:2}}><span style={{fontSize:9,opacity:.8}}>GREENHAVEN VALLEY</span><br/><strong style={{fontSize:15,letterSpacing:1}}>Willowmere</strong></div>
  {!ready&&<div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',color:'#f6e7c1'}}>Opening the village…</div>}
  {!props.paused&&<>
   <div style={{position:'absolute',bottom:16,left:16,display:'grid',gridTemplateColumns:'repeat(3,35px)',gap:3,opacity:.87}}>
    <span/><button aria-label="Move up" style={buttonStyle} {...hold('up')}>↑</button><span/>
    <button aria-label="Move left" style={buttonStyle} {...hold('left')}>←</button><button aria-label="Move down" style={buttonStyle} {...hold('down')}>↓</button><button aria-label="Move right" style={buttonStyle} {...hold('right')}>→</button>
   </div>
   <button disabled={!nearby} onClick={()=>{controls.current.interact=true;}} style={{position:'absolute',right:16,bottom:18,padding:'12px 17px',border:'1px solid #f3ddb566',borderRadius:10,background:nearby?'#f0d69b':'#344e47dd',color:nearby?'#354c40':'#f2e4c0',fontFamily:'inherit',fontSize:11,cursor:nearby?'pointer':'default',maxWidth:'55%',boxShadow:'0 3px 0 #273e34'}}>{nearby?`E · ${nearby}`:'WASD / arrows to explore'}</button>
  </>}
 </div>;
}
