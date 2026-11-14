"""Export image-model illustrations; never construct or redraw character anatomy.

Original sheets are preserved. Export uses one scale per sheet, nearest sampling,
binary alpha, and removal of detached 1–2px alpha speckles only. No quantization,
palette changes, facial repainting or geometric character generation is performed.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import fcntl
import json
import math

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = ROOT / 'art-production/v2'
DEST = ROOT / 'public/assets/tower-v2'
CONTACTS = PRODUCTION / 'contact-sheets'
VERSION = 7
ALPHA_THRESHOLD = 220
SIZE = 128
FOOT = (64, 122)
CLIPS = {'idle': ([0, 1, 2, 3], [240, 180, 140, 240], True),
         'attack': ([4, 5, 6, 7], [120, 100, 160, 160], False),
         'impact': ([8, 9], [150, 220], False),
         'victory': ([10, 11, 12, 13], [180, 220, 220, 260], False),
         'transform': ([14, 15], [260, 320], False)}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def export_fingerprint(entry):
    id=entry['id']
    paths=[PRODUCTION/'sources'/(id+'.png')]
    if id.startswith('hero-'):
        paths.append(PRODUCTION/'sources'/(id+'-back.png'))
    if id=='hero-female':
        paths.append(PRODUCTION/'approved-reference.png')
    review_path=CONTACTS/'visual-review.json'
    review=json.loads(review_path.read_text()) if review_path.exists() else {}
    data={'version':VERSION,'alpha':ALPHA_THRESHOLD,'rosterEntry':entry,'sourceHashes':[sha(p) if p.exists() else None for p in paths],
          'visualReview':review.get('characters',{}).get(id),'boundaryReviews':[r for r in review.get('boundaryReviews',[]) if r.get('id')==id]}
    return hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()

def cached_files_exist(record):
    paths=[record['front'],record['portrait']]
    if 'back' in record:
        paths.append(record['back'])
    for key in ['animations','backAnimations']:
        paths.extend(c['file'] for c in record.get(key,{}).values())
    return all((DEST/p).exists() for p in paths) and (CONTACTS/(record['id']+'-frames.png')).exists()

def binary(image):
    result = image.convert('RGBA')
    result.putalpha(result.getchannel('A').point(lambda a: 255 if a >= ALPHA_THRESHOLD else 0))
    return result

def grid_rects(image):
    """Generated grids can drift a few pixels: split along nearby empty gutters.

    Looking only near each quarter cannot reorder frames. Prefer an empty line,
    then the nearest line to the declared grid; retain coordinates as provenance.
    """
    mask=binary(image).getchannel('A')
    def cuts(length,vertical):
        result=[0]
        radius=max(2,round(length/4*.08))
        for i in range(1,4):
            nominal=length*i/4
            candidates=range(max(result[-1]+1,round(nominal)-radius),min(length,round(nominal)+radius+1))
            def score(p):
                # Require padding on both sides of a cut, not merely the first
                # empty pixel next to a fist. This avoids zero-margin exports
                # when an intact pose extends beyond the nominal quarter.
                lo,hi=max(0,p-2),min(length,p+3)
                rect=(lo,0,hi,image.height) if vertical else (0,lo,image.width,hi)
                return (mask.crop(rect).histogram()[255],abs(p-nominal))
            result.append(min(candidates,key=score))
        return result+[length]
    xs,ys=cuts(image.width,True),cuts(image.height,False)
    return [(xs[i%4],ys[i//4],xs[i%4+1],ys[i//4+1]) for i in range(16)]

def clear_speckles(image):
    """Only discard detached 1–2 native-pixel particles; do not touch body pixels."""
    px = image.load()
    unseen = {(x, y) for y in range(SIZE) for x in range(SIZE) if px[x, y][3]}
    discarded = 0
    while unseen:
        start = unseen.pop()
        component, queue = [start], [start]
        while queue:
            x, y = queue.pop()
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (-1, 1), (1, -1)]:
                q = x+dx, y+dy
                if q in unseen:
                    unseen.remove(q)
                    queue.append(q)
                    component.append(q)
        if len(component) <= 2:
            for p in component:
                px[p] = (0, 0, 0, 0)
            discarded += len(component)
    for y in range(SIZE):
        for x in range(SIZE):
            if not px[x, y][3]:
                px[x, y] = (0, 0, 0, 0)
    return discarded

def foot_center(image, bbox):
    """Find the horizontal contact midpoint from the bottom shoe/foot band."""
    x0, y0, x1, y1 = bbox
    band = max(1, round((y1-y0)*.06))
    px = image.load()
    xs = [x for y in range(y1-band,y1) for x in range(x0,x1) if px[x,y][3]]
    return (min(xs)+max(xs)+1)/2

def registered(image, bbox, scale, anchor_x=None):
    cropped = image.crop(bbox)
    w, h = max(1, round(cropped.width*scale)), max(1, round(cropped.height*scale))
    if w > 116 or h > 112:
        raise ValueError(f'Export would clip {w}x{h}')
    sampled = cropped.resize((w, h), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (SIZE, SIZE))
    anchor_x = foot_center(image,bbox) if anchor_x is None else anchor_x
    offset_x = FOOT[0]-round((anchor_x-bbox[0])*scale)
    if offset_x < 0 or offset_x+w > SIZE:
        raise ValueError(f'Foot registration would clip: {offset_x}+{w}')
    canvas.alpha_composite(sampled, (offset_x, FOOT[1]+1-h))
    removed = clear_speckles(canvas)
    return canvas, removed

def make_sheet(images, path, columns, scale=1, labels=None):
    cell = SIZE*scale
    label_height = 30 if labels else 0
    rows = math.ceil(len(images)/columns)
    sheet = Image.new('RGB', (columns*(cell+12)+12, rows*(cell+label_height+12)+12), '#142239')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
    for i, image in enumerate(images):
        x, y = 12+(i%columns)*(cell+12), 12+(i//columns)*(cell+label_height+12)
        draw.rectangle((x, y, x+cell-1, y+cell-1), fill='#fff2d3' if i%2==0 else '#20354a')
        view = image.resize((cell, cell), Image.Resampling.NEAREST)
        sheet.paste(view, (x, y), view)
        if labels:
            draw.text((x+2, y+cell+5), labels[i], font=font, fill='#f6e8c6')
    sheet.save(path)

def export_character(entry):
    id = entry['id']
    source = PRODUCTION / 'sources' / (id+'.png')
    if not source.exists():
        return None, {'id': id, 'status': 'source-pending'}
    image = Image.open(source).convert('RGBA')
    frames, source_boxes, raw_boxes = [], [], []
    issues = []
    for i,rect in enumerate(grid_rects(image)):
        frame = binary(image.crop(rect))
        box = frame.getbbox()
        if not box:
            raise ValueError(f'{id}: empty frame {i}')
        margin = min(box[0], box[1], frame.width-box[2], frame.height-box[3])
        if margin <= 2:
            issues.append({'frame': i, 'issue': 'source-near-cell-boundary', 'margin': margin})
        frames.append(frame)
        source_boxes.append(box)
        raw_boxes.append(rect)
    back_source = PRODUCTION / 'sources' / (id+'-back.png')
    back_frames, back_boxes, back_rects = [], [], []
    back_image = None
    if id.startswith('hero-') and back_source.exists():
        back_image = Image.open(back_source).convert('RGBA')
        for i,rect in enumerate(grid_rects(back_image)):
            frame=binary(back_image.crop(rect))
            box=frame.getbbox()
            if not box:
                raise ValueError(f'{id}: empty back frame {i}')
            margin=min(box[0],box[1],frame.width-box[2],frame.height-box[3])
            if margin<=2:
                issues.append({'frame':i,'view':'back','issue':'source-near-cell-boundary','margin':margin})
            back_frames.append(frame)
            back_boxes.append(box)
            back_rects.append(rect)
    reviewed_boundaries=[]
    visual_review=None
    review_path=CONTACTS/'visual-review.json'
    if review_path.exists():
        reviews=json.loads(review_path.read_text())
        reviewed=reviews.get('boundaryReviews',[])
        candidate=reviews.get('characters',{}).get(id)
        if candidate and candidate.get('sourceSha256')==sha(source):
            visual_review=candidate
        for issue in issues[:]:
            match=next((r for r in reviewed if r.get('id')==id and r.get('frame')==issue.get('frame') and r.get('sourceSha256')==sha(source) and r.get('accepted') is True),None)
            if match:
                reviewed_boundaries.append({**issue,'review':match['reason']})
                issues.remove(issue)
    anchors = [foot_center(f,b) for f,b in zip(frames,source_boxes)]
    back_anchors = [foot_center(f,b) for f,b in zip(back_frames,back_boxes)]
    max_reach = max(max(a-b[0],b[2]-a) for a,b in zip(anchors+back_anchors,source_boxes+back_boxes))
    scale = min(58/max_reach, 112/max(b[3]-b[1] for b in source_boxes+back_boxes))
    native, removed = [], []
    for frame, box, anchor in zip(frames, source_boxes, anchors):
        out, n = registered(frame, box, scale, anchor)
        native.append(out)
        removed.append(n)
    back_native=[]
    for frame,box,anchor in zip(back_frames,back_boxes,back_anchors):
        out,n=registered(frame,box,scale,anchor)
        back_native.append(out)
        removed.append(n)
    dest = DEST / 'characters' / id
    dest.mkdir(parents=True, exist_ok=True)
    # The chosen original is the protagonist's static identity, with untouched RGB.
    front = native[0]
    front_source = source
    if id == 'hero-female':
        front_source = PRODUCTION / 'approved-reference.png'
        original = binary(Image.open(front_source))
        box = original.getbbox()
        target_height = native[0].getbbox()[3]-native[0].getbbox()[1]
        anchor = foot_center(original,box)
        front, _ = registered(original, box, min(58/max(anchor-box[0],box[2]-anchor), target_height/(box[3]-box[1])),anchor)
    front.save(dest / 'front.png')
    # Portrait uses original-resolution RGB; it is not an enlarged small sprite.
    original_front = binary(Image.open(front_source)) if id=='hero-female' else frames[0]
    box = original_front.getbbox()
    face = original_front.crop((box[0], box[1], box[2], box[1]+round((box[3]-box[1])*.44)))
    face.thumbnail((116, 116), Image.Resampling.NEAREST)
    portrait = Image.new('RGBA', (SIZE, SIZE))
    portrait.alpha_composite(face, ((SIZE-face.width)//2, (SIZE-face.height)//2))
    clear_speckles(portrait)
    portrait.save(dest / 'portrait.png')
    animation = {}
    for name, (indexes, durations, loop) in CLIPS.items():
        atlas = Image.new('RGBA', (SIZE*len(indexes), SIZE))
        for x, index in enumerate(indexes):
            atlas.alpha_composite(native[index], (x*SIZE, 0))
        atlas.save(dest / (name+'.png'))
        animation[name] = {'file': f'characters/{id}/{name}.png', 'frames': len(indexes), 'durationsMs': durations, 'loop': loop, 'sourceFrames': indexes}
    back_animation={}
    if back_native:
        back_native[0].save(dest/'back.png')
        for name,(indexes,durations,loop) in CLIPS.items():
            atlas=Image.new('RGBA',(SIZE*len(indexes),SIZE))
            for x,index in enumerate(indexes):
                atlas.alpha_composite(back_native[index],(x*SIZE,0))
            atlas.save(dest/('back-'+name+'.png'))
            back_animation[name]={'file':f'characters/{id}/back-{name}.png','frames':len(indexes),'durationsMs':durations,'loop':loop,'sourceFrames':indexes}
        make_sheet(back_native,CONTACTS/(id+'-back-frames.png'),4,2,[f'{i:02}' for i in range(16)])
    make_sheet(native, CONTACTS / (id+'-frames.png'), 4, 2, [f'{i:02}' for i in range(16)])
    native_hashes = [hashlib.sha256(f.tobytes()).hexdigest() for f in native+back_native]
    bounds = [list(f.getbbox()) for f in native+back_native]
    source_rgb = {p[:3] for p in image.getdata() if p[3]>=ALPHA_THRESHOLD}
    if back_image:
        source_rgb|={p[:3] for p in back_image.getdata() if p[3]>=ALPHA_THRESHOLD}
    exported_rgb = {p[:3] for f in native+back_native for p in f.getdata() if p[3]}
    assert exported_rgb <= source_rgb, 'Export changed original RGB values'
    if len(set(native_hashes[4:8])) < 3:
        issues.append({'issue': 'insufficient-distinct-attack-poses'})
    assert all(set(f.getchannel('A').getdata()) <= {0,255} for f in native+back_native)
    assert all(b[0]>=0 and b[1]>=0 and b[2]<=128 and b[3]<=123 for b in bounds)
    record = {'id':id,'name':entry['name'],'frame':[128,128],'pivot':list(FOOT),'front':f'characters/{id}/front.png','portrait':f'characters/{id}/portrait.png','animations':animation,
              'source':f'art-production/v2/sources/{id}.png','sourceSha256':sha(source),'frontSourceSha256':sha(front_source),'sourceRects':raw_boxes,'sourceFootCenters':anchors,'sharedScale':scale,'method':'image-model illustration; nearest resampling; alpha cleanup; no palette or facial edits'}
    if back_native:
        record.update({'back':f'characters/{id}/back.png','backAnimations':back_animation,'backSourceSha256':sha(back_source),'backSourceRects':back_rects,'backSourceFootCenters':back_anchors})
    status='needs-source-review' if issues else ('exported-visual-reviewed' if visual_review else 'exported-awaiting-visual-review')
    validation = {'id':id,'status':status,'visualReview':visual_review,'sourceSize':list(image.size),'sharedScale':scale,'frameCount':16,'backFrameCount':len(back_native),'uniqueFrames':len(set(native_hashes)),
                  'alphaValues':[0,255],'rgbValuesPreserved':True,'sourceColors':len(source_rgb),'nativeColors':len(exported_rgb),'bounds':bounds,'feetY':[b[3]-1 for b in bounds],'discardedDetachedPixels':removed,'issues':issues,'reviewedBoundaries':reviewed_boundaries}
    return record, validation

def main():
    CONTACTS.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    roster = json.loads((PRODUCTION/'roster.json').read_text())
    previous=json.loads((DEST/'manifest.json').read_text()) if (DEST/'manifest.json').exists() else {}
    old_validation=json.loads((PRODUCTION/'validation.json').read_text()) if (PRODUCTION/'validation.json').exists() else {}
    old_reports={c['id']:c for c in old_validation.get('characters',[])}
    manifest={'version':VERSION,'name':'Battle Tower illustrated cast','frame':[128,128],'pivot':list(FOOT),'sampling':'nearest','alphaThreshold':ALPHA_THRESHOLD,'characters':{}}
    # Environment/UI PNGs are authored by the art integration task; discover only
    # existing files so rerunning the character exporter never erases their index.
    manifest['backgrounds']={}
    for file in [DEST/'title.png',DEST/'hub.png',*sorted(DEST.glob('arena-*.png'))]:
        if file.exists():
            manifest['backgrounds'][file.stem]={'file':file.name,'size':list(Image.open(file).size),'sampling':'nearest'}
    manifest['icons']={file.stem.removeprefix('icon-'):{'file':file.name,'size':list(Image.open(file).size),'sampling':'nearest'} for file in sorted(DEST.glob('icon-*.png'))}
    validation={'version':VERSION,'expectedCharacters':len(roster),'characters':[],'pending':[]}
    fronts, labels = [], []
    for entry in roster:
        try:
            fingerprint=export_fingerprint(entry)
            cached=previous.get('characters',{}).get(entry['id'])
            if cached and cached.get('exportFingerprint')==fingerprint and entry['id'] in old_reports and cached_files_exist(cached):
                record,report=cached,old_reports[entry['id']]
            else:
                record, report = export_character(entry)
                if record:
                    record['exportFingerprint']=fingerprint
        except (OSError, ValueError) as e:
            validation['pending'].append({'id':entry['id'],'error':str(e)})
            continue
        if record:
            manifest['characters'][entry['id']] = record
            validation['characters'].append(report)
            fronts.append(Image.open(DEST / record['front']).convert('RGBA'))
            labels.append(entry['id'])
        else:
            validation['pending'].append(report)
    if fronts:
        make_sheet(fronts, CONTACTS/'cast-1x.png', 6, 1, labels)
        make_sheet(fronts, CONTACTS/'cast-2x.png', 6, 2, labels)
        portraits=[Image.open(DEST/'characters'/id/'portrait.png').convert('RGBA') for id in labels]
        make_sheet(portraits,CONTACTS/'portraits-1x.png',6,1,labels)
        for start in range(0,len(fronts),12):
            make_sheet(fronts[start:start+12], CONTACTS/f'cast-4x-{start//12+1:02}.png', 4, 4, labels[start:start+12])
            make_sheet(portraits[start:start+12],CONTACTS/f'portraits-2x-{start//12+1:02}.png',4,2,labels[start:start+12])
        for start in range(0,len(fronts),12):
            extremes, extreme_labels=[],[]
            for id in labels[start:start+12]:
                d=DEST/'characters'/id
                for clip,frame in [('front',0),('attack',2),('impact',0),('victory',1),('transform',1)]:
                    atlas=Image.open(d/(clip+'.png')).convert('RGBA')
                    extremes.append(atlas.crop((frame*SIZE,0,(frame+1)*SIZE,SIZE)))
                    extreme_labels.append(id+'\n'+clip)
            make_sheet(extremes,CONTACTS/f'qa-poses-{start//12+1:02}.png',5,1,extreme_labels)
    validation['exportedCharacters']=len(fronts)
    validation['uniqueFronts']=len({hashlib.sha256(f.tobytes()).hexdigest() for f in fronts})
    validation['exportComplete']=len(fronts)==len(roster)
    validation['issuesCount']=sum(len(c['issues']) for c in validation['characters'])
    validation['reviewedCharacters']=sum(c['status']=='exported-visual-reviewed' for c in validation['characters'])
    validation['animationFrames']=sum(c['frameCount']+c['backFrameCount'] for c in validation['characters'])
    validation['runtimeCharacterPngs']=len(list((DEST/'characters').rglob('*.png')))
    manifest_temp=DEST/'characters/.manifest-export.tmp'
    manifest_temp.write_text(json.dumps(manifest,indent=2)+'\n')
    manifest_temp.replace(DEST/'manifest.json')
    validation_temp=CONTACTS/'.validation-export.tmp'
    validation_temp.write_text(json.dumps(validation,indent=2)+'\n')
    validation_temp.replace(PRODUCTION/'validation.json')
    print(json.dumps({k:validation[k] for k in ['expectedCharacters','exportedCharacters','uniqueFronts','exportComplete','issuesCount']}))

if __name__=='__main__':
    # Watcher and a requested manual rerun must never write atlases simultaneously.
    with open('/tmp/battle-tower-art-v2-export.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        main()
