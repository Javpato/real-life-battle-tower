/** Original procedural score for Everstride. No samples, downloads, or copyrighted melodies.
 * Call startMusic from a user gesture. setVolume is 0..1; 0 is muted.
 * Tracks are editable MIDI-note sequences (0 = rest), with one entry per eighth note.
 * To replace this score with recordings, keep these three exported control functions
 * and map the same track IDs to licensed audio files. Stop the prior track on changes.
 */
export type MusicTrack='village'|'trainer'|'leader'|'rival'|'victory';
type Score={bpm:number;melody:readonly number[];roots:readonly number[];wave:OscillatorType;loop:boolean};
const scores:Record<MusicTrack,Score>={
 village:{bpm:86,melody:[74,0,69,71,74,76,0,71,69,0,66,69,71,0,0,0,74,0,78,76,74,71,69,0,67,69,71,0,69,0,0,0],roots:[50,55,57,53],wave:'triangle',loop:true},
 trainer:{bpm:108,melody:[72,67,70,72,0,75,74,70,67,0,65,67,70,72,0,67,72,74,75,0,74,70,67,65,67,70,72,0,70,67,0,0],roots:[48,53,55,46],wave:'triangle',loop:true},
 leader:{bpm:118,melody:[69,0,76,74,72,71,69,0,65,69,72,0,71,67,64,0,69,72,76,79,76,74,72,71,69,0,67,64,65,67,69,0],roots:[45,41,43,40],wave:'square',loop:true},
 rival:{bpm:126,melody:[64,67,71,0,72,71,67,64,62,66,69,0,71,69,66,62,64,71,76,0,74,72,71,67,65,69,72,0,71,67,64,0],roots:[40,38,43,41],wave:'triangle',loop:true},
 victory:{bpm:110,melody:[72,0,76,0,79,0,84,0,83,79,76,0,81,0,79,0,77,76,74,0,76,79,84,0,84,0,0,0,0,0,0,0],roots:[48,53,55,48],wave:'triangle',loop:false},
};
let context:AudioContext|undefined,master:GainNode|undefined,bus:GainNode|undefined,activeFilter:BiquadFilterNode|undefined;
let timer:ReturnType<typeof setInterval>|undefined,active:MusicTrack|undefined,volume=.28,generation=0;
const sounding=new Set<OscillatorNode>();
const frequency=(midi:number)=>440*Math.pow(2,(midi-69)/12);

function voice(note:number,at:number,length:number,loudness:number,wave:OscillatorType,destination:GainNode){
 if(!context||note===0)return;
 const osc=context.createOscillator(),envelope=context.createGain();osc.type=wave;osc.frequency.setValueAtTime(frequency(note),at);
 // Softer attacks avoid clicks; long releases overlap gently at low amplitude.
 envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(loudness,at+.018);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,loudness*.35),at+Math.max(.03,length*.55));envelope.gain.exponentialRampToValueAtTime(.0001,at+length);
 osc.connect(envelope);envelope.connect(destination);sounding.add(osc);
 osc.onended=()=>{sounding.delete(osc);osc.disconnect();envelope.disconnect();};osc.start(at);osc.stop(at+length+.02);
}

/** Returns false if Web Audio is unavailable or browser gesture policy blocks playback. */
export async function startMusic(track:MusicTrack='village'):Promise<boolean>{
 if(typeof window==='undefined'||!(track in scores))return false;
 if(active===track&&timer&&context?.state==='running')return true;
 stopMusic();const run=++generation;
 try{
  const AudioCtor=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioCtor)return false;
  if(!context||context.state==='closed'){context=new AudioCtor();master=context.createGain();master.gain.value=volume;master.connect(context.destination);}
  if(context.state!=='running')await context.resume();if(run!==generation||context.state!=='running')return false;
  const score=scores[track],ctx=context,trackBus=ctx.createGain(),filter=ctx.createBiquadFilter();
  // A low-pass softens the chiptune upper harmonics, particularly on phone speakers.
  filter.type='lowpass';filter.frequency.value=score.wave==='square'?1500:3600;trackBus.connect(filter);filter.connect(master!);trackBus.gain.setValueAtTime(0,ctx.currentTime);trackBus.gain.linearRampToValueAtTime(1,ctx.currentTime+.18);bus=trackBus;activeFilter=filter;active=track;
  const eighth=30/score.bpm;let next=ctx.currentTime+.04,index=0;
  const tick=()=>{
   if(run!==generation||ctx.state!=='running'||document.hidden)return;
   if(next<ctx.currentTime-.25)next=ctx.currentTime+.03;
   while(next<ctx.currentTime+.14){
    if(!score.loop&&index>=score.melody.length){if(timer){clearInterval(timer);timer=undefined;}active=undefined;const finish=ctx.currentTime+eighth*2;trackBus.gain.setTargetAtTime(0,finish,.15);setTimeout(()=>{trackBus.disconnect();filter.disconnect();},Math.max(0,finish-ctx.currentTime)*1000+1000);return;}
    const position=index%score.melody.length,root=score.roots[Math.floor(position/8)%score.roots.length];
    voice(score.melody[position],next,eighth*1.55,score.wave==='square'?.026:.065,score.wave,trackBus);
    if(index%4===0)voice(root,next,eighth*3.6,.075,'sine',trackBus);
    if(index%8===0){voice(root+12,next,eighth*7.2,.022,'triangle',trackBus);voice(root+19,next,eighth*7.2,.014,'sine',trackBus);}
    if(track!=='village'&&track!=='victory'&&index%2===1)voice(root+24,next,eighth*.35,.019,'triangle',trackBus);
    index++;next+=eighth;
   }
  };
  timer=setInterval(tick,30);tick();return true;
 }catch{if(run===generation)stopMusic();return false;}
}

/** Stops queued music and releases sounding notes; the audio context is reused. */
export function stopMusic(){
 generation++;if(timer){clearInterval(timer);timer=undefined;}active=undefined;
 const oldBus=bus,oldFilter=activeFilter;bus=undefined;activeFilter=undefined;
 if(context&&oldBus){oldBus.gain.cancelScheduledValues(context.currentTime);oldBus.gain.setTargetAtTime(0,context.currentTime,.025);setTimeout(()=>{oldBus.disconnect();oldFilter?.disconnect();},150);}
 for(const osc of sounding){try{osc.stop((context?.currentTime??0)+.08);}catch{/* Already ended. */}}
}
export function setVolume(value:number){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));if(master&&context){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(volume,context.currentTime,.035);}}
