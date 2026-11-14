# Illustrated Battle Tower assets

The user approved `art-production/v2/approved-reference.png`, including its original eyes and face. Do not copy the later96px retouched eyes. Complex characters are illustrated with the built-in image-generation tool; code only processes, repairs alpha, crops, registers and exports. The old geometric character generator and its runtime assets are retired.

## Inventory

60characters:2protagonists,36normaladversaries,19regularbosses,1centennialboss,2instructors. Each has16different illustrated poses:4idle,4attack,2impact,4victory,2transformation. Both protagonists have16additional back-view poses. Total992distinct pose frames and432 character PNG exports, plus8scene backgrounds and24icons.

## Sources and reproduction

Originals and complete prompts live in `art-production/v2/sources/`; rejected iterations remain separately identified. `roster.json` assigns logical IDs and names. The original approved female portrait/front preserves her face without palette or eye repainting. The final cast is inspectable at `art-production/v2/gallery.html`; contact sheets include native,2×/4× and key action comparisons.

Run:

```sh
python3 scripts/export-tower-art-v2.py
python3 scripts/export-tower-scenery-v2.py
```

Python3/Pillow and DejaVu fonts are required. The original model generations are not deterministic; export from retained PNGs is reproducible. Pixel Art Studio remains installed for grid/export/inspection workflows; PixelLab is not connected or used.

## Native contracts

- Runtime root:`public/assets/tower-v2/`. Central `manifest.json` describes characters, clips, sources and review status; `scenery.json` describes backgrounds/icons and arena anchors.
- Characters128×128 RGBA, one shared scale per character across poses/front/back, foot pivot[64,122], nearest-neighbor sampling. Alpha is normalized from generated transparency; source colors are preserved. No palette reduction or global face edits.
- `front.png` and `portrait.png` are still images. `idle.png`,`attack.png`,`impact.png`,`victory.png`,`transform.png` are horizontal128px-cell atlases. Heroes also have `back.png` and corresponding`back-*`clips. Frame timing is in the manifest.
- New poses are illustrated, not synthesized by translating a still. The renderer keeps the foot transform fixed while advancing frames. Reduced-motion displays a still.
- Scene planes480×270; normalized feet hero[.312,.815], enemy[.77,.618]. Six arenas share this composition. Icons32×32, frames remain sharp with integer nearest sampling.
- Every source-boundary exception requires explicit visual inspection tied to its SHA256. Alpha cleanup of white-background mistakes is masked outside outlines and recorded; never erase enclosed white hair or clothing.

## Replacing a character

Keep its logical ID. Generate a4×4 sheet matching the approved face/pixel construction and clip order. Leave margins around every pose. Replace the source PNG and record its prompt, then rerun export. Inspect all16frames on light/dark backgrounds and actual battle-size rendering. Do not mark production ready from dimensions alone. Update the manifest and capture browser evidence before retiring the old source.

## Presentation boundaries

The generated backgrounds were composed as pixel-style illustrations and normalized to the scene grid; they are not claimed as a manually authored tile atlas. Exercise instructions for90movements are written, movement-specific guides. No unreviewed anatomical illustration is used to imply correct physical technique. Existing detector demonstrations remain available for their supported families. Native art QA does not validate human movement detection.
