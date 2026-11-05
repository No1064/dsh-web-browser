#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dsh-web-browser 抖音竖屏宣传片（30.0s / 1080x1920）
原创 BGM 程序化合成 + 8 句 VO 精确落位混音
=============================================================

特点
----
- 全部声音由 numpy/scipy 程序化合成（sine/saw/noise + biquad 滤波 + 包络），
  不含任何版权采样、歌曲或人声素材。
- 120 BPM，4/4，15 小节 = 30.000s，采样率 48kHz，输出立体声。
- 8 句 VO 按 work/timeline.json 的 start 做**样本级**落位（误差 0 采样）。
- 人声段 BGM 用**看前静态包络**压低 10.0dB（pre 120ms / post 300ms 余弦斜坡），
  不做逐样本 sidechain，避免抽吸，压低量可测量、可复现。
- 母带：低切 → 轻总线压缩 → 峰值限幅 → ffmpeg loudnorm 闭环校准到 -14.0 LUFS。

用法
----
    python3 bgm_script.py                # 全流程：合成 → 母带 → 混音 → 自检 → 报告
    python3 bgm_script.py --no-mp3       # 跳过 bgm_only.mp3 导出
    python3 bgm_script.py --keep         # 保留 _build/ 中间文件（默认也会保留 report.json）
    python3 bgm_script.py --trim-vo-lead # 去掉 edge-tts 自带 ~180ms 前导静音后落位
                                         # （默认关闭：严格按 timeline.start 原样落位）
    python3 bgm_script.py --bgm-from X.wav   # 换外部 BGM：自动 48k/双声道/裁补 30s/-17LUFS

依赖：python3 + numpy + scipy + ffmpeg/ffprobe（用于测量与 24bit 封装）

产物（本目录）
--------------
    bgm.wav       30.000s / 48kHz / 2ch / 24bit   BGM 单独版（-17.0 LUFS 试听电平）
    mix.wav       30.000s / 48kHz / 2ch / 24bit   成片混音（-14.0 LUFS / TP <= -1.0)
    bgm_only.mp3  bgm.wav 的 192k MP3（试听备用）
    _build/report.json                            全部测量数据（自检用）
"""
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import scipy.io.wavfile as wavfile
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, lfilter, sosfilt

# ---------------------------------------------------------------- 基本参数
SR = 48000                      # 采样率
DUR = 30.0                      # 总时长
N = int(round(DUR * SR))        # 1_440_000 采样
BPM = 120.0
BEAT = 60.0 / BPM               # 0.5s
BAR = 4 * BEAT                  # 2.0s（15 小节 = 30s）
S16 = BEAT / 4                  # 0.125s（16 分音符）

# 关键时间点（来自 work/timeline.json 与分镜）
INTRO_END = 3.358               # s2 揭晓，大 impact、进鼓
BREAK_OUT = 13.33               # s5 主页，留白开始
BREAK_IN = 16.5                 # 留白结束，鼓组回到
BUILD = 19.778                  # s7 历史，起 build
LIFT = 23.446                   # s8 CTA，抬升
END_SEC = 28.0                  # 收尾减薄
FINALE = 29.2                   # 终结重音
DUCK_DB = 10.0                  # 人声段 BGM 压低量（要求 8–12dB）
VO_LINE_LUFS = -16.5            # VO 总线（双声道双单声）响度目标；单声道stem低 3.01dB
VO_CREST_DB = 12.5              # 单句 VO 峰值相对响度上限（crest dB），收爆破音/齿音
BGM_BUS_COMP = (-18.0, 2.0)     # BGM 总线轻压缩（threshold dB, ratio）
BGM_LUFS = -17.0                # bgm.wav 母带电平
MIX_LUFS = -14.0                # mix.wav 整体响度
CEIL_DB = -1.7                  # 母带峰值天花板（给真峰值留余量）

HERE = Path(__file__).resolve().parent
ENTITY = HERE.parent
TIMELINE = ENTITY / "work" / "timeline.json"
VO_DIR = HERE / "vo"
TMPDIR = HERE / "_build"

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"

RNG = np.random.default_rng(20261105)   # 固定种子 → 可复现


# ---------------------------------------------------------------- 基础工具
def db2lin(db):
    return 10.0 ** (np.asarray(db, dtype=np.float64) / 20.0)


def lin2db(x):
    return 20.0 * np.log10(np.maximum(np.asarray(x, dtype=np.float64), 1e-12))


def midi_hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def normalize(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def pan_gains(p):
    """等功率声像：p=-1 左，0 中，+1 右；居中时两声道均为 1.0。"""
    p = float(np.clip(p, -1.0, 1.0))
    a = (p + 1.0) * math.pi / 4.0
    return math.cos(a) * math.sqrt(2.0), math.sin(a) * math.sqrt(2.0)


def biquad(x, kind, fc, order=2):
    """Butterworth 双二阶滤波（sos，稳定）。"""
    nyq = SR / 2.0
    if kind == "low":
        sos = butter(order, min(fc / nyq, 0.999), "low", output="sos")
    elif kind == "high":
        sos = butter(order, max(fc / nyq, 1e-4), "high", output="sos")
    elif kind == "band":
        lo, hi = fc
        sos = butter(order, [max(lo / nyq, 1e-4), min(hi / nyq, 0.999)],
                     "band", output="sos")
    else:
        raise ValueError(kind)
    return sosfilt(sos, x, axis=0)


def lp(x, fc, order=2):
    return biquad(x, "low", fc, order)


def hp(x, fc, order=2):
    return biquad(x, "high", fc, order)


def bp(x, lo, hi, order=2):
    return biquad(x, "band", (lo, hi), order)


def movavg(x, k):
    """O(n) 滑动平均（边缘复制填充），用于包络平滑。"""
    k = max(1, int(k))
    if k == 1:
        return x.astype(np.float64)
    c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64)]))
    out = (c[k:] - c[:-k]) / k
    left = (k - 1) // 2
    right = len(x) - len(out) - left
    return np.concatenate([np.full(left, out[0]), out, np.full(right, out[-1])])


def cos_ramp(u):
    """0→1 的余弦斜坡，u ∈ [0,1]。"""
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(u, 0.0, 1.0))


def fade_edges(x, a=0.004, b=0.01):
    """给任意短音两端加余弦淡入淡出，避免 click。"""
    n = len(x)
    x = np.array(x, dtype=np.float64)
    na = min(int(a * SR), n // 2)
    nb = min(int(b * SR), n // 2)
    if na > 0:
        x[:na] *= cos_ramp(np.linspace(0, 1, na))
    if nb > 0:
        x[-nb:] *= cos_ramp(np.linspace(1, 0, nb))
    return x


def automation(points, n=N):
    """关键点 (t秒, 增益) → 全长度余弦插值增益包络。"""
    pts = sorted(points)
    ts = np.array([p[0] for p in pts], dtype=np.float64)
    gs = np.array([p[1] for p in pts], dtype=np.float64)
    t = np.arange(n) / SR
    out = np.empty(n)
    out[:] = gs[0]
    for i in range(len(pts) - 1):
        m = (t >= ts[i]) & (t < ts[i + 1])
        if not np.any(m):
            continue
        u = (t[m] - ts[i]) / max(ts[i + 1] - ts[i], 1e-9)
        out[m] = gs[i] + (gs[i + 1] - gs[i]) * cos_ramp(u)
    out[t >= ts[-1]] = gs[-1]
    return out


def add(buf, sig, t, gain=1.0, pan=0.0):
    """把单声道短音叠加到立体声总线（带声像）。"""
    i = int(round(t * SR))
    if i >= N:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), N - i)
    if n <= 0:
        return
    gl, gr = pan_gains(pan)
    buf[i:i + n, 0] += (sig[:n] * gain * gl).astype(np.float32)
    buf[i:i + n, 1] += (sig[:n] * gain * gr).astype(np.float32)


# ---------------------------------------------------------------- 响度测量（ITU-R BS.1770-4）
_K_COEF = (
    ([1.53512485958697, -2.69169618940638, 1.19839281085285],
     [1.0, -1.69065929318241, 0.73248077421585]),
    ([1.0, -2.0, 1.0],
     [1.0, -1.99004745483398, 0.99007225036621]),
)


def k_weight(x):
    y = np.asarray(x, dtype=np.float64)
    for b, a in _K_COEF:
        y = lfilter(b, a, y, axis=0)
    return y


def _block_powers(x):
    """400ms 块 / 100ms 步进，返回每块加权均方功率（按声道求和）。"""
    y = k_weight(x)
    if y.ndim == 1:
        y = y[:, None]
    win, hop = int(0.4 * SR), int(0.1 * SR)
    n = len(y)
    if n < win:
        y = np.pad(y, ((0, win - n), (0, 0)))
        n = win
    starts = range(0, n - win + 1, hop)
    return np.array([np.mean(y[i:i + win] ** 2, axis=0).sum() for i in starts])


def integrated_lufs(x):
    """门限积分响度（LUFS），与 ffmpeg loudnorm 的 input_i 同一定义。"""
    ms = _block_powers(x)
    lufs = -0.691 + 10.0 * np.log10(np.maximum(ms, 1e-20))
    abs_ok = lufs > -70.0
    if not np.any(abs_ok):
        return -70.0
    rel = -0.691 + 10.0 * np.log10(np.mean(ms[abs_ok])) - 10.0
    ok = abs_ok & (lufs > rel)
    return float(-0.691 + 10.0 * np.log10(np.mean(ms[ok])))


def window_lufs(x, t0, t1):
    """某个时间窗内的 K 加权均方 → 相对 dB（用于平衡比对，不是严格 LUFS）。"""
    a, b = int(round(t0 * SR)), int(round(t1 * SR))
    seg = np.asarray(x)[a:b]
    if seg.size == 0:
        return -120.0
    y = k_weight(seg)
    if y.ndim == 1:
        y = y[:, None]
    return float(-0.691 + 10.0 * np.log10(max(np.mean(y ** 2), 1e-20)))


# ---------------------------------------------------------------- 合成器
def synth_kick(dur=0.40, f0=112.0, f1=44.0, amp_tau=0.14, click=0.22):
    """深而短的小底鼓：正弦扫频 + 极短噪声敲击。不做 EDM 长 boom。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.030)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.tanh(1.6 * np.sin(ph)) / np.tanh(1.6)
    env = np.minimum(1.0, t / 0.0015) * np.exp(-t / amp_tau)
    sig = body * env
    if click > 0:
        nz = RNG.standard_normal(n) * np.exp(-t / 0.0035)
        sig += click * 0.6 * hp(nz, 1700)
    return normalize(sig)


