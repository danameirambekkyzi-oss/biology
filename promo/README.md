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

---

# 45 секундтық walkthrough + қазақша дауыс

- `BioUBT_walkthrough_45s_voice.mp4` — дайын видео (дауыс + бәсеңдетілген музыка).
- `BioUBT_45s_voice.wav` — тек дауыс, `BioUBT_45s_music.wav` — тек музыка.
- Дауыс: ISSAI KazakhTTS2 / Piper `kk_KZ-issai-high` (CC-BY-4.0), 3-спикер (F1 Raya). Басқа әйел дауыстарының үлгілері — `voice_samples/`.

```bash
# модель: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-kk_KZ-issai-high.tar.bz2
pip install sherpa-onnx soundfile
python3 vo45.py 3                                   # vo_3.wav (спикер нөмірі: 2, 3, 4, 5)
python3 music_walk45.py                             # music_walk45.wav
PAGE=walk45.html DUR=45 node walk_render.js video walk45_noaudio.mp4 30
```
