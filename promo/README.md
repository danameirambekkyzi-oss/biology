# BioҰБТ промовидео (9:16, 1080×1920, 19.5 с)

Дайын видео: `BioUBT_promo.mp4` (H.264 + AAC, Instagram Reels / TikTok).

Барлық көріністер — сайттың нақты скриншоттары (демо-аккаунтпен, жергілікті режимде түсірілген).

## Қайта жасау
```bash
python3 -m http.server 8765          # репо түбірінен
cd promo
node capture.js $PWD/shots && node cap2.js $PWD/shots   # сайт скриншоттары
python3 music.py                                        # music.wav (синтезделген трек + SFX)
node render.js video video_noaudio.mp4 30 19.5          # comp.html → кадрлар → mp4
ffmpeg -i video_noaudio.mp4 -i music.wav -af loudnorm=I=-14:TP=-1.5 -c:v copy -c:a aac -b:a 192k BioUBT_promo.mp4
```
Мәтіндер мен уақыт сызығы — `comp.html` ішінде (`render(t)`).

---

# 40 секундтық walkthrough видео (9:16, 1080×1920)

- `BioUBT_walkthrough_40s.mp4` — дайын видео (фондық музыка −20 LUFS, дауыс жазуға арналған деңгей).
- `BioUBT_walkthrough_music.wav` — тек музыка + шерту дыбыстары (дауысты бөлек миксшілеу үшін).

Сайт тірі күйінде iframe ішінде басқарылады: мәзір, бөлімдер, айналдыру, экспресс-тесттегі жауап пен «Тексеру» —
барлығы нақты басулар. Сайттың CSS-анимациялары видео уақытына синхрондалады.

```bash
python3 -m http.server 8765                  # репо түбірінен
cd promo
node walk_render.js video walk_noaudio.mp4 30   # walk.html → mp4
python3 music_walk.py                          # music_walk.wav
ffmpeg -i walk_noaudio.mp4 -i music_walk.wav -af loudnorm=I=-20:TP=-2 -c:v copy -c:a aac -b:a 192k BioUBT_walkthrough_40s.mp4
```
Уақыт сызығы, жазулар және курсор қадамдары — `walk.html` ішіндегі `CAPS`, `K`, `SCROLL`.
