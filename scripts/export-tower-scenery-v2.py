"""Crop and export image-generated scenery/icons; no primary illustration."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art-production/v2/sources'
OUT=ROOT/'public/assets/tower-v2'
for name in ['title','hub']:
    Image.open(SOURCE/(name+'.png')).convert('RGBA').resize((480,270),Image.Resampling.NEAREST).save(OUT/(name+'.png'))
atlas=Image.open(SOURCE/'arenas.png').convert('RGBA');w,h=atlas.size
for i in range(6):
    x,y=i%3,i//3
    tile=atlas.crop((round(x*w/3)+3,round(y*h/2)+3,round((x+1)*w/3)-3,round((y+1)*h/2)-3))
    tw,th=tile.size;cw=int(th*16/9)
    tile.crop(((tw-cw)//2,0,(tw+cw)//2,th)).resize((480,270),Image.Resampling.NEAREST).save(OUT/f'arena-{i}.png')
icons=Image.open(SOURCE/'icons-transparent.png').convert('RGBA');w,h=icons.size
names='leg arm back core cardio mobility coin potion shield star tower bag settings play pause trophy training skill record flash lock crystal stairs gloves'.split()
for i,name in enumerate(names):
    x,y=i%6,i//6
    tile=icons.crop((round(x*w/6),round(y*h/4),round((x+1)*w/6),round((y+1)*h/4)))
    tile.putalpha(tile.getchannel('A').point(lambda a:255 if a>=220 else 0))
    assert tile.getbbox(),name
    tile=tile.crop(tile.getbbox());tile.thumbnail((28,28),Image.Resampling.NEAREST)
    icon=Image.new('RGBA',(32,32));icon.alpha_composite(tile,((32-tile.width)//2,(32-tile.height)//2));icon.save(OUT/f'icon-{name}.png')
(OUT/'scenery.json').write_text(json.dumps({'version':2,'source':'art-production/v2/sources','method':'image_gen illustration; native nearest-neighbor export; no palette recoloring','size':[480,270],'battleFeet':{'hero':[.312,.815],'enemy':[.77,.618]},'zones':[f'arena-{i}.png' for i in range(6)],'title':'title.png','hub':'hub.png','icons':{name:f'icon-{name}.png' for name in names}},indent=2)+'\n')
