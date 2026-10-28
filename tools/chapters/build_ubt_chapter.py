"""ҰБТ форматындағы тараулық тесттер: parse_ubt.py шығарған JSON → js/tests/chapters.js (сол тарау бөлімін қосады/жаңартады)
Қолданылуы: python3 -I build_ubt_chapter.py repo module t1.json t2.json ...   (module: anatomy, genetics, ...)"""
import json, sys
repo, mod, srcs = sys.argv[1], sys.argv[2], sys.argv[3:]
NAME = {"anatomy": ("анатомия", "ana"), "genetics": ("генетика", "gen")}[mod]
NOTE = f"Егер {NAME[0]} тарауынан әлсіз болсаң, бұл жерде сенің біліміңді күшейтуге өте көптеген тесттер бар. Жаттығып, балыңды арттыр!"
def tx(s): return " ".join(s.split())
tests = []
for k, src in enumerate(srcs, 1):
    tid, data, out = f"{NAME[1]}-{k}", json.load(open(src)), []
    for q in data["questions"]:
        e = {"id": f"{tid}-q{q['n']}", "module": mod}
        if q["items"]:
            assert len(q["items"]) == 2 and len(q["opts"]) == 4, (tid, q["n"])
            e.update(type="match", q="Сәйкестендіріңіз", options=[tx(o["t"]) for o in q["opts"]],
                     items=[{"text": tx(it["text"]), "answer": it["answer"]} for it in q["items"]], correct=[it["answer"] for it in q["items"]])
        else:
            corr = [i for i, o in enumerate(q["opts"]) if o["c"]]
            assert corr and 4 <= len(q["opts"]) <= 6 and len(corr) <= 3, (tid, q["n"])
            if len(q["opts"]) >= 5 or len(corr) > 1: e["type"] = "multi"
            e.update(q=tx(q["q"]), options=[tx(o["t"]) for o in q["opts"]], correct=corr)
        out.append(e)
    tests.append({"id": tid, "title": data["title"], "questions": out})
entry = {"module": mod, "note": NOTE, "tests": tests}
path = f"{repo}/js/tests/chapters.js"
head, body = open(path).read().split("window.CHAPTER_TESTS = ", 1)
data = [m for m in json.loads(body.rstrip().rstrip(";")) if m["module"] != mod] + [entry]
open(path, "w").write(head + "window.CHAPTER_TESTS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
from collections import Counter
for t in tests: print(t["title"], len(t["questions"]), Counter(q.get("type", "single") for q in t["questions"]))
