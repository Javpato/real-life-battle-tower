# Everstride artwork and replacement guide

The village and battle cast now load original bitmap artwork from `public/assets/manifest.json`. This is a genuine asset replacement, not a CSS enlargement of the former 16×24 canvas figures. The old character/tree/building generators were removed. `src/game/art.ts` now composes the map ground from the terrain bitmap while retaining collision geometry separately.

## Coordinates and sheets

The world remains 768×576 logical units, viewed through a 480×270 logical window. Phaser renders at 960×540 with camera zoom 2 so the new source detail survives on desktop. Movement, interaction distances and obstacle coordinates are unchanged. Nearest-neighbor rendering is enabled. WASD/arrows walk at 78 units/second; hold Shift to run at 132. Diagonal input is normalized and both speeds use the same collision checks. Movement never generates step rewards.

All paths occur in the manifest; `src/game/assets.ts` resolves them relative to Vite's deployment base. Register new sheets there before using them. PNG transparency is preserved. Do not use JPEG for cutout sprites.

| Sheet | Source size | Grid | Contents in reading order |
| --- | --- | --- | --- |
| traveler | 1247×1261 | 4×4 | South, west, east, north rows; idle/step/idle/other step columns |
| battleCast | 1774×887 | 4×2 | Traveler, Moss, Pip, Fern, Terra, Flint, Zephyr, Rowan |
| villagers | 1774×887 | 4×2 | Healer, Jun, Mira, Ollie, Ada, Noor, Finn, gardener |
| buildings | 1774×887 | 4×2 | Rest House, store, alchemy, Wind Sanctum, Root Dojo, Ember Hall, home, summit gate |
| scenery | 1774×887 | 4×2 | Oak, conifer, blossom tree, flowerbed, fountain, bench/lamp, market stall, wall |
| items | 1774×887 | 4×2 | Potion, protection, boost, coins, root/ember/wind medals, ingredient |
| terrain | 1254×1254 | 2×2 | Grass, dirt, cobblestones, water |

These are source dimensions, not claimed 256px frames. `frameRect` rounds grid boundaries without overlapping adjacent cells. Phaser computes opaque-content bounds once when loading each atlas, ignoring near-transparent background dust for the foot anchor, then adds a two-pixel margin. Characters use bottom-center origins. Their world height is 35–39 units. The traveler uses one common scale for all 16 frames. Replacements should keep feet aligned and include every limb inside its cell. Battle UI uses the full original cell to preserve complete silhouettes.

`BattleSprite({id, variant?, className?})` accepts encounter IDs or `hero`. `variant='back'` uses the dedicated rear battle portrait with matching proportions, not the chibi walking frame. Single-image portraits use contain sizing without stretching. Its class must supply display/width/height; the inner sprite fills that box. `ItemSprite({id,className?})` supports potion, shield, boost, coins, leg, arm, back and ingredient. Parent UI supplies sizing and animation; the sprite component only selects artwork.

## Provenance and reference research

All seven PNG atlases and the battle background were generated specifically for Everstride with the built-in OpenAI image-generation tool on 2026-11-14. No stock or proprietary RPG graphics, ROM data, fan-game sprites, copied code, or external music were imported. These are original project resources; no third-party CC0 license is asserted for generated output.

Primary references inspected for layout, sprite conventions and licensing:

