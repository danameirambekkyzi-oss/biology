# ҰБТ форматындағы тараулық тест (.docx): «N. сұрақ», «А. нұсқа» (бір жолда да бола береді), дұрысы — қалың (bold) жазу;
# «Сәйкестендір» сұрағында «1. элемент А» / «2. элемент Д» жолдары. Бірінші қалың жол — тест тақырыбы.
# Қолданылуы: python3 -I parse_ubt.py in.docx out.json
import sys, re, json, docx
from docx.oxml.ns import qn
d = docx.Document(sys.argv[1])
lines = []  # (мәтін, қалың-маска)
for el in d.element.body.iterchildren():
    if el.tag.split('}')[1] != 'p': continue
    p = docx.text.paragraph.Paragraph(el, d)
    t = m = ""
    for r in p.runs:
        b = bool(r.bold) or bool(r.style is not None and r.style.font.bold)
        t += r.text; m += ("1" if b else "0") * len(r.text)
    lst = el.find('.//' + qn('w:numPr')) is not None  # тізім элементі — әріпсіз нұсқа
    for seg in re.finditer(r'[^\n]+', t):
        if seg.group().strip(): lines.append((seg.group(), m[seg.start():seg.end()], lst))
title = re.sub(r'\s*;\s*', '; ', re.sub(r'\s+', ' ', lines[0][0])).strip(' ;')
QS = re.compile(r'^\s*(\d+)\s*\.\s*')
MARK = re.compile(r'(?:(?<=^)|(?<=[\s,]))([АAВBБСCДDЕEФFa-f])\s*[.)]\s*')
LET = {c: i for i, s in enumerate(["АAa", "ВBбБb", "СCc", "ДDd", "ЕEe", "ФFf"]) for c in s}
def marks(t, k):  # тек кезекті әріптер (А, В, С...) — «А. Флеминг» сияқты бас әріптер нұсқа емес
    out = []
    for x in MARK.finditer(t):
        if x.group(1).islower() and (x.start() or ")" not in x.group()): continue  # a) b) — тек жол басында
        if LET[x.group(1)] == k + len(out): out.append(x.start())
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
for t, m, lst in lines[1:]:
    if cur and not lst and not QS.match(t) and not marks(t, len(cur["opts"])) and not (cur["match"] and not cur["opts"]):
        pend.append((t, m)); continue
    flush(bool(QS.match(t)))
    if lst and not QS.match(t) and not MARK.match(t):
        it = re.match(r'^\s*(.+?)\s*[-–—]?\s*([АAВBСCДD])\s*$', t)
        if cur and cur["match"] and len(cur["items"]) < 2 and not cur["opts"] and it:  # тізіммен жазылған элемент
            cur["items"].append({"text": it.group(1).strip(), "answer": LET[it.group(2)]}); continue
        if cur is None or len(cur["opts"]) >= 6:  # нөмірсіз (тізім) сұрақ
            cur = {"n": len(qs) + 1, "q": t.strip(), "opts": [], "items": [], "match": "сәйкест" in t.lower()}; qs.append(cur); continue
        sig = [f for c, f in zip(t, m) if not c.isspace()]
        cur["opts"].append({"t": re.sub(r'\s+', ' ', t).strip(' ;'), "c": sig.count("1") > len(sig) / 2}); continue
    mm = QS.match(t)
    if cur and cur["match"] and mm and mm.group(1) in "12" and len(cur["items"]) < 2 and not cur["opts"]:
        it = re.match(r'^\s*\d\s*\.\s*(.+?)\s*[-–—]?\s*([АAВBСCДD])\s*$', t)
        cur["items"].append({"text": it.group(1).strip(), "answer": LET[it.group(2)]}); continue
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
        cur["opts"].append({"t": re.sub(r'\s+', ' ', body).strip(' ;'), "c": sig.count("1") > len(sig) / 2})
flush(False)
for q in qs: q["q"] = re.sub(r'\s+', ' ', q["q"]).strip(); del q["match"]
json.dump({"title": title, "questions": qs}, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(title, len(qs))
