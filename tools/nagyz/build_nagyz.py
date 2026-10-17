import sys, re, json, html, os, shutil
# Ескерту: бұл скрипт nagyz.js-ті толық қайта жазады; кейін tools/nagyz/build_anat_gen.py-ді іске қосыңыз (Тест-3–5).
import docx
from docx.oxml.ns import qn
src, repo = sys.argv[1], sys.argv[2]
d = docx.Document(src)
L = {"А":0,"A":0,"В":1,"B":1,"С":2,"C":2,"Д":3,"D":3,"Е":4,"E":4,"Ф":5,"F":5,"G":6,"H":7}
OPT = re.compile(r"^\s*([A-HАВСДЕФ])\s*[.)]\s*")
NUM = re.compile(r"^\s*(\d+)\s*[.)]\s*")
ITEM = re.compile(r"^\s*([12])\s*(?:[.)]|\s*ші)\s*(.*?)\s*[-–—]?\s*([A-HАВСДЕФ])\s*$")
MATCH = re.compile(r"^[СC]әйкестендір", re.I)
def bold(r, p):
    if r.bold is not None: return r.bold
    return bool(r.style is not None and r.style.font.bold) or bool(p.style is not None and p.style.font.bold)
def rhtml(r):
    t = html.escape(r.text)
    if r.font.superscript: t = f"<sup>{t}</sup>"
    elif r.font.subscript: t = f"<sub>{t}</sub>"
    return t
qs, cur, imgs_all = [], None, []
for p in d.paragraphs:
    imgs = []
    for r in p.runs:
        for b in r._element.iter(qn("a:blip")):
            rid = b.get(qn("r:embed"))
            if rid in d.part.related_parts: imgs.append(d.part.related_parts[rid])
    if cur is not None: cur["img"] += imgs
    txt = p.text.strip(); h = re.sub(r"\s+", " ", "".join(rhtml(r) for r in p.runs)).strip()
    if not txt: continue
    if cur is not None and cur["match"] and len(cur["items"]) < 2:
        m = ITEM.match(txt)
        if m:
            name = m.group(2).strip(" -–")
            if re.match(r"^сурет", name): name = f"{m.group(1)}-сурет"
            cur["items"].append({"text": name, "answer": L[m.group(3)]}); continue
    m = NUM.match(txt)
    if m and not OPT.match(txt):
        q = NUM.sub("", h, count=1).strip().rstrip(" -–").strip()
        cur = {"n": int(m.group(1)), "q": q, "opts": [], "bold": [], "img": imgs[:], "match": bool(MATCH.match(q)), "items": []}
        qs.append(cur); continue
    if OPT.match(txt) and cur is not None:
        cur["opts"].append(OPT.sub("", h, count=1).strip())
        cur["bold"].append(any(bold(r, p) for r in p.runs if r.text.strip())); continue
    if cur is not None:
        if cur["opts"]: cur["opts"][-1] += " " + h
        else: cur["q"] += " " + h
assert [q["n"] for q in qs] == list(range(1, 111)), [q["n"] for q in qs]
FIX = {}  # жауабы белгіленбеген сұрақтар: {нөмір: [индекс]}
BYN = {q["n"]: q for q in qs}
for a, b in ((46, 45), (48, 47)): BYN[a]["img"] = BYN[b]["img"][:]  # «жоғарыдағы сурет» сілтемесі
# Әр тестке: 20 бір жауапты (1–40), 9 сәйкестендіру (93–110), 26 көп жауапты (41–92) — ҰБТ ретімен
groups = [qs[0:40], qs[92:110], qs[40:92]]
parts = [[g[:len(g) // 2] for g in groups], [g[len(g) // 2:] for g in groups]]
tests = []
for t in (1, 2):
    idir = f"img/tests/nagyz-{t}"; shutil.rmtree(f"{repo}/{idir}", ignore_errors=True); os.makedirs(f"{repo}/{idir}")
    out = []
    order = [x for g in parts[t-1] for x in g]
    if t == 1: order[:4] = [order[2], order[3], order[0], order[1]]  # мұғалімнің өтініші: 1–2 сұрақ 3–4-пен орын ауыстырды
    for q in order:
        k = len(out) + 1
        files = []
        for j, part in enumerate(q["img"]):
            fn = f"q{k}{'' if j == 0 else '_' + str(j)}{os.path.splitext(part.partname)[1]}"
            open(f"{repo}/{idir}/{fn}", "wb").write(part.blob); files.append(f"{idir}/{fn}")
        e = {"id": f"nagyz-{t}-q{k}", "module": ""}
        if q["match"]:
            assert len(q["items"]) == 2 and len(q["opts"]) == 4, q["n"]
            e.update(type="match", q="Сәйкестендіріңіз", options=q["opts"], items=q["items"], correct=[it["answer"] for it in q["items"]])
        else:
            corr = FIX.get(q["n"]) or [i for i, b in enumerate(q["bold"]) if b]
            assert corr and len(q["opts"]) >= 4, (q["n"], q["opts"])
            multi = len(q["opts"]) >= 6
            if multi: e["type"] = "multi"
            else: assert len(corr) == 1, q["n"]
            text = re.sub(r"^\d+\s*ші суреттегі", "Жоғарыдағы суреттегі", q["q"]).replace("Осы жоғарыдағы сұрақтағы", "Суреттегі")
            text = re.sub(r"\s*\(\d+\s*(дұрыс\s*)?жауап\)", "", text).strip()
            e.update(q=text or "Суретке қараңыз", options=q["opts"], correct=corr)
        if t == 1 and k == 4:  # жүрек суреті мұғалім жіберген жаңа суретпен ауыстырылды
            for f in files: os.remove(f"{repo}/{f}")
            shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "heart.png"), f"{repo}/{idir}/q4.png"); files = [f"{idir}/q4.png"]
        if files: e["img"] = files
        out.append(e)
    tests.append({"id": f"nagyz-{t}", "title": f"Тест-{t}", "sub": "Ботаника және зоология бойынша келген сұрақтар", "questions": out})
    from collections import Counter
    print(f"Тест-{t}", len(out), Counter(x.get("type", "single") for x in out))
js = "/* «2026 жылғы Нағыз ҰБТ базасы» — tools/nagyz/build_nagyz.py арқылы .docx файлдан жасалған */\n(window.TEST_FOLDERS = window.TEST_FOLDERS || []).push(" + json.dumps({"id": "nagyz", "title": "2026 жылғы Нағыз ҰБТ базасы", "desc": "Бұл жерде 2026 жылғы нағыз ҰБТ-да келген тесттер тарау бойынша бөлінген.", "tests": tests}, ensure_ascii=False, indent=1) + ");\n"
open(f"{repo}/js/tests/nagyz.js", "w").write(js)
