import json, sys, numpy as np, soundfile as sf
from tts_kk import tts
SID = int(sys.argv[1]) if len(sys.argv) > 1 else 3
LINES = [
 (0.6, 5.4, "Сәлем! Бұл — Био ұбэтэ, биологиядан ұбэтэға дайындық платформасы."),
 (6.5, 10.2, "Мәзірден ұбэтэ сынамасын ашып, уақытты таңдаймыз."),
 (10.3, 13.1, "Тест бірді бастап, сұрақтарға жауап береміз."),
 (13.3, 16.5, "Тестті аяқтаған соң, толық талдау шығады."),
 (16.7, 20.1, "Қатемен жұмыс бөлімінде қате сұрақтарды қайта тапсырасың."),
 (20.5, 23.2, "Жиі кездесетін сұрақтарды жауабымен жатта."),
 (23.4, 26.4, "Сосын өз жауабыңды жазып, тексер."),
 (26.7, 29.5, "Негізгі ақпараттар кестеде берілген."),
 (29.7, 31.7, "Жаттау режимінде қайтала."),
 (31.9, 35.1, "Өзіңді тексер тестінде біліміңді бекіт."),
 (35.4, 39.8, "Күнделікті экспресс-тестте дұрыс жауап бірден көрсетіледі."),
 (40.4, 44.9, "Био ұбэтэ. Биологияны бірге меңгерейік! Дайындықты бүгін баста!"),
]
SR = 22050
out = np.zeros(int(45 * SR)); info = []
for a, b, text in LINES:
    slot = b - a
    g = tts.generate(text, sid=SID, speed=1.0); x = np.array(g.samples); d = len(x) / SR
    sp = 1.0
    if d > slot:
        sp = min(1.3, d / slot * 1.02); g = tts.generate(text, sid=SID, speed=sp); x = np.array(g.samples); d = len(x) / SR
    # trim leading/trailing silence
    nz = np.where(np.abs(x) > 0.01)[0]; x = x[max(0, nz[0] - 200): nz[-1] + 2000]
    i = int(a * SR); out[i:i + len(x)] += x[:len(out) - i]
    info.append((a, b, round(len(x) / SR, 2), round(sp, 2), text))
sf.write(f"vo_{SID}.wav", out / np.max(np.abs(out)) * 0.9, SR)
for r in info: print(r[:4], "OVER" if r[0] + r[2] > r[1] + .05 else "", r[4][:40])
