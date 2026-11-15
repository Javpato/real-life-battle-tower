import {ADDITIONAL_GUIDES} from './expandedCatalog';
import {exerciseProfile, CAMERA_VIEWS, EXERCISE_SOURCES, recognitionLabel} from './exerciseProfiles';
/** Physical-skill instructions. These deliberately do not inherit the detector family's
 * guide: a wall sit is a hold, not a squat, even when both share a tracking family. */
export type SkillGuide={title:string;setup:string;movement:string;camera:string;note:string;sources?:Array<{title:string;url:string;scope:string}>};
export const SKILL_GUIDES:Readonly<Record<string,SkillGuide>>={
 ...ADDITIONAL_GUIDES,
 'mini-squat':{
  title:'Mini Squat',setup:'Stand with feet comfortably apart and your whole body in view.',
  movement:'Bend your knees a little and move your hips back, then return to standing. One down-and-up cycle is one repetition.',
  camera:'Side or slight three-quarter view · shoulders, hips, knees and ankles visible.',
  note:'Experimental shallow-range recognition. It observes a movement pattern, not a validated assessment of your technique. Keep the movement comfortable.',
 },
 squat:{
  title:'Squat',setup:'Stand with feet comfortably apart and your weight balanced over both feet.',
  movement:'Move your hips back as you bend your knees, then stand tall again with control. Complete the return before starting the next repetition.',
  camera:'Side or slight three-quarter view · shoulders, hips, knees and ankles visible.',
  note:'The camera checks a bend-and-return pattern. Small bounces do not count; do not force extra depth to satisfy the game.',
 },
 'pause-squat':{
  title:'Pause Squat',setup:'Stand with feet comfortably apart, ready to lower into a comfortable squat.',
  movement:'Lower with control, pause briefly while keeping still, then stand back up. Count one repetition after the complete return.',
  camera:'Optional side-view preview · keep your whole body in view.',
  note:'Manual counting: the pause and its duration are not verified by the squat detector. Take a rest between repetitions whenever needed.',
 },
 'assisted-lunge':{
  title:'Assisted Lunge',setup:'Stand beside a stable support, with room to step and return. Use the support for balance.',
  movement:'Step into a split stance, bend both knees through a comfortable range, then return. Alternate the leading leg after each complete repetition.',
  camera:'Optional three-quarter preview · both feet and the support visible.',
  note:'Manual counting: the game cannot verify the support, how much assistance you use, or this variation’s range. The side label names the leading leg.',
 },
 lunge:{
  title:'Lunge',setup:'Stand tall with enough space for a forward step and a return.',
  movement:'Step forward, bend your knees, then return to standing. Alternate the leading leg after each complete repetition.',
  camera:'Side or slight three-quarter view · both legs, hips and ankles visible.',
  note:'The camera must distinguish both anatomical sides. The side label names the leading leg; reposition if one leg is hidden.',
 },
 'sumo-squat':{
  title:'Sumo Squat',setup:'Take a comfortably wider stance with your toes turned slightly outward.',
  movement:'Lower between your feet with control, then return to standing. Keep your knees moving in the same direction as your toes.',
  camera:'Optional front or three-quarter preview · both feet and knees visible.',
  note:'Manual counting: the standard squat detector does not verify wide-stance or foot-angle requirements. Choose a stance you can control.',
 },
 'wall-sit':{
  title:'Wall Sit',setup:'Rest your back against a clear wall and place your feet a little forward.',
  movement:'Slide down only as far as comfortable and hold still while breathing normally. Stand up to finish or rest; this is a hold, not repeated squatting.',
  camera:'Optional side-view preview · wall, hips, knees and feet visible.',
  note:'Manual seconds: the game does not verify wall contact or this hold. Enter each completed second explicitly; waiting on screen earns no time.',
 },
 'reverse-lunge':{
  title:'Reverse Lunge',setup:'Stand with clear space behind you and your feet comfortably apart.',
  movement:'Step one foot backward, lower with control, then bring it forward to return. Alternate the stepping leg after each complete repetition.',
  camera:'Optional side or three-quarter preview · both legs and the backward step visible.',
  note:'Manual counting: backward-step direction is not verified by the lunge detector. Here the side label names the leg stepping backward.',
 },
 'tempo-squat':{
  title:'Tempo Squat',setup:'Stand in your usual comfortable squat stance.',
  movement:'Lower slowly over about three counts, then rise slowly over about three counts. One controlled descent and return is one repetition.',
  camera:'Optional side-view preview · keep your whole body visible.',
  note:'Manual counting: the deliberate tempo is not verified by the standard squat detector. The counts guide your rhythm; there is no speed bonus.',
 },
 'single-leg-squat':{
  title:'Single-leg Squat',setup:'Stand near a stable support. Shift onto one leg and keep the other foot clear without forcing your balance.',
  movement:'Make a small controlled bend on the supporting leg, then straighten again. Alternate the supporting leg after each repetition.',
  camera:'Optional front or three-quarter preview · both legs and any support visible.',
  note:'Manual counting: single-leg support is not verified. Use a comfortable small range or return to an earlier skill; the side label names the supporting leg.',
 },
 'wall-pushup':{
  title:'Wall Push-up',setup:'Face a clear wall with your palms against it and your feet at a comfortable distance.',
  movement:'Bend your elbows to move your torso toward the wall, then press back to the starting position. Keep the movement controlled.',
  camera:'Side view · near shoulder, elbow, wrist, hip and feet visible.',
  note:'The detector observes your arm cycle and body position; it cannot verify that the wall or contact surface is suitable.',
 },
 'incline-pushup':{
  title:'Incline Push-up',setup:'Place your hands on a stable raised surface and step back into a straight, supported body position.',
  movement:'Bend your elbows to bring your torso toward the surface, then press back up. Count the repetition after returning to the top.',
  camera:'Optional low side-view preview · surface, arms and body line visible.',
  note:'Manual counting: support height, surface stability and the incline variation are not verified. Use a surface that will not move under your hands.',
 },
 'knee-pushup':{
  title:'Knee Push-up',setup:'Start on your hands and knees on a comfortable floor surface. Extend your body from your knees through your hips and shoulders.',
  movement:'Keep your knees supported while you lower your torso by bending your elbows, then press back up. Return fully before repeating.',
  camera:'Low side view · near shoulder, elbow, wrist, hip and knee visible.',
  note:'Experimental knee-supported recognition. It observes the supported arm cycle, not a validated assessment of technique or comfort.',
 },
 'high-plank':{
  title:'High Plank',setup:'Place your hands under your shoulders and extend your legs behind you, supported on hands and toes.',
  movement:'Hold your body steady while breathing normally. Lower your knees to rest; do not perform push-up repetitions for this hold.',
  camera:'Optional low side-view preview · hands, shoulders, hips and ankles visible.',
  note:'Manual seconds: the push-up detector does not verify this hold. Enter each completed second explicitly; elapsed screen time is not exercise credit.',
 },
 pushup:{
  title:'Push-up',setup:'Start supported on hands and toes, with your arms extended and your body in one controlled line.',
  movement:'Lower your torso by bending your elbows, then press back up. Return to the top before beginning the next repetition.',
  camera:'Low side view · near shoulder, elbow, wrist, hip and ankle visible.',
  note:'The camera checks the arm cycle with body movement. Moving only your head does not count; pause or choose an earlier skill whenever needed.',
 },
 'pause-pushup':{
  title:'Pause Push-up',setup:'Start in a comfortable push-up position, with arms extended.',
  movement:'Lower your torso, pause briefly without bouncing, then press back up. Count after the full return.',
  camera:'Optional low side-view preview · near arm and the full body line visible.',
  note:'Manual counting: the pause is not verified by the standard push-up detector. Rest between repetitions whenever you need.',
 },
 diamond:{
  title:'Diamond Push-up',setup:'Start in a push-up position with hands closer together. Bring thumbs and fingers toward a diamond shape only if comfortable.',
  movement:'Lower your torso with control, then press back up. Use a comfortable range and return fully before repeating.',
  camera:'Optional low three-quarter preview · hands, near arm and body line visible.',
  note:'Manual counting: hand and finger placement are not verified by body-pose tracking. This skill does not receive camera accreditation from a normal push-up.',
 },
 'eccentric-pushup':{
  title:'Eccentric Push-up',setup:'Begin at the top of a push-up with space to lower and reset.',
  movement:'Lower slowly over about three counts. Bring your knees down to help reset at the top if needed. One controlled lowering and reset is one repetition.',
  camera:'Optional low side-view preview · near arm, hips and knees visible.',
  note:'Manual counting: the slow lowering and assisted reset are not verified. The reset is part of this variation, not another repetition.',
 },
 'wide-pushup':{
  title:'Wide Push-up',setup:'Start in a push-up position with hands comfortably wider than your usual placement.',
  movement:'Bend your elbows to lower your torso, then press back up. Keep a range and hand width you can control.',
  camera:'Optional low front or three-quarter preview · both hands and shoulders visible.',
  note:'Manual counting: hand spacing is not verified by the standard push-up detector. Wider placement does not earn extra credit.',
 },
 'archer-pushup':{
  title:'Archer Push-up',setup:'Use a comfortably wide hand position and begin with both arms extended.',
  movement:'Shift gently toward one hand while bending that elbow and keeping the other arm longer. Push back to the center, then alternate the bent-arm side.',
  camera:'Optional low front or three-quarter preview · both arms and the body line visible.',
  note:'Manual counting: lateral weight shift and arm support are not verified. Use a small controlled range; the side label names the bending arm.',
 },
 birddog:{
  title:'Basic Bird Dog',setup:'Start on hands and knees with hands under shoulders and knees under hips.',
  movement:'Reach one arm and the opposite leg outward, then return both to the floor. Alternate the reaching arm after each complete repetition.',
  camera:'Low three-quarter view · both arms and legs visible throughout.',
  note:'The side label names the reaching arm, not the leg. The camera looks for opposite limbs and a controlled return.',
 },
 'alternating-birddog':{
  title:'Alternating Bird Dog',setup:'Start on hands and knees with enough room to reach in front and behind you.',
  movement:'Extend one arm and the opposite leg, return to the starting position, then repeat on the other side. Each full reach-and-return counts once.',
  camera:'Low three-quarter view · both arms, hips and legs visible.',
  note:'Follow the alternating arm-side cue. Returning between sides matters; repeated movements on the same side do not advance the count.',
 },
 'short-superman':{
  title:'Short Superman',setup:'Lie face down on a comfortable floor surface with your arms reaching forward.',
  movement:'Gently lift your arms and legs through a comfortable small range and hold briefly while breathing. Lower to rest whenever needed.',
  camera:'Near floor height at your side · wrist, shoulder, hip and ankle visible.',
  note:'This skill counts observable held seconds, not repetitions. Lowering or leaving the frame pauses credit; do not force a higher lift for the camera.',
 },
 superman:{
  title:'Superman',setup:'Lie face down with arms extended forward and enough space around you.',
  movement:'Gently lift arms and legs and hold steady through a comfortable range. Keep breathing, and lower fully to take a rest.',
  camera:'Near floor height at your side · wrist, shoulder, hip and ankle visible.',
  note:'Only fresh observed hold events earn seconds. Resting does not remove already credited time, and the game does not require an exaggerated back arch.',
 },
 'back-extension':{
  title:'Back Extension',setup:'Lie face down with your hands resting beside your body or lightly near your shoulders.',
  movement:'Gently raise your upper chest a small comfortable amount, then lower back down with control. Each lift-and-lower cycle counts once.',
  camera:'Optional low side-view preview · shoulders, hips and legs visible.',
  note:'Manual repetitions: this is a repeated upper-body movement, not the Superman hold. The game does not verify this variation’s range.',
 },
 'snow-angels':{
  title:'Reverse Snow Angels',setup:'Lie face down with arms near your sides and clear space to move them outward.',
  movement:'Lift your hands slightly if comfortable, sweep your arms out toward an overhead position, then return along the same path. One out-and-back sweep counts once.',
  camera:'Optional raised three-quarter preview · both arms and the full sweep visible.',
  note:'Manual repetitions: arm-sweep direction and range are not verified by the Superman detector. Keep the movement small enough to control.',
 },
 'pause-birddog':{
  title:'Pause Bird Dog',setup:'Start on hands and knees with your body steady.',
  movement:'Reach one arm and the opposite leg, pause briefly, then return both to the floor. Alternate the reaching arm after each repetition.',
  camera:'Optional low three-quarter preview · both arms and legs visible.',
  note:'Manual counting: the extra pause is not verified by the basic Bird Dog detector. The side cue names the reaching arm.',
 },
 'alternating-superman':{
  title:'Alternating Superman',setup:'Lie face down with arms forward and both legs resting on the floor.',
  movement:'Gently lift one arm and the opposite leg, then lower them. Alternate the lifting arm after each complete lift-and-lower cycle.',
  camera:'Optional three-quarter preview · both arms and legs visible.',
  note:'Manual repetitions: this opposite-limb variation is not the two-sided timed Superman hold. The side cue names the lifting arm.',
 },
 'tempo-extension':{
  title:'Tempo Back Extension',setup:'Lie face down with your hands resting beside you or lightly near your shoulders.',
  movement:'Raise your upper chest gently over about three counts, then lower over about three counts. Count one repetition after the complete return.',
  camera:'Optional low side-view preview · upper chest, hips and legs visible.',
  note:'Manual repetitions: neither the extension variation nor its tempo is verified. Use a comfortable small lift; slow counts do not need a larger range.',
 },
 'advanced-birddog':{
  title:'Advanced Bird Dog',setup:'Begin on hands and knees with room to extend an arm and the opposite leg.',
  movement:'Reach opposite limbs, draw the reaching elbow and opposite knee inward without rushing, then reach again and return to the floor. Alternate the reaching arm.',
  camera:'Optional low three-quarter preview · both arms, hips and knees visible.',
  note:'Manual counting: the inward movement and extended sequence are not verified by the basic detector. The whole sequence counts once, not each reach.',
 },
};
export function skillGuide(id:string):SkillGuide{
 if(!Object.hasOwn(SKILL_GUIDES,id))throw Error('UNKNOWN_SKILL_GUIDE');
 const guide=SKILL_GUIDES[id],profile=exerciseProfile(id);
 if(!profile)return guide;
 const note=profile.method==='existing'?`${guide.note} ${profile.limitation}`:profile.method==='assisted'?`Experimental assisted camera: ${profile.observable}. ${profile.limitation} Estimates are saved as unverified, not technique accreditation. Manual counting remains available; rest freely.`:`Camera preview + manual confirmation: ${profile.limitation} Confirm only movements or held seconds you actually complete. Rest freely.`;
 return {...guide,camera:`${CAMERA_VIEWS[profile.view]} · ${recognitionLabel(id)}`,note,sources:profile.sources.map(key=>EXERCISE_SOURCES[key]).filter(Boolean)};
}
