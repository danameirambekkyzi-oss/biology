import numpy as np, wave

SR = 44100
DUR = 19.5
N = int(SR * DUR)
rng = np.random.default_rng(3)
BEAT = 0.5  # 120 BPM
t_all = np.arange(N) / SR


def onepole_lp(x, fc):
    """Time-varying one-pole low-pass; fc may be scalar or array (Hz)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y


def hp(x, fc):
    return x - onepole_lp(x, fc)


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


def saw(f, n, phase=0.0):
    tt = np.arange(n) / SR
    return 2 * ((f * tt + phase) % 1) - 1


def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=None):
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / max(a, 1e-4))
    dec = s + (1 - s) * np.exp(-(tt - a) / max(d, 1e-4))
    e = np.where(tt < a, e, dec)
    if hold is not None:
        e *= np.clip((hold + r - tt) / r, 0, 1)
    return e


# chords: Am F C G (bars of 2 s starting at t = 1.0)
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]]
ROOTS = [45, 41, 36, 43]


def chord_at(t):
    if t < 1.0: return 0
    return int((t - 1.0) // 2) % 4


drums = np.zeros(N); bass = np.zeros(N); pad = np.zeros(N); lead = np.zeros(N); fx = np.zeros(N)

# ---------- kick ----------
def kick(big=False):
    n = int(SR * (0.6 if big else 0.35)); tt = np.arange(n) / SR
    f = 48 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-tt * (5 if big else 9))
    k += 0.25 * np.exp(-tt * 300) * rng.standard_normal(n)
    return np.tanh(k * 1.6)

kick_times = [3.0 + i * BEAT for i in range(int((15.5 - 3.0) / BEAT))] + [16.0 + i * BEAT for i in range(5)]
for kt in kick_times: place(drums, kick(), kt, 0.9)
place(drums, kick(True), 0.0, 0.7)
place(drums, kick(True), 16.0, 1.1)
place(drums, kick(True), 18.5, 0.9)

# ---------- clap ----------
def clap():
    n = int(SR * 0.25); tt = np.arange(n) / SR
    nz = rng.standard_normal(n)
    e = np.exp(-tt * 22) + 0.6 * np.exp(-((tt - 0.012) % 0.011) * 400) * (tt < 0.035)
    return hp(nz * e, 900)
c = clap()
for i in range(int((15.5 - 3.5) / 1.0)):
    place(drums, c, 3.5 + i * 1.0, 0.35)
for i in range(3): place(drums, c, 16.5 + i, 0.3)

# ---------- hats ----------
def hat(open_=False):
    n = int(SR * (0.18 if open_ else 0.05)); tt = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-tt * (18 if open_ else 80))
hc, ho = hat(), hat(True)
for i in range(int((15.5 - 3.0) / 0.125)):
    tt = 3.0 + i * 0.125
    if abs((tt - 3.0) % 0.5 - 0.25) < 1e-6: place(drums, ho, tt, 0.22)
    elif tt >= 8.0: place(drums, hc, tt, 0.10)
for i in range(int((19.0 - 16.0) / 0.5)): place(drums, ho, 16.25 + i * 0.5, 0.16)

# snare roll into 8.0 and build 15.0–16.0
for i in range(16):
    place(drums, c, 15.0 + i * (1.0 / 16), 0.08 + 0.25 * i / 16)

# ---------- sidechain envelope ----------
sc = np.ones(N)
for kt in kick_times + [16.0, 18.5]:
    i = int(kt * SR); n = int(0.3 * SR)
    seg = 1 - 0.75 * np.exp(-np.arange(n) / SR * 12)
    sc[i:i + n] = np.minimum(sc[i:i + n], seg[:max(0, min(n, N - i))])

# ---------- bass (offbeat 8ths) ----------
for i in range(int((15.5 - 3.0) / 0.25)):
    tt = 3.0 + i * 0.25
    if abs((tt - 3.0) % 0.5 - 0.25) > 1e-6 and tt < 8.0: continue
    f = note(ROOTS[chord_at(tt)])
    n = int(0.22 * SR)
    s = saw(f, n) + 0.5 * np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)
    place(bass, s * env(n, 0.003, 0.12, 0.3, 0.03, hold=0.19), tt, 0.35)
# final sustained bass
n = int(3.4 * SR)
place(bass, (saw(note(41), n) + np.sin(2 * np.pi * note(29) * np.arange(n) / SR)) * env(n, 0.01, 1.2, 0.4, 0.8, hold=2.6), 16.0, 0.35)

# ---------- pad (supersaw chords) ----------
def supersaw(freqs, n):
    out = np.zeros(n)
    for f in freqs:
        for d in (-0.12, -0.05, 0, 0.06, 0.13):
            out += saw(f * 2 ** (d / 12), n, rng.random())
    return out / (len(freqs) * 5)
for b in range(-1, 9):
    start = 1.0 + 2 * b
    if start >= 16.0: break
    st = max(0.0, start); n = int((min(start + 2.0, 16.0) - st) * SR)
    ch = CHORDS[chord_at(st + 0.01)]
    place(pad, supersaw([note(m) for m in ch] + [note(ch[0] + 12)], n) * env(n, 0.05, 3, 1, 0.05, hold=n / SR - 0.05), st, 1.0)
# final chord F → C (bright)
n = int(3.5 * SR)
place(pad, supersaw([note(m) for m in [53, 60, 64, 69, 72]], n) * env(n, 0.01, 4, 0.6, 1.2, hold=2.3), 16.0, 1.3)
cut = np.where(t_all < 3.0, 300 + 2500 * (t_all / 3.0) ** 2, np.where(t_all < 15.0, 3200, np.where(t_all < 16.0, 3200 - 2600 * (t_all - 15.0), 5000)))
pad = onepole_lp(onepole_lp(pad, cut), cut) * 0.55
swell = np.clip(t_all / 2.5, 0, 1)
pad *= np.where(t_all < 3.0, swell, 1.0)

# ---------- pluck arp ----------
def pluck(f, n):
    s = saw(f, n) * 0.6 + np.sign(np.sin(2 * np.pi * f * np.arange(n) / SR)) * 0.25
    return s * env(n, 0.002, 0.09, 0.0)
arp_step = 0.125
for i in range(int((16.0 - 1.0) / arp_step)):
    tt = 1.0 + i * arp_step
    if tt < 3.0 and i % 2: continue
    if 3.0 <= tt < 8.0 and i % 2: continue
    if 15.5 <= tt: continue
    ch = CHORDS[chord_at(tt)]
    seq = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24, ch[2] + 12, ch[0] + 24, ch[1] + 12, ch[2] + 24]
    place(lead, pluck(note(seq[i % 8]), int(0.2 * SR)), tt, 0.16 if tt < 3 else 0.2)
# final sparkle bells
for j, m in enumerate([72, 76, 79, 84, 88]):
    n = int(1.2 * SR)
    place(lead, np.sin(2 * np.pi * note(m) * np.arange(n) / SR) * env(n, 0.002, 0.5), 16.0 + j * 0.06, 0.12)
lead = onepole_lp(lead, 5500)

# ---------- FX ----------
def whoosh(dur=0.45, f0=400, f1=6000, rev=False):
    n = int(dur * SR); tt = np.arange(n) / SR
    fc = f0 * (f1 / f0) ** (tt / dur)
    if rev: fc = fc[::-1]
    nz = rng.standard_normal(n)
    y = onepole_lp(hp(nz, fc * 0.4), fc)
    e = np.sin(np.pi * tt / dur) ** 2
    return y * e
def riser(dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    fc = 200 * (9000 / 200) ** (tt / dur)
    y = onepole_lp(hp(rng.standard_normal(n), fc * 0.3), fc) * (tt / dur) ** 2
    y += 0.3 * np.sin(2 * np.pi * np.cumsum(200 + 1600 * (tt / dur) ** 2) / SR) * (tt / dur) ** 2
    return y
def click(f=2400, d=0.03):
    n = int(d * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 180) + 0.3 * rng.standard_normal(n) * np.exp(-tt * 600)
def impact():
    n = int(2.0 * SR); tt = np.arange(n) / SR
    y = onepole_lp(rng.standard_normal(n), 2500) * np.exp(-tt * 3)
    y += np.sin(2 * np.pi * 45 * tt) * np.exp(-tt * 2.5)
    return y

place(fx, whoosh(0.6, 300, 4000), 0.0, 0.35)
place(fx, riser(1.5), 1.5, 0.35)
place(fx, whoosh(0.45), 2.75, 0.55)
place(fx, whoosh(0.45, 600, 8000), 5.2, 0.5)
place(fx, whoosh(0.4), 7.7, 0.5)
for k in range(1, 6): place(fx, whoosh(0.3, 800, 9000), 8.0 + k - 0.12, 0.33)
place(fx, whoosh(0.5, 300, 5000), 13.85, 0.5)
place(fx, riser(1.0), 15.0, 0.45)
place(fx, impact(), 16.0, 0.6)
place(fx, whoosh(0.5, 500, 7000, rev=True), 17.45, 0.25)
# UI clicks
place(fx, click(), 4.62, 0.5)
for k in range(8): place(fx, click(3200, 0.02), 6.35 + k * 1.3 / 7, 0.22)
place(fx, click(), 8.48, 0.5)
place(fx, click(1800, 0.04), 17.55, 0.45)
place(fx, click(4200, 0.03), 18.2, 0.25)
for k, at in enumerate([0.3 + i * .07 for i in range(6)]): place(fx, click(5000 + 300 * k, 0.015), at, 0.08)

music = drums * 0.9 + bass * sc + pad * sc + lead * sc * 0.9
mix = music + fx
mix = hp(mix, 25)
# fades
mix *= np.clip(t_all / 0.03, 0, 1) * np.clip((DUR - t_all) / 0.9, 0, 1)
# stereo widening: pad/lead slight delay on one side
L = mix + 0.15 * np.roll(pad * sc + lead * 0.5, int(0.011 * SR))
R = mix + 0.15 * np.roll(pad * sc + lead * 0.5, int(0.017 * SR))
st = np.stack([L, R], 1)
st = np.tanh(st / np.max(np.abs(st)) * 1.4) / np.tanh(1.4) * 0.89
with wave.open("music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print("ok")
