#!/usr/bin/env python3
"""
ҰБТ сынама нұсқаларын (.docx) сайтқа түрлендіру.

Әр .docx — бір толық нұсқа (40 тапсырма, ресми ҰБТ құрылымы):
   1–25  бір дұрыс жауапты         (дұрыс жауап — қалың қаріппен)
  26–30  контекстік                (контекст мәтіні 26-сұрақтың алдында; суреттер болуы мүмкін)
  31–35  сәйкестендіру             (жауап жолдың соңында: «Липаза – В»)
  36–40  бірнеше дұрыс жауапты     (дұрыс жауаптар — қалың қаріппен)

Қолдану:
  pip install python-docx
  python3 tools/ubt_docx.py --folder "Наурыз ҰБТ слив" --id naurz --out js/tests/naurz.js тест1.docx тест2.docx ...
Суреттер img/tests/<id>/ папкасына сақталады. Нәтиже файлын index.html-ге <script> ретінде қосыңыз.
"""
import argparse, html, json, os, re, sys

try:
    import docx
    from docx.oxml.ns import qn
except ImportError:
    sys.exit("python-docx орнатылмаған: pip install python-docx")

LETTER_INDEX = {  # кирилл/латын әріптері → нұсқа реті
    "А": 0, "A": 0, "В": 1, "B": 1, "Б": 1, "С": 2, "C": 2, "Д": 3, "D": 3, "Г": 3,
    "Е": 4, "E": 4, "Ф": 5, "F": 5,
}
OPT_RE = re.compile(r"^\s*([A-FАБВСДЕФГ])\s*[.)]\s*(.*)$")
NUM_RE = re.compile(r"^\s*\d+\s*[.)]\s*")
MATCH_HEAD_RE = re.compile(r"^\s*(\d+\s*[.)]\s*)?сәйкестендір(у|іңіз)?\s*:?\s*$", re.I)
ITEM_RE = re.compile(r"^\s*(?:\d+\s*[.)]\s*)?(.+?)\s*[-–—]?\s*([A-FАБВСДЕФГ])\s*$")


def run_html(r):
    t = html.escape(r.text)
    va = r.font.superscript, r.font.subscript
    if va[0]: t = f"<sup>{t}</sup>"
    elif va[1]: t = f"<sub>{t}</sub>"
    return t


def is_bold(r, p):
    if r.bold is not None: return r.bold
    if r.style is not None and r.style.font.bold: return True
    return bool(p.style is not None and p.style.font.bold)


def paragraph_lines(p, doc, save_image):
    """Абзацты жолдарға бөледі (жол үзілімі <w:br/> бойынша). Әр жол: html, plain, bold маскасы, суреттер."""
    lines = [{"html": "", "plain": "", "bold": [], "imgs": []}]
    for r in p.runs:
        for blip in r._element.iter(qn("a:blip")):
            rid = blip.get(qn("r:embed"))
            if rid and rid in doc.part.related_parts:
                lines[-1]["imgs"].append(save_image(doc.part.related_parts[rid]))
        parts = r.text.split("\n")
        b = is_bold(r, p)
        for k, part in enumerate(parts):
            if k > 0: lines.append({"html": "", "plain": "", "bold": [], "imgs": []})
            lines[-1]["plain"] += part
            lines[-1]["bold"] += [b] * len(part)
            lines[-1]["html"] += run_html(r) if len(parts) == 1 else html.escape(part)
    return lines


def bold_ratio(line, start):
    chars = [(c, b) for c, b in zip(line["plain"][start:], line["bold"][start:]) if not c.isspace()]
    return sum(b for _, b in chars) / len(chars) if chars else 0


def clean_html(h):
    h = re.sub(r"\s+", " ", h).strip()
    return h


def strip_num(h):
    return NUM_RE.sub("", h, count=1).strip()


def parse_docx(path, save_image):
    d = docx.Document(path)
    items = []  # {"kind": "text"|"opt", ...}
    for p in d.paragraphs:
        for ln in paragraph_lines(p, d, save_image):
            plain = ln["plain"].replace("\xa0", " ")
            if not plain.strip():
                if ln["imgs"]: items.append({"kind": "text", "plain": "", "html": "", "imgs": ln["imgs"]})
                continue
            m = OPT_RE.match(plain)
            if m:
                start = m.start(2)
                # html денесі: префиксті алып тастау
                h = ln["html"].replace("\xa0", " ")
                text_html = html.escape(m.group(2).strip())
                # егер жолда sup/sub болса, оны сақтау
                if "<sup>" in h or "<sub>" in h:
                    text_html = re.sub(r"^\s*([A-FАБВСДЕФГ])\s*[.)]\s*", "", h).strip()
                items.append({"kind": "opt", "letter": m.group(1), "html": clean_html(text_html),
                              "bold": bold_ratio(ln, start) > 0.5, "imgs": ln["imgs"]})
            else:
                items.append({"kind": "text", "plain": plain.strip(), "html": clean_html(ln["html"]), "imgs": ln["imgs"]})

    # Нұсқаның жалғасы (Word-та келесі жолға түсіп кеткен мәтін) → алдыңғы нұсқаға қосу
    merged = []
    for k, it in enumerate(items):
        nxt = next((x for x in items[k + 1:] if x["kind"] == "opt" or x.get("plain")), None)
        if (it["kind"] == "text" and it.get("plain") and merged and merged[-1]["kind"] == "opt"
                and nxt is not None and nxt["kind"] == "opt" and not NUM_RE.match(it["plain"]) and not it["imgs"]
                and LETTER_INDEX.get(nxt["letter"], -9) == LETTER_INDEX.get(merged[-1]["letter"], -9) + 1):
            merged[-1]["html"] += " " + it["html"]
            continue
        merged.append(it)
    items = merged

    # Блоктарға бөлу: [мәтін жолдары] + [нұсқалар]
    blocks, texts, opts = [], [], []
    for it in items:
        if it["kind"] == "opt":
            opts.append(it)
        else:
            if opts:
                blocks.append((texts, opts)); texts, opts = [], []
            texts.append(it)
    if opts: blocks.append((texts, opts))
    return blocks


