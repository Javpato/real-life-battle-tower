"""Original deterministic native pixel designs; separate exploration art, never scaled portraits."""
from PIL import Image, ImageDraw
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
# outfit, hair, skin, accessory; follows identities and palettes of preserved battle cast.
palettes=[('#285c68','#ad623d','#e9ba86','cape'),('#285c68','#743c33','#ecc092','braid'),('#49634a','#493b2c','#dcb07a','pack'),('#bd813e','#59372d','#e7b482','scarf'),('#c2b6be','#624854','#e6ba95','leaf'),('#a77546','#bc6336','#b77b50','braid'),('#8a4548','#2b303e','#dca16c','belt'),('#668e9a','#c3c6c1','#e2c3a3','braid'),('#494251','#665157','#e1bb92','coat'),('#e0d2a6','#b37a64','#efc29b','cap'),('#b38b4e','#5e4939','#d6aa77','cap'),('#8a77a3','#5c4a67','#e0b38a','cap'),('#7c9852','#736045','#dcb181','cap'),('#b77c5e','#583c36','#d8a27c','braid'),('#8c7ba4','#463b44','#b78e6c','braid'),('#588c8f','#72513c','#ddae7d','scarf')]
ids=['hero','hero-female','trainer-1','trainer-2','trainer-3','leader-leg','leader-arm','leader-back','rival','healer','shop','alchemy','quest-squat','quest-pushup','quest-birddog','quest-lunge']
im=Image.new('RGBA',(48*16,48*16))
for row,(outfit,hair,skin,acc) in enumerate(palettes):
 for direction in range(4):
  for step in range(4):
   d=ImageDraw.Draw(im);ox=(direction*4+step)*48;oy=row*48;bob=1 if step in [1,3] else 0
   def r(box,c):d.rectangle((ox+box[0],oy+box[1]-bob,ox+box[2],oy+box[3]-bob),fill=c)
   dark='#293339';cream='#eddbac';boot='#6c4b35'
   r((15,40,32,42),'#243b3940');r((17,27,30,38),dark);r((17,36+(step==1),22,41+(step==1)),boot);r((26,36+(step==3),31,41+(step==3)),boot)
   r((13,20,34,31),dark);r((15,21,32,30),outfit);r((18,22,29,29),cream);r((17,30,30,32),boot);r((24,30,26,32),'#d6b164')
   r((15,8,32,22),dark);r((16,9,31,21),skin);r((14,7,32,13),hair);r((17,5,29,9),hair);r((14,10,17,17),hair)
   if direction==3:r((16,9,31,23),hair);r((16,22,31,32),outfit)
   else:
    if direction in [0,2]:r((27,15,28,17),dark);r((28,15,28,15),cream)
    if direction in [0,1]:r((19,15,20,17),dark);r((20,15,20,15),cream)
    r((23,20,26,20),'#a46d4a')
   r((12,23,15,30+(step==3)),skin);r((32,23,35,30+(step==1)),skin)
   if acc=='braid':r((31,11,35,27),hair);r((33,26,35,29),'#d8b05e')
   if acc in ['cape','braid'] and row in [0,1,7]:r((14,22,17,36),outfit);r((30,22,33,36),outfit);r((18,23,20,24),'#d5ad65')
   if acc=='cap':r((13,7,34,11),outfit);r((17,4,30,8),outfit)
   if acc=='scarf':r((16,21,32,23),'#b34f45');r((30,22,34,28),'#b34f45')
   if acc=='pack' and direction==3:r((18,24,29,33),'#9f8254')
   if acc=='coat':r((14,28,18,37),outfit);r((30,28,34,37),outfit);r((18,24,19,35),'#c4a366')
   if acc=='leaf':r((30,7,33,10),'#d5b468')
im.save(root/'public/assets/sprites/overworld-v3.png')
icons=Image.new('RGBA',(16*7,16));d=ImageDraw.Draw(icons)
patterns=['00110000/00110000/11111100/11111100/00110000/00110000','01111000/11001100/11111100/11111100/01111000/00110000','00110000/01111000/11111100/01111000/00110000/00000000','01111000/11001100/10110100/10110100/11111100/01111000','10000100/01001000/00110000/00110000/01001000/10000100','01111000/11001100/00011000/00110000/00000000/00110000','00110000/01111000/11111100/01111000/00110000/00000000']
for i,p in enumerate(patterns):
 d.rounded_rectangle((i*16+1,1,i*16+14,14),radius=3,fill='#263c45',outline='#e1c88a')
 for y,row in enumerate(p.split('/')):
  for x,c in enumerate(row):
   if c=='1':d.point((i*16+4+x,y+4),fill=['#b8dda3','#f3cf72','#c6b0dc','#e5c27d','#f2b386','#f6df9b','#a6ddda'][i])
icons.save(root/'public/assets/sprites/indicators-v3.png')
p=root/'public/assets/manifest.json';m=json.loads(p.read_text());m['sheets']['overworld']={'path':'assets/sprites/overworld-v3.png','width':768,'height':768,'columns':16,'rows':16};m['sheets']['indicators']={'path':'assets/sprites/indicators-v3.png','width':112,'height':16,'columns':7,'rows':1};m['overworldCharacters']={id:{'sheet':'overworld','row':i} for i,id in enumerate(ids)};p.write_text(json.dumps(m,indent=2)+'\n')
