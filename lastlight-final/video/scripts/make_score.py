#!/usr/bin/env python3
"""LASTLIGHT video sound design (30 s, 48 kHz stereo WAV). Original, synthesized here: no licensing question.

Events follow the edit (video/src/LastLight.tsx) and the voice timings (assets/audio/voice-timings.json):
  2.2  flight from the Moon to Athena's site   -> whoosh
  6.4  "dead": one radio blip, then a sub drop and near silence
  7.5  title: low boom, the warm pad enters
  14.28 "we crash it first": whoosh, ghost landers tick down
  19.62 flight to the pole: whoosh, bells rise with "Where. When."
  23.46 flight to the verdict, final chord resolves

Usage: pipeline/.venv/bin/python video/scripts/make_score.py video/public/score.wav
"""
import sys
import wave

import numpy as np
from numba import njit

SR = 48000
DUR = 30.0
t = np.arange(int(SR * DUR)) / SR
rng = np.random.default_rng(11)


@njit(cache=True)
def svf_bandpass(x, cutoff, q):
    """State-variable filter with a per-sample cutoff (Hz); returns the band-pass output."""
    low = 0.0
    band = 0.0
    out = np.empty_like(x)
    for i in range(x.shape[0]):
        f = 2.0 * np.sin(np.pi * min(cutoff[i], 18000.0) / 48000.0)
        low += f * band
        high = x[i] - low - band / q
        band += f * high
        out[i] = band
    return out


def smooth(a, b, x):
    k = np.clip((x - a) / (b - a), 0, 1)
    return k * k * (3 - 2 * k)


def env(x, a, b, fade):
    return np.clip((x - a) / fade, 0, 1) * np.clip((b - x) / fade, 0, 1)


def whoosh(at, length=1.6, level=0.5):
    """Air passing: noise through a band that sweeps up then down, with a soft swell."""
    k = (t - at) / length
    m = (k >= 0) & (k <= 1)
    cutoff = 250.0 * (1 + 15.0 * np.sin(np.pi * np.clip(k, 0, 1)) ** 1.5)
    shaped = svf_bandpass(rng.standard_normal(t.size), cutoff, 1.2)
    return shaped * np.sin(np.pi * np.clip(k, 0, 1)) ** 2 * m * level


def tone(freq, at, length, level, decay, shape=None):
    k = t - at
    m = (k >= 0) & (k < length)
    f = freq if shape is None else shape(k)
    return np.sin(2 * np.pi * f * np.where(m, k, 0)) * np.exp(-np.clip(k, 0, None) * decay) * m * level


# 1. Drone: cold, present all along, swells slowly
drone = sum(np.sin(2 * np.pi * f * t + p) * g for f, p, g in [(55.0, 0, 0.5), (55.4, 1.3, 0.35), (82.4, 0.4, 0.25)])
drone *= 0.16 * (0.75 + 0.25 * np.sin(2 * np.pi * t / 9.0))
drone *= 1 - 0.85 * smooth(6.3, 6.7, t) * (1 - smooth(7.4, 7.6, t))  # drops out around "dead"

# 2. Pad: warm, enters with the title, swells toward the end
pad_freqs = [220.0, 277.18, 329.63, 440.0]
pad = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.11 * t + i)) for i, f in enumerate(pad_freqs))
pad *= 0.05 * env(t, 7.5, 30.5, 2.0) * (0.55 + 0.45 * smooth(19.0, 26.0, t))
pad *= 1 - 0.6 * env(t, 11.8, 14.0, 0.5)  # dips when the ridge hides the Sun

# 3. Whooshes on every flight
air = whoosh(2.2, 2.4, 0.5) + whoosh(14.2, 1.8, 0.45) + whoosh(19.55, 1.8, 0.45) + whoosh(23.4, 1.8, 0.5)

# 4. "Dead": a single radio blip, then a sub drop
blip = tone(1250.0, 6.35, 0.12, 0.09, 30.0) + tone(1250.0, 6.62, 0.08, 0.05, 40.0)
drop = tone(0, 6.7, 1.6, 0.55, 3.2, shape=lambda k: 62 - 30 * np.clip(k, 0, 1.2))

# 5. Title: low boom + airy shimmer at LASTLIGHT
boom = tone(0, 7.5, 2.4, 0.5, 2.2, shape=lambda k: 46 + 40 * np.exp(-k * 9))
shimmer = svf_bandpass(rng.standard_normal(t.size), np.full(t.size, 5200.0), 6.0) * np.exp(-np.clip(t - 7.5, 0, None) * 2.0) * (t >= 7.5) * 0.12

# 6. Ghost landers: dozens of tiny ticks while the crash test runs; a few low tones when batteries die
ticks = np.zeros_like(t)
for i in range(120):
    at = 14.9 + rng.beta(1.5, 2.5) * 4.6
    f = rng.choice([1320.0, 1760.0, 2093.0, 2637.0]) * (1 + 0.01 * rng.standard_normal())
    ticks += tone(f, at, 0.12, 0.02 * (0.5 + rng.random()), 40.0)
ticks *= env(t, 14.8, 19.6, 0.3)
lows = sum(tone(110.0 * (1 + 0.05 * j), 16.5 + 0.55 * j, 0.5, 0.05, 6.0) for j in range(5))

# 7. Bells for "Where. When. Will it survive?" and the final resolve
bells = sum(tone(f, at, 1.8, 0.05, 2.4) for f, at in [(659.3, 19.9), (783.99, 20.9), (987.77, 21.9)])
final = sum(tone(f, 23.46, 6.5, 0.045, 0.7) for f in (440.0, 659.3, 880.0, 1318.5))

mix = drone + pad + air + blip + drop + boom + shimmer + ticks + lows + bells + final
mix *= env(t, 0, DUR, 1.0) * 0.9
mix *= 1.0 - 0.0 * t
mix /= max(1.0, np.abs(mix).max() / 0.85)
width = np.roll(mix, int(0.011 * SR))
stereo = np.stack([mix * 0.96 + width * 0.04, width * 0.96 + mix * 0.04], 1)
pcm = (stereo * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("score written", sys.argv[1], f"peak {np.abs(mix).max():.2f}")
