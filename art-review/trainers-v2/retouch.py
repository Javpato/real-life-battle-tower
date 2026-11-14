"""Limited native-pixel correction of imagegen R2 artwork, not a drawing generator.
No scaling, geometric body construction, stroke expansion or filters on final art.
Run from anywhere. Native changes are individually reported before registration.
"""
from pathlib import Path
from PIL import Image
import json,subprocess,sys
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'final';OUT.mkdir(exist_ok=True)
report={}
for name in ['a-trail-athlete','b-strength-specialist','c-veteran-coach']:
 original=Image.open(ROOT/'working'/f'{name}-redraw.png').convert('RGBA');assert original.size==(96,96)
 im=original.copy();changes=[]
 def put(x,y,rgb,reason):
  old=im.getpixel((x,y));assert old[3]==255,(name,x,y,'attempt to extend silhouette')
  new=(*rgb,255)
  if old!=new:im.putpixel((x,y),new);changes.append({'x':x,'y':y,'before':list(old[:3]),'after':list(rgb),'reason':reason})
 if name.startswith('a-'):
  ink=(23,21,30);skin=(252,199,155);ivory=(251,237,220)
  for x,y,c in [(47,20,ink),(48,20,ink),(46,21,skin),(47,21,skin),(48,21,skin),(53,21,ink),(54,21,ink),(53,22,ivory),(54,22,ink),(53,23,ivory),(54,23,ink),(52,23,skin),(52,24,skin),(53,24,skin)]:put(x,y,c,'separate eyebrow and two-pixel eye clusters; remove alternating far-eye stripe')
  for x,y,c in [(49,26,ink),(50,26,ink),(49,27,(141,57,57)),(50,27,skin)]:put(x,y,c,'replace tiny open O mouth with legible asymmetric smile')
  # The existing ivory collar already separates well; no cloth changes are warranted.
 elif name.startswith('b-'):
  skin=(181,119,82);shadow=(137,82,64);highlight=(213,156,111)
  mapping={(247,182,137):skin,(194,127,100):shadow}
  regions={'face':(41,21,56,32),'neck':(43,32,49,38),'raised fist':(34,32,40,38),'left forearm':(30,38,38,45),'midriff':(39,44,51,50),'right forearm':(56,45,64,52),'right hand':(59,55,66,61),'left ankle':(29,78,34,84),'right ankle':(58,78,64,84)}
  for label,(x0,y0,x1,y1) in regions.items():
   for y in range(y0,y1):
    for x in range(x0,x1):
     old=im.getpixel((x,y))
     if old[3] and old[:3] in mapping:put(x,y,mapping[old[:3]],'restore medium-brown skin, masked '+label)
  for x,y,c in [(50,22,highlight),(51,22,highlight),(48,28,skin),(49,28,skin),(55,27,skin),(54,27,skin),(49,25,(31,22,35)),(49,27,(31,22,35))]:put(x,y,c,'restrain oversized eye highlights and retain warm forehead light')
 else:
  ink=(26,20,34);skin=(243,186,129);ivory=(245,231,209)
  for x,y,c in [(49,20,ink),(50,20,skin),(51,20,skin),(49,21,ink),(50,21,skin),(51,21,skin),(48,22,skin),(49,22,skin),(54,19,ink),(55,19,ink),(54,20,ivory),(55,20,ink),(54,21,ivory),(55,21,ink),(54,22,skin),(55,22,skin)]:put(x,y,c,'clean two-pixel eyes and eyebrows without changing face contour')
  beard={(160,148,157):(116,127,144),(245,231,209):(219,228,226),(235,212,192):(177,190,198),(199,172,140):(177,190,198)}
  for y in range(25,29):
   for x in range(44,54):
    c=im.getpixel((x,y))
    if c[3] and c[:3] in beard:put(x,y,beard[c[:3]],'cool existing beard clusters only; keep face and jacket warm')
  for x,y in [(50,26),(51,26),(52,26)]:put(x,y,(116,127,144),'separate beard smile from skin shadows')
 # Only observed micro-edits above affect native art. Registration translates pixels intact.
 retouched=im.copy();unique={(r['x'],r['y']) for r in changes};native_delta=sum(original.getpixel((x,y))!=retouched.getpixel((x,y)) for x,y in unique)
 shift=(2,1 if name.startswith('c-') else 0)
 final=Image.new('RGBA',(96,96));final.alpha_composite(im,shift)
 # Clear hidden RGB in already transparent cells for a clean portable grid.
 px=final.load()
 for y in range(96):
  for x in range(96):
   if px[x,y][3]==0:px[x,y]=(0,0,0,0)
 assert final.getbbox()[3]-1==92
 assert set(final.getchannel('A').getdata())<={0,255}
 output=OUT/f'{name}.png';final.save(output);final.resize((384,384),Image.Resampling.NEAREST).save(OUT/f'{name}-4x.png')
 source=OUT/f'{name}.json'
 subprocess.run([sys.executable,'/home/javpato/.codex/skills/pixel-art-studio/scripts/pixel_art.py','from-png',str(output),str(source)],check=True,capture_output=True,text=True)
 grid=json.loads(source.read_text());grid['pivot']=[48,92];source.write_text(json.dumps(grid,indent=2)+'\n')
 color_count=len({c for c in final.getdata() if c[3]})
 report[name]={'nativeSize':[96,96],'status':'first-art-proof candidate; requires user approval','source':f'working/{name}-redraw.png','nativePixelChanges':native_delta,'visibleSourcePixels':sum(c[3]>0 for c in original.getdata()),'registrationTranslation':list(shift),'footBaselineY':92,'pivot':[48,92],'opaqueColors':color_count,'binaryAlpha':True,'bbox':list(final.getbbox()),'edits':changes,'preserved':'Generated anatomy, silhouette, outfit shapes and poses. No resampling of native final art. Only preview is enlarged with nearest-neighbor.'}
(OUT/'retouch-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({n:{k:v[k] for k in ['nativePixelChanges','opaqueColors','registrationTranslation','bbox']} for n,v in report.items()},indent=2))
