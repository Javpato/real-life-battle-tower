# Everstride — implemented game design

Everstride is the current name of the Real-Life RPG prototype. Its connected loop is village exploration → visible trainer/leader → exercise or manual attack → per-unit damage → rewards → skills/items → three badges → rival and ending. The nutrition journal is a separate personal record inside the same application. Food consumption, weight change and calorie deficit never grant combat power or coins.

This document describes current code. Unfinished systems are identified explicitly; the master prompt remains the broader target. Rules live primarily in `src/core/game.ts`; world placement/art lives in `src/game`; journal calculations live in `src/nutrition`.

## World and controls

One compact original pixel-art village contains a rest house, shop, alchemy lab, three gyms, summit gate, three visible trainers and four quest NPCs. Phaser uses a 480 × 270 logical viewport, pixel rendering, camera following and collision checks. Exploration is a single scene; interactions open React UI rather than separate interiors.

- Move with WASD/arrows or the on-screen directional pad.
- Interact with E/Enter or the proximity button within 42 world units.
- Escape opens the menu or pauses combat; while a quest is open it leaves the quest.
- Trainers are visible and only start combat after interaction and confirmation. There are no random encounters.
- The rival interaction requires all three badges. After its victory, the ending view appears and exploration can continue.

The renderer and combat data currently contain some different NPC display names; IDs are authoritative integration keys. Do not use display names as save identifiers.

## Player, progression and inventory

Initial state: level 1; 100 HP; Attack 20; Defense 20; Speed 12; 0 XP; 50 coins; two potions and one guard. All six basic moves are available; Earthbound, Iron Pulse, Skykeeper and Wild Balance start equipped. One to four moves may be equipped. Specials require their matching badge.

XP needed for the next level is `60 + 30 × currentLevel`. A level increases maximum HP by 12, Attack and Defense by 2, Speed by 1, and restores HP. XP and earned skills survive defeat.

Each attack has five levels, represented by upgrade count `n = 0..4`. Current upgraded damage is `baseDamage × (1 + 0.22 × n)`; required units stay unchanged. Upgrade prices are 25, 50, 75 and 100 coins. Thus upgrades always improve damage per unit; they do not yet vary repetition requirements or recognition tolerances.

| Item | Shop price | Combat effect | Alchemy cost |
|---|---:|---|---:|
| Willow tonic / potion | 15 | Restores up to 45 HP | 1 ingredient |
| Bark guard / shield | 12 | Halves the next landed enemy hit | 1 ingredient |
| Bright spark / boost | 20 | Multiplies the next attack series by 1.25 | 2 ingredients |

An item consumes a turn. The rest house heals freely outside combat. Defeat restores HP, relocates to the rest house and removes `min(30, floor(coins × 0.10))` coins, preserving permanent progress and remaining items.

## Attacks and types

| Attack | Exercise | Type | Initial units | Base damage |
|---|---|---|---:|---:|
| Earthbound | Squat | Leg | 8 reps | 32 |
| Trailblazer | Lunge | Leg | 12 total; 6 each side | 44 |
| Iron Pulse | Push-up | Arm | 6 reps | 40 |
| Diamond Strike | Diamond push-up | Arm | 4 reps | 48 |
| Skykeeper | Superman | Back | 20 valid seconds | 32 |
| Wild Balance | Bird Dog | Back | 10 total; 5 each side | 42 |
| Mountain Heart | Squat; Leg badge | Leg | 10 reps | 52 |
| Ember Fist | Push-up; Arm badge | Arm | 8 reps | 60 |
| Aurora Wings | Superman; Back badge | Back | 24 valid seconds | 50 |

| Attacking type → defending type | Leg | Arm | Back |
|---|---:|---:|---:|
| Leg | 1 | 1.5 | 0.75 |
| Arm | 0.75 | 1 | 1.5 |
| Back | 1.5 | 0.75 | 1 |

Dual defenses multiply both entries. Neutral is the empty defensive type list and has no STAB. Before each encounter the player may choose Neutral or an unlocked badge specialization; it remains fixed for that battle. A matching attack gets 1.25 STAB. Enemy attacks get the same STAB rule for either active type. No immunities or random critical hits exist.

## Combat state and equations

Battle states are player turn, enemy turn, exercise, transformation, won and lost. Speed determines the opening actor; ties favor the player. Normal actions then alternate. The enemy waits during exercise, calibration and rest. Camera units cannot advance paused or finished battles.

For each accepted unit:

```text
damage = upgradedAttackDamage / requiredUnits
       × quality
       × typeEffectiveness
       × STAB
       × clamp(playerAttack / max(1, enemyDefense), 0.8, 1.2)
       × manualFatigueFactor
       × boostFactor
```

Quality is in `(0, 1]`. Verified units always use fatigue factor 1. Boost factor is 1.25 when active, otherwise 1. HP and damage retain floating-point precision; UI rounds for display only. No detector or Phaser scene calculates damage.

Unit validation checks exercise, ID, quality/confidence, timestamp, anatomical side when required, current state and optional attack-session token. IDs remain deduplicated across the battle, and new series receive new session IDs. The engine tracks verified and manual unit counts separately. A rejected unit does not reverse previously applied damage.

Lunge and Bird Dog require alternating sides and even targets. The first side is unrestricted. Bird Dog's side denotes the extended arm; the detector requires the opposite leg.

Completing or cancelling a series yields the enemy turn if the enemy survives. Cancellation retains all prior damage. Reaching final zero HP ends combat immediately. At a nonfinal phase threshold, damage is capped at that threshold, excess is discarded, the series ends and a transformation acknowledgment is shown; then the next phase responds. A unit never crosses two phases.

Enemy damage is:

