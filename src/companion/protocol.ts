/** Ephemeral signaling only. Never contains video, landmarks, saves or nutrition. */
export type PairRole='desktop'|'invite'|'phone';
export type SignalAction='poll'|'claim'|'approve'|'offer'|'answer'|'ice'|'close';
export type PairState={id:string;expiresAt:number;desktopHash:string;inviteHash:string;phoneHash?:string;phoneName?:string;challenge?:string;approved:boolean;closed:boolean;offer?:{type:'offer';sdp:string};answer?:{type:'answer';sdp:string};desktopIce:unknown[];phoneIce:unknown[]};
export type PairView={expiresAt:number;phoneName?:string;challenge?:string;approved:boolean;closed:boolean;offer?:{type:'offer';sdp:string};answer?:{type:'answer';sdp:string};ice:unknown[]};
export const PAIR_TTL_MS=300000;
export function createPairState(id:string,desktopHash:string,inviteHash:string,now:number):PairState{return {id,expiresAt:now+PAIR_TTL_MS,desktopHash,inviteHash,approved:false,closed:false,desktopIce:[],phoneIce:[]};}
export function roleForToken(s:PairState,hash:string):PairRole|null{return hash===s.desktopHash?'desktop':hash===s.phoneHash?'phone':hash===s.inviteHash?'invite':null;}
export function pairView(s:PairState,role:PairRole):PairView{if(role==='invite')throw Error('CLAIM_REQUIRED');return {expiresAt:s.expiresAt,phoneName:s.phoneName,challenge:s.challenge,approved:s.approved,closed:s.closed,offer:s.approved?s.offer:undefined,answer:s.approved?s.answer:undefined,ice:s.approved?(role==='desktop'?s.phoneIce:s.desktopIce):[]};}
export function applySignal(input:PairState,role:PairRole,action:SignalAction,payload:unknown,now:number):PairState{
 if(now>=input.expiresAt)throw Error('PAIR_EXPIRED');if(input.closed)throw Error('PAIR_CLOSED');
 const s=structuredClone(input),p=payload as Record<string,unknown>|undefined;
 if(action==='claim'){
  if(role!=='invite'||s.phoneHash)throw Error('PHONE_ALREADY_CLAIMED');
  if(typeof p?.phoneHash!=='string'||!/^[a-f0-9]{64}$/.test(p.phoneHash)||typeof p.challenge!=='string'||!/^\d{6}$/.test(p.challenge)||typeof p.phoneName!=='string'||p.phoneName.length>40)throw Error('INVALID_CLAIM');
  s.phoneHash=p.phoneHash;s.challenge=p.challenge;s.phoneName=p.phoneName.trim()||'Phone';return s;
 }
 if(role==='invite')throw Error('CLAIM_REQUIRED');
 if(action==='poll')return s;
 if(action==='close'){s.closed=true;s.offer=undefined;s.answer=undefined;s.desktopIce=[];s.phoneIce=[];return s;}
 if(action==='approve'){if(role!=='desktop'||!s.phoneHash||p?.challenge!==s.challenge)throw Error('CONFIRM_PHONE_FIRST');s.approved=true;return s;}
 if(!s.approved)throw Error('CONFIRM_PHONE_FIRST');
 if(action==='offer'||action==='answer'){
  if((action==='offer'&&role!=='desktop')||(action==='answer'&&role!=='phone'))throw Error('WRONG_PEER');
  if(p?.type!==action||typeof p.sdp!=='string'||p.sdp.length>16000||!p.sdp.startsWith('v=0'))throw Error('INVALID_SDP');
  if(s[action])throw Error('DESCRIPTION_ALREADY_SET');
  if(action==='offer')s.offer={type:'offer',sdp:p.sdp};else s.answer={type:'answer',sdp:p.sdp};return s;
 }
 if(action==='ice'){
  if(!p||typeof p.candidate!=='string'||p.candidate.length>2000||(p.sdpMid!==null&&p.sdpMid!==undefined&&typeof p.sdpMid!=='string')||(p.sdpMLineIndex!==null&&p.sdpMLineIndex!==undefined&&!Number.isInteger(p.sdpMLineIndex)))throw Error('INVALID_ICE');
  const list=role==='desktop'?s.desktopIce:s.phoneIce;if(list.length>=64)throw Error('ICE_LIMIT');
  list.push({candidate:p.candidate,sdpMid:p.sdpMid??null,sdpMLineIndex:p.sdpMLineIndex??null});return s;
 }
 throw Error('UNKNOWN_ACTION');
}
