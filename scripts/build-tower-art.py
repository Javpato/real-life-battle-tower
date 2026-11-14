"""Battle Tower: original native pixel geometry. No input images or downsampling.
All coordinates are authored on the output pixel grid. Pillow is only a raster pen.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import random,json,math
OUT=Path(__file__).resolve().parents[1]/'public/assets/tower'
OUT.mkdir(parents=True,exist_ok=True)
INK='#24334b'; LIGHT='#fff0c9'; GOLD='#efbd62'
def canvas(w,h,bg=None):
 im=Image.new('RGBA',(w,h),bg or (0,0,0,0));return im,ImageDraw.Draw(im)
def poly(d,pts,c,o=INK,width=2):d.polygon(pts,fill=c);d.line(pts+[pts[0]],fill=o,width=width)
def box(d,b,c,o=None):d.rectangle(b,fill=c,outline=o)
def save(im,n):im.save(OUT/(n+'.png'))
def tree(d,x,y,s=1,kind=0):
 box(d,(x-3*s,y-14*s,x+3*s,y+3*s),'#655a48',INK)
 if kind==1:
  for k in range(3):
   yy=y-19*s-k*10*s;poly(d,[(x-16*s+k*3*s,yy+13*s),(x,yy-13*s),(x+16*s-k*3*s,yy+13*s)],['#365f67','#42777a','#55938a'][k])
 else:
  for dx,dy,r,c in [(-8,-24,13,'#376963'),(8,-26,13,'#376963'),(0,-37,14,'#4a8f70'),(-5,-35,10,'#70b885'),(7,-31,8,'#529c74')]:
   d.ellipse((x+(dx-r)*s,y+(dy-r)*s,x+(dx+r)*s,y+(dy+r)*s),fill=c,outline=INK,width=s)
  for dx,dy in [(-9,-38),(-3,-44),(5,-38),(-14,-29),(2,-29),(12,-30)]:box(d,(x+dx*s,y+dy*s,x+(dx+3)*s,y+(dy+2)*s),'#a1d48d')
def stone(d,x,y,w,h,c='#8b9da7'):
 box(d,(x,y,x+w,y+h),c,INK);box(d,(x+2,y+2,x+w-2,y+3),'#d3d7be')
 for yy in range(y+8,y+h,8):
  d.line((x,yy,x+w,yy),fill='#5e7382');
  for xx in range(x+((yy//8)%2)*8,x+w,16):d.line((xx,yy,xx, min(yy+8,y+h)),fill='#5e7382')
def cloud(d,x,y,c='#f2e6c7'):
 for b in [(x,y+5,x+45,y+13),(x+8,y,x+25,y+15),(x+23,y+3,x+36,y+14)]:box(d,b,c)
def landscape(zone=0,hub=False):
 palettes=[('#91c5cb','#b9d9c1','#6c9b83','#819b72','#b4bd83'),('#a0ced2','#cee4c4','#56856b','#6f9365','#9eb77e'),('#e8b78c','#f7d8a4','#a27970','#aa8c76','#c4a788'),('#6b91b3','#b9cad1','#49677f','#6d8794','#94a7aa'),('#8b83b0','#d6bad1','#675d89','#79739a','#b5a6bc'),('#344d78','#ad9db3','#35455f','#535e79','#81909b')]
 sky,haze,mount,ground,grass=palettes[zone%6];im,d=canvas(480,270,sky);rng=random.Random(100+zone)
 box(d,(0,86,480,139),haze)
 for x,y in [(20,28),(170,18),(340,44)]:cloud(d,x,y)
 for x,y in [(-30,72),(95,47),(225,64),(365,39)]:
  poly(d,[(x,142),(x+62,y),(x+147,145)],mount,o=mount);poly(d,[(x+42,y+29),(x+62,y),(x+89,y+34),(x+66,y+23)],haze,o=haze,width=1)
 box(d,(0,133,480,270),ground)
 for i in range(210):
  x=rng.randrange(480);y=rng.randrange(140,270);box(d,(x,y,x+2,y+1),grass)
 if hub:
  # River and stone embankments, a path with a coherent vanishing direction.
  poly(d,[(0,199),(155,189),(205,204),(480,201),(480,223),(192,224),(145,210),(0,222)],'#457d9c',o='#658d90')
  for i in range(45):
   x=rng.randrange(480);y=rng.randrange(204,219);box(d,(x,y,x+7,y),'#9bcbcb')
  poly(d,[(224,139),(257,139),(299,270),(181,270)],'#d3ba8b',o='#6d806c')
  for y in range(147,270,12):d.line((218-(y-145)//3,y,262+(y-145)//3,y),fill='#ad9777')
  # Monumental tower: stepped octagonal bastion and visible side planes.
  stone(d,195,80,90,96,'#adb9aa');poly(d,[(285,80),(301,68),(301,162),(285,176)],'#718b90')
  stone(d,207,43,66,42,'#b7c3b1');poly(d,[(273,43),(287,35),(287,75),(273,85)],'#7c9697')
  stone(d,220,22,40,23,'#c8c9ad');poly(d,[(213,22),(240,2),(269,22)],'#56737f')
  for xx in [197,216,254,273]:stone(d,xx,74,10,13,'#d4d6bc')
  for xx in [213,258]:box(d,(xx,55,xx+8,70),INK);box(d,(xx+2,57,xx+5,66),'#9bcebc')
  for xx in [205,265]:box(d,(xx,96,xx+9,116),'#32475b');box(d,(xx+2,98,xx+6,113),'#83c8bc')
  d.ellipse((224,130,256,162),fill=INK);box(d,(224,146,256,176),INK);box(d,(229,147,251,174),'#795949');box(d,(238,147,240,174),'#c39b61')
  for xx,c in [(214,'#d77966'),(253,'#65a4b4')]:poly(d,[(xx,88),(xx+12,88),(xx+12,121),(xx+6,127),(xx,121)],c);box(d,(xx+5,94,xx+7,114),GOLD)
  for x,y in [(34,178),(81,160),(421,176),(456,158),(102,250),(392,252)]:tree(d,x,y,1,zone%2)
  # Lodge and workshop distinct footprints.
  for x,y,c in [(60,207,'#b96855'),(348,208,'#476e83')]:
   stone(d,x,y-39,66,40,'#e3d7b6');poly(d,[(x-7,y-40),(x+14,y-62),(x+63,y-62),(x+76,y-40)],c)
   for yy in range(y-57,y-40,5):d.line((x+12,yy,x+65,yy),fill='#f0b28a' if x==60 else '#7fa4aa')
   box(d,(x+26,y-22,x+39,y),INK)
   for xx in [x+7,x+48]:box(d,(xx,y-25,xx+11,y-13),'#6097a4',INK);box(d,(xx+2,y-23,xx+8,y-21),LIGHT)
  for x in [178,302]:
   box(d,(x,204,x+2,235),INK);box(d,(x-4,197,x+6,206),GOLD,INK);box(d,(x-2,199,x+2,203),LIGHT)
 else:
  for x in [15,47,418,463]:tree(d,x,165,1,zone%2)
  # Six architectural arenas, not recolored copies.
  if zone==0:
   for x in [60,365]:stone(d,x,110,40,65);box(d,(x-4,106,x+44,115),LIGHT,INK)
  elif zone==1:
   for x,y in [(86,155),(369,150),(160,137)]:tree(d,x,y,1)
   for x in range(60,420,24):box(d,(x,164,x+12,166),'#caa76a')
  elif zone==2:
   for x in [68,359]:stone(d,x,88,50,85,'#b79479');poly(d,[(x-6,89),(x+25,66),(x+57,89)],'#b26e59')
   for y in range(140,171,8):box(d,(170-(y-140),y,310+(y-140),y+4),'#d2ae88')
  elif zone==3:
   for x in [70,360]:
    stone(d,x,95,35,80,'#71818f');poly(d,[(x-5,95),(x+18,70),(x+42,95)],'#445775');box(d,(x+11,112,x+23,152),'#72bfca',INK)
  elif zone==4:
   for x in [77,367]:
    poly(d,[(x,171),(x-19,120),(x-8,83),(x+14,97),(x+25,142)],'#a38fcc');poly(d,[(x-8,87),(x+3,113),(x,166),(x-14,121)],'#d0bee4',o='#8075ad')
  else:
   for x in [50,380]:stone(d,x,77,43,100,'#697b8c');box(d,(x+7,89,x+35,151),'#26394f',GOLD)
   d.ellipse((216,58,264,106),fill=GOLD,outline=INK,width=3);d.ellipse((225,67,255,97),fill=sky)
  # Ground-aligned platforms. Exact feet exported in registry.
  for x,y,rx,ry in [(136,228,85,20),(349,170,65,16)]:
   d.ellipse((x-rx,y-ry,x+rx,y+ry),fill='#475e68',outline=INK,width=2)
   d.ellipse((x-rx,y-ry-5,x+rx,y+ry-5),fill='#bfbd99',outline=LIGHT,width=2)
   d.ellipse((x-rx+8,y-ry+1,x+rx-8,y+ry-11),outline='#7c947c',width=2)
   for dx in range(-rx+18,rx-12,18):box(d,(x+dx,y+8,x+dx+7,y+9),'#d8d0a9')
 return im
for z in range(6):save(landscape(z),f'arena-{z}')
save(landscape(0,True),'hub');save(landscape(4,True),'title')

# Human figures drawn in native 128px cells with fixed foot anchor, separate anatomical poses.
def character(kind=0,back=False,frame=0):
 im,d=canvas(128,128);female=kind==1;enemy=kind>=2
 palettes=[('#448d9c','#8dc9bf','#cf7752'),('#c75f69','#efae83','#473e66'),('#748b4b','#c8cb75','#5e473a'),('#bd8050','#efc080','#343d50'),('#647cb2','#b0c2d7','#44364e'),('#bb6c53','#e9b778','#6b4b43'),('#606c88','#b4bfbe','#b47854'),('#776091','#c9a1c2','#e5c99e'),('#3b5669','#7cb9b5','#eee4b3'),('#9c575f','#e4b788','#40354a')]
 coat,hi,hair=palettes[kind];skin=['#e8b58c','#c98f6c','#d6a57d'][kind%3];shadow='#a87561';bob=frame%2
 # Deliberately distinct pose parameters per identity.
 shoulder=[22,18,24,27,18,23,30,17,25,28][kind];lean=[0,2,-3,3,-1,0,-2,2,0,1][kind];cx=64+lean
 leftx=44 if kind not in [3,6,9] else 38;rightx=78 if kind not in [3,6,9] else 84
 poly(d,[(cx-15,72),(cx-1,76),(leftx+10,103),(leftx+7,114),(leftx-3,113),(leftx-1,99)],'#46556c')
 poly(d,[(cx+1,75),(cx+17,71),(rightx+3,100),(rightx+4,114),(rightx-7,114),(rightx-10,102)],'#354459')
 for x in [leftx,rightx]:poly(d,[(x-6,106),(x+7,105),(x+9,115),(x-10,116),(x-11,113)],'#785549');box(d,(x-6,107,x+4,109),'#ba8960');box(d,(x-10,115,x+9,117),INK)
 # Long jacket/cape only for selected silhouettes; others sport short training wear.
 if kind in [0,1,4,7,8]:poly(d,[(cx-18,43),(cx+19,43),(cx+26,93),(cx+9,89),(cx,96),(cx-24,88)],coat)
 poly(d,[(cx-shoulder,43-bob),(cx-10,36-bob),(cx+11,36-bob),(cx+shoulder,44-bob),(cx+16,76),(cx-17,77)],coat)
 poly(d,[(cx-9,43),(cx+8,42),(cx+10,69),(cx-11,69)],'#e9dcb8' if kind<2 else hi)
 box(d,(cx-18,71,cx+17,77),'#594b49',INK);box(d,(cx-3,71,cx+3,76),GOLD,INK)
 # Arms: poised runner / guard / martial / staff silhouettes.
 if kind in [3,6,9]:
  poly(d,[(cx-shoulder,43),(cx-shoulder-8,54),(cx-34,44),(cx-37,34),(cx-28,30),(cx-22,43),(cx-15,52)],skin)
  poly(d,[(cx+shoulder,44),(cx+36,59),(cx+32,69),(cx+16,57)],skin)
  box(d,(cx-38,30,cx-28,41),coat,INK);box(d,(cx+25,60,cx+35,70),coat,INK)
 elif kind in [4,7]:
  poly(d,[(cx-shoulder,44),(cx-29,58),(cx-43,53),(cx-47,58),(cx-30,69),(cx-13,55)],coat)
  poly(d,[(cx+shoulder,44),(cx+24,62),(cx+30,55),(cx+35,58),(cx+28,74),(cx+14,68)],coat)
  d.line((cx+35,38,cx+35,115),fill=INK,width=5);d.line((cx+35,38,cx+35,114),fill=GOLD,width=2);poly(d,[(cx+35,26),(cx+29,36),(cx+35,46),(cx+41,36)],hi)
 else:
  poly(d,[(cx-shoulder,44),(cx-shoulder-5,68),(cx-20,85),(cx-12,82),(cx-20,65),(cx-14,48)],coat)
  poly(d,[(cx+shoulder,44),(cx+29,58),(cx+23,72),(cx+16,69),(cx+19,56),(cx+13,48)],coat)
  box(d,(cx-21,78,cx-13,86),skin,INK);box(d,(cx+17,65,cx+25,73),skin,INK)
 # Neck, face and deliberately designed hair.
 box(d,(cx-5,31-bob,cx+6,44-bob),skin,INK)
 poly(d,[(cx-12,12-bob),(cx+7,9-bob),(cx+16,20-bob),(cx+12,35-bob),(cx+3,40-bob),(cx-9,35-bob),(cx-15,24-bob)],skin)
 box(d,(cx-10,27-bob,cx-7,33-bob),shadow);box(d,(cx+7,31-bob,cx+10,34-bob),shadow)
 if back:
  poly(d,[(cx-14,12-bob),(cx+9,8-bob),(cx+17,22-bob),(cx+11,37-bob),(cx-10,36-bob),(cx-16,24-bob)],hair)
  poly(d,[(cx-11,48),(cx+12,48),(cx+16,68),(cx+9,77),(cx-12,74)],'#8b6f4d');box(d,(cx-8,53,cx+8,56),GOLD)
 else:
  poly(d,[(cx-15,24-bob),(cx-16,12-bob),(cx-9,9-bob),(cx-4,4-bob),(cx+1,9-bob),(cx+12,7-bob),(cx+17,18-bob),(cx+10,22-bob),(cx+8,15-bob),(cx-5,19-bob),(cx-8,27-bob)],hair)
  box(d,(cx-5,24-bob,cx-2,27-bob),INK);box(d,(cx+7,23-bob,cx+10,26-bob),INK);box(d,(cx-4,24-bob,cx-4,24-bob),LIGHT);box(d,(cx+8,23-bob,cx+8,23-bob),LIGHT);box(d,(cx+1,33-bob,cx+6,33-bob),'#925e53')
 # Personal equipment and fine pixel clusters.
 if female:
  for j in range(6):box(d,(cx+13+j%2,22+j*5,cx+20+j%2,28+j*5),hair,INK)
  box(d,(cx+14,49,cx+21,52),GOLD);poly(d,[(cx-18,40),(cx+13,39),(cx+10,47),(cx-15,48)],hi)
 elif kind==0:
  poly(d,[(cx-15,38),(cx+15,39),(cx+10,47),(cx-13,46)],hi);poly(d,[(cx+9,43),(cx+30,37),(cx+28,45),(cx+15,51)],hi)
 elif kind==2:
  poly(d,[(cx-18,15),(cx-13,7),(cx+11,7),(cx+18,17)],coat);box(d,(cx-20,16,cx+22,20),GOLD,INK);box(d,(cx-24,47,cx-20,70),'#d7b479')
 elif kind==3:box(d,(cx-13,17,cx+14,20),hi);box(d,(cx-10,75,cx+12,80),hi)
 elif kind==4:poly(d,[(cx-17,14),(cx-3,0),(cx+14,13)],coat);box(d,(cx-17,14,cx+16,17),GOLD)
 elif kind==5:
  box(d,(cx-14,17,cx+15,20),hi);box(d,(cx-14,81,cx-4,94),hi);box(d,(cx+5,81,cx+14,95),hi)
 elif kind==6:
  poly(d,[(cx-shoulder,42),(cx-9,46),(cx-12,54),(cx-34,51)],hi);poly(d,[(cx+9,45),(cx+shoulder,41),(cx+35,51),(cx+12,56)],hi)
 elif kind==7:
  for yy in [53,60,67]:box(d,(cx-8,yy,cx+8,yy),GOLD)
 elif kind==8:
  poly(d,[(cx-19,43),(cx+1,49),(cx+20,42),(cx+18,55),(cx,63),(cx-18,55)],hi);box(d,(cx-5,50,cx+5,57),GOLD,INK)
 elif kind==9:
  poly(d,[(cx-17,13),(cx-13,2),(cx-3,10),(cx+8,1),(cx+16,14)],hi);box(d,(cx-17,15,cx+16,18),GOLD)
 for x,y in [(cx-16,52),(cx-15,57),(cx+12,62),(cx+9,67)]:box(d,(x,y,x+2,y+3),hi)
 return im
chars=['hero-male','hero-female','moss','pip','fern','terra','flint','zephyr','rowan','warden']
for i,n in enumerate(chars):
 for v in ['front','back'] if i<2 else ['front']:
  sheet=Image.new('RGBA',(512,128))
  for f in range(4):sheet.alpha_composite(character(i,v=='back',f),(f*128,0))
  save(sheet,n+'-'+v);save(character(i,v=='back'),n+'-'+v+'-still')
# Separate native exploration/idle figures, not reduced portraits.
for k,n in enumerate(chars):
 im,d=canvas(192,48)
 for f in range(4):
  x=f*48+24;y=f%2;coat=['#448d9c','#c75f69','#748b4b','#bd8050','#647cb2','#bb6c53','#606c88','#776091','#3b5669','#9c575f'][k]
  poly(d,[(x-7,28-y),(x+7,28-y),(x+8,39),(x+4,43),(x,36),(x-4,43),(x-8,42)],'#405169',width=1)
  poly(d,[(x-8,18-y),(x+8,18-y),(x+11,29-y),(x+7,34-y),(x-8,34-y),(x-11,27-y)],coat,width=1)
  box(d,(x-5,33-y,x+6,34-y),GOLD);poly(d,[(x-7,7-y),(x+5,6-y),(x+9,12-y),(x+7,20-y),(x,23-y),(x-7,19-y)],'#e7b58e',width=1)
  poly(d,[(x-8,12-y),(x-5,5-y),(x+6,4-y),(x+9,10-y),(x+5,13-y),(x-2,10-y)],'#433b50' if k%2 else '#ba7751',width=1)
  box(d,(x-3,16-y,x-2,17-y),INK);box(d,(x+4,16-y,x+5,17-y),INK)
  if k==1:box(d,(x+8,14-y,x+10,30-y),'#433b50')
  if k==7:d.line((x+14,15,x+14,43),fill=GOLD,width=2)
 save(im,n+'-idle')
# 32px handcrafted icon tiles.
icons=['leg','arm','back','coin','potion','shield','star','tower','bag','settings','play','pause']
for name in icons:
 im,d=canvas(32,32)
 if name=='coin':
  d.ellipse((5,3,27,29),fill='#ac704c',outline=INK,width=2);d.ellipse((4,2,26,27),fill=GOLD,outline=LIGHT,width=2);box(d,(13,8,17,21),'#a76948');box(d,(10,13,20,16),'#a76948')
 elif name=='potion':
  poly(d,[(11,4),(21,4),(21,11),(27,18),(25,28),(7,28),(5,18),(11,11)],'#91cbce');box(d,(9,18,24,25),'#ce6e79');box(d,(10,2,22,7),'#b88c61',INK);box(d,(9,13,11,19),LIGHT)
 elif name=='shield':poly(d,[(5,5),(16,2),(27,5),(26,21),(16,30),(6,21)],'#569497');poly(d,[(10,8),(16,6),(22,8),(21,19),(16,24),(11,19)],GOLD)
 elif name=='star':poly(d,[(16,2),(20,11),(30,12),(23,19),(25,29),(16,24),(7,29),(9,19),(2,12),(12,11)],GOLD)
 elif name=='tower':stone(d,7,10,19,19);box(d,(6,4,10,13),LIGHT,INK);box(d,(14,4,18,13),LIGHT,INK);box(d,(22,4,27,13),LIGHT,INK);box(d,(13,20,19,29),INK)
 elif name=='leg':poly(d,[(10,2),(21,2),(20,13),(16,20),(22,25),(27,25),(27,30),(14,30),(8,22),(12,12)],'#85b580')
 elif name=='arm':poly(d,[(5,26),(5,13),(9,8),(13,8),(15,14),(12,18),(16,21),(22,17),(27,20),(27,27),(18,30)],'#ce8065');box(d,(7,4,15,10),GOLD,INK)
 elif name=='back':poly(d,[(16,6),(10,3),(5,6),(2,13),(10,17),(12,29),(21,29),(23,17),(30,13),(26,6),(21,3)],'#939bce');d.line((16,10,16,25),fill=LIGHT,width=2)
 elif name=='bag':poly(d,[(9,7),(12,3),(21,3),(24,7),(27,12),(27,29),(5,29),(5,12)],'#b78c60');box(d,(10,17,22,25),GOLD,INK);box(d,(15,18,17,21),LIGHT)
 elif name=='play':poly(d,[(8,4),(27,16),(8,28)],GOLD)
 elif name=='pause':box(d,(6,5,12,28),GOLD,INK);box(d,(20,5,26,28),GOLD,INK)
 else:
  for a in range(8):
   x=16+int(math.cos(a*math.pi/4)*10);y=16+int(math.sin(a*math.pi/4)*10);box(d,(x-3,y-3,x+3,y+3),'#9bb0ba',INK)
  d.ellipse((6,6,26,26),fill='#9bb0ba',outline=INK,width=2);d.ellipse((12,12,20,20),fill=INK)
 save(im,'icon-'+name)
manifest={'version':1,'name':'Battle Tower native pixel atlas','provenance':{'author':'Codex','source':'scripts/build-tower-art.py','method':'Original integer-coordinate raster drawing; no input images, image rescaling or proprietary artwork'},'pixelRules':{'outline':INK,'light':'upper-left','sampling':'nearest','worldTile':16},'characters':{n:{'front':n+'-front.png','still':n+'-front-still.png','back':n+'-back.png' if i<2 else None,'idle':n+'-idle.png','frame':[128,128],'frames':4,'foot':[64,117],'idleFrame':[48,48]} for i,n in enumerate(chars)},'battle':{'size':[480,270],'heroFoot':[136,228],'enemyFoot':[349,170],'zones':[f'arena-{i}.png' for i in range(6)]},'icons':{n:f'icon-{n}.png' for n in icons}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Created {len(list(OUT.glob("*.png")))} original PNGs')
