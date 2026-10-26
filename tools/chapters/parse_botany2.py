# b.docx: «N. сұрақ» немесе тізім абзацы; нұсқалар «А.» әріптерімен немесе әріпсіз тізім; дұрыс — қалың жазу
# Сәйкестендіру: «1. X Д» / «X - B» жолдары, сосын A–D нұсқалары. Суреттер сұраққа тіркеледі.
import sys, re, json, os, docx
from docx.oxml.ns import qn
d = docx.Document(sys.argv[1]); outdir = sys.argv[3]; os.makedirs(outdir, exist_ok=True)
paras = []
for el in d.element.body.iterchildren():
    if el.tag.split('}')[1] != 'p': continue
    p = docx.text.paragraph.Paragraph(el, d)
    t = ''.join(r.text for r in p.runs)
    m = ''.join(('1' if (r.bold or (r.style is not None and r.style.font.bold)) else '0') * len(r.text) for r in p.runs)
    blips = [b.get(qn('r:embed')) for b in el.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}blip')]
    num = el.find('.//' + qn('w:numPr')); nid = None
    if num is not None:
        ni = num.find(qn('w:numId')); nid = ni.get(qn('w:val')) if ni is not None else None
    if not t.strip() and not blips: continue
    paras.append({"t": t, "m": m, "nid": nid, "img": [d.part.related_parts[b] for b in blips if b in d.part.related_parts]})
LET = "АAВBСCДDЕEФF"
OPT = re.compile(r'^\s*([' + LET + r'])\s*[.)]\s*')
NUMQ = re.compile(r'^\s*\d+\s*[.)]\s*')
ITEM = re.compile(r'^\s*(?:\d+\s*(?:[.)]|ші)?\s*)?(.+?)\s*[-–]?\s*([АAВBСCДD])\s*$')
def L(c): return {"А":0,"A":0,"В":1,"B":1,"С":2,"C":2,"Д":3,"D":3,"Е":4,"E":4,"Ф":5,"F":5}[c]
qs, cur = [], None
def newq(p, text):
    global cur
    cur = {"q": text, "nid": p["nid"], "opts": [], "items": [], "img": [], "unl": False}
    qs.append(cur)
def corr(t, m, start):
    sig = [f for c, f in zip(t[start:], m[start:]) if not c.isspace()]
    return bool(sig) and sum(f == '1' for f in sig) > len(sig) / 2
for p in paras:
    t, m = p["t"], p["m"]
    if not t.strip():
        if cur is not None: cur["img"] += p["img"]
        continue
    om = OPT.match(t)
    is_match = cur is not None and re.search(r'[СC]әйкестендір', cur["q"])
    if is_match and not cur["opts"] and not om and ITEM.match(t) and not NUMQ.match(t) or (is_match and not cur["opts"] and NUMQ.match(t) and ITEM.match(t)):
        im = ITEM.match(t); cur["items"].append({"text": NUMQ.sub("", im.group(1)).strip(" -–"), "answer": L(im.group(2))}); cur["img"] += p["img"]; continue
    if om and cur is not None:
        cur["opts"].append({"t": re.sub(r'\s+', ' ', t[om.end():]).strip(), "c": corr(t, m, om.end())}); cur["img"] += p["img"]; continue
    if NUMQ.match(t) or cur is None:
        newq(p, NUMQ.sub("", t).strip()); cur["img"] += p["img"]; continue
    if p["nid"] and p["nid"] != "0":
        if (not cur["opts"] and p["nid"] != cur["nid"] and not is_match) or (cur["opts"] and cur["unl"] and p["nid"] == cur["unid"]):
            cur["opts"].append({"t": re.sub(r'\s+', ' ', t).strip(), "c": corr(t, m, 0)}); cur["unl"] = True; cur["unid"] = p["nid"]; continue
        newq(p, t.strip()); cur["img"] += p["img"]; continue
    # жай абзац: сұрақтың жалғасы
    if not cur["opts"]: cur["q"] += " " + t.strip()
    else: cur["opts"][-1]["t"] += " " + t.strip()
out = []
for i, q in enumerate(qs, 1):
    files = []
    for j, part in enumerate(q["img"]):
        fn = f"q{i}{'' if j == 0 else '_' + str(j)}{os.path.splitext(part.partname)[1]}"
        open(os.path.join(outdir, fn), "wb").write(part.blob); files.append(fn)
    out.append({"n": i, "q": re.sub(r'\s+', ' ', q["q"]).strip(), "opts": q["opts"], "items": q["items"], "img": files})
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(len(out))
