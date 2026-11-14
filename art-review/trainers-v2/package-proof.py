"""Package existing illustrations for review; never draw character anatomy.

Pillow is used only for contact-sheet composition and exact pixel checks.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SKILL = Path.home() / '.codex/skills/pixel-art-studio/scripts/pixel_art.py'
NAMES = ['a-trail-athlete', 'b-strength-specialist', 'c-veteran-coach']
LABELS = ['A · Atleta de aventura', 'B · Especialista de fuerza', 'C · Entrenador veterano']
NOTES = ['Gesto abierto · jade / coral', 'Trenza y guardia · coral / ciruela', 'Palma adelantada · marfil / azul']
report = {'status': 'candidates awaiting artistic approval', 'assets': {}}
for name in NAMES:
    path = ROOT / 'final' / (name + '.png')
    native = Image.open(path).convert('RGBA')
    zoom = Image.open(path.with_stem(name + '-4x')).convert('RGBA')
    inspected = subprocess.run([sys.executable, str(SKILL), 'inspect', str(path), '--size', '96', '96', '--max-colors', '32', '--binary-alpha'], capture_output=True, text=True, check=True)
    data = json.loads(inspected.stdout)
    assert zoom.tobytes() == native.resize((384, 384), Image.Resampling.NEAREST).tobytes()
    grid = json.loads(path.with_suffix('.json').read_text())
    palette = {key: tuple(bytes.fromhex(value.lstrip('#'))) for key, value in grid['palette'].items()}
    palette = {key: value if len(value) == 4 else (*value, 255) for key, value in palette.items()}
    palette['.'] = (0, 0, 0, 0)
    rows = grid['frames'][0]['rows']
    assert [palette[pixel] for row in rows for pixel in row] == list(native.getdata())
    assert grid['pivot'] == [48, 92]
    assert native.getbbox()[3] - 1 == 92
    data.update({'nearest4xExact': True, 'editableGridExact': True, 'pivot': grid['pivot'], 'footBaseline': 92, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    report['assets'][name] = data
(ROOT / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')

font_root = Path('/usr/share/fonts/truetype/dejavu')
def font(size, bold=False):
    return ImageFont.truetype(str(font_root / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')), size)
sheet = Image.new('RGB', (1328, 1056), '#142239')
draw = ImageDraw.Draw(sheet)
draw.text((24, 18), 'BATTLE TOWER  /  PRUEBA ARTÍSTICA A · B · C', font=font(26, True), fill='#f1cc86')
draw.text((24, 56), 'PNG transparentes · escala nativa 96×96 · ampliaciones enteras sin suavizado', font=font(17), fill='#ced7df')
for i, (name, label, note) in enumerate(zip(NAMES, LABELS, NOTES)):
    x = 24 + i * 432
    draw.rectangle((x, 94, x + 416, 700), fill='#1c2e43', outline='#527082')
    draw.text((x + 16, 106), label, font=font(21, True), fill='#f6e8c6')
    draw.text((x + 16, 140), '1× · 96×96', font=font(16), fill='#ced7df')
    native = Image.open(ROOT / 'final' / (name + '.png')).convert('RGBA')
    # A light and a dark stage expose alpha/outline defects without modifying assets.
    draw.rectangle((x + 16, 164, x + 399, 267), fill='#fff2d3')
    sheet.paste(native, (x + 160, 168), native)
    draw.text((x + 16, 281), '4× · nearest-neighbor · 384×384', font=font(16), fill='#ced7df')
    zoom = Image.open(ROOT / 'final' / (name + '-4x.png')).convert('RGBA')
    sheet.paste(zoom, (x + 16, 308), zoom)
    draw.text((x + 8, 714), note, font=font(16), fill='#f1cc86')

draw.text((24, 758), 'Referencia del usuario · 3 recortes de 65×65 a 4×', font=font(18, True), fill='#f6e8c6')
ref = Image.open(ROOT / 'reference-user-provided.png').convert('RGB')
for i, rect in enumerate([(130, 0, 195, 65), (0, 390, 65, 455), (65, 130, 130, 195)]):
    sheet.paste(ref.crop(rect).resize((260, 260), Image.Resampling.NEAREST), (24 + i * 260, 790))
draw.text((844, 758), 'Anterior · 128×128 a 2×', font=font(18, True), fill='#f6e8c6')
old = Image.open(ROOT / 'previous-character.png').convert('RGBA').resize((256, 256), Image.Resampling.NEAREST)
sheet.paste(old, (880, 790), old)
draw.text((1160, 840), 'Muestras', font=font(16), fill='#ced7df')
draw.text((1160, 866), 'estáticas.', font=font(16), fill='#ced7df')
draw.text((1160, 910), 'Pendientes', font=font(16), fill='#f1cc86')
draw.text((1160, 936), 'de aprobar.', font=font(16), fill='#f1cc86')
sheet.save(ROOT / 'comparison.png')
print(json.dumps(report, indent=2))