def synth_sub(freq, dur, pattern=None, unit=S16, smooth=0.035):
    """深 sub：基频 + 少量二次谐波（手机外放也能听见一点），8 分音符脉动。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.10 * np.sin(4 * np.pi * freq * t)
    sig = np.tanh(1.25 * sig)
    if pattern is None:
        pat = np.ones(8)
    else:
        pat = np.asarray(pattern, dtype=np.float64)
    lvl = np.repeat(pat, int(unit * SR))
    lvl = np.resize(lvl, n)
    k = max(3, int(smooth * SR))
    lvl = movavg(lvl, k)
    lvl = lvl / max(lvl.max(), 1e-9)
    env = np.minimum(1.0, t / 0.015) * np.minimum(1.0, (dur - t) / 0.05)
    return normalize(sig * env * lvl)


def _saw(ph):
    return 2.0 * ((ph / (2 * np.pi) + 0.5) % 1.0) - 1.0


def synth_pad(freqs, dur, cutoff=1500.0, attack=0.22, release=0.55, detune=0.0045):
    """暖 pad：每音 4 个微失谐锯齿（L/R 反向失谐）+ 低通，慢起慢落。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)
    for f in freqs:
        for sign in (1.0, -1.0):
            phL = 2 * np.pi * f * (1 + sign * detune) * t + RNG.uniform(0, 2 * np.pi)
            phR = 2 * np.pi * f * (1 - sign * detune) * t + RNG.uniform(0, 2 * np.pi)
            L += _saw(phL)
            R += _saw(phR)
    L = lp(L, cutoff, 2)
    R = lp(R, cutoff, 2)
    env = np.minimum(1.0, t / max(attack, 1e-4))
    tail = np.minimum(1.0, (dur - t) / max(release, 1e-4))
    env = env * tail
    m = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    return np.stack([L / m, R / m], axis=1) * env[:, None]


def synth_pluck(freq, dur=0.50, tau=0.15, spark=0.35, cutoff=3300.0):
    """暖 pluck：泛音堆叠 + 高次泛音衰减更快 + 极短噪声颗粒，低通压掉刺耳。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k, amp in enumerate([1.0, 0.34, 0.15, 0.07, 0.035], start=1):
        sig += amp * np.sin(2 * np.pi * freq * k * t) * np.exp(-t / (tau / k ** 0.7))
    sig *= np.minimum(1.0, t / 0.004)
    if spark > 0:
        nz = RNG.standard_normal(n) * np.exp(-t / 0.006)
        sig += spark * 0.12 * bp(nz, 1800, 5500)
    return normalize(lp(sig, cutoff, 2))


def synth_hat(dur=0.075, tau=0.020, lo=6000.0, hi=13500.0, metallic=True):
    """干净 closed hat：带通噪声 + 两条窄带金属共鸣。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = RNG.standard_normal(n)
    sig = bp(nz, lo, hi, 2)
    if metallic:
        for fc, a in ((8300.0, 0.10), (11200.0, 0.06)):
            sig += a * bp(nz, fc * 0.9, fc * 1.1, 2)
    env = np.minimum(1.0, t / 0.0015) * np.exp(-t / tau)
    return normalize(sig * env)


