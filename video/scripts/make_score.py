#!/usr/bin/env python3
"""Generate the LASTLIGHT video score (30 s, 48 kHz stereo WAV). Original, synthesized here,
so there is no licensing question. Cut times match assets/audio/voice-timings.json.

Usage: python3 video/scripts/make_score.py video/public/score.wav
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 30.0
CUTS = [7.5, 11.64, 14.28, 19.62, 23.46]  # shot changes (voice segment starts)
DEATH = 6.6  # "it's dead"

t = np.arange(int(SR * DUR)) / SR
rng = np.random.default_rng(7)


def env(t, a, b, fade=1.5):
    return np.clip((t - a) / fade, 0, 1) * np.clip((b - t) / fade, 0, 1)


def lowpass(x, cutoff):
    # one-pole, enough for soft noise beds
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


# 1. Cold drone (A1 + E2), slow beating, present all along
drone = sum(np.sin(2 * np.pi * f * t + p) * g for f, p, g in [(55.0, 0, 0.5), (55.4, 1.3, 0.35), (82.4, 0.4, 0.25)])
drone *= 0.18 * (0.75 + 0.25 * np.sin(2 * np.pi * t / 9.0))

# 2. Warm pad enters with the Sun (shot 2) and swells toward the end
pad_freqs = [220.0, 277.18, 329.63, 440.0]
pad = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.11 * t + i)) for i, f in enumerate(pad_freqs))
pad *= 0.045 * env(t, 7.2, 31, 3.0) * (0.6 + 0.4 * np.clip((t - 19) / 8, 0, 1))
# brief dip when the ridge hides the Sun (shot 3)
pad *= 1 - 0.7 * env(t, 11.64, 14.0, 0.6)

# 3. Air sweeps on each cut (band-limited noise swell)
noise = rng.standard_normal(t.size)
sweeps = np.zeros_like(t)
for c in CUTS:
    w = np.exp(-((t - c) ** 2) / (2 * 0.35 ** 2))
    sweeps += w
air = lowpass(noise, 1800) * sweeps * 0.12

# 4. Sub thud at "it's dead", then near-silence until shot 2
thud = np.sin(2 * np.pi * (48 - 18 * np.clip(t - DEATH, 0, 1)) * t) * np.exp(-np.clip(t - DEATH, 0, None) * 4) * (t >= DEATH) * 0.5

# 5. Final resolve: soft high chime at 23.46 (outro)
chime = sum(np.sin(2 * np.pi * f * t) for f in (880.0, 1318.5)) * np.exp(-np.clip(t - 23.46, 0, None) * 0.9) * (t >= 23.46) * 0.05

mix = drone + pad + air + thud + chime
mix *= env(t, 0, DUR, 1.2) * 0.9
mix /= max(1.0, np.abs(mix).max() / 0.85)
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], 1)  # tiny Haas width
pcm = (stereo * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("score written", sys.argv[1])