```text
enemyAttack × typeEffectiveness × enemySTAB
× clamp(enemyAttack / max(1, playerDefense), 0.8, 1.2)
× (guard ? 0.5 : 1)
```

Player dodge probability is `min(0.10, playerSpeed / 300)`. A seeded generator makes tests reproducible. A dodge causes no damage and retains guard for the next landed hit. Enemies never dodge completed exercise units. Current enemy AI deterministically selects one of its active phase types; separate coverage attacks are not implemented.

### Manual fatigue

Manual confirmation supplies perfect-quality but unverified units. Each muscle group retains fatigue in `[0, 3]`. At the first manual unit in a series, its factor is frozen to `1 − min(0.4, 0.15 × groupFatigue)` for that series's manual units.

When the series closes, let `fraction = manualUnits / requiredUnits`. Increase its muscle group's fatigue by `fraction` and reduce each other group's fatigue by `fraction / 2`, clamped to bounds. Four full consecutive manual series therefore have factors 1.00, 0.85, 0.70 and 0.60. Cancelling a partially manual series accounts for only its manual fraction. A fully verified series does not clear manual fatigue. A new battle starts with zero fatigue.

## Encounters, quests and rewards

Trainer base HP is 35, Attack 12, Defense 18, Speed 10. Leader HP is `120 + 16 × badgesAlreadyHeld`, Defense is `20 + 2 × badgesAlreadyHeld`, Attack stays 18 and Speed stays 10. Rival HP is 230, Attack 24, Defense 18 and Speed 16.

| Encounter | Phase sequence | HP thresholds |
|---|---|---|
| Leg leader | Leg → Leg + Arm | 50%, then 0 |
| Arm leader | Arm → Arm + Back | 50%, then 0 |
| Back leader | Back → Back + Leg | 50%, then 0 |
| Rival | Leg + Arm → Arm + Back → Leg + Back | 67%, 34%, then 0 |

All leader orders are allowed. Leaders award their matching badge, specialization and special attack. First trainer victories give 35 XP / 20 coins; leaders give 100 XP / 45 coins; rival gives 200 XP / 20 coins. Repeated victories currently give 10 XP / 8 coins. A recorded battle ID can be rewarded only once, including after reload.

Difficulty multiplies enemy HP by 0.85 / 1.00 / 1.35 for Easy / Medium / Hard. Hard multiplies first-win coins by 0.7, rounded; it does not increase enemy Attack. Repeat-win and quest rewards currently do not scale by difficulty.

Four NPC missions request squat, push-up, Bird Dog and lunge. Completion counts 0–4 increase targets. Squat/push-up targets are `3 + min(completions, 4)`; alternating targets are `4 + 2 × min(completions, 4)` total. First five completions give 25 XP and 12 coins each; later completions give 12 coins with no XP. Missions can be left without a penalty.

### Current timing evidence

Deterministic simulations use real level progression, Neutral, 80% quality, optimal basic attacks and no healing items. Assumed cadence is 3 seconds per squat/lunge/push-up, 4 per diamond/Bird Dog, 1 per Superman second, plus 2 seconds per enemy turn. Calibration, demonstrations and unlimited rest are excluded.

| Scenario | Level | Series | Estimated active time | Result |
|---|---:|---:|---:|---|
| First trainer | 1 | 1 | 28 sec | Won |
| Leg leader, no badges | 3 | 2 | 78 sec | Won |
| Arm leader, one badge | 3 | 4 | 71 sec | Won |
| Back leader, two badges | 3 | 4 | 94 sec | Won |
| Rival | 5 | 6 | 127 sec | Won |

These are simulations, not human sessions. They establish baseline reachability but miss the original 1–3 minute trainer / 4–7 minute leader active-duration goals. Type multipliers are cyclically symmetric, but attack duration, physical effort, accessibility and manual-mode balance need physical playtesting. Existing damage numbers have not been tuned to claim that work complete.

## Camera, journal and external systems

The camera pipeline uses a local bundled MediaPipe lite model in a worker. It checks framing and visibility, requires a stable initial posture and a practice movement, then starts a three-second countdown. Guides can be skipped. Dynamic exercises require a full cycle with hysteresis/stability; Superman accumulates visible valid time. Tracking loss and pauses keep completed units. Original SVG guides illustrate movement. Physical accuracy remains unverified; see `docs/POSE.md` and `QA.md`.

The journal provides manual food labels, OFF products/search, explicit portions and meal confirmation, recipes based on final cooked yield, manual activities, measurements, local history, exports and adult-only optional energy estimates. It includes a conditional local dynamic weight model and explicit recalibration proposals, not generative nutrition AI. Planning a meal or discovering a product does not mark consumption. Missing nutrient values remain unknown; incomplete diary days are not zero-intake days.

Manual incremental exercise expenditure uses `(MET − 1) × 3.5 × kg / 200 × minutes`. Additional intake credit defaults to zero because habitual activity is already included in the profile factor. Overlapping manual sessions are excluded conservatively. Energy estimates do not mint coins.

Walking rewards have native and server foundations but are not part of the local RPG wallet until fully integrated. Server schedules are Easy: 30 coins per 1,000 steps; Medium: 12 per 500; Hard: 2 per 100. Only one source/device epoch may credit steps; retry IDs and cumulative high-water accounting prevent duplicate credit. Health Connect and the raw sensor must never be added for the same period.

Local IndexedDB is the current adventure persistence path. Supabase adapters/schema support pairing, exclusive control, transactional wallet operations and versioned nutrition, but full server-authoritative combat/quest/world synchronization is absent. Do not label local PC and Android saves as a completed shared adventure. Native health compilation and SQL tests are separate from physical device or hosted deployment acceptance.
