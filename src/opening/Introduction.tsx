import {useEffect,useState} from 'react';
import {startMusic,stopMusic} from '../audio/music';
import BattleSprite from '../game/BattleSprite';
export default function Introduction({name,avatar,onDone}:{name:string;avatar:'male'|'female';onDone:()=>void}) {
 useEffect(()=>{void startMusic('intro');return()=>stopMusic()},[]);
 const [scene,setScene]=useState(0),[letters,setLetters]=useState(0);
 const lines=[`Welcome to Willowmere, ${name}. I'm Moss. Every great journey begins with one small step.`,"Here, your own movement powers your adventure. Walk, explore, and turn a little effort into real strength.",`You begin as a Neutral trainer. There is no single way to grow, ${name}. Find the rhythm that works for you.`,"Terra, Flint and Zephyr lead our three gyms: Leg, Arm and Back. Each badge opens a new specialization and a special skill.","Beyond the woodland route, Rowan awaits at the summit. Earn all three badges to enter the arena. Until then, the valley is yours to explore.","Morning is coming. Your adventure begins at home. I'll meet you outside — and we'll take the first steps together."];
 const line=lines[scene];
 useEffect(()=>{setLetters(0);const timer=setInterval(()=>setLetters(n=>n+1),24);return()=>clearInterval(timer)},[scene]);
 const next=()=>{if(letters<line.length)setLetters(line.length);else if(scene<lines.length-1)setScene(scene+1);else onDone()};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['Enter','e','E',' '].includes(e.key)&&!e.repeat){e.preventDefault();next()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[letters,scene]);
 return <section className="opening introduction" aria-label="Introduction"><div className="opening-landscape"/><button className="opening-back" onClick={onDone}>Skip introduction</button><div className="intro-cast"><BattleSprite id={scene===2?(avatar==='female'?'hero-female':'hero'):'trainer-1'} className="intro-character"/></div><button className="dialogue-box" onClick={next}><span className="dialogue-speaker">{scene===2?name:'Moss'} <small>{scene+1} / {lines.length}</small></span><span>{line.slice(0,letters)}</span><small className="dialogue-next">Enter · E · touch to continue ▸</small></button></section>
}
