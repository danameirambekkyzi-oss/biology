#!/usr/bin/env python3
"""
.docx файлдағы тест сұрақтарын js/questions.js форматына түрлендіреді.

Қолдану:
    pip install python-docx
    python3 tools/docx_to_questions.py сұрақтар.docx            # js/questions.js файлын қайта жазады
    python3 tools/docx_to_questions.py сұрақтар.docx -o out.js  # басқа файлға жазу

.docx ішіндегі формат (әр жол — жеке абзац):

    # Генетика                          <- тарау (botany, zoology, anatomy, genetics, molecular, cell, biotech, biomed, evolution
                                           немесе қазақша атауы)
    Контекст: Ферменттер — ...          <- (міндетті емес) контекстік мәтін, келесі сұраққа жатады
    1. Жасушаның энергетикалық станциясы:
    A) Рибосома
    *B) Митохондрия                     <- дұрыс жауап: басында * немесе + белгісі, НЕМЕСЕ қалың (bold) қаріп
    C) Гольджи кешені
    D) Лизосома
    Түсініктеме: Митохондрияда АТФ синтезделеді.

Дұрыс жауабы 2 не одан көп болса, сұрақ автоматты түрде "multi" болады.
"""
import argparse
import json
import re
import sys

try:
    import docx  # python-docx
except ImportError:
    sys.exit("python-docx орнатылмаған: pip install python-docx")

MODULE_ALIASES = {
    "cell": "cell", "жасушалық биология": "cell", "цитология": "cell",
    "molecular": "molecular", "молекулалық биология": "molecular",
    "biotech": "biotech", "биотехнология": "biotech",
    "biomed": "biomed", "биомедицина": "biomed",
    "genetics": "genetics", "генетика": "genetics",
    "botany": "botany", "ботаника": "botany",
    "zoology": "zoology", "зоология": "zoology",
    "anatomy": "anatomy", "анатомия": "anatomy", "адам анатомиясы": "anatomy",
    "evolution": "evolution", "эволюция": "evolution",
}

Q_RE = re.compile(r"^\s*(\d+)\s*[.)]\s*(.+)$")
OPT_RE = re.compile(r"^\s*([*+]?)\s*([A-HА-Е])\s*[).]\s*(.+)$")
CTX_RE = re.compile(r"^\s*(контекст|context)\s*:\s*(.+)$", re.I)
EXP_RE = re.compile(r"^\s*(түсініктеме|талдау|explain)\s*:\s*(.+)$", re.I)


def parse(path):
    document = docx.Document(path)
    questions, module, context, cur = [], "genetics", None, None

    def flush():
        nonlocal cur
        if cur and cur["options"]:
            if not cur["correct"]:
                print(f"Ескерту: {cur['id']} сұрағында дұрыс жауап белгіленбеген", file=sys.stderr)
            cur["type"] = "multi" if len(cur["correct"]) > 1 else ("context" if cur.get("context") else "single")
            questions.append(cur)
        cur = None

    for para in document.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        bold = any(r.bold for r in para.runs if r.text.strip())
        if text.startswith("#"):
            flush()
            name = text.lstrip("#").strip().lower()
            module = MODULE_ALIASES.get(name, name)
            continue
        m = CTX_RE.match(text)
        if m:
            flush()
            context = m.group(2).strip()
            continue
        m = EXP_RE.match(text)
        if m and cur:
            cur["explain"] = m.group(2).strip()
            continue
        m = OPT_RE.match(text)
        if m and cur:
            if m.group(1) or bold:
                cur["correct"].append(len(cur["options"]))
            cur["options"].append(m.group(3).strip())
            continue
        m = Q_RE.match(text)
        if m:
            flush()
            cur = {"id": f"{module[:3]}{len(questions) + 1}", "module": module, "q": m.group(2).strip(),
                   "options": [], "correct": [], "explain": ""}
            if context:
                cur["context"], context = context, None
            continue
        if cur and not cur["options"]:
            cur["q"] += " " + text  # көп жолды сұрақ
    flush()
    return questions


def main():
    ap = argparse.ArgumentParser(description=".docx → js/questions.js")
    ap.add_argument("docx")
    ap.add_argument("-o", "--out", default="js/questions.js")
    args = ap.parse_args()
    qs = parse(args.docx)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("/* .docx файлынан автоматты түрде жасалған (tools/docx_to_questions.py) */\n")
        f.write("window.QUESTIONS = " + json.dumps(qs, ensure_ascii=False, indent=2) + ";\n")
    print(f"{len(qs)} сұрақ → {args.out}")


if __name__ == "__main__":
    main()
