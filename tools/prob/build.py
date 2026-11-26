"""«ҰБТ сынамасы → Пробныйда келген нұсқалар» (мұғалімнің .docx файлдары).
Формат: «N. сұрақ», нұсқалар «A) …», дұрыс жауап — «✅»; сәйкестендіру: «Варианттар: A) … · B) …» + кесте (элемент | жауап).
Қолданылуы: python3 -I tools/prob/build.py repo p1.docx [p2.docx …]"""
import json, re, sys
import docx
from docx.oxml.ns import qn
repo, files = sys.argv[1], sys.argv[2:]
L = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "А": 0, "В": 1, "С": 2, "Д": 3, "Е": 4}
OPT = re.compile(r"^([A-FАВСДЕ])\)\s*(.*?)\s*(✅)?\s*$")
QN = re.compile(r"^(\d+)\.\s*(.*)$")
FIX = {  # файл → {сұрақ: өзгерту}
    7: {33: {"q": "Фитогормондарды қызметтерімен сәйкестендіріңіз:"}},  # элементтер сұрақ мәтінінде қайталанған
    2: {15: {"q": "Суретте көрсетілген үдеріс", "img": ["img/tests/prob-2/q15.png"]}},  # сурет — мұғалім жіберген (2026-11-23)
    1: {35: {"options": {1: "популяциядағы даралар ие барлық геннің, олардың түр өзгерістерінің жиынтығы",
                         2: "популяциядағы жыныстық жағынан жетілген аталық және аналық арасындағы қатынас",
                         3: "популяциядағы әр түрлі жастағы даралар арасындағы қатынас"}}},  # түпнұсқа тест бойынша
}

BOLD = [False]  # соңғы абзац толық қалың қаріппен бе
def body(d):  # абзацтар мен кестелер құжаттағы ретімен
    for el in d.element.body.iterchildren():
        if el.tag == qn("w:p"):
            for bl in el.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
                yield "img", d.part.related_parts[bl.get(qn("r:embed"))]
            runs = [r for r in el.iter(qn("w:r")) if "".join(t.text or "" for t in r.iter(qn("w:t"))).strip()]
            bold = bool(runs) and all(r.find(qn("w:rPr")) is not None and r.find(qn("w:rPr")).find(qn("w:b")) is not None
                                      and r.find(qn("w:rPr")).find(qn("w:b")).get(qn("w:val"), "true") not in ("0", "false") for r in runs)
            BOLD[0] = bold
            yield "p", "".join(t.text or "" for t in el.iter(qn("w:t"))).strip()
        elif el.tag == qn("w:tbl"):
            rows = [["".join(t.text or "" for t in c.iter(qn("w:t"))).strip() for c in r.iter(qn("w:tc"))] for r in el.iter(qn("w:tr"))]
            yield "t", rows