def build_question(idx, texts, opts, qid, warn, ctx_holder):
    imgs_all = [im for t in texts for im in t["imgs"]]
    lines = [t for t in texts if t["plain"]]
    options = [o["html"] for o in opts]
    letter_map = {o["letter"]: k for k, o in enumerate(opts)}
    q = {"id": qid, "module": "", "options": options}

    if 30 <= idx <= 34:  # сәйкестендіру
        cand = [t for t in lines if not MATCH_HEAD_RE.match(t["plain"])]
        its = []
        for t in cand:
            m = ITEM_RE.match(NUM_RE.sub("", t["plain"], count=1))
            if not m: continue
            letter = m.group(2)
            ans = letter_map.get(letter, LETTER_INDEX.get(letter))
            its.append({"text": html.escape(m.group(1).strip(" -–—")), "answer": ans})
        if len(its) != 2: warn(f"{qid}: сәйкестендіруде {len(its)} элемент табылды (күтілгені 2)")
        q.update({"type": "match", "q": "Сәйкестендіріңіз:", "items": its, "correct": [i["answer"] for i in its]})
        if imgs_all: q["img"] = imgs_all
        return q

    if not lines:
        warn(f"{qid}: сұрақ мәтіні табылмады"); qtext, before = "", []
    else:
        qtext, before = strip_num(lines[-1]["html"]), lines[:-1]
    correct = [k for k, o in enumerate(opts) if o["bold"]]
    q["q"] = qtext

    if idx == 25:  # контекст басталады
        # сұрақ жолының өз суреттері сұраққа; одан бұрынғы суреттер контекстке
        qline = lines[-1] if lines else None
        ctx_imgs, q_imgs, seen_q = [], [], False
        for t in texts:
            if t is qline: seen_q = True
            (q_imgs if seen_q else ctx_imgs).extend(t["imgs"])
        title = ""
        if before and len(before[0]["plain"]) < 80 and not before[0]["plain"].endswith("."):
            title, before = before[0]["html"], before[1:]
        ctx_holder.update({"context": "<br><br>".join(b["html"] for b in before), "contextTitle": title, "contextImg": ctx_imgs})
        imgs_all = q_imgs
    if 25 <= idx <= 29:
        q["type"] = "context"
        q["context"] = ctx_holder.get("context", "")
        if ctx_holder.get("contextTitle"): q["contextTitle"] = ctx_holder["contextTitle"]
        if ctx_holder.get("contextImg"): q["contextImg"] = ctx_holder["contextImg"]
    elif idx >= 35:
        q["type"] = "multi"
    else:
        q["type"] = "single"
    if before and idx not in (25,):
        q["q"] = " ".join([b["html"] for b in before] + [qtext])
    if imgs_all: q["img"] = imgs_all
    q["correct"] = correct
    if q["type"] == "multi":
        if not (2 <= len(correct) <= 4): warn(f"{qid}: бірнеше жауапты сұрақта {len(correct)} дұрыс жауап белгіленген")
    elif len(correct) != 1:
        warn(f"{qid}: {len(correct)} дұрыс жауап белгіленген (күтілгені 1) — «{re.sub('<[^>]+>', '', qtext)[:60]}»")
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--img-dir", default="img/tests")
    ap.add_argument("files", nargs="+")
    a = ap.parse_args()
    warnings, tests = [], []
    for n, f in enumerate(a.files, 1):
        tid = f"{a.id}-{n}"
        img_dir = os.path.join(a.img_dir, tid); os.makedirs(img_dir, exist_ok=True)
        counter = {"n": 0}

        def save_image(part, img_dir=img_dir, counter=counter):
            counter["n"] += 1
            ext = os.path.splitext(part.partname)[1] or ".png"
            name = f"{counter['n']}{ext}"
            with open(os.path.join(img_dir, name), "wb") as fh: fh.write(part.blob)
            return f"{img_dir}/{name}".replace(os.sep, "/")

        blocks = parse_docx(f, save_image)
        warn = lambda m, tid=tid: warnings.append(f"Тест-{n}: {m}")
        if len(blocks) != 40: warn(f"{len(blocks)} тапсырма табылды (күтілгені 40)")
        ctx = {}
        qs = [build_question(i, t, o, f"{tid}-q{i + 1}", warn, ctx) for i, (t, o) in enumerate(blocks)]
        tests.append({"id": tid, "title": f"Тест-{n}", "questions": qs})
    folder = {"id": a.id, "title": a.folder, "tests": tests}
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write(f"/* «{a.folder}» — tools/ubt_docx.py арқылы .docx файлдардан жасалған */\n")
        fh.write("(window.TEST_FOLDERS = window.TEST_FOLDERS || []).push(" + json.dumps(folder, ensure_ascii=False, indent=1) + ");\n")
    for t in tests:
        from collections import Counter
        print(t["title"], len(t["questions"]), dict(Counter(q["type"] for q in t["questions"])))
    print("\nЕСКЕРТУЛЕР:" if warnings else "\nЕскерту жоқ")
    for w in warnings: print(" -", w)


if __name__ == "__main__":
    main()
