"""«ҰБТ сынамасы → ҰБТ нұсқалары» (мұғалімнің 5 .docx файлы, 2026-11-19).
Қолданылуы: python3 -I tools/ubtn/build.py src_dir repo
  src_dir: v1.docx v2.docx v3.docx v5.docx v6.docx (мұғалімнің «1», «2», «3», «5», «6» файлдары)
v1, v2, v3, v6 — tools/ubt_docx.py арқылы (дұрыс жауап — қалың қаріп), содан кейін төмендегі түзетулер.
v5 — жауаптары «+» белгісімен, сәйкестендіру жауабы жолдың соңындағы әріп, сондықтан бөлек оқылады."""
import json, os, re, subprocess, sys, shutil, tempfile
import docx
from docx.oxml.ns import qn
src, repo = sys.argv[1:3]
here = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp()
# 1) қалың қаріппен белгіленген төрт файл
subprocess.run([sys.executable, "-I", os.path.join(here, "..", "ubt_docx.py"), "--folder", "x", "--id", "ubtn", "--out", f"{tmp}/a.js", "--img-dir", f"{tmp}/img",
                f"{src}/v1.docx", f"{src}/v2.docx", f"{src}/v3.docx", f"{src}/v6.docx"], check=True, stdout=subprocess.DEVNULL)
txt = open(f"{tmp}/a.js", encoding="utf-8").read()
A = json.loads(txt[txt.index(".push(") + 6: txt.rindex(");")])["tests"]
t1, t2, t3, t6 = A
def Q(t, n): return t["questions"][n - 1]
# — 1-нұсқа, 31: сәйкестендіру (жауабы жолдың соңындағы әріп, сызықшасыз)
q = Q(t1, 31)
for k in ("context", "contextTitle", "contextImg"): q.pop(k, None)
q.update({"type": "match", "q": "Көздің оптикалық жүйесіне тән қасиеттерді сәйкестендіріңіз",
          "items": [{"text": "Алдыңғы камера", "answer": 1}, {"text": "Көзбұршақ", "answer": 0}], "correct": [1, 0]})
# — 2-нұсқа, 39: сәйкестендіру элементтері нұсқалардың ішіне түсіп кеткен
q = Q(t2, 39)
q.update({"options": q["options"][2:], "items": [{"text": "Пачини денешігі", "answer": 0}, {"text": "Руффини денешігі", "answer": 3}], "correct": [0, 3]})
# — 3-нұсқа, 37–38: бір сұрақ екіге бөлініп кеткен (нұсқалары «А)», «в)» …)
q37, q38 = Q(t3, 37), Q(t3, 38)
q37.update({"type": "multi", "options": ["қаныққан", "қанықпаған", "шеткі", "интегралды", "фосфолипидті", "гликолипидті"], "correct": [2, 3]})
t3["questions"].remove(q38)
# 2) v5 — «+» белгісімен
LET = {"А": 0, "A": 0, "Б": 1, "B": 1, "В": 1, "С": 2, "C": 2, "Д": 3, "D": 3, "Е": 4, "E": 4, "Г": 5, "F": 5, "Ф": 5}
d = docx.Document(f"{src}/v5.docx")
lines, img = [], None
for p in d.paragraphs:
    t = p.text.replace("\xa0", " ").strip()
    for bl in p._p.findall(".//" + qn("a:blip")):
        part = d.part.related_parts[bl.get(qn("r:embed"))]
        os.makedirs(f"{repo}/img/tests/ubtn-4", exist_ok=True)
        img = "img/tests/ubtn-4/1" + (os.path.splitext(part.partname)[1] or ".png")
        open(f"{repo}/{img}", "wb").write(part.blob)
    if t: lines.append(t)
assert lines[0].startswith("Нұсқа"); lines = lines[1:]
OPT = re.compile(r"^([АБСДЕГ])\s*\.\s*(.*?)\s*(\+)?\s*$")
blocks, cur = [], None
for t in lines:
    m = OPT.match(t)
    if m:
        cur["opts"].append((m.group(2).strip(), bool(m.group(3)))); continue
    if cur and cur["opts"] or cur is None: cur = {"head": [], "opts": []}; blocks.append(cur)
    cur["head"].append(t)
qs, ctx = [], None
for b in blocks:
    head = [h for h in b["head"] if not h.startswith("Контекст")]
    if any(h.startswith("Контекст") for h in b["head"]): ctx = next(h for h in b["head"] if h.startswith("Контекст")).split(".", 1)[1].strip()
    n = len(qs) + 1; q = {"id": f"ubtn-4-q{n}", "module": "", "options": [o for o, _ in b["opts"]]}
    corr = [i for i, (_, c) in enumerate(b["opts"]) if c]
    if len(head) == 2:  # сәйкестендіру: «мәтін Х»
        items = []
        for h in head:
            m = re.match(r"^(.*?)\s*([АБСД])$", h); items.append({"text": m.group(1).strip(), "answer": LET[m.group(2)]})
        q.update({"type": "match", "q": "Сәйкестендіріңіз:", "items": items, "correct": [it["answer"] for it in items]})
    else:
        q["q"] = head[0]
        if len(b["opts"]) > 4: q.update({"type": "multi", "correct": corr})
        elif 26 <= n <= 30: q.update({"type": "context", "context": "", "contextTitle": ctx, "contextImg": [img], "correct": corr})
        else: q.update({"type": "single", "correct": corr})
    qs.append(q)
# жауабы белгіленбеген екі сұрақ (мұғалімге айтылды)
assert not qs[23]["correct"] and not qs[24]["correct"]
qs[23]["correct"] = [3]   # Түтіктәрізді сүйектердің жуандап өсуі — сүйекқап
qs[24]["correct"] = [3]   # Екіншілік активті тасымалдау — аминқышқылдары
for q in qs: assert q["correct"], q["id"]
t5 = {"id": "ubtn-4", "title": "", "questions": qs}
# 3) реттеу, атаулар, id-лер
tests = [t1, t2, t3, t5, t6]
for i, t in enumerate(tests, 1):
    old = t["id"]; t["id"] = f"ubtn-{i}"; t["title"] = f"{i}-нұсқа"
    for j, q in enumerate(t["questions"], 1):
        q["id"] = f"ubtn-{i}-q{j}"
        for k in ("img", "contextImg"):
            if k in q: q[k] = [s.replace(f"{tmp}/img/{old}", f"img/tests/ubtn-{i}") for s in q[k]]
for i, t in enumerate(tests, 1):
    assert len(t["questions"]) == 40, (t["title"], len(t["questions"]))
folder = {"id": "ubtn", "title": "ҰБТ нұсқалары", "tests": tests}
with open(f"{repo}/js/tests/ubtn.js", "w", encoding="utf-8") as fh:
    fh.write("/* «ҰБТ нұсқалары» — мұғалімнің 5 .docx файлы (tools/ubtn/build.py) */\n")
    fh.write("(window.TEST_FOLDERS = window.TEST_FOLDERS || []).push(" + json.dumps(folder, ensure_ascii=False, indent=1) + ");\n")
from collections import Counter
for t in tests: print(t["title"], len(t["questions"]), dict(Counter(q["type"] for q in t["questions"])))
shutil.rmtree(tmp)