tests = []
for n, f in enumerate(files, 1):
    tid = f"prob-{n}"; qs = []; cur = None; ctx = None; ctx_left = 0; pending_ctx = None; in_ctx = False
    for kind, x in body(docx.Document(f)):
        if kind == "img":  # сурет — ағымдағы сұраққа
            import os
            k = cur["id"].split("-q")[1]; ext = os.path.splitext(x.partname)[1] or ".png"
            os.makedirs(f"{repo}/img/tests/{tid}", exist_ok=True)
            path = f"img/tests/{tid}/q{k}{'' if not cur.get('img') else '-' + str(len(cur['img']) + 1)}{ext}"
            if in_ctx:  # контекст мәтінінен кейінгі сурет — контекстке
                path = f"img/tests/{tid}/ctx{ext}"; open(f"{repo}/{path}", "wb").write(x.blob)
                pending_ctx["contextImg"] = [path]; continue
            open(f"{repo}/{path}", "wb").write(x.blob); cur.setdefault("img", []).append(path); continue
        if kind == "t":  # сәйкестендіру жауаптары
            items = []
            for r in x[1:]:
                m = re.match(r"^([A-FАВСДЕ])\)", r[1].strip())
                items.append({"text": re.sub(r"^\d+\)\s*", "", r[0]), "answer": L[m.group(1)]})
            cur.update({"type": "match", "items": items, "correct": [i["answer"] for i in items]}); continue
        if not x: continue
        if re.match(r"^(І|ІІ|ІІІ|IV|II|III|I)\s+бөлім", x) or x.startswith("Биология тест"): continue
        m = OPT.match(x)
        if m and cur is not None and "items" not in cur:
            cur["options"].append(m.group(2))
            if BOLD[0]: cur.setdefault("bold", []).append(len(cur["options"]) - 1)
            if m.group(3): cur["correct"].append(len(cur["options"]) - 1)
            continue
        if x.startswith("Варианттар:"):
            cur["options"] = [re.sub(r"^[A-FАВСДЕ]\)\s*", "", o.strip()).strip() for o in x.split(":", 1)[1].split("·")]; continue
        m = QN.match(x)
        if m:
            k = int(m.group(1))
            cur = {"id": f"{tid}-q{k}", "module": "", "q": m.group(2), "options": [], "correct": []}
            in_ctx = False
            if pending_ctx and 26 <= k <= 30: cur.update(pending_ctx); cur["type"] = "context"
            qs.append(cur); continue
        # нөмірсіз ұзын мәтін — контекст («Тақырыбы. Мәтін…»)
        t, rest = (x.split(".", 1) + [""])[:2]
        pending_ctx = {"contextTitle": t.strip(), "context": rest.strip()}; in_ctx = True
    for q in qs:
        k = int(q["id"].split("-q")[1])
        fx = FIX.get(n, {}).get(k, {})
        for i, v in fx.get("options", {}).items(): q["options"][i] = v
        for key in ("q", "img"):
            if key in fx: q[key] = fx[key]
        q.setdefault("type", "multi" if len(q["options"]) > 4 else "single")
        bold = q.pop("bold", [])
        if not q["correct"] and bold: q["correct"] = bold  # ✅ жоқ — жауап қалың қаріппен белгіленген
        if not q["correct"]: print("ЖАУАПСЫЗ:", q["id"], q["q"])
    assert len(qs) == 40, (f, len(qs))
    tests.append({"id": tid, "title": f"{n}-нұсқа", "questions": qs})
# Суреттерді тазарту: жауапқа сілтейтін қолжазба, сұраққа сәйкес келмейтін тақырып үзіндісі (бастапқы суреттің пикселімен)
from PIL import Image, ImageDraw, ImageFilter
IMGFIX = {
    "img/tests/prob-7/q19.png": {"white": [(97, 146, 140, 161)], "scale": 3},  # «несеп» қолжазбасы; сурет кішкентай
    "img/tests/prob-7/q17.png": {"crop_top": 45},                                 # «…дағы 1 санымен берілген ұлпа» үзіндісі
}
for path, fx in IMGFIX.items():
    im = Image.open(f"{repo}/{path}").convert("RGB")
    for b in fx.get("white", []):  # айналасындағы фонның орташа түсімен жабу
        ring = [im.getpixel((x, y)) for x in range(b[0] - 3, b[2] + 4) for y in (b[1] - 3, b[3] + 3)] + [im.getpixel((x, y)) for y in range(b[1], b[3]) for x in (b[2] + 3,)]
        ring = sorted(ring, key=sum)[len(ring) // 3:]  # күңгірт сызықтарды ескермеу
        ImageDraw.Draw(im).rectangle(b, fill=tuple(sum(c[i] for c in ring) // len(ring) for i in range(3)))
    if fx.get("crop_top"): im = im.crop((0, fx["crop_top"], im.width, im.height))
    if fx.get("scale"):
        k = fx["scale"]; im = im.resize((im.width * k, im.height * k), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=3))
    im.save(f"{repo}/{path}")
folder = {"id": "prob", "title": "Пробныйда келген нұсқалар", "tests": tests}
with open(f"{repo}/js/tests/prob.js", "w", encoding="utf-8") as fh:
    fh.write("/* «Пробныйда келген нұсқалар» — мұғалімнің .docx файлдары (tools/prob/build.py) */\n")
    fh.write("(window.TEST_FOLDERS = window.TEST_FOLDERS || []).push(" + json.dumps(folder, ensure_ascii=False, indent=1) + ");\n")
from collections import Counter
for t in tests: print(t["title"], len(t["questions"]), dict(Counter(q["type"] for q in t["questions"])))
