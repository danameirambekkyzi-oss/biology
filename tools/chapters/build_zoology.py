"""Зоология тарауының тесттері: parse_botany1/2.py шығарған JSON → js/tests/chapters.js (зоология бөлімін қосады/жаңартады)
Қолданылуы: python3 -I build_zoology.py a.json b.json imgdir repo
a.json: QNIDS=1,3 STOPNID=16 parse_botany1.py, b.json: parse_botany2.py"""
import json, sys, os, shutil
a, b, imgdir, repo = sys.argv[1:5]
NOTE = "Егер зоология тарауынан әлсіз болсаң, бұл жерде сенің біліміңді күшейтуге өте көптеген тесттер бар. Жаттығып, балыңды арттыр!"
# Тест-1 соңындағы сәйкестендіру сұрақтары файлда ретсіз жазылған — қолмен енгізілді: (элементтер, жауаптар, нұсқалар)
MATCH1 = [
    (["Гаструла", "Нейрула"], [1, 2], ["Зиготаның бөлшектенуі нәтижесінде пайда болған ұрық", "Екіқабатты ұрық", "Жүйке түтігі пайда болады", "Мезодерма пайда болады"]),
    (["Адам қарны", "Сиыр қарны"], [2, 3], ["Соқырішегі қысқа, қарны 4 бөлімді", "Соқырішегі ұзын, қарны 1 бөлімді", "Соқырішегі қысқа, қарны 1 бөлімді", "Соқырішегі ұзын, қарны 4 бөлімді"]),
    (["Қытай-Малай орталығы", "Үнді орталығы"], [3, 1], ["Шошқа, сыңар өркешті түйе, кептер", "Буйвол, ит, тауыс, тауық, үнді мысығы, балара", "Түйеқұс, мысыр тауығы, ит, есек, шошқа", "Тауық, үйрек, тұт жібек құрты"]),
    (["Энтодерма", "Мезодерма"], [0, 2], ["Асқорыту жүйесі, өкпе", "Зәр шығару жүйесі, жүйке жүйесі", "Бұлшықет, қаңқа, буын", "Жүрек – қан тамырлары, тер бездері"]),
    (["Ақбөкен", "Реликті шағала"], [2, 3], ["Қазақстан сирек кездесетін құстардың бірі", "Басы кішкентай, тұмсығы үлкен ортасынан бөлінген", "Қорек іздеу кезінде үлкен арақашықтықты жүгіріп өтеді", "Қанаттарының қақпа қауырсындарында өзіндік ерекше өрнектері бар"]),
    (["Батыс Алтай қорығы", "Қаратау қорығы"], [0, 2], ["Шығыс Қазақстанда орналасқан", "Арал теңізінде орналасқан", "Оңтүстік Қазақстанда орналасқан", "Ақмола облысында орналасқан"]),
    (["Зәр қышқылы", "Гуанин"], [0, 1], ["C₅H₄N₄O₃", "C₅H₅N₅O", "C₅H₃N₄O₃", "C₅H₄N₃O₂"]),
    (["Тері-бұлшықет қапшығы пайда болған", "Бұлшықеттің жеке шоғыры пайда болды"], [1, 3], ["Ұлуларда", "Құрттар", "Губкалар", "Буынаяқтылар"]),
    (["Сегізаяқ", "Өрмекшітәрізділер"], [2, 0], ["Жұтқыншақүсті жүйке түйіні нашар дамыған", "Бас түйіндері мүлде дамымаған", "Көру мүшесі жақсы дамыған", "Жұтқыншақ маңы жүйке буылтығы мен құрсақ жүйке тізбегінен тұрады"]),
]
# Тест-2 түзетулері: 90 — суреттер элементтер; 102 — бос жол (алынып тасталады);
# 103+104 — бір сәйкестендіру, файлда жауабы белгіленбеген
FIX2 = {90: {"items": ["1-сурет", "2-сурет"], "correct": [3, 0]}}
# файлдағы 2-сұрақ толығымен сурет болып қойылған (1-сұраққа жабысып қалған) — мәтінмен қайта жазылды
NOIMG2 = {1}
EXTRA2 = {1: {"id": "zoo-2-q1b", "module": "zoology", "q": "Жүйке жүйесін белгіле", "options": ["Түйінді", "Түтікше тәрізді", "Сатылы", "Бағанды жүйке жүйесі"],
             "correct": [1], "img": ["img/chapters/zoo-2/nerve.png"]}}
