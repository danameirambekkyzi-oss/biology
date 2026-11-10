# ҰБТ форматындағы тараулық тест (.docx): «N. сұрақ», «А. нұсқа» (бір жолда да бола береді), дұрысы — қалың (bold) жазу;
# «Сәйкестендір» сұрағында «1. элемент А» / «2. элемент Д» жолдары. Бірінші қалың жол — тест тақырыбы.
# Суреттер: сурет тұрған абзац алдыңғы сұраққа (немесе сол абзацтағы сұраққа) тіркеледі; imgdir берілсе, сонда сақталады.
# Қолданылуы: python3 -I parse_ubt.py in.docx out.json [imgdir]
import sys, re, json, os, docx
from docx.oxml.ns import qn
d = docx.Document(sys.argv[1])
lines = []  # (мәтін, қалың-маска, тізім numId немесе "")
LIMG = {}  # жол индексі → сол жолдан кейін тіркелетін суреттер (docx бөліктері)
for el in d.element.body.iterchildren():
    if el.tag.split('}')[1] != 'p': continue
    p = docx.text.paragraph.Paragraph(el, d)
    blips = [b.get(qn('r:embed')) for b in el.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}blip')]
    parts = [d.part.related_parts[b] for b in blips if b in d.part.related_parts]
    t = m = ""
    for r in p.runs:
        b = bool(r.bold) or bool(r.style is not None and r.style.font.bold)
        t += r.text; m += ("1" if b else "0") * len(r.text)
    ni = el.find('.//' + qn('w:numPr') + '/' + qn('w:numId'))
    lst = (ni.get(qn('w:val')) or "?") if el.find('.//' + qn('w:numPr')) is not None else ""  # тізім элементі — әріпсіз нұсқа
    n0 = len(lines)
    for seg in re.finditer(r'[^\n]+', t):
        if seg.group().strip(): lines.append((seg.group(), m[seg.start():seg.end()], lst))
    if parts and lines: LIMG.setdefault(n0 if len(lines) > n0 else len(lines) - 1, []).extend(parts)
# Бірінші жол — тақырып; файл бірден «1. сұрақпен» басталса, тақырып жоқ (build кезінде басқа атау беріледі)
has_title = not re.match(r'^\s*1\s*\.', lines[0][0])
title = re.sub(r'\s*;\s*', '; ', re.sub(r'\s+', ' ', lines[0][0])).strip(' ;') if has_title else ""
skip = 1 if has_title else 0
while has_title and skip < len(lines) and not re.match(r'^\s*\d+\s*\.', lines[skip][0]) and lines[skip][1].count("1") > len(lines[skip][1]) / 2:
    title += " " + lines[skip][0].strip(); skip += 1  # тақырыптың келесі жолға ауысқан жалғасы
title = re.sub(r'\s+', ' ', title).strip()
QS = re.compile(r'^\s*(\d+)\s*\.\s*')
MARK = re.compile(r'(?:(?<=^)|(?<=[\s,]))([АAВBБСCДDЕEФFa-fавбсдеф])\s*[.)]\s*')
LET = {c: i for i, s in enumerate(["АAaа", "ВBбБbв", "СCcс", "ДDdд", "ЕEeе", "ФFfф"]) for c in s}
def marks(t, k):  # тек кезекті әріптер (А, В, С...) — «А. Флеминг» сияқты бас әріптер нұсқа емес
    out = []
    for x in MARK.finditer(t):
        lat = x.group(1) in "abcdef"
        if x.group(1).islower() and (x.start() or (lat and ")" not in x.group())): continue  # a) b), «с. …» — тек жол басында
        n = LET[x.group(1)]
        if n == k + len(out) or (x.start() == 0 and not out and k and n == k - 1): out.append(x.start())  # жол басында қайталанған әріп (В, В) — бәрібір жаңа нұсқа
    return out
# 26–30-сұрақтардың алдындағы контекст мәтіні: нөмірсіз жолдар тобы, ішінде ұзын абзац бар.
# Нөмірсіз жолдарды кейінге қалдырамыз: келесі сұрақ басталғанда — контекст па, әлде алдыңғы мәтіннің жалғасы ма, шешеміз.
def flush(next_is_question):
    global ctx, left
    if not pend: return
    if next_is_question and any(len(t.strip()) > 150 for t, _ in pend):
        body = [t.strip() for t, _ in pend]
        title = body.pop(0) if len(body[0]) < 90 else ""
        ctx, left = {"title": title, "text": "<br><br>".join(body)}, 5
    else:
        for t, m in pend: cont(t, m)
    pend.clear()
def cont(t, m):  # әріпсіз жол — алдыңғы мәтіннің жалғасы
    starts = marks(t, len(cur["opts"]))
    e = starts[0] if starts else len(t)
    if cur["opts"]: cur["opts"][-1]["t"] += " " + t[:e].strip()
    else: cur["q"] += " " + t[:e].strip()
