import json, os, shutil, sys
S, REPO = sys.argv[1], sys.argv[2]
L = "ABCDEF"
tests, flags = [], []
for n in range(1, int(sys.argv[3]) + 1 if len(sys.argv) > 3 else 5):
    ns = {}; exec(open(f"{S}/uto/t{n}.py").read(), ns); T = ns["T"]
    tid = f"uto-{n}"; idir = f"img/tests/{tid}"; os.makedirs(f"{REPO}/{idir}", exist_ok=True)
    def img(f):
        shutil.copy(f"{S}/pptx_in/crops/{f}", f"{REPO}/{idir}/{f.split('_', 1)[1]}"); return f"{idir}/{f.split('_', 1)[1]}"
    qs, ctx, left = [], None, 0
    for item in T:
        kind = item[0]
        if kind == "ctx":
            ctx = {"contextTitle": item[1], "context": item[2], "contextImg": [img(f) for f in item[3]]}; left = 5; continue
        extra = item[-1] if isinstance(item[-1], dict) else {}
        qid = f"{tid}-q{len(qs) + 1}"
        if kind == "x":
            _, q, its, opts, ans = item[:5]
            assert len(its) == 2 and len(ans) == 2, qid
            d = {"id": qid, "module": "", "type": "match", "q": q, "options": opts,
                 "items": [{"text": its[k], "answer": L.index(ans[k])} for k in range(2)], "correct": [L.index(a) for a in ans]}
            assert all(L.index(a) < len(opts) for a in ans), qid
        else:
            _, q, opts, ans = item[:4]
            assert all(L.index(a) < len(opts) for a in ans), qid
            d = {"id": qid, "module": "", "type": "multi" if kind == "m" else "single", "q": q, "options": opts, "correct": sorted(L.index(a) for a in ans)}
            if kind == "s": assert len(ans) == 1 and len(opts) == 4, qid
            if kind == "s" and left > 0: d["type"] = "context"; d.update(ctx); left -= 1
        if extra.get("img"): d["img"] = [img(f) for f in extra["img"]]
        if extra.get("explain"): d["explain"] = extra["explain"]
        if extra.get("flag"): flags.append(f"Тест-{n}, {len(qs) + 1}-сұрақ: {extra['flag']}")
        qs.append(d)
    tests.append({"id": tid, "title": f"Тест-{n}", "questions": qs})
folder = {"id": "uto", "title": "ҰТО нұсқалары", "tests": tests}
with open(f"{REPO}/js/tests/uto.js", "w", encoding="utf-8") as fh:
    fh.write("/* «ҰТО нұсқалары» — мұғалімнің .pptx файлдарынан (дұрыс жауап — дөңгелектелген нұсқа) */\n")
    fh.write("(window.TEST_FOLDERS = window.TEST_FOLDERS || []).push(" + json.dumps(folder, ensure_ascii=False, indent=1) + ");\n")
from collections import Counter
for t in tests:
    mx = sum(2 if q["type"] in ("multi", "match") else 1 for q in t["questions"])
    print(t["title"], len(t["questions"]), dict(Counter(q["type"] for q in t["questions"])), "max", mx)
print("\n".join(flags))