DROP2 = {102, 104}
JOIN2 = {103: (["Бір ғана қанайналым шеңбері бар", "Жүрегі төрт қуысты"], [0, 1], 104)}
def tx(s): return " ".join(s.split())
def imgs(e, q, idir, img_src):
    files = []
    from PIL import Image
    for f in q.get("img") or []:
        shutil.copy(os.path.join(img_src, f), f"{repo}/{idir}/{f}"); files.append(f"{idir}/{f}")
        im = Image.open(f"{repo}/{idir}/{f}"); im.thumbnail((1400, 1400)); im.save(f"{repo}/{idir}/{f}", optimize=True)
    if files: e["img"] = files
def build(src, tid, img_src=None):
    out, idir = [], f"img/chapters/{tid}"
    shutil.rmtree(f"{repo}/{idir}", ignore_errors=True)
    if img_src: os.makedirs(f"{repo}/{idir}")
    qs = json.load(open(src)); byn = {q["n"]: q for q in qs}
    if tid == "zoo-1": qs = [q for q in qs if q["n"] != 126]
    for q in qs:
        if tid == "zoo-2" and q["n"] in DROP2: continue
        e = {"id": f"{tid}-q{q['n']}", "module": "zoology"}
        if tid == "zoo-2" and q["n"] in JOIN2:
            items, ans, src_n = JOIN2[q["n"]]
            e.update(type="match", q="Сәйкестендіріңіз", options=[tx(o["t"]) for o in byn[src_n]["opts"]],
                     items=[{"text": t, "answer": x} for t, x in zip(items, ans)], correct=ans)
        elif q.get("items"):
            fix = FIX2.get(q["n"], {}) if tid == "zoo-2" else {}
            items = [{"text": tx(t), "answer": x} for t, x in zip(fix.get("items", [it["text"] for it in q["items"]]),
                                                               fix.get("correct", [it["answer"] for it in q["items"]]))]
            assert len(items) == 2 and len(q["opts"]) == 4, q["n"]
            e.update(type="match", q="Сәйкестендіріңіз", options=[tx(o["t"]) for o in q["opts"]], items=items, correct=[it["answer"] for it in items])
        else:
            corr = [i for i, o in enumerate(q["opts"]) if o["c"]]
            assert corr and 3 <= len(q["opts"]) <= 6 and len(corr) <= 3, (tid, q["n"])
            if len(q["opts"]) >= 5 or len(corr) > 1: e["type"] = "multi"
            e.update(q=tx(q["q"]), options=[tx(o["t"]) for o in q["opts"]], correct=corr)
        if not (tid == "zoo-2" and q["n"] in NOIMG2): imgs(e, q, idir, img_src)
        out.append(e)
        if tid == "zoo-2" and q["n"] in EXTRA2:
            shutil.copy(f"{repo}/tools/chapters/zoo2_nerve.png", f"{repo}/{idir}/nerve.png"); out.append(EXTRA2[q["n"]])
    if tid == "zoo-1":
        for i, (items, ans, opts) in enumerate(MATCH1):
            out.append({"id": f"{tid}-m{i+1}", "module": "zoology", "type": "match", "q": "Сәйкестендіріңіз", "options": opts,
                        "items": [{"text": t, "answer": x} for t, x in zip(items, ans)], "correct": ans})
    return out
entry = {"module": "zoology", "note": NOTE, "tests": [
    {"id": "zoo-1", "title": "Зоология тарауы бойынша тест-1", "questions": build(a, "zoo-1")},
    {"id": "zoo-2", "title": "Зоология тарауы бойынша тест-2", "questions": build(b, "zoo-2", imgdir)}]}
path = f"{repo}/js/tests/chapters.js"
head, body = open(path).read().split("window.CHAPTER_TESTS = ", 1)
data = [m for m in json.loads(body.rstrip().rstrip(";")) if m["module"] != "zoology"] + [entry]
open(path, "w").write(head + "window.CHAPTER_TESTS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
from collections import Counter
for t in entry["tests"]: print(t["title"], len(t["questions"]), Counter(q.get("type", "single") for q in t["questions"]))
