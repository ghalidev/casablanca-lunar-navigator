"""Offline mix for the cinematic cut (public/film_mix.wav). Needs numpy and ffmpeg.

Layers: voice, music bed, space ambience, low drone, risers, whooshes on every dissolve, a braaam on "dead",
a hit on the title, data ticks under the crash test, an end swell. The voice always leads: it sits at -16 LUFS,
the music 21 dB under it while it speaks, and every effect passes through a bus that ducks 6 dB under speech.
Gains come from measured loudness (ffmpeg ebur128). Output: limiter, then loudnorm to -14 LUFS / -1 dBTP.
"""
import json, os, subprocess
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(HERE, 'public')
SR = 48000
DUR = 30.0
n = int(SR * DUR)
t = np.arange(n) / SR


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def lufs_of(x):
    tmp = os.path.join(PUB, '_m.wav')
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', tmp], input=pcm.tobytes(), check=True)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    os.remove(tmp)
    return float([l for l in out.splitlines() if l.strip().startswith('I:')][-1].split()[1])


def db(x):
    return 10 ** (x / 20)


def fit(x, target):
    return x * db(target - lufs_of(x))


def env(length, fin=0.02, fout=0.3):
    e = np.ones(length)
    a, b = int(fin * SR), int(fout * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] *= np.linspace(1, 0, b) ** 1.5
    return e


def place(bus, x, at):
    i = int(at * SR)
    if i < 0:
        x, i = x[-i:], 0
    j = min(n, i + len(x))
    bus[i:j] += x[: j - i]


segs = json.load(open(os.path.join(PUB, 'voice-timings.json')))['segments']
speak = np.zeros(n)
for s in segs:
    speak[(t >= s['start'] - 0.12) & (t <= s['end'] + 0.18)] = 1
k = int(0.25 * SR)
speak = np.convolve(speak, np.ones(k) / k, mode='same')

mix = np.zeros((n, 2))

# 1. voice
v = load(os.path.join(PUB, 'voice.mp3'))[:n]
v = fit(v, -16)
mix[: len(v)] += v

# 2. music: -30 in the gaps, -37 under speech, 1 s fade in, 2.5 s fade out
m = load(os.path.join(PUB, 'music', 'galaxy.wav'))[:n]
ml = lufs_of(m)
gain = (-30 - ml) * (1 - speak[: len(m)]) + (-37 - ml) * speak[: len(m)]
fade = np.clip(t[: len(m)] / 1.0, 0, 1) * np.clip((DUR - t[: len(m)]) / 2.5, 0, 1)
mix[: len(m)] += m * (db(gain) * fade)[:, None]

# 3. effects bus (ducked under speech)
bus = np.zeros((n, 2))
amb = load(os.path.join(PUB, 'sfx2', 'ambience.wav'))
loop = np.zeros((n, 2))
step = len(amb) - int(1.5 * SR)
xf = np.ones(len(amb))
xf[: int(1.5 * SR)] = np.linspace(0, 1, int(1.5 * SR))
xf[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR))
for i0 in range(0, n, step):
    j0 = min(n, i0 + len(amb))
    loop[i0:j0] += (amb * xf[:, None])[: j0 - i0]
loop *= (np.clip(t / 2.0, 0, 1) * np.clip((28.5 - t) / 2.0, 0, 1))[:, None]
bus += fit(loop, -38)

drone = load(os.path.join(PUB, 'sfx2', 'drone.mp3'))[: int(16 * SR)]
drone *= env(len(drone), 1.5, 3.0)[:, None]
place(bus, fit(drone, -36), 0.0)

def cue(name, at, target, cut=None, fin=0.01, fout=0.4, end_at=None):
    x = load(os.path.join(PUB, 'sfx2', name))
    if cut:
        x = x[: int(cut * SR)]
    x = x * env(len(x), fin, fout)[:, None]
    x = fit(x, target)
    if end_at is not None:
        at = end_at - len(x) / SR
    place(bus, x, at)

cue('braaam.wav', 4.9, -29, cut=4.0, fout=1.5)
cue('riser1.wav', 0, -31, end_at=7.55, fout=0.05)
cue('whoosh1.wav', 6.95, -31)
cue('whoosh2.wav', 11.15, -33)
cue('whoosh1.wav', 13.75, -31)
cue('data.wav', 15.2, -37, cut=3.8, fout=1.0)
cue('riser2.wav', 0, -32, end_at=19.65, fout=0.05)
cue('hit.wav', 19.6, -26, cut=3.2, fout=2.0)
cue('whoosh2.wav', 22.0, -34)
cue('whoosh1.wav', 23.0, -32)
cue('end.wav', 26.9, -28, cut=3.0, fout=1.6)

duck = db(-6 * speak)
mix += bus * duck[:, None]

# limiter (fast attack, 80 ms release) then loudness normalisation
peak = np.max(np.abs(mix), axis=1)
ceil = db(-1.5)
g = np.minimum(1, ceil / np.maximum(peak, 1e-9))
rel = np.exp(-1 / (0.08 * SR))
e = np.empty_like(g)
cur = 1.0
for i in range(len(g)):
    cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
    e[i] = cur
mix *= e[:, None]
tmp = os.path.join(PUB, 'film_mix_raw.wav')
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', tmp], input=pcm.tobytes(), check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', str(SR), os.path.join(PUB, 'film_mix.wav')], check=True)
os.remove(tmp)
# voice-to-background check over the spoken parts
bg = mix - np.pad(v, ((0, n - len(v)), (0, 0)))
sp = speak > 0.9
r = 10 * np.log10(np.mean(v[: n][sp[: len(v)]] ** 2) / max(np.mean(bg[sp] ** 2), 1e-12))
print('film_mix.wav written; voice over everything else while speaking: %.1f dB' % r)
