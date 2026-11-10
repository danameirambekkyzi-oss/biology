# Жабық тесттер

Мұндағы файлдар — мұғалім кейін ашатын бақылау тесттері. Мазмұны шифрланған (AES-256), сайтта жоқ: сұрақтары
«Тараулық тест», «Файлдан тест жасау», «Сұрақ іздеу» бөлімдерінде де, сайт кодында да шықпайды. Құпия сөз тек мұғалімде.

## anatomy-exam.enc — «Тараулық тест → Анатомия» бөлімінің 7-тесті (бақылау тесті)

Ашу (мұғалім құпия сөзді бергенде):

```sh
mkdir -p /tmp/exam && openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in tools/secret/anatomy-exam.enc -pass pass:'ҚҰПИЯ_СӨЗ' | tar -xz -C /tmp/exam
mkdir -p img/chapters/ana-7 && cp /tmp/exam/img/* img/chapters/ana-7/
python3 -I tools/chapters/build_ubt_chapter.py . anatomy <ana t1..t6 json> /tmp/exam/test.json   # 1–6 тесттердің JSON-ы parse_ubt.py арқылы
./tools/bump.sh
```

`test.json`-да `"exam": true` — сайт оны премиумсыз, алдыңғы тестсіз ашады және әр оқушыда сұрақ ретін араластырады.

## anatomy-zachet.enc — «Анатомия — жалпы сынақ (зачет) сұрақтары» (бақылау тесті, 112 сұрақ)

Ашу жолы жоғарыдағыдай (`anatomy-exam.enc` орнына осы файл), суреттер `img/chapters/ana-zachet/` папкасына көшіріледі.
110–111 — бірнеше әріпті сәйкестендіру (`items[].answers`), 112 — суретке белгілеу (`type: "label"`, `zones`).
