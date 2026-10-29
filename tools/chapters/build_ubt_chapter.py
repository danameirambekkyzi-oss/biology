"""ҰБТ форматындағы тараулық тесттер: parse_ubt.py шығарған JSON → js/tests/chapters.js (сол тарау бөлімін қосады/жаңартады)
Қолданылуы: python3 -I build_ubt_chapter.py repo module t1.json t2.json ...   (module: anatomy, genetics, ...)"""
import json, sys
repo, mod, srcs = sys.argv[1], sys.argv[2], sys.argv[3:]
NAME = {"anatomy": ("анатомия", "ana"), "genetics": ("генетика", "gen"), "molecular": ("молекулалық биология", "mol"),
        "cell": ("жасушалық биология", "cell")}[mod]
# Файлда тақырып жазылмаса — тест атауы (тараудағы реті бойынша)
TITLE = {("molecular", 1): "Тірі организмдердегі заттардың тасымалдануы", ("cell", 5): "Митохондрия және энергия алмасуы"}
# Файлдағы тақырыптың жазылуын түзету
TITLE_FIX = {"Өсімдіктердің Құрылысы": "Өсімдіктердің құрылысы"}
# Мәтіндегі емле қателері
TEXT_FIX = {"Фагацитоз": "Фагоцитоз", "Эозонофилдер": "Эозинофилдер", "тасылмалдану": "тасымалдану", "бағыттта": "бағытта",
            "рецепиент": "реципиент", "Транслокоза": "Транслоказа"}
NOTE = f"Егер {NAME[0]} тарауынан әлсіз болсаң, бұл жерде сенің біліміңді күшейтуге өте көптеген тесттер бар. Жаттығып, балыңды арттыр!"
def tx(s):
    s = " ".join(s.split())
    for a, b in (TEXT_FIX.items() if mod in ("molecular", "cell") else ()): s = s.replace(a, b)
    return s
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
            if q.get("ctx"):  # контекстік тапсырма
                assert len(q["opts"]) == 4 and len(corr) == 1, (tid, q["n"])
                e.update(type="context", contextTitle=q["ctx"]["title"], context=q["ctx"]["text"])
        if q.get("img"): e["img"] = q["img"]
        out.append(e)
    title = data["title"] or TITLE[mod, k]
    for a, b in TITLE_FIX.items(): title = title.replace(a, b)
    tests.append({"id": tid, "title": title, "questions": out})
entry = {"module": mod, "note": NOTE, "tests": tests}
path = f"{repo}/js/tests/chapters.js"
head, body = open(path).read().split("window.CHAPTER_TESTS = ", 1)
data = [m for m in json.loads(body.rstrip().rstrip(";")) if m["module"] != mod] + [entry]
open(path, "w").write(head + "window.CHAPTER_TESTS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
from collections import Counter
for t in tests: print(t["title"], len(t["questions"]), Counter(q.get("type", "single") for q in t["questions"]))
