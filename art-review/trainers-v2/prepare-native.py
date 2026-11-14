"""Processing only. Prepare image-generated coarse redraws for native pixel retouching.
Not a character illustrator; does not construct anatomy, clothing or poses.
Working files are intermediate and must not be presented as approved final sprites.
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent
(ROOT / 'working').mkdir(exist_ok=True)
for source in (ROOT / 'sources').glob('*-redraw.png'):
    generated = Image.open(source).convert('RGBA')
    native = generated.resize((96, 96), Image.Resampling.NEAREST)
    alpha = native.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    native = native.convert('RGB').quantize(colors=28, dither=Image.Dither.NONE).convert('RGBA')
    native.putalpha(alpha)
    native.save(ROOT / 'working' / source.name)
    native.resize((384, 384), Image.Resampling.NEAREST).save(ROOT / 'working' / (source.stem + '-4x.png'))
