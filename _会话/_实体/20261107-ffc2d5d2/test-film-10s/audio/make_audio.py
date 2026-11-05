#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SWISS MOTION 10 s test film — original score + print foley, synthesised with numpy.

120 BPM, 8th = 0.25 s, 10.000 s at 48 kHz stereo.
No samples, no third-party material: every sound is generated here.

Structure (matches app.js)
  0.00 paper wipe / 0.125 dot / 0.50 columns grow / 1.00 masthead / 1.50 giant "3"
  2.00 2.50 3.00 rules snap; beat counter fills one 8th per hit (2.0-4.0)
  3.50 camera push / 4.00 exception leaves the grid / 5.00 HARD SILENCE (music out)
  5.25 knife cut / 5.50 "66" climbs / 6.25 wall of 66 / 6.80 end line
  9.40 final cut / 9.78 end line leaves / 10.0 empty grid

The exception is the only element that sings: a sine glide follows its position,
and it is the only sound inside the silence (STYLE.md §7).

Usage: python3 make_audio.py [--out mix.wav]
"""
import argparse
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 10.0
N = int(SR * DUR)
rng = np.random.default_rng(20261107)


# ---------------------------------------------------------------- helpers
def buf():
    return np.zeros((2, N), dtype=np.float64)


def add(dst, sig, at, gain=1.0, pan=0.0):
    """Mix a mono signal into a stereo buffer at `at` seconds, equal-power pan."""
    i = int(round(at * SR))
    if i >= N or i < 0:
        return
    n = min(len(sig), N - i)
    if n <= 0:
        return
    s = sig[:n] * gain
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    dst[0, i:i + n] += s * l
    dst[1, i:i + n] += s * r


def env_adsr(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return (1 - np.exp(-t / max(a, 1e-5))) * np.exp(-t / max(d, 1e-5))


def sos(kind, f, order=2):
    if isinstance(f, (list, tuple)):
        return butter(order, f, kind, fs=SR, output='sos')
    return butter(order, f, kind, fs=SR, output='sos')


def noise(n):
    return rng.standard_normal(n)


# ---------------------------------------------------------------- instruments
def kick(dur=0.30):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 118 * np.exp(-t * 20) + 46
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
    click = noise(n) * np.exp(-t * 500) * 0.22
    return (body + click) * 0.95


def hat(dur=0.055, open_=False):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = sosfilt(sos('highpass', 7200), noise(n))
    return x * np.exp(-t * (55 if open_ else 120)) * 0.30


def bass(freq, dur=0.24):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * t)
         + 0.32 * np.sin(4 * np.pi * freq * t)
         + 0.12 * np.sin(6 * np.pi * freq * t))
    return x * env_adsr(n, 0.004, 0.11) * 0.42


def marimba(freq, dur=0.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * t) * np.exp(-t * 8)
         + 0.30 * np.sin(2 * np.pi * 2.0 * freq * t) * np.exp(-t * 13)
         + 0.10 * np.sin(2 * np.pi * 4.07 * freq * t) * np.exp(-t * 24))
    return x * 0.30


def glock(freq, dur=0.7):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * freq * t) * np.exp(-t * 5)
         + 0.25 * np.sin(2 * np.pi * 2.76 * freq * t) * np.exp(-t * 9))
    return x * 0.16


# ---------------------------------------------------------------- print foley
def paper_slap(gain=0.5):
    n = int(SR * 0.10)
    t = np.arange(n) / SR
    x = sosfilt(sos('bandpass', [700, 5200]), noise(n)) * np.exp(-t * 55)
    thud = np.sin(2 * np.pi * 110 * t) * np.exp(-t * 40) * 0.5
    return (x * 0.9 + thud) * gain


def ruling_pen(gain=0.32):
    n = int(SR * 0.26)
    t = np.arange(n) / SR
    x = sosfilt(sos('bandpass', [1800, 7000]), noise(n))
    a = np.clip(t / 0.03, 0, 1) * np.exp(-t * 12)
    return x * a * gain


def letterpress(gain=0.55):
    n = int(SR * 0.12)
    t = np.arange(n) / SR
    clack = sosfilt(sos('bandpass', [250, 3200]), noise(n)) * np.exp(-t * 130)
    body = np.sin(2 * np.pi * 150 * t) * np.exp(-t * 70) * 0.55
    return (clack + body) * gain


def numeral_thunk(gain=0.6):
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 78 * t) * np.exp(-t * 14)
    nz = sosfilt(sos('lowpass', 600), noise(n)) * np.exp(-t * 60) * 0.4
    return (x + nz) * gain


def block_snap(gain=0.5, freq=210.0):
    n = int(SR * 0.12)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t * 55)
    nz = sosfilt(sos('bandpass', [400, 3000]), noise(n)) * np.exp(-t * 200) * 0.6
    return (x * 0.7 + nz) * gain


def guillotine(gain=0.55):
    n = int(SR * 0.20)
    t = np.arange(n) / SR
    snick = sosfilt(sos('highpass', 3500), noise(n)) * np.exp(-t * 170)
    ring = np.sin(2 * np.pi * 1350 * t) * np.exp(-t * 40) * 0.25
    return (snick + ring) * gain


def felt_thump(gain=0.5):
    n = int(SR * 0.30)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 62 * t) * np.exp(-t * 17)
    nz = sosfilt(sos('lowpass', 300), noise(n)) * np.exp(-t * 45) * 0.5
    return (x + nz) * gain


def tile_tick(gain=0.16):
    n = int(SR * 0.035)
    t = np.arange(n) / SR
    return sosfilt(sos('bandpass', [2600, 9000]), noise(n)) * np.exp(-t * 220) * gain


# ---------------------------------------------------------------- arrangement
music = buf()
foley = buf()
exception_bus = buf()

# --- motorik pulse: kick on beats, hats on 8ths, bass on 8ths, marimba pattern
KICK = [0.5, 1.0, 1.5] + [2.0, 2.5, 3.0, 3.5, 4.0, 4.5] + [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]
for at in KICK:
    add(music, kick(), at, 0.9)

HAT_TIMES = [x * 0.25 for x in range(4, 19)] + [x * 0.25 for x in range(22, 36)]  # 1.0-4.5, 5.5-8.75
for i, at in enumerate(HAT_TIMES):
    add(music, hat(open_=(i % 8 == 4)), at, 0.55 if i % 2 == 0 else 0.34)

BASS_TIMES = [x * 0.25 for x in range(8, 19)] + [x * 0.25 for x in range(22, 36)]   # 2.0-4.5, 5.5-8.75
BASS_PAT = [55.0, 55.0, 65.41, 65.41, 55.0, 55.0, 73.42, 73.42]
for i, at in enumerate(BASS_TIMES):
    add(music, bass(BASS_PAT[i % len(BASS_PAT)]), at, 0.85)

MAR_TIMES = [x * 0.25 for x in range(4, 19)] + [x * 0.25 for x in range(22, 35)]     # 1.0-4.5, 5.5-8.5
SCALE = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0]
ARP = [0, 2, 4, 3, 1, 3, 5, 4, 0, 2, 4, 5, 3, 1, 2, 0]
for i, at in enumerate(MAR_TIMES):
    add(music, marimba(SCALE[ARP[i % len(ARP)]]), at, 0.75, pan=(-0.25 if i % 2 else 0.25))

for i, at in enumerate([5.5, 6.5, 7.5, 8.0, 8.5]):          # glockenspiel: one per new rule
    add(music, glock(1760.0 if i % 2 == 0 else 1318.5), at, 0.8, pan=0.3)

# --- the silence: music out 5.00-5.50 (hard stop with an 8 ms fade)
sil = np.ones(N)
for i in range(int(5.0 * SR), min(N, int(5.5 * SR))):
    sil[i] = 0.0
fade = int(0.008 * SR)
for k in range(fade):
    i = int(5.0 * SR) + k
    if i < N:
        sil[i] = 1 - k / fade
    j = int(5.5 * SR) - fade + k
    if 0 <= j < N:
        sil[j] = k / fade
music *= sil

# --- foley: dry and close, the materials of print
add(foley, paper_slap(0.75), 0.00)
add(foley, ruling_pen(0.30), 0.50)                       # columns ruled
add(foley, letterpress(0.5), 1.00)                       # masthead
add(foley, numeral_thunk(0.55), 1.50)                    # the giant 3
for i, at in enumerate([2.0, 2.5, 3.0, 3.5]):            # rules snap
    add(foley, block_snap(0.42 + 0.03 * i, 190 + 22 * i), at)
add(foley, paper_slap(0.45), 4.00)                       # the exception leaves
add(foley, guillotine(0.55), 5.25)                       # knife cut through the 3
add(foley, block_snap(0.5, 160), 5.50)                   # 66 starts
add(foley, letterpress(0.4), 6.00)                       # caption row
for i in range(0, 66, 3):                                # wall of 66 tiles
    add(foley, tile_tick(0.13), 6.25 + i * (0.65 / 66), pan=0.35)
add(foley, paper_slap(0.5), 6.80)                        # end line
add(foley, guillotine(0.5), 9.40)                        # final cut
add(foley, felt_thump(0.45), 9.78)                       # end line leaves
add(foley, paper_slap(0.28), 9.92)

# --- the exception: a sine glide that follows its position, the only voice in the silence
def glide_segment(t0, t1, f0, f1, gain=0.045):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / max(t1 - t0, 1e-9))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph)
    e = np.minimum(1.0, np.minimum(t / 0.05, (t[-1] - t) / 0.05) + 0.0)
    return sig * e * gain


add(exception_bus, glide_segment(4.0, 5.2, 380, 720), 4.0, 1.0, pan=0.35)
add(exception_bus, glide_segment(5.2, 5.5, 720, 720), 5.2, 1.0, pan=0.35)
add(exception_bus, glide_segment(5.5, 6.88, 720, 360), 5.5, 1.0, pan=0.45)

# ---------------------------------------------------------------- master
mix = music * 0.9 + foley * 0.85 + exception_bus
# gentle bus soft-clip, then peak-normalise with headroom for ffmpeg loudnorm
mix = np.tanh(mix * 1.25) * 0.92
peak = np.max(np.abs(mix))
if peak > 0:
    mix = mix / peak * 0.60          # ≈ −4.4 dBFS sample peak: leaves room for inter-sample peaks
rms = np.sqrt(np.mean(mix ** 2))
print(f"peak {20*np.log10(peak):.2f} dBFS  rms {20*np.log10(rms+1e-12):.2f} dBFS")

out = Path(__file__).resolve().parent / 'mix.wav'
out.parent.mkdir(parents=True, exist_ok=True)
pcm = np.clip(mix.T, -1, 1)
pcm16 = (pcm * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm16.tobytes())
print('wrote', out, f'{DUR:.3f}s {SR}Hz stereo')