- [pret/pokeemerald](https://github.com/pret/pokeemerald) and [pret/pokefirered](https://github.com/pret/pokefirered): top-down adventure references only. Decompilation availability is not permission to reuse proprietary game art. Nothing imported.
- [Kenney Tiny Town](https://kenney.nl/assets/tiny-town) and [Kenney licensing explanation](https://kenney.nl/support): source states CC0; its 16px modular composition was a reference, but no files imported.
- [Universal LPC character generator](https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator) and [LPC character bases](https://opengameart.org/content/lpc-character-bases): directional animation and atlas references only. LPC bases carry attribution/share-alike obligations. Nothing imported.

The generated visual direction is an original warm pastoral adventure: cream stone, terracotta/ochre/lavender/teal roofs, copper-haired traveler with teal cape, and distinct leader silhouettes. Generation was conditioned on original characters, crisp pixel clusters, no existing franchise likeness, transparent isolated cells and complete silhouettes. The walk atlas reused the generated battle cast as identity reference. The scenery sheet received a second image-generation edit to remove its initial white background. No API key or external generation CLI was used.

Generation record (built-in output IDs):

- Battle cast: `exec-dfdbbba8-d694-459b-ae9a-61b8fcf97382`; eight full-body original travelers/trainers/leaders/rival, regular 4×2, transparent, complete silhouettes.
- Walking: `exec-ce332b50-cf43-4d72-adbd-6726f54f72d1`; same copper-haired teal-cape traveler, chibi proportions, four directional rows and four walking frames per row.
- Buildings: `exec-43270eeb-469c-4784-a45f-30ef3ad24ebe`; eight distinct village buildings, 4×2, readable roofs/doors/windows and original shop/gym identities, no text.
- Scenery: `exec-9669a13d-466f-435f-a3a5-aa678b946a3d`, transparent-background correction `exec-ec2735bb-14b3-47b7-942d-878359093e86`; trees, fountain, flowers and village furnishings.
- Items: `exec-bc652b29-2b9a-4782-b743-99f324a923e3`; eight isolated original potions/medals/materials, 4×2.
- Terrain: `exec-4b9548cc-f69e-44df-b2ed-a514e82a4cf3`; four original pixel-texture material swatches, 2×2, no objects or text.
- Villagers: `exec-1f114ec4-8603-40fb-87a1-d9ff9e899f47`; eight distinct service/quest characters with coordinated pastoral clothing, 4×2 transparent.

## Audio and exercise guides

Original music is deterministic Web Audio synthesis in `src/audio/music.ts`; `startMusic(track)`, `stopMusic()`, `setVolume(value)` are the integration API. Tracks are village/trainer/leader/rival/victory. Replace that module with licensed audio decoding behind the same API, recording the file source and license. Sound effects are synthesized in `src/audio/sounds.ts` where present. Exercise demonstrations remain the independent SVG guide system listed in the manifest; they are not camera verification.

## Verification

TypeScript compilation passes. `tests/adventure-smoke.mjs` passed against the artwork preview: actual keyboard exploration, interaction, manual battle, victory rewards, persistence and reload. `tests/art-browser.mjs` verifies real Shift input travels farther than walking over the same interval and captures all four directions. One run measured 31 versus 53 logical units (1.71×), no browser errors. All four frames were visually inspected, as were full battle portraits and the colored village: no cut limbs, atlas-neighbor bleed or conspicuous alpha fringe. Browser captures are inspection artifacts, not physical exercise validation. Integrated battle-screen sizing must also be checked after the parent UI adopts BattleSprite.

## Battle arena background

`battlefieldUrl()` resolves the original 1536×1024 garden arena from the manifest. Preserve its 3:2 ratio where possible; it contains no characters or UI. Suggested sprite foot anchors in normalized background coordinates: hero (0.28, 0.77), enemy (0.79, 0.43). CSS cover cropping changes these apparent positions and should be visually checked. Generation output `exec-a6183abe-9608-44bf-b8cf-715730a4739e`: original detailed crisp pixel garden arena, warm limestone, rich foliage and distant teal/terracotta village, empty lower-left and upper-right standing platforms, no text or characters.

The dedicated `heroBack` sprite is a 1024×1536 transparent original portrait, generated from the original front-facing cast as identity reference (`exec-b2214ed1-a3aa-42db-8a6a-880eed535389`). Prompt: same copper-haired teal-caped traveler, complete full-body three-quarter rear battle stance facing upper-right, both boots visible, matching front portrait proportions/colors/pixel clusters, no text/other characters/floor. Combat-only portraits and item icons are not preloaded by the village.
