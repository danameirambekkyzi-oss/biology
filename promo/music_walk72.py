"""Soft background bed for the 73 s walkthrough with the author's voice (walk72.html): 90 BPM, C–G–Am–F, plus mouse clicks."""
import numpy as np, wave

SR = 44100
DUR = 73.0
N = int(SR * DUR)
rng = np.random.default_rng(5)
t_all = np.arange(N) / SR
BEAT = 60 / 90
BAR = 4 * BEAT
CLICKS = [6.3, 7.9, 9.9, 10.8, 11.7, 12.3, 13.1, 13.9, 14.6, 20.6, 21.5, 30.9, 32.3, 33.1, 34.6, 35.4, 45.0, 47.6, 50.2, 51.0,
          54.0, 56.5, 58.0, 59.0, 60.4, 61.1, 62.3, 62.9, 64.0, 65.0, 65.6]  # walk72.html click keyframes
KEYS = (45.9, 47.2, 8)  # typing: start, end, characters
CHIMES = [4.85, 20.4, 34.3, 50.0, 62.3, 66.8]  # section flashes


def onepole_lp(x, fc):
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


note = lambda m: 440 * 2 ** ((m - 69) / 12)
CHORDS = [[48, 55, 60, 64], [43, 55, 59, 62], [45, 57, 60, 64], [41, 57, 60, 65]]  # C G Am F
chord_at = lambda t: CHORDS[int(t // BAR) % 4]

pad = np.zeros(N); keys = np.zeros(N); bass = np.zeros(N); perc = np.zeros(N); fx = np.zeros(N)

# warm pad: detuned triangles, slow attack/release, crossfaded per bar
def tri(f, n, ph=0.0):
    x = (np.arange(n) / SR * f + ph) % 1
    return 4 * np.abs(x - .5) - 1
nb = int(np.ceil(DUR / BAR))
for b in range(nb):
    st = b * BAR; n = int((BAR + 1.0) * SR); tt = np.arange(n) / SR
    e = np.clip(tt / 0.8, 0, 1) * np.clip((BAR + 1.0 - tt) / 1.0, 0, 1)
    sig = sum(tri(note(m + 12) * 2 ** (d / 1200), n, rng.random()) for m in chord_at(st + .01)[1:] for d in (-7, 0, 7)) / 9
    place(pad, sig * e, st, 1.0)
pad = onepole_lp(pad, 1800)

# soft electric-piano arpeggio (8ths)
def ep(f, n):
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + .25 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 6)) * np.exp(-tt * 2.6) * np.clip(tt / .004, 0, 1)
pattern = [0, 2, 3, 1, 2, 3, 1, 2]
for i in range(int(DUR / (BEAT / 2))):
    tt = i * BEAT / 2
    if tt < 1.3 or tt > 71.0: continue
    ch = chord_at(tt)
    m = ch[1 + pattern[i % 8] % 3] + 12
    place(keys, ep(note(m), int(1.2 * SR)), tt, 0.16 if i % 2 == 0 else 0.11)

# sub bass (roots, sustained) from bar 2
for b in range(1, nb):
    st = b * BAR; n = int(BAR * SR); tt = np.arange(n) / SR
    f = note(chord_at(st + .01)[0] - 12)
    place(bass, np.sin(2 * np.pi * f * tt) * np.clip(tt / .05, 0, 1) * np.clip((BAR - tt) / .1, 0, 1), st, 0.32)

# gentle percussion: soft kick + shaker (bars 3–14)
def kick():
    n = int(.25 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(50 + 60 * np.exp(-tt * 30)) / SR) * np.exp(-tt * 12)
def shaker():
    n = int(.07 * SR); tt = np.arange(n) / SR
    x = rng.standard_normal(n); x = x - onepole_lp(x, 5000)
    return x * np.sin(np.pi * np.clip(tt / .07, 0, 1)) ** 2
k, sh = kick(), shaker()
for i in range(int(DUR / BEAT)):
    tt = i * BEAT
    if 2 * BAR <= tt < 25 * BAR:
        if i % 2 == 0: place(perc, k, tt, 0.35)
        place(perc, sh, tt + BEAT / 2, 0.10)
        place(perc, sh, tt, 0.05)

# UI: soft mouse clicks; very gentle airy swells at the device changes
def click():
    n = int(.03 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2600 * tt) * np.exp(-tt * 260) + .4 * rng.standard_normal(n) * np.exp(-tt * 900))
for c in CLICKS: place(fx, click(), c, 0.22)
def swell(d):
    n = int(d * SR); tt = np.arange(n) / SR
    x = onepole_lp(rng.standard_normal(n), 900 + 1800 * np.sin(np.pi * tt / d))
    return x * np.sin(np.pi * tt / d) ** 2
for i in range(KEYS[2]):
    place(fx, click() * 0.6, KEYS[0] + (KEYS[1] - KEYS[0]) * i / KEYS[2], 0.12)
def chime():
    n = int(1.6 * SR); tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * note(m) * tt) * np.exp(-tt * (2.5 + j)) for j, m in enumerate([84, 88, 91, 96])) / 4
for c in CHIMES:
    place(fx, swell(1.0), c - .55, 0.03); place(fx, chime(), c - .05, 0.07)

music = pad * 0.55 + keys + bass + perc
music *= np.clip(t_all / 1.5, 0, 1) * np.clip((DUR - t_all) / 2.0, 0, 1)
fxm = fx * np.clip((DUR - t_all) / 1.0, 0, 1)
L = music + fxm + 0.10 * np.roll(keys, int(.013 * SR))
R = music + fxm + 0.10 * np.roll(keys, int(.021 * SR))
st = np.stack([L, R], 1)
st = st / np.max(np.abs(st)) * 0.7
with wave.open("music_walk72.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print("ok")
