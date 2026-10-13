#!/usr/bin/env python3
"""Анатомия және генетика тесттерін js/tests/nagyz.js-ке қосады.
Қолдану:
  python3 tools/nagyz/build_anat_gen.py <суреттер> <репо>                      # Тест-3–5, anat_gen.py
  python3 tools/nagyz/build_anat_gen.py <суреттер> <репо> anat_gen2.py 6 6     # Тест-6–11, anat_gen2.py"""
import json, os, re, shutil, sys
from collections import Counter
imgsrc, repo = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
data = sys.argv[3] if len(sys.argv) > 3 else "anat_gen.py"
first = int(sys.argv[4]) if len(sys.argv) > 4 else 3; count = int(sys.argv[5]) if len(sys.argv) > 5 else 3
ns = {}; exec(open(os.path.join(here, data), encoding="utf-8").read(), ns)
S, M, X = ns["S"], ns["M"], ns["X"]
L = "ABCDEFGH"
def split(a, sizes):
    assert sum(sizes) == len(a); r, i = [], 0
    for z in sizes: r.append(a[i:i + z]); i += z
    return r
def even(a, n, front=True):  # қалдықты алдыңғы (немесе соңғы) тесттерге бөледі
    q, r = divmod(len(a), n); z = [q + (1 if (i < r if front else i >= n - r) else 0) for i in range(n)]; return split(a, z)
if data == "anat_gen.py":  # 39 / 39 / 40: бір жауапты 19+19+18, сәйкестендіру 6+6+7, көп жауапты 14+14+15
    sS, sX, sM = split(S, [19, 19, 18]), split(X, [6, 6, 7]), split(M, [14, 14, 15])
else:
    sS, sX, sM = even(S, count), even(X, count), even(M, count)
ids = [f"nagyz-{first + k}" for k in range(count)]
path = os.path.join(repo, "js/tests/nagyz.js"); js = open(path, encoding="utf-8").read()
head, body = js.split("push(", 1); folder = json.loads(body.rsplit(");", 1)[0])
folder["tests"] = [t for t in folder["tests"] if t["id"] not in ids]
for k in range(count):
    tid = ids[k]; idir = f"img/tests/{tid}"
    shutil.rmtree(os.path.join(repo, idir), ignore_errors=True); os.makedirs(os.path.join(repo, idir))
    out = []
    for it in sS[k] + sX[k] + sM[k]:
        n = len(out) + 1; e = {"id": f"{tid}-q{n}", "module": ""}
        if it[0] == "x":
            _, q, items, opts, ans = it[:5]; assert len(items) == 2 and len(ans) == 2
            e.update(type="match", q=q, options=opts, items=[{"text": t, "answer": L.index(a)} for t, a in zip(items, ans)], correct=[L.index(a) for a in ans])
            extra = it[5] if len(it) > 5 else {}
        else:
            kind, q, opts, ans = it[:4]; corr = [L.index(a) for a in ans]
            assert all(c < len(opts) for c in corr), q
            if kind == "s": assert len(opts) in (3, 4) and len(corr) == 1, q
            else: e["type"] = "multi"; assert len(opts) >= 6, q
            e.update(q=q[:1].upper() + q[1:], options=opts, correct=corr)
            extra = it[4] if len(it) > 4 else {}
        imgs = extra.get("img") or []
        if isinstance(imgs, str): imgs = [imgs]
        for j, src in enumerate(imgs):
            fn = f"q{n}{'' if j == 0 else '_' + str(j)}{os.path.splitext(src)[1]}"; shutil.copy(os.path.join(imgsrc, src), os.path.join(repo, idir, fn)); e.setdefault("img", []).append(f"{idir}/{fn}")
        out.append(e)
    folder["tests"].append({"id": tid, "title": f"Тест-{first + k}", "sub": "Анатомия және генетика бойынша келген сұрақтар", "questions": out})
    print(f"Тест-{first + k}", len(out), dict(Counter(x.get("type", "single") for x in out)))
folder["tests"].sort(key=lambda t: int(t["id"].split("-")[1]))
open(path, "w", encoding="utf-8").write(head + "push(" + json.dumps(folder, ensure_ascii=False, indent=1) + ");\n")