def synth_snap(freq=190.0, dur=0.16):
    """轻量军鼓/拍手：噪声带通 + 一点体声，build 段用。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = RNG.standard_normal(n) * np.exp(-t / 0.045)
    body = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.035)
    sig = 0.8 * bp(nz, 1200, 3800, 2) + 0.45 * body
    return normalize(np.minimum(1.0, t / 0.0015) * sig)


def synth_impact(kind="lite"):
    """画面切点的冲击音：低频下潜 + 低频噪声闷响 + 极短空气爆点。"""
    if kind in ("big", "final"):
        dur, f0, f1, sub_tau, nz_tau, air = 1.9, 82.0, 33.0, 0.62, 0.30, 0.22
    elif kind == "cta":
        dur, f0, f1, sub_tau, nz_tau, air = 1.3, 88.0, 38.0, 0.45, 0.24, 0.20
    else:  # lite
        dur, f0, f1, sub_tau, nz_tau, air = 0.75, 98.0, 50.0, 0.20, 0.13, 0.14
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.20)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.tanh(1.4 * np.sin(ph)) * np.minimum(1.0, t / 0.003) * np.exp(-t / sub_tau)
    nz = RNG.standard_normal(n) * np.exp(-t / nz_tau)
    thud = lp(nz, 340.0, 2) * 0.9
    burst = bp(nz, 2200.0, 8000.0, 2) * np.exp(-t / 0.05) * air
    return normalize(sub * 0.9 + thud + burst)


def synth_bell(freq, dur=1.5, index=1.7, tau=0.50):
    """FM 钟声点缀：只用少量、低电平，避免抢戏。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = index * np.exp(-t / 0.18) * np.sin(2 * np.pi * 2.01 * freq * t)
    sig = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / tau)
    sig += 0.18 * np.sin(2 * np.pi * freq * 3.0 * t) * np.exp(-t / (tau * 0.5))
    return normalize(np.minimum(1.0, t / 0.003) * sig)