qs, cur, pend, ctx, left = [], None, [], None, 0
IMGDIR = sys.argv[3] if len(sys.argv) > 3 else None
def attach(i):
    for part in LIMG.get(i, []):
        if cur is None: continue
        k = len(cur.setdefault("img", []))
        fn = f"q{cur['n']}{'' if k == 0 else '_' + str(k)}{os.path.splitext(part.partname)[1]}"
        if IMGDIR: os.makedirs(IMGDIR, exist_ok=True); open(os.path.join(IMGDIR, fn), "wb").write(part.blob)
        cur["img"].append(fn)
prev = None
for li in range(skip, len(lines)):
    if prev is not None: attach(prev)
    prev = li
    t, m, lst = lines[li]
    if re.match(r'^\s*[IVX]+\s*бөлім\b', t): continue  # «II бөлім. …» — бөлім атауы, сұрақ емес
    if cur and not lst and not QS.match(t) and not marks(t, len(cur["opts"])) and not (cur["match"] and not cur["opts"]):
        pend.append((t, m)); continue
    flush(bool(QS.match(t)))
    if lst and not QS.match(t) and not MARK.match(t):
        it = re.match(r'^\s*(.+?)\s*[-–—]?\s*([АAВBСCДD])\s*$', t)
        if cur and cur["match"] and len(cur["items"]) < 2 and not cur["opts"] and it:  # тізіммен жазылған элемент
            cur["items"].append({"text": it.group(1).strip(), "answer": LET[it.group(2)]}); continue
        if cur is None or len(cur["opts"]) >= 6 or (len(cur["opts"]) >= 4 and lst != cur.get("onid")):  # нөмірсіз (тізім) сұрақ
            cur = {"n": len(qs) + 1, "q": t.strip(), "opts": [], "items": [], "match": "сәйкест" in t.lower()}; qs.append(cur); continue
        sig = [f for c, f in zip(t, m) if not c.isspace()]
        cur["onid"] = lst
        cur["opts"].append({"t": re.sub(r'\s+', ' ', t).strip(' ;'), "c": sig.count("1") > len(sig) / 2}); continue
    mm = QS.match(t)
    if cur and cur["match"] and mm and mm.group(1) in "12" and len(cur["items"]) < 2 and not cur["opts"]:
        it = re.match(r'^\s*\d\s*\.\s*(.+?)\s*[-–—]?\s*([АAВBСCДD])\s*$', t)
        if it: cur["items"].append({"text": it.group(1).strip(), "answer": LET[it.group(2)]})
        else: cur["bad"] = True  # жауап әрпі табылмады — қолмен тексеру керек
        continue
    if mm:
        t, m = t[mm.end():], m[mm.end():]
        cur = {"n": len(qs) + 1, "q": "", "opts": [], "items": []}; qs.append(cur)
        if ctx and left: cur["ctx"] = ctx; left -= 1
        starts = marks(t, 0)
        cur["q"] = t[:starts[0] if starts else len(t)].strip()
        cur["match"] = "сәйкест" in cur["q"].lower()
        if cur["match"] and "ctx" in cur: del cur["ctx"]; left = 0
        if not starts: continue
        t, m = t[starts[0]:], m[starts[0]:]
    if cur is None: continue
    starts = marks(t, len(cur["opts"]))
    if not starts or starts[0] != 0:  # әріпсіз жол — алдыңғы мәтіннің жалғасы
        e = starts[0] if starts else len(t)
        if cur["opts"]: cur["opts"][-1]["t"] += " " + t[:e].strip()
        else: cur["q"] += " " + t[:e].strip()
        if not starts: continue
    for j, s in enumerate(starts):
        e = starts[j + 1] if j + 1 < len(starts) else len(t)
        seg, sm = t[s:e], m[s:e]
        k = MARK.match(seg).end()
        body, bm = seg[k:], sm[k:]
        sig = [f for c, f in zip(body, bm) if not c.isspace()]
        if cur["opts"] and cur["opts"][-1].get("empty"):  # «C. Д. Арнон»: бос нұсқадан кейінгі әріп — аты-жөннің бас әрпі
            o = cur["opts"][-1]; o["t"] = re.sub(r'\s+', ' ', seg).strip(' ;'); o["c"] = sig.count("1") > len(sig) / 2; del o["empty"]; continue
        o = {"t": re.sub(r'\s+', ' ', body).strip(' ;'), "c": sig.count("1") > len(sig) / 2}
        if not o["t"]: o["empty"] = True
        cur["opts"].append(o)
if prev is not None: attach(prev)
flush(False)
for q in qs: q["q"] = re.sub(r'\s+', ' ', q["q"]).strip(); del q["match"]; q.pop("onid", None)
json.dump({"title": title, "questions": qs}, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(title, len(qs))
