"""Offline mix for the explainer (public/mix.wav). Run with any Python that has numpy.

Levels follow the team's earlier productions (REDOX: music ~20 dB under the voice while it speaks):
voice -16 LUFS, music -36 LUFS under speech and -27 LUFS in the gaps (0.3 s ramps), each effect at its own target.
Gains come from measured loudness (ffmpeg ebur128), not guesses. Output is limited to -1 dBTP and normalised to -14 LUFS.
"""
import json, os, subprocess
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(HERE, 'public')
SR = 48000
DUR = 30.0


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def lufs(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    line = [l for l in out.splitlines() if l.strip().startswith('I:')][-1]
    return float(line.split()[1])


def db(x):
    return 10 ** (x / 20)


n = int(SR * DUR)
mix = np.zeros((n, 2), dtype=np.float64)

# voice
vpath = os.path.join(PUB, 'voice.mp3')
v = load(vpath) * db(-16 - lufs(vpath))
mix[: len(v)] += v[:n]

# music bed with ducking driven by the spoken segments
segs = json.load(open(os.path.join(PUB, 'voice-timings.json')))['segments']
mpath = os.path.join(PUB, 'music', 'galaxy.wav')
m = load(mpath)[:n]
ml = lufs(mpath)
t = np.arange(len(m)) / SR
speak = np.zeros(len(m))
for s in segs:
    speak[(t >= s['start'] - 0.1) & (t <= s['end'] + 0.15)] = 1
k = int(0.3 * SR)
speak = np.convolve(speak, np.ones(k) / k, mode='same')
gain_db = (-27 - ml) * (1 - speak) + (-36 - ml) * speak
fade = np.clip(t / 1.0, 0, 1) * np.clip((DUR - t) / 2.5, 0, 1)
mix[: len(m)] += m * (db(gain_db) * fade)[:, None]

# effects: (time s, file, target LUFS)
CUES = [
    (0.25, 'pop', -30), (2.15, 'swoosh', -31), (3.9, 'pop2', -30), (4.3, 'bonk', -27),
    (5.05, 'pop', -32), (5.2, 'tick', -30), (7.0, 'slidedown', -29),
    (7.5, 'swoosh2', -33), (9.85, 'swoosh', -33), (12.9, 'slidedown', -31),
    (14.3, 'swoosh2', -32), (16.6, 'tick', -33), (18.8, 'ding', -30),
    (19.75, 'sparkle', -28), (21.87, 'click', -26), (23.5, 'swoosh', -33), (26.5, 'sparkle', -29),
]
CUT = {'tick': 1.8}
for at, name, target in CUES:
    p = os.path.join(PUB, 'sfx', f'{name}.wav')
    x = load(p)
    if name in CUT:
        x = x[: int(CUT[name] * SR)]
        x *= np.linspace(1, 0, len(x))[:, None] ** 0.5
    x = x * db(target - lufs(p))
    i = int(at * SR)
    j = min(n, i + len(x))
    mix[i:j] += x[: j - i]

# gentle peak limiter (fast attack, 80 ms release) then write
peak = np.max(np.abs(mix), axis=1)
ceil = db(-1.5)
g = np.minimum(1, ceil / np.maximum(peak, 1e-9))
rel = np.exp(-1 / (0.08 * SR))
env = np.empty_like(g)
cur = 1.0
for i2 in range(len(g)):
    cur = g[i2] if g[i2] < cur else g[i2] + (cur - g[i2]) * rel
    env[i2] = cur
mix *= env[:, None]
tmp = os.path.join(PUB, 'mix_raw.wav')
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', tmp], input=pcm.tobytes(), check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', str(SR), os.path.join(PUB, 'mix.wav')], check=True)
os.remove(tmp)
print('mix.wav', lufs(os.path.join(PUB, 'mix.wav')), 'LUFS')
