"""«Суретпен жұмыс» → Ботаника: вегетативті көбею суреттері (мұғалім жіберген PDF/суреттерден құрама сурет).
Қолданылуы: python3 -I build_veg.py src repo
  src/i-004.png, i-005.png — PDF-тен (мұртша+тамырсабақ, түйнек+пиязшық); src/g2.png, g3.png, g4.png — телу, көзшелеу, сұлатпа.
Әр суреттің астына бос ұяшық орны қалдырылады; ұяшықтың орны js/images.js-ке %-бен жазылады."""
import json, sys
from PIL import Image, ImageFilter
src, repo = sys.argv[1:3]
LAB = 64  # ұяшыққа арналған жолақ биіктігі

def up(im, k):  # кіші суретті үлкейтіп, анықтау
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=2))

def compose(panels, cols, cell_w, cell_h, gap=24):
    rows = (len(panels) + cols - 1) // cols
    W = cols * cell_w + (cols + 1) * gap; H = rows * (cell_h + LAB) + (rows + 1) * gap
    S = Image.new("RGB", (W, H), "white"); zones = []
    for k, (im, ans) in enumerate(panels):
        r, c = divmod(k, cols)
        im = im.convert("RGB"); s = min(cell_w / im.width, cell_h / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x0 = gap + c * (cell_w + gap); y0 = gap + r * (cell_h + LAB + gap)
        S.paste(im, (x0 + (cell_w - im.width) // 2, y0 + (cell_h - im.height) // 2))
        zw = min(cell_w - 40, 330); zx = x0 + (cell_w - zw) // 2; zy = y0 + cell_h + 10
        zones.append({"x": round(zx / W * 100, 2), "y": round(zy / H * 100, 2), "w": round(zw / W * 100, 2), "h": round((LAB - 14) / H * 100, 2), "answer": ans})
    return S, zones

a, b = Image.open(f"{src}/i-004.png"), Image.open(f"{src}/i-005.png")
p1 = [(a.crop((0, 90, 650, 436)), 0), (a.crop((775, 0, 1415, 418)), 1), (b.crop((0, 60, 770, 384)), 2), (b.crop((815, 30, 1278, 384)), 3)]
S1, z1 = compose(p1, 2, 700, 380)
g2, g3, g4 = Image.open(f"{src}/g2.png"), Image.open(f"{src}/g3.png"), Image.open(f"{src}/g4.png")
g4 = g4.crop((0, 0, g4.width, g4.height - 26))  # астындағы жазуды («Сұлатпа бұтақтары арқылы көбею») алып тастаймыз
# сканерленген беттің арт жағынан көрінген әріптерді (ақшыл сұр) ағартамыз
g2 = g2.convert("L").point(lambda v: 255 if v > 165 else max(0, int(v * 0.85))).convert("RGB")
p2 = [(up(g2, 3), 0), (up(g3, 3), 1), (up(g4, 3), 2)]
S2, z2 = compose(p2, 3, 520, 300)
S1.save(f"{repo}/img/images/veg-propagation.jpg", quality=88); S2.save(f"{repo}/img/images/veg-grafting.jpg", quality=88)
T = [
 {"id": "img-veg-propagation", "module": "botany", "title": "Вегетативті көбею (мұртша, тамырсабақ, түйнек, пиязшық)", "img": ["img/images/veg-propagation.jpg"],
  "options": ["Мұртша", "Тамырсабақ", "Түйнек", "Пиязшық"], "zones": z1},
 {"id": "img-veg-grafting", "module": "botany", "title": "Телу және сұлатпа бұтақтар арқылы көбею", "img": ["img/images/veg-grafting.jpg"],
  "options": ["Қалемше арқылы телу", "Көзшелеп телу", "Сұлатпа бұтақтар арқылы"], "zones": z2}]
print(json.dumps(T, ensure_ascii=False))
