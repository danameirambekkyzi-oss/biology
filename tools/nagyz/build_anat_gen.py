#!/usr/bin/env python3
"""Тест-3, 4, 5 (анатомия және генетика) — anat_gen.py деректерінен js/tests/nagyz.js-ке қосады.
Қолдану: python3 tools/nagyz/build_anat_gen.py <суреттер_папкасы> <репо>"""
import json, os, re, shutil, sys
from collections import Counter
imgsrc, repo = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
ns = {}; exec(open(os.path.join(here, "anat_gen.py"), encoding="utf-8").read(), ns)
S, M, X = ns["S"], ns["M"], ns["X"]
L = "ABCDEFGH"
def split(a, sizes):
    assert sum(sizes) == len(a); r, i = [], 0
    for z in sizes: r.append(a[i:i + z]); i += z
    return r
# 39 / 39 / 40: бір жауапты 19+19+18, сәйкестендіру 6+6+7, көп жауапты 14+14+15
sS, sX, sM = split(S, [19, 19, 18]), split(X, [6, 6, 7]), split(M, [14, 14, 15])
path = os.path.join(repo, "js/tests/nagyz.js"); js = open(path, encoding="utf-8").read()
head, body = js.split("push(", 1); folder = json.loads(body.rsplit(");", 1)[0])
folder["tests"] = [t for t in folder["tests"] if t["id"] not in ("nagyz-3", "nagyz-4", "nagyz-5")]
for k in range(3):
    tid = f"nagyz-{k + 3}"; idir = f"img/tests/{tid}"
    shutil.rmtree(os.path.join(repo, idir), ignore_errors=True); os.makedirs(os.path.join(repo, idir))
    out = []
    for it in sS[k] + sX[k] + sM[k]:
        n = len(out) + 1; e = {"id": f"{tid}-q{n}", "module": ""}
        if it[0] == "x":
            _, q, items, opts, ans = it; assert len(items) == 2 and len(ans) == 2
            e.update(type="match", q=q, options=opts, items=[{"text": t, "answer": L.index(a)} for t, a in zip(items, ans)], correct=[L.index(a) for a in ans])
        else:
            kind, q, opts, ans = it[:4]; corr = [L.index(a) for a in ans]
            assert all(c < len(opts) for c in corr), q
            if kind == "s": assert len(opts) == 4 and len(corr) == 1, q
            else: e["type"] = "multi"; assert len(opts) >= 6, q
            e.update(q=q, options=opts, correct=corr)
            extra = it[4] if len(it) > 4 else {}
            if extra.get("img"):
                fn = f"q{n}{os.path.splitext(extra['img'])[1]}"; shutil.copy(os.path.join(imgsrc, extra["img"]), os.path.join(repo, idir, fn)); e["img"] = [f"{idir}/{fn}"]
        out.append(e)
    folder["tests"].append({"id": tid, "title": f"Тест-{k + 3}", "sub": "Анатомия және генетика бойынша келген сұрақтар", "questions": out})
    print(f"Тест-{k + 3}", len(out), dict(Counter(x.get("type", "single") for x in out)))
folder["tests"].sort(key=lambda t: int(t["id"].split("-")[1]))
open(path, "w", encoding="utf-8").write(head + "push(" + json.dumps(folder, ensure_ascii=False, indent=1) + ");\n")
