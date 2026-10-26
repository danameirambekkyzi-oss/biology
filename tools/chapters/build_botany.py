"""Ботаника тарауының тесттері: parse_botany1/2.py шығарған JSON → js/tests/chapters.js
Қолданылуы: python3 -I build_botany.py a.json b.json imgdir repo"""
import json, sys, os, shutil
a, b, imgdir, repo = sys.argv[1:5]
NOTE = "Егер ботаника тарауынан әлсіз болсаң, бұл жерде сенің біліміңді күшейтуге өте көптеген тесттер бар. Жаттығып, балыңды арттыр!"
# Түзетулер (файлдағы техникалық ақаулар)
FIX2 = {101: {"items": ["1-сурет", "2-сурет"]}}
TEXT_FIX = {"С у жинайтын": "Су жинайтын", " (4 дұрыс жауап)": ""}
def tx(s):
    for k, v in TEXT_FIX.items(): s = s.replace(k, v)
    return s.strip()
def build(src, tid, img_src=None):
    out = []
    idir = f"img/chapters/{tid}"
    if img_src:
        shutil.rmtree(f"{repo}/{idir}", ignore_errors=True); os.makedirs(f"{repo}/{idir}")
    for q in json.load(open(src)):
        e = {"id": f"{tid}-q{q['n']}", "module": "botany"}
        fix = (FIX2 if tid == "bot-2" else {}).get(q["n"], {})
        if q.get("items"):
            items = [{"text": tx(fix["items"][i] if "items" in fix else it["text"]), "answer": it["answer"]} for i, it in enumerate(q["items"])]
            assert len(items) == 2 and len(q["opts"]) == 4, q["n"]
            e.update(type="match", q="Сәйкестендіріңіз", options=[tx(o["t"]) for o in q["opts"]], items=items, correct=[it["answer"] for it in items])
        else:
            corr = [i for i, o in enumerate(q["opts"]) if o["c"]]
            assert corr and len(q["opts"]) >= 4, (tid, q["n"])
            if len(q["opts"]) >= 5 or len(corr) > 1: e["type"] = "multi"
            assert len(corr) <= 3, (tid, q["n"], corr)
            e.update(q=tx(q["q"]), options=[tx(o["t"]) for o in q["opts"]], correct=corr)
        if q.get("img"):
            files = []
            for f in q["img"]:
                shutil.copy(os.path.join(img_src, f), f"{repo}/{idir}/{f}"); files.append(f"{idir}/{f}")
            e["img"] = files
        out.append(e)
    return out
t1, t2 = build(a, "bot-1"), build(b, "bot-2", imgdir)
data = [{"module": "botany", "note": NOTE, "tests": [
    {"id": "bot-1", "title": "Ботаника тарауы бойынша тест-1", "questions": t1},
    {"id": "bot-2", "title": "Ботаника тарауы бойынша тест-2", "questions": t2}]}]
js = "/* «Тараулық тест» бөлімінің тесттері — tools/chapters/build_botany.py арқылы мұғалімнің .docx файлдарынан жасалған */\nwindow.CHAPTER_TESTS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
open(f"{repo}/js/tests/chapters.js", "w").write(js)
from collections import Counter
for t in data[0]["tests"]: print(t["title"], len(t["questions"]), Counter(q.get("type", "single") for q in t["questions"]))