def synth_riser(dur, f_lo=3000.0, f_hi=9000.0, tone=(0.0, 0.0), seed=11):
    """噪声升腾：分 10 段做中心频率上扫 + 幅度上扬，另加一条上滑正弦。"""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    centers = np.geomspace(f_lo, f_hi, 10)
    out = np.zeros(n)
    seg = max(int(n / 6), 32)
    win = np.hanning(seg * 2 + 1)
    for i, c in enumerate(centers):
        lo, hi = c / 1.7, min(c * 1.7, 20000.0)
        band = bp(noise, lo, hi, 2)
        pos = int(i * (n - seg) / 9)
        w = np.zeros(n)
        sl = win[win.size // 2 - seg: win.size // 2 + seg + 1][1:-1]
        w[pos:pos + sl.size] = sl[:max(0, min(sl.size, n - pos))]
        out += band * w
    t = np.arange(n) / SR
    u = np.clip(t / dur, 0, 1)
    amp = (0.15 + 0.85 * u ** 2.2) * np.minimum(1.0, t / 0.05)
    amp *= np.clip((dur - t) / 0.045, 0.0, 1.0)      # 顶点前收干净，交给 impact
    out *= amp
    if tone[0] > 0 and tone[1] > 0:
        f = tone[0] * (tone[1] / tone[0]) ** (u ** 1.4)
        ph = 2 * np.pi * np.cumsum(f) / SR
        out = out + 0.16 * np.sin(ph) * amp
    return normalize(out)


def synth_room_ir(x, size=1.0, wet=0.35):
    """小型 Schroeder 混响（4 comb + 2 allpass），短、干净，避免"糊墙"。"""
    xin = lp(np.asarray(x, dtype=np.float64), 5200.0, 2)

    def fb(y, d, g):
        y = np.array(y, dtype=np.float64)
        k = 0
        while (k + 1) * d < len(y):
            lo, hi = (k + 1) * d, min((k + 2) * d, len(y))
            y[lo:hi] += g * y[lo - d:hi - d]
            k += 1
        return y

    def allpass(y, d, g):
        xd = np.zeros_like(y)
        xd[d:] = y[:-d]
        return fb(-g * y + xd, d, g)

    combs = [(int(SR * 0.0297 * size), 0.78), (int(SR * 0.0371 * size), 0.76),
             (int(SR * 0.0411 * size), 0.74), (int(SR * 0.0437 * size), 0.72)]
    L = sum(fb(xin, d, g) for d, g in combs) / 4.0
    R = sum(fb(xin, d + 17, g) for d, g in combs) / 4.0
    L = allpass(L, int(SR * 0.0050), 0.5)
    L = allpass(L, int(SR * 0.0017), 0.5)
    R = allpass(R, int(SR * 0.0053), 0.5)
    R = allpass(R, int(SR * 0.0019), 0.5)
    return np.stack([lp(L, 7000.0, 2), lp(R, 7000.0, 2)], axis=1) * wet


# ---------------------------------------------------------------- 编曲
CHORDS = {
    # 温暖、无强导向音的 voicing（Am7 / Fmaj7 / Cmaj7 / Gadd9）
    "Am": [220.00, 261.63, 329.63, 392.00],
    "F":  [174.61, 220.00, 261.63, 329.63],
    "C":  [261.63, 329.63, 392.00, 493.88],
    "G":  [196.00, 246.94, 293.66, 440.00],
}
ROOTS = {"Am": 55.00, "F": 43.65, "C": 65.41, "G": 49.00}
# 每小节的根音（bar 0 = [0,2)）；15 小节 Am-F-C-G 循环，头尾落在 Am
CHORD_BY_BAR = ["Am", "Am", "Am", "F", "C", "G", "Am", "F",
                "C", "G", "Am", "F", "C", "G", "Am"]

# 鼓/帽子/琶音在 16 分格上的位置（0..15）
KICK_PAT = {
    "intro": set(), "groove": {0, 8, 14}, "break": set(),
    "groove2": {0, 8, 14}, "build": {0, 6, 8, 14},
    "lift": {0, 8, 12, 14}, "end": {0}, "finale": set(),
}
HAT_PAT = {
    "intro": set(), "groove": {0, 2, 4, 6, 8, 10, 12, 14}, "break": set(),
    "groove2": {0, 2, 4, 6, 8, 10, 12, 14},
    "build": {0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15},
    "lift": {0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14},
    "end": {0, 4, 8, 12}, "finale": set(),
}
HAT_VEL = [0.88, 0.30, 0.55, 0.26, 0.82, 0.28, 0.50, 0.32]
PLUCK_PAT = {
    "intro": {2, 6, 10, 14}, "groove": {0, 3, 6, 8, 11, 14},
    "break": {0, 8}, "groove2": {0, 3, 6, 8, 11, 14},
    "build": {0, 2, 3, 4, 6, 8, 10, 11, 12, 14},
    "lift": {0, 2, 4, 6, 8, 10, 12, 14, 13},
    "end": {0}, "finale": set(),
}
SUB_PULSE = [0.95, 0.55, 0.78, 0.48, 0.92, 0.52, 0.72, 0.46]
BUS_GAIN = {
    "pad": 0.36, "sub": 0.40, "pluck": 0.26, "hat": 0.120, "kick": 0.50,
    "perc": 0.10, "impact": 0.36, "riser": 0.13, "bell": 0.12,
}
IMPACT_GAIN = {"big": 1.0, "lite": 0.42, "cta": 0.78, "final": 1.05}


def section_at(t):
    if t < INTRO_END:
        return "intro"
    if t < BREAK_OUT:
        return "groove"
    if t < BREAK_IN:
        return "break"
    if t < BUILD:
        return "groove2"
    if t < LIFT:
        return "build"
    if t < END_SEC:
        return "lift"
    if t < FINALE:
        return "end"
    return "finale"


def chord_runs():
    """把 CHORD_BY_BAR 合并成 (起, 止, 和弦) 的连续段。"""
    runs = []
    b = 0
    while b < len(CHORD_BY_BAR):
        e = b
        while e + 1 < len(CHORD_BY_BAR) and CHORD_BY_BAR[e + 1] == CHORD_BY_BAR[b]:
            e += 1
        runs.append((b * BAR, (e + 1) * BAR, CHORD_BY_BAR[b]))
        b = e + 1
    return runs


# 各总线随段落的电平自动化（时间秒, 增益）
PAD_AUTO = [(0.0, 0.0), (0.8, 0.80), (3.30, 0.90), (3.40, 1.0), (13.2, 1.02),
            (13.45, 1.22), (16.5, 1.12), (19.7, 1.02), (23.4, 1.06),
            (23.55, 1.34), (27.9, 1.26), (29.2, 1.18), (29.5, 1.05), (30.0, 0.0)]
SUB_AUTO = [(0.0, 0.0), (1.2, 0.50), (3.30, 0.62), (3.40, 1.0), (13.2, 1.0),
            (13.45, 0.56), (16.5, 0.74), (19.7, 0.94), (23.4, 1.0),
            (23.55, 1.14), (28.0, 1.04), (29.1, 0.95), (29.22, 0.0), (30.0, 0.0)]
MASTER_FADE = [(0.0, 0.0), (0.04, 1.0), (29.55, 1.0), (30.0, 0.0)]

IMPACTS = [
    (INTRO_END, "big"),      # 3.358 揭晓，进鼓
    (6.69, "lite"),          # s3 多标签
    (9.662, "lite"),         # s4 地址栏
    (BREAK_OUT, "lite"),     # 13.33 主页 / 留白开始
    (16.518, "lite"),        # s6 右键菜单
    (BUILD, "lite"),         # 19.778 history / 起 build
    (LIFT, "cta"),           # 23.446 CTA 抬升
    (FINALE, "final"),       # 29.2 终结重音
]
RISERS = [
    (2.30, INTRO_END, 3000.0, 9000.0, (55.0, 110.0), 11),   # 前奏 → 揭晓
    (18.30, BUILD, 2500.0, 8000.0, (0.0, 0.0), 22),         # 起 build 前
    (21.50, LIFT, 3500.0, 11000.0, (82.4, 164.8), 33),      # build → CTA 抬升
]
BELLS = [
    (BREAK_OUT, [880.00], 0.55),                 # 13.33 留白入口，一声高音
    (9.662, [659.26], 0.35),                     # 9.66 轻点一下
    (LIFT, [880.00, 1108.73], 0.70),             # 23.446 CTA
    (FINALE, [880.00, 1046.50, 1318.51], 1.0),   # 29.2 终结重音上的钟声和弦
]


def build_bgm():
    """按时间轴铺满 15 小节，返回各条总线。"""
    buses = {k: np.zeros((N, 2), dtype=np.float32) for k in
             ("pad", "sub", "pluck", "hat", "kick", "perc", "impact", "riser", "bell")}

    # ---- pad：按和弦连续段渲染，段间 0.45s 交叠淡入淡出 ----
    for i, (t0, t1, ch) in enumerate(chord_runs()):
        dur = (t1 - t0) + 0.45
        atk = 0.85 if t0 < 0.01 else 0.22
        cut = 1000.0 if t0 < INTRO_END else (1900.0 if BREAK_OUT <= t0 < BREAK_IN else
                                            2400.0 if t0 >= LIFT else 1550.0)
        pad = synth_pad(CHORDS[ch], dur, cutoff=cut, attack=atk, release=0.60)
        i0 = int(round(t0 * SR))
        n = min(len(pad), N - i0)
        buses["pad"][i0:i0 + n] += pad[:n].astype(np.float32)

    # ---- sub：每小节一个持续音，8 分音符脉动（前奏为长音） ----
    for b in range(15):
        t0 = b * BAR
        ch = CHORD_BY_BAR[b]
        sec = section_at(t0 + 0.01)
        pat = None if sec in ("intro", "finale") else SUB_PULSE
        sub = synth_sub(ROOTS[ch], BAR + 0.06, pattern=pat)
        add(buses["sub"], sub, t0, 1.0, 0.0)

    # ---- 16 分格事件：kick / hat / pluck / perc ----
    rng_arp = np.random.default_rng(7)
    arp_state = 0
    tones = CHORDS["Am"]
    slots = int(round(FINALE / S16)) + 1
    for slot in range(slots):
        t = slot * S16
        if t >= FINALE - 1e-9:
            break
        sec = section_at(t)
        bar = int(t // BAR)
        pos = int(round((t - bar * BAR) / S16)) % 16
        ch = CHORD_BY_BAR[min(bar, 14)]
        tones = CHORDS[ch]
        bar_in_2 = bar % 2

        # kick（避开与 impact 撞在同一时刻的低频）
        if pos in KICK_PAT[sec]:
            if sec in ("groove2", "lift") and bar_in_2 == 1 and pos == 12:
                pass  # 每两小节加一个 1.5 拍推进
            else:
                k = synth_kick(f0=112 if sec != "lift" else 116)
                add(buses["kick"], k, t, 1.0, 0.0)

        # closed hat
        if pos in HAT_PAT[sec]:
            vel = HAT_VEL[(pos // 2) % 8]
            if pos % 2 == 1:                      # build/lift 的 16 分弱拍
                vel *= 0.45
            bright = 1.0 if sec in ("build", "lift") else 0.85
            h = synth_hat(lo=5500 * bright, hi=13500 * bright,
                          tau=0.026 if sec in ("build", "lift") else 0.019)
            add(buses["hat"], h, t, vel, -0.18 if pos % 4 < 2 else 0.18)

        # 暖 pluck 琶音（随机游走，不做记忆点旋律）
        if pos in PLUCK_PAT[sec]:
            step = int(rng_arp.choice([-1, 0, 0, 1]))
            arp_state = int(np.clip(arp_state + step, 0, 3))
            octv = 2 if (sec in ("lift", "build") and pos % 2 == 0) else 1
            f = tones[arp_state] * octv
            vel = {"intro": 0.42, "groove": 0.55, "break": 0.40, "groove2": 0.55,
                   "build": 0.60, "lift": 0.68, "end": 0.42}.get(sec, 0.4)
            vel *= 1.0 + 0.10 * rng_arp.standard_normal()
            p = synth_pluck(f, spark=0.35 if sec != "break" else 0.18)
            pan = 0.30 if (slot % 2 == 0) else -0.30
            add(buses["pluck"], p, t, max(vel, 0.05), pan)

        # build 段的轻军鼓
        if sec == "build" and pos in (4, 12):
            s = synth_snap()
            add(buses["perc"], s, t, 0.75, 0.05)

    # ---- impact / riser / bell ----
    for t, kind in IMPACTS:
        add(buses["impact"], synth_impact(kind), t, IMPACT_GAIN[kind], 0.0)
    for t0, t1, flo, fhi, tone, seed in RISERS:
        r = synth_riser(t1 - t0, f_lo=flo, f_hi=fhi, tone=tone, seed=seed)
        add(buses["riser"], r, t0, 1.0, 0.0)
    for t, freqs, g in BELLS:
        for i, f in enumerate(freqs):
            add(buses["bell"], synth_bell(f, tau=0.55 if len(freqs) == 1 else 0.75),
                t + i * 0.012, g / max(len(freqs), 1) ** 0.5, 0.35 if i else -0.25)

    # ---- 段落电平自动化 ----
    buses["pad"] *= automation(PAD_AUTO)[:, None]
    buses["sub"] *= automation(SUB_AUTO)[:, None]

    return buses


def render_bgm_float():
    """合成 → 混总线 → 混响 send → 主淡出。返回 (N,2) float64。"""
    buses = build_bgm()
    mix = np.zeros((N, 2), dtype=np.float64)
    for k, b in buses.items():
        mix += b.astype(np.float64) * BUS_GAIN[k]

    # 混响 send：只给 pad / pluck / bell，短而干，避免糊
    send = (buses["pad"].mean(axis=1) * 0.55
            + buses["pluck"].mean(axis=1) * 0.40
            + buses["bell"].mean(axis=1) * 0.45)
    wet = synth_room_ir(send, size=1.0, wet=1.0)
    mix += wet * 0.22

    mix *= automation(MASTER_FADE)[:, None]
    return mix


def load_external_bgm(path):
    """读取外部 BGM（替换曲目用）：任意采样率/声道 → 48k 立体声、裁/补到 30.000s。"""
    from scipy.signal import resample_poly
    sr_in, d = wavfile.read(str(path))
    if d.dtype == np.int16:
        x = d.astype(np.float64) / 32768.0
    elif d.dtype == np.int32:                       # 24bit 在 scipy 里是 int32 左对齐
        x = d.astype(np.float64) / 2147483648.0
    elif d.dtype == np.float32 or d.dtype == np.float64:
        x = d.astype(np.float64)
    else:
        raise ValueError(f"不支持的采样格式: {d.dtype}")
    if x.ndim == 2 and x.shape[0] < x.shape[1]:     # 兼容 (ch, n) 布局
        x = x.T
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    if sr_in != SR:                                  # 重采样到 48k
        g = math.gcd(int(SR), int(sr_in))
        x = resample_poly(x, SR // g, int(sr_in) // g, axis=0)
    out = np.zeros((N, 2), dtype=np.float64)
    n = min(len(x), N)
    out[:n] = x[:n]
    print(f"    载入外部 BGM: {path.name}  {sr_in}Hz/{x.shape[1]}ch → "
          f"48kHz/2ch  原始 {len(x) / SR:.3f}s → 30.000s")
    return out


# ---------------------------------------------------------------- 母带 / 文件 IO
def limit_peak(x, ceiling_db=CEIL_DB, lookahead_ms=8.0):
    """前瞻峰值限幅（安全网，正常应几乎不工作）。返回 (y, 最大衰减dB)。"""
    ceil = 10.0 ** (ceiling_db / 20.0)
    mono = (np.ndim(x) == 1)
    xin = x[:, None] if mono else x
    la = max(1, int(lookahead_ms * SR / 1000))
    absx = np.max(np.abs(xin), axis=1)
    env = maximum_filter1d(absx, size=2 * la + 1, mode="nearest")
    g = np.minimum(1.0, ceil / np.maximum(env, 1e-12))
    g = movavg(g, la)                                   # 平滑增益，降低失真
    g = np.minimum(g, 1.0)
    gr = float(lin2db(np.min(g)))
    y = xin * g[:, None]
    pk = np.max(np.abs(y))
    if pk > ceil:                                       # 兜底：整体微缩
        y *= ceil / pk
        gr += float(lin2db(ceil / pk))
    return (y[:, 0] if mono else y), gr


def soft_comp(x, thresh_db=-20.0, ratio=2.5, win_ms=45.0, smooth_ms=30.0):
    """慢速软压缩（单声道/立体声均可），只做 2–3dB 的温和收束。"""
    p = x ** 2
    k = max(3, int(win_ms * SR / 1000))
    if p.ndim == 1:
        p = movavg(p, k)
        lvl = 10 * np.log10(np.maximum(p, 1e-12))
        over = np.maximum(0.0, lvl - thresh_db)
        g = 10 ** ((-over * (1 - 1 / ratio)) / 20)
        return x * movavg(g, int(smooth_ms * SR / 1000))
    out = np.empty_like(x)
    for c in range(x.shape[1]):
        out[:, c] = soft_comp(x[:, c], thresh_db, ratio, win_ms, smooth_ms)
    return out


def write_wav_f32(path, x):
    wavfile.write(str(path), SR, np.clip(x, -1.0, 1.0).astype(np.float32))


def wav24_from_float(path, x):
    tmp = TMPDIR / "_tmp_f32.wav"
    write_wav_f32(tmp, x)
    run([FFMPEG, "-y", "-v", "error", "-i", str(tmp), "-c:a", "pcm_s24le",
         "-ar", str(SR), str(path)])


def run(cmd):
    p = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"命令失败: {' '.join(map(str, cmd))}\n{p.stderr[-2000:]}")
    return p.stdout + p.stderr


def ffprobe_info(path):
    out = run([FFPROBE, "-v", "error", "-show_entries",
               "stream=codec_name,sample_rate,channels,bits_per_sample,bit_rate:"
               "format=duration,format_name", "-of", "json", str(path)])
    return json.loads(out)


def ffmpeg_loudnorm(path, target_i=MIX_LUFS, target_tp=-1.0):
    """一过测量（print_format=json）。返回 input_i / input_tp / input_lra 等。"""
    out = run([FFMPEG, "-hide_banner", "-nostats", "-nostdin", "-i", str(path),
               "-af", f"loudnorm=I={target_i}:TP={target_tp}:LRA=11:print_format=json",
               "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", out, re.S)
    if not m:
        raise RuntimeError("无法解析 loudnorm 输出")
    return json.loads(m.group(0))


def ffmpeg_loudnorm_2pass(src, dst, target_i=MIX_LUFS, target_tp=-1.0, target_lra=11.0):
    """ffmpeg loudnorm 两遍法（第二遍 linear=true，第二次测量作为验收数据）。"""
    m1 = ffmpeg_loudnorm(src, target_i, target_tp)
    af = (f"loudnorm=I={target_i}:TP={target_tp}:LRA={target_lra}"
          f":measured_I={m1['input_i']}:measured_TP={m1['input_tp']}"
          f":measured_LRA={m1['input_lra']}:measured_thresh={m1['input_thresh']}"
          f":offset={m1['target_offset']}:linear=true:print_format=json")
    run([FFMPEG, "-y", "-v", "error", "-i", str(src), "-af", af,
         "-c:a", "pcm_s24le", "-ar", str(SR), str(dst)])
    return m1, ffmpeg_loudnorm(dst, target_i, target_tp)


def silencedetect(path, noise_db=-45.0, min_dur=0.25):
    out = run([FFMPEG, "-hide_banner", "-nostats", "-nostdin", "-i", str(path),
               "-af", f"silencedetect=n={noise_db}dB:d={min_dur}", "-f", "null", "-"])
    res = []
    for m in re.finditer(r"silence_(start|end): ([\d.]+)", out):
        res.append((m.group(1), float(m.group(2))))
    return res


def volumedetect(path):
    out = run([FFMPEG, "-hide_banner", "-nostats", "-nostdin", "-i", str(path),
               "-af", "volumedetect", "-f", "null", "-"])
    return {k: float(v) for k, v in
            re.findall(r"(mean_volume|max_volume): (-?[\d.]+) dB", out)}


def master_to_lufs(x, target_i, ceiling_db=CEIL_DB, tol=0.08, max_iter=6, tag="?"):
    """闭环校准：线性增益 + 限幅，用 ffmpeg loudnorm 测量收敛到目标响度。"""
    g_db = 0.0
    hist = []
    probe = TMPDIR / "_probe.wav"
    y = x
    for it in range(max_iter):
        y = x * db2lin(g_db)
        y, gr = limit_peak(y, ceiling_db)
        write_wav_f32(probe, y)
        js = ffmpeg_loudnorm(probe, target_i)
        i, tp = float(js["input_i"]), float(js["input_tp"])
        hist.append({"iter": it + 1, "gain_db": round(g_db, 3),
                     "lufs": i, "tp": tp, "lim_gr_db": round(gr, 2)})
        err = target_i - i
        print(f"    [{tag}] iter{it + 1}: gain={g_db:+.2f}dB  I={i:.2f}LUFS  "
              f"TP={tp:.2f}dBTP  limGR={gr:.2f}dB")
        if abs(err) <= tol and tp <= -1.0:
            return y, hist
        g_db += err
    return y, hist


# ---------------------------------------------------------------- VO 与混音
def load_vo_lines(trim_lead=False):
    """读 8 句 VO，返回 [(id, 起点秒, 单声道 float 波形)]。"""
    tl = json.loads(TIMELINE.read_text(encoding="utf-8"))
    out = []
    for line in tl["vo"]:
        wav = VO_DIR / f"line{line['id']}.wav"
        sr, d = wavfile.read(str(wav))
        assert sr == SR, f"{wav.name} 采样率 {sr} != {SR}"
        x = d.astype(np.float64) / 32768.0
        if x.ndim > 1:
            x = x.mean(axis=1)
        if trim_lead:                      # 可选：裁掉 edge-tts 自带前导静音
            thr = 0.004
            idx = np.where(np.abs(x) > thr)[0]
            if len(idx):
                x = x[idx[0]:]
        out.append({"id": line["id"], "start": float(line["start"]),
                    "dur": float(line["dur"]), "end": float(line["end"]),
                    "x": x})
    return out


def build_vo_bus(lines):
    """VO 处理：低切 85Hz → 两级温和压缩 → 响度归一 → 峰值收口 → 样本级落位。

    VO 以「双单声」放中央（L/R 各一份），总线的 K 加权响度比单声道 stem 高
    10*log10(2) = +3.01 dB（功率相加），所以单声道目标取 VO_LINE_LUFS - 3.01。
    峰值按 crest 上限收口：峰值 = 单声道目标响度 + VO_CREST_DB，保证落到 -14 LUFS
    母带时人声峰值不撞天花板、不需要重限幅。
    """
    bus = np.zeros((N, 2), dtype=np.float64)
    info = []
    target_mono = VO_LINE_LUFS - 10.0 * math.log10(2.0)     # -3.01 dB
    for ln in lines:
        x = hp(ln["x"], 85.0, 2)                            # 低切，给低频让位
        x = soft_comp(x, thresh_db=-22.0, ratio=3.0, win_ms=25.0, smooth_ms=12.0)
        x = soft_comp(x, thresh_db=-14.0, ratio=4.0, win_ms=10.0, smooth_ms=6.0)
        # 响度归一 + 峰值收口，迭代 3 次收敛
        for _ in range(3):
            lufs = integrated_lufs(x)
            x = x * db2lin(target_mono - lufs)
            x, _gr = limit_peak(x, ceiling_db=target_mono + VO_CREST_DB,
                                lookahead_ms=4.0)
        lufs = float(integrated_lufs(x))
        peak = float(lin2db(np.max(np.abs(x))))
        i0 = int(round(ln["start"] * SR))                   # 样本级落位
        n = min(len(x), N - i0)
        bus[i0:i0 + n, 0] += x[:n]
        bus[i0:i0 + n, 1] += x[:n]
        info.append({"id": ln["id"], "place_sec": ln["start"],
                     "place_sample": i0,
                     "lufs_mono": round(lufs, 2),
                     "lufs_bus": round(lufs + 3.01, 2),
                     "peak_dbfs": round(peak, 2),
                     "crest_db": round(peak - lufs, 2),
                     "file_samples": len(ln["x"])})
    return bus, info


def duck_envelope(intervals, depth_db=DUCK_DB, pre=0.12, post=0.30):
    """人声段 BGM 压低包络（0..1 权重），返回线性增益曲线。"""
    w = np.zeros(N, dtype=np.float64)
    for s, e in intervals:
        i0 = max(0, int(round((s - pre) * SR)))
        i1 = min(N, int(round(s * SR)))
        j0 = min(N, int(round(e * SR)))
        j1 = min(N, int(round((e + post) * SR)))
        if i1 > i0:
            w[i0:i1] = np.maximum(w[i0:i1], cos_ramp(np.linspace(0, 1, i1 - i0, endpoint=False)))
        if j0 > i1:
            w[i1:j0] = 1.0
        if j1 > j0:
            u = np.linspace(0, 1, j1 - j0, endpoint=False)
            w[j0:j1] = np.maximum(w[j0:j1], 1.0 - cos_ramp(u))
    return 10.0 ** (-depth_db * w / 20.0), w


def merge_intervals(iv, gap=0.30):
    iv = sorted(iv)
    out = [list(iv[0])]
    for s, e in iv[1:]:
        if s - out[-1][1] < gap:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [tuple(x) for x in out]


# ---------------------------------------------------------------- 主流程
def main():
    TMPDIR.mkdir(exist_ok=True)
    keep = "--keep" in sys.argv
    do_mp3 = "--no-mp3" not in sys.argv
    trim_lead = "--trim-vo-lead" in sys.argv
    bgm_from = None
    if "--bgm-from" in sys.argv:
        bgm_from = Path(sys.argv[sys.argv.index("--bgm-from") + 1]).expanduser()
    report = {"generated_by": "audio/bgm_script.py", "params": {
        "sr": SR, "duration": DUR, "bpm": BPM, "duck_db": DUCK_DB,
        "vo_line_lufs": VO_LINE_LUFS, "bgm_lufs": BGM_LUFS, "mix_lufs": MIX_LUFS,
        "ceiling_db": CEIL_DB, "trim_vo_lead": trim_lead}}

    print("=" * 68)
    if bgm_from:
        print(f"1) 使用外部 BGM：{bgm_from}")
        bgm = load_external_bgm(bgm_from)
        report["external_bgm"] = str(bgm_from)
    else:
        print("1) 合成 BGM（120 BPM / 15 小节 / 30.0s）")
        bgm = render_bgm_float()
    for k, v in (("peak", float(np.max(np.abs(bgm)))),
                 ("rms", float(np.sqrt(np.mean(bgm ** 2))))):
        print(f"    BGM 总线 {k}: {lin2db(v):+.2f} dB")
    report["bgm_bus"] = {"peak_dbfs": round(float(lin2db(np.max(np.abs(bgm)))), 2)}

    print("2) BGM 母带 → bgm.wav（目标 %.1f LUFS）" % BGM_LUFS)
    bgm = soft_comp(bgm, thresh_db=BGM_BUS_COMP[0], ratio=BGM_BUS_COMP[1],
                    win_ms=60.0, smooth_ms=45.0)          # 收 impact 峰值，降 crest
    bgm_mastered, hist = master_to_lufs(bgm, BGM_LUFS, tag="bgm")
    bgm_mastered, gr = limit_peak(bgm_mastered, ceiling_db=-1.5)
    bgm_path = HERE / "bgm.wav"
    wav24_from_float(bgm_path, bgm_mastered)
    report["bgm_master"] = {"iterations": hist, "limit_gr_db": round(gr, 2)}
    bgm_ln = ffmpeg_loudnorm(bgm_path)
    print(f"    bgm.wav: I={bgm_ln['input_i']}LUFS  TP={bgm_ln['input_tp']}dBTP  "
          f"crest={float(bgm_ln['input_tp']) - float(bgm_ln['input_i']):.1f}dB")

    print("3) VO 处理 + 样本级落位")
    lines = load_vo_lines(trim_lead=trim_lead)
    vo_bus, vo_info = build_vo_bus(lines)
    report["vo"] = vo_info
    for v in vo_info:
        print(f"    line{v['id']}: place={v['place_sec']:.3f}s "
              f"({v['place_sample']} 采样) lufs_mono={v['lufs_mono']:.2f} "
              f"peak={v['peak_dbfs']:.2f}dBFS crest={v['crest_db']:.1f}dB")
    print(f"    VO 总线响度: {integrated_lufs(vo_bus):.2f} LUFS")
    report["vo_bus_lufs"] = round(integrated_lufs(vo_bus), 2)

    print("4) 人声段 BGM 压低（%.1f dB）+ 相加" % DUCK_DB)
    iv = merge_intervals([(l["start"], l["end"]) for l in lines])
    duck_gain, duck_w = duck_envelope(iv)
    bgm_ducked = bgm_mastered * duck_gain[:, None]
    mix = bgm_ducked + vo_bus

    # 人声段实测压低量
    voice_windows = [(l["start"] + 0.25, l["end"] - 0.25) for l in lines]
    d_vals = [window_lufs(bgm_mastered, a, b) - window_lufs(bgm_ducked, a, b)
              for a, b in voice_windows]
    silent_windows = [(0.0, 0.14), (28.7, 29.15)]
    d_sil = [window_lufs(bgm_mastered, a, b) - window_lufs(bgm_ducked, a, b)
             for a, b in silent_windows]
    print(f"    人声段压低: {np.mean(d_vals):.2f} dB（各段 {[round(v, 1) for v in d_vals]}）")
    print(f"    无人声段压低: {np.mean(d_sil):.2f} dB")
    report["duck"] = {"depth_db": DUCK_DB, "merged_intervals": iv,
                      "measured_voice_reduction_db": [round(v, 2) for v in d_vals],
                      "measured_silence_reduction_db": [round(v, 2) for v in d_sil]}

    print("5) 母带 mix.wav（低切 25Hz + 轻压缩 + 限幅 + 校准到 %.1f LUFS）" % MIX_LUFS)
    mix = hp(mix, 25.0, 2)
    mix = soft_comp(mix, thresh_db=-16.0, ratio=1.8, win_ms=60.0, smooth_ms=40.0)
    mix_mastered, hist = master_to_lufs(mix, MIX_LUFS, tag="mix")
    mix_path = HERE / "mix.wav"
    wav24_from_float(mix_path, mix_mastered)

    # 中间文件：VO stem（自检用）
    vo_stem = TMPDIR / "vo_stem.wav"
    write_wav_f32(vo_stem, vo_bus)

    print("6) 自检")
    checks = {}
    for name, p in (("bgm", bgm_path), ("mix", mix_path)):
        info = ffprobe_info(p)
        st = info["streams"][0]
        checks[name] = {
            "duration": float(info["format"]["duration"]),
            "sample_rate": int(st["sample_rate"]),
            "channels": int(st["channels"]),
            "codec": st["codec_name"],
            "bits": st.get("bits_per_sample"),
            "loudnorm": ffmpeg_loudnorm(p),
            "volumedetect": volumedetect(p),
        }
        print(f"    {name}.wav: {checks[name]['duration']:.6f}s  "
              f"{checks[name]['sample_rate']}Hz  {checks[name]['channels']}ch  "
              f"{checks[name]['codec']}/{checks[name]['bits']}bit  "
              f"peak={checks[name]['volumedetect']['max_volume']:.2f}dBFS")

    # 两遍法 loudnorm 复核（写到 _build，不覆盖交付文件）
    m1, m2 = ffmpeg_loudnorm_2pass(mix_path, TMPDIR / "mix_loudnorm_check.wav")
    checks["loudnorm_2pass"] = {"pass1": m1, "pass2": m2}
    print(f"    loudnorm 两遍法复核: pass1 I={m1['input_i']} TP={m1['input_tp']} | "
          f"pass2 I={m2['input_i']} TP={m2['input_tp']}")
    r128 = integrated_lufs(mix_mastered)
    crest = float(checks["mix"]["volumedetect"]["max_volume"]) - r128
    checks["mix_crest"] = {"r128_python": round(r128, 2), "crest_db": round(crest, 2)}
    print(f"    mix: 自实现 R128={r128:.2f}LUFS（ffmpeg {checks['mix']['loudnorm']['input_i']}）"
          f"  crest≈{crest:.1f}dB")

    # VO 落位复核（对 VO stem 做 silencedetect）
    sd = silencedetect(vo_stem, -45.0, 0.25)
    onsets = [t for kind, t in sd if kind == "end"]
    expected_speech = []
    for l in lines:
        idx = np.where(np.abs(l["x"]) > 0.004)[0]
        lead = idx[0] / SR if len(idx) else 0.0
        expected_speech.append(l["start"] + lead)
    pairs = []
    for exp in expected_speech:          # 句内停顿也会被检出，取最近的一个匹配
        got = min(onsets, key=lambda v: abs(v - exp)) if onsets else float("nan")
        pairs.append({"expected_speech_onset": round(exp, 3),
                      "detected_onset": round(got, 3),
                      "delta_ms": round((got - exp) * 1000, 1)})
    checks["vo_onsets"] = {"silencedetect": [[k, round(t, 3)] for k, t in sd],
                           "pairs": pairs}
    print("    VO 语音起点（silencedetect 实测 vs 期望）:")
    for p in pairs:
        print(f"      exp={p['expected_speech_onset']:.3f}s  got={p['detected_onset']:.3f}s"
              f"  Δ={p['delta_ms']:+.1f}ms")

    # mix 在人声时段确实有人声：VO stem 与 mix 的 K 加权电平
    probes = []
    for l in lines:
        a, b = l["start"] + 0.20, l["start"] + 0.60
        probes.append({"id": l["id"], "window": [round(a, 2), round(b, 2)],
                       "vo_stem_db": round(window_lufs(vo_bus, a, b), 1),
                       "mix_db": round(window_lufs(mix_mastered, a, b), 1)})
    checks["vo_presence_in_mix"] = probes
    print("    mix 中 VO 存在性（0.4s 窗）: " +
          ", ".join(f"{p['id']}:{p['mix_db']:.1f}dB" for p in probes))

    # 片尾 28.3–30.0 只有 BGM
    tail = {"vo_stem_28_3_30": round(window_lufs(vo_bus, 28.3, 30.0), 1),
            "mix_28_3_30": round(window_lufs(mix_mastered, 28.3, 30.0), 1),
            "bgm_28_3_30": round(window_lufs(bgm_mastered, 28.3, 30.0), 1)}
    checks["tail"] = tail
    print(f"    片尾 28.3–30.0: VO={tail['vo_stem_28_3_30']:.1f}dB  "
          f"BGM={tail['bgm_28_3_30']:.1f}dB  mix={tail['mix_28_3_30']:.1f}dB")

    # 段落结构能量（BGM 每段 K 加权电平）
    secs = [("intro", 0.0, INTRO_END), ("drop", INTRO_END, BREAK_OUT),
            ("break", BREAK_OUT, BREAK_IN), ("groove2", BREAK_IN, BUILD),
            ("build", BUILD, LIFT), ("lift", LIFT, END_SEC),
            ("end", END_SEC, FINALE), ("finale", FINALE, DUR)]
    checks["bgm_sections"] = {n: round(window_lufs(bgm_mastered, a, b), 1)
                              for n, a, b in secs}
    print("    BGM 分段电平: " +
          ", ".join(f"{n}={v}dB" for n, v in checks["bgm_sections"].items()))

    report["checks"] = checks

    if do_mp3:
        print("7) 导出 bgm_only.mp3")
        run([FFMPEG, "-y", "-v", "error", "-i", str(bgm_path), "-c:a", "libmp3lame",
             "-b:a", "192k", "-ar", str(SR), str(HERE / "bgm_only.mp3")])
        mp = ffprobe_info(HERE / "bgm_only.mp3")
        report["mp3"] = {"duration": float(mp["format"]["duration"]),
                         "bit_rate": mp["streams"][0].get("bit_rate")}
        print(f"    bgm_only.mp3: {report['mp3']['duration']:.3f}s")

    (TMPDIR / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n测量数据 → {TMPDIR / 'report.json'}")
    print("交付：bgm.wav / mix.wav / bgm_script.py / README.md"
          + (" / bgm_only.mp3" if do_mp3 else ""))
    if not keep:
        for f in ("_probe.wav", "_tmp_f32.wav", "mix_loudnorm_check.wav", "vo_stem.wav"):
            p = TMPDIR / f
            if p.exists():
                p.unlink()
        print("（中间文件已清理；加 --keep 可保留）")


if __name__ == "__main__":
    main()
