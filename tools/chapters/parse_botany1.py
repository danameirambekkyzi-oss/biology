# a.docx: сұрақ — n1.0 (ilvl 0) тізім элементі; нұсқалар — келесі абзацтар (тізім элементтері немесе «А.» әріптері)
# Дұрыс жауап: Heading стилі немесе қалың (bold) жазу
import sys, re, json, docx
from docx.oxml.ns import qn
d = docx.Document(sys.argv[1])
paras = []
for el in d.element.body.iterchildren():
    if el.tag.split('}')[1] != 'p': continue
    p = docx.text.paragraph.Paragraph(el, d)
    head = p.style.name.startswith('Heading')
    chars, mask = [], []
    for r in p.runs:
        b = head or bool(r.bold) or bool(r.style is not None and r.style.font.bold)
        chars.append(r.text); mask.append(b)
    num = el.find('.//' + qn('w:numPr'))
    nid = lvl = None
    if num is not None:
        ni, il = num.find(qn('w:numId')), num.find(qn('w:ilvl'))
        nid = ni.get(qn('w:val')) if ni is not None else None
        lvl = il.get(qn('w:val')) if il is not None else '0'
    text = ''.join(chars)
    if not text.strip(): continue
    m = ''.join(('1' if b else '0') * len(t) for t, b in zip(chars, mask))
    paras.append({"t": text, "m": m, "nid": nid, "lvl": lvl, "head": head})
# сұрақтарға бөлу
qs, cur = [], None
for p in paras:
    if p["nid"] == "1" and p["lvl"] == "0":
        cur = {"paras": [p]}; qs.append(cur)
    elif cur is not None:
        cur["paras"].append(p)
MARK = re.compile(r'(?:(?<=^)|(?<=[\s,]))([АAВBСCДDЕEФF])\s*[.)]\s*')
out = []
for qi, q in enumerate(qs, 1):
    segs = []  # (text, mask, is_list_item)
    for k, p in enumerate(q["paras"]):
        t, m = p["t"], p["m"]
        listopt = k > 0 and p["nid"] is not None
        starts = [mm.start() for mm in MARK.finditer(t)]
        # тізім элементінің басындағы «A.Флеминг» сияқты бас әріп — нұсқа әрпі емес
        initial = listopt and re.match(r'^[АAВBСCДDЕEФF][.)](?=\S)', t)
        if initial: starts = [s for s in starts if s != 0]
        if listopt and (not starts or starts[0] != 0 and t[:starts[0]].strip()): starts = [0] + starts
        if k == 0:
            qend = starts[0] if starts else len(t)
            segs.append(("Q", t[:qend], m[:qend], False))
        else:
            if not starts: starts = [0]
            if starts[0] != 0 and t[:starts[0]].strip():  # абзац басында әріпсіз мәтін — алдыңғы нұсқаның жалғасы
                segs.append(("C", t[:starts[0]], m[:starts[0]], False))
        for j, s in enumerate(starts):
            e = starts[j + 1] if j + 1 < len(starts) else len(t)
            segs.append(("O", t[s:e], m[s:e], bool(initial) and s == 0))
    qtext = "".join(s[1] for s in segs if s[0] == "Q").strip()
    opts = []
    for kind, t, m, keep in segs:
        if kind == "O": opts.append([t, m, keep])
        elif kind == "C" and opts: opts[-1][0] += " " + t; opts[-1][1] += "0" + m
    clean = []
    for t, m, keep in opts:
        tt = t if keep else (MARK.sub("", t, count=1) if MARK.match(t) else t)
        letters = [c for c, f in zip(t, m) if not c.isspace()]
        flags = [f for c, f in zip(t, m) if not c.isspace()]
        # әріп маркерін есепке алмай, мәтіннің басым бөлігі белгіленсе — дұрыс
        body = re.sub(r'\s+', ' ', tt).strip(' ;:')
        start = len(t) - len(tt)
        bm = m[start:]; bt = t[start:]
        sig = [f for c, f in zip(bt, bm) if not c.isspace()]
        corr = sum(1 for f in sig if f == '1') > len(sig) / 2 if sig else False
        if body: clean.append({"t": body, "c": corr})
    out.append({"n": qi, "q": re.sub(r'\s+', ' ', qtext).strip(), "opts": clean})
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(len(out))
