/* SWISS MOTION — 10 s test film
 * Style: lemo-opuscar styles/swiss-motion/STYLE.md (MIT)
 * Contract: window.DUR / window.render(t) / window.READY / window.TEXTS(t)
 * Deterministic: no Date.now(), no unseeded random, no state carried between frames.
 *
 * Timeline (120 BPM, 0.5 s beat, 8th = 0.25 s)
 *   0.00 paper wipe · 0.125 dot · 0.50 columns grow from the dot · 1.00 masthead
 *   1.50 giant "3" climbs · 2.00 / 2.50 / 3.00 the three rules snap
 *   2.00-4.00 beat counter fills, one 8th per hit
 *   3.50 camera push · 4.00 the exception leaves the grid (linear) · 5.00 silence
 *   5.25 knife cut through the "3" · 5.50 "66" climbs in
 *   6.25 wall of 66 artifacts · 6.80 end line · 9.40 final cut · 10.0 empty grid
 */
(() => {
  'use strict';

  const DUR = 10.0;
  const BPM = 120;
  const BEAT = 60 / BPM;
  const C = {
    page: '#EAE9E5', paper: '#FFFFFF', ink: '#111111',
    grey: '#6B6A66', light: '#B8B6AF', hair: '#D6D4CD', signal: '#E30613',
  };
  const M = 96, GUT = 24, COLS = 12;
  const W = 1920, H = 1080;          // design frame

  let cv, cx, vw, vh, colW;

  // ---------------------------------------------------------------- math
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
  const lin = (x) => clamp(x, 0, 1);

  function bezierX(x) {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const xt = 3 * (1 - t) * (1 - t) * t * 0.7 + 3 * (1 - t) * t * t * 0.2 + t * t * t;
      const dx = 3 * (1 - t) * (1 - t) * 0.7 + 6 * (1 - t) * t * (0.2 - 0.7) + 3 * t * t * (1 - 0.2);
      if (Math.abs(dx) < 1e-6) break;
      t = clamp(t - (xt - x) / dx, 0, 1);
    }
    return t;
  }
  function ease(x) {
    const t = bezierX(clamp(x, 0, 1));
    return 3 * (1 - t) * t * t + t * t * t;   // y of cubic-bezier(.7, 0, .2, 1)
  }

  // ---------------------------------------------------------------- camera
  function camAt(t) {
    const inP = ease(seg(t, 3.5, 4.0));
    const backP = ease(seg(t, 6.0, 6.5));
    return { cx: 1300, cy: 700, s: 1 + 0.05 * inP * (1 - backP) };
  }
  function applyCam(c, t) {
    const { cx: ax, cy: ay, s } = camAt(t);
    c.translate(ax, ay); c.scale(s, s); c.translate(-ax, -ay);
  }
  function toScreen(x, y, t) {
    const { cx: ax, cy: ay, s } = camAt(t);
    return { x: ax + (x - ax) * s, y: ay + (y - ay) * s };
  }

  // ---------------------------------------------------------------- type
  const STACK = "'Inter','Noto Sans SC',sans-serif";
  function setFont(size, weight, tracking) {
    cx.font = `${weight} ${size}px ${STACK}`;
    cx.letterSpacing = (tracking || 0) + 'em';
  }
  function measure(text, size, weight, tracking) {
    setFont(size, weight, tracking || 0);
    return cx.measureText(text).width;
  }

  // clip-reveal: words rise out of a clip rect from below the baseline
  function text(s, x, y, o) {
    o = o || {};
    const size = o.size || 16, weight = o.weight || 400, tracking = o.tracking || 0;
    setFont(size, weight, tracking);
    cx.fillStyle = o.color || C.ink;
    const w = cx.measureText(s).width;
    const xx = o.align === 'right' ? x - w : x;
    const p = o.clip === undefined ? 1 : ease(o.clip);
    if (p <= 0) return w;
    const h = size * 1.24;
    cx.save();
    cx.beginPath();
    cx.rect(xx - size * 0.35, y - h * p, w + size * 0.7, h * p + 1);
    cx.clip();
    if (o.halo) {
      cx.strokeStyle = o.haloColor || C.paper;
      cx.lineWidth = o.halo;
      cx.lineJoin = 'round';
      cx.strokeText(s, xx, y + (1 - p) * size * 0.42);
    }
    cx.fillText(s, xx, y + (1 - p) * size * 0.42);
    cx.restore();
    return w;
  }

  // ---------------------------------------------------------------- paper & grid
  function drawPaper(t) {
    cx.fillStyle = C.page;
    cx.fillRect(0, 0, vw, vh);
    const p = ease(seg(t, 0.0, 0.3));
    cx.save();
    cx.beginPath();
    cx.rect(48, 48, (W - 96) * p, H - 96);
    cx.clip();
    cx.fillStyle = C.paper;
    cx.fillRect(48, 48, W - 96, H - 96);
    cx.restore();
  }

  const TOP = 168, BOT = 984;

  function drawGrid(t) {
    const dotP = ease(seg(t, 0.125, 0.25));
    const grow = ease(seg(t, 0.5, 1.0));
    cx.strokeStyle = C.hair;
    cx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
      const x = Math.round(M + i * (colW + GUT)) + 0.5;
      const h = (BOT - TOP) * grow;
      if (h <= 0) continue;
      cx.beginPath(); cx.moveTo(x, TOP); cx.lineTo(x, TOP + h); cx.stroke();
    }
    const tp = ease(seg(t, 1.0, 1.25));
    const bp = ease(seg(t, 0.75, 1.0));
    cx.strokeStyle = C.ink;
    if (tp > 0) { cx.beginPath(); cx.moveTo(M, TOP + 0.5); cx.lineTo(M + (W - 2 * M) * tp, TOP + 0.5); cx.stroke(); }
    if (bp > 0) { cx.beginPath(); cx.moveTo(M, BOT + 0.5); cx.lineTo(M + (W - 2 * M) * bp, BOT + 0.5); cx.stroke(); }
    if (dotP > 0) {
      const s = 9 * dotP;
      cx.fillStyle = C.ink;
      cx.fillRect(M - s / 2, TOP - s / 2, s, s);
    }
  }

  // ---------------------------------------------------------------- content
  function drawMasthead(t) {
    const p = ease(seg(t, 1.0, 1.25));
    if (p <= 0) return;
    text('LEMO-OPUSCAR', M, 136, { size: 18, weight: 700, tracking: 0.14, clip: p });
    text('CODE-MADE FILM · TEST 10 s', W - M, 136, { size: 13, weight: 400, tracking: 0.16, color: C.grey, align: 'right', clip: p });
  }

  const COL2 = 242;                 // second column: the rules are grid-aligned
  const RULES = [
    { n: '01', t: '一切上网格', note: '12 COL · 24 PX BASELINE', arrive: 2.0 },
    { n: '02', t: '一切踩节拍', note: '120 BPM · 8TH SNAPS', arrive: 2.5 },
    { n: '03', t: '留一个例外', note: 'ONE ELEMENT, OFF GRID', arrive: 3.0 },
  ];
  const RULE_Y = [286, 382, 478];

  function drawRules(t) {
    RULES.forEach((r, i) => {
      const p = ease(seg(t, r.arrive - 0.22, r.arrive));
      if (p <= 0) return;
      const y = RULE_Y[i];
      text(r.n, M, y - 22, { size: 13, weight: 400, tracking: 0.18, color: C.grey, clip: p });
      text(r.t, COL2, y, { size: 52, weight: 700, tracking: 0.01, clip: p });
      text(r.note, COL2, y + 30, { size: 12, weight: 400, tracking: 0.14, color: C.light, clip: p });
    });
  }

  // beat counter: one 8th per hit, 2.0 -> 4.0
  function drawBeatCounter(t) {
    const x0 = COL2, y = 556, barH = 30, gap = 12, barW = 4;
    for (let i = 0; i < 8; i++) {
      const a = 2.0 + i * 0.25;
      const p = ease(seg(t, a, a + 0.07));
      cx.fillStyle = C.hair;
      cx.fillRect(x0 + i * (barW + gap), y, barW, barH);
      if (p > 0) {
        cx.fillStyle = C.ink;
        const hh = barH * p;
        cx.fillRect(x0 + i * (barW + gap), y + (barH - hh), barW, hh);
      }
    }
  }

  // big numerals climb in eased steps, one band at a time (single clip path: no seams)
  function numeralBands(s, rightX, y, size, p) {
    setFont(size, 700, -0.02);
    const w = cx.measureText(s).width;
    const xx = rightX - w;
    const capH = size * 0.74, bandH = capH / 6;
    cx.fillStyle = C.ink;
    cx.save();
    cx.beginPath();
    for (let i = 0; i < 6; i++) {
      const local = ease(clamp((p - i * 0.055) / (1 - 5 * 0.055), 0, 1));
      if (local <= 0) continue;
      const bandTop = y - capH + (5 - i) * bandH;
      cx.rect(xx - size * 0.04, bandTop, w + size * 0.08, bandH * local + 0.6);
    }
    cx.clip();
    cx.fillText(s, xx, y + (1 - p) * 34);
    cx.restore();
    return { x: xx, w, top: y - capH, bottom: y };
  }

  function drawGiant(t) {
    const rightX = W - M, baseline = 620;
    const p3 = ease(seg(t, 1.5, 2.05));
    const cut = seg(t, 5.25, 5.375);
    const drop = ease(seg(t, 5.375, 5.625));
    if (t < 5.7 && p3 > 0) {
      cx.save();
      cx.translate(0, baseline); cx.scale(1, Math.max(0.0001, 1 - drop)); cx.translate(0, -baseline);
      const b = numeralBands('3', rightX, baseline, 620, p3);
      if (cut > 0 && cut < 1) {
        const yLine = b.top + (b.bottom - b.top) * 0.45;
        cx.strokeStyle = C.ink; cx.lineWidth = 3;
        cx.beginPath();
        cx.moveTo(rightX - 430, yLine);
        cx.lineTo(rightX - 430 + 450 * ease(cut), yLine);
        cx.stroke();
      }
      cx.restore();
      const pc = ease(seg(t, 1.75, 2.05));
      text('条规则', rightX, 668, { size: 26, weight: 700, tracking: 0.02, align: 'right', clip: pc });
    }
    const p66 = ease(seg(t, 5.5, 6.25));
    if (p66 > 0) numeralBands('66', rightX, baseline, 540, p66);
  }

  // wall of 66 artifacts, bottom right
  const TILE = 26, TGAP = 10, WCOLS = 11, WROWS = 6;
  function wallOrigin() {
    return { x: W - M - (WCOLS * TILE + (WCOLS - 1) * TGAP), y: 716 };
  }
  function tileRect(i) {
    const o = wallOrigin();
    return { x: o.x + (i % WCOLS) * (TILE + TGAP), y: o.y + Math.floor(i / WCOLS) * (TILE + TGAP) };
  }
  function drawWall(t) {
    if (t < 6.25) return;
    const step = 0.65 / 66;
    for (let i = 0; i < 66; i++) {
      const a = 6.25 + i * step;
      const p = ease(seg(t, a, a + 0.08));
      if (p <= 0) continue;
      const r = tileRect(i);
      const hh = TILE * p;
      cx.fillStyle = (i === 65) ? C.signal : C.ink;
      cx.fillRect(r.x, r.y + (TILE - hh), TILE, hh);
    }
    const o = wallOrigin();
    const pl = ease(seg(t, 6.98, 7.18));
    if (pl > 0) text('66 × STYLE.md', o.x, o.y + WROWS * TILE + (WROWS - 1) * TGAP + 34,
      { size: 12, weight: 400, tracking: 0.14, color: C.grey, clip: pl });
  }

  // ---------------------------------------------------------------- the exception
  const P = { x0: 1180, y0: 790, x1: 1690, y1: 300, x2: 1798, y2: 880, s: 28, landAt: 6.88 };
  function exceptionAt(t) {
    if (t < 3.2) return { x: P.x0, y: P.y0, rot: 0, onGrid: true, vis: false };
    if (t < 4.0) return { x: P.x0, y: P.y0, rot: 0, onGrid: true, vis: true };
    if (t < 5.2) {
      const p = lin((t - 4.0) / 1.2);
      return { x: P.x0 + (P.x1 - P.x0) * p, y: P.y0 + (P.y1 - P.y0) * p, rot: 90 * p, onGrid: false, vis: true };
    }
    if (t < 5.5) return { x: P.x1, y: P.y1, rot: 90, onGrid: false, vis: true };
    if (t < P.landAt) {
      const p = lin((t - 5.5) / (P.landAt - 5.5));
      return { x: P.x1 + (P.x2 - P.x1) * p, y: P.y1 + (P.y2 - P.y1) * p, rot: 90 + 180 * p, onGrid: false, vis: true };
    }
    return { x: P.x2, y: P.y2, rot: 270, onGrid: false, vis: false };   // it is the wall's 66th tile now
  }
  function drawException(t) {
    // the hole it left behind
    const ghost = ease(seg(t, 4.6, 4.9));
    if (ghost > 0) {
      cx.strokeStyle = C.hair; cx.lineWidth = 1;
      cx.strokeRect(P.x0 + 0.5, P.y0 + 0.5, P.s - 1, P.s - 1);
    }
    const e = exceptionAt(t);
    if (!e.vis) return;
    cx.save();
    cx.translate(e.x + P.s / 2, e.y + P.s / 2);
    cx.rotate((e.rot * Math.PI) / 180);
    if (e.onGrid === false) {                    // a paper gap, so the red reads on ink
      cx.fillStyle = C.paper;
      cx.fillRect(-(P.s + 7) / 2, -(P.s + 7) / 2, P.s + 7, P.s + 7);
    }
    cx.fillStyle = C.signal;
    cx.fillRect(-P.s / 2, -P.s / 2, P.s, P.s);
    cx.restore();
    const op = ease(seg(t, 3.2, 3.45));
    if (op > 0 && t < 6.2) {
      const label = e.onGrid ? 'ON GRID' : 'OFF GRID';
      const lw = measure(label, 12, 600, 0.16);
      const left = e.x + P.s + 14;
      const halo = e.onGrid ? 0 : 3;
      if (left + lw > W - M) {
        text(label, e.x - 14, e.y + P.s / 2 + 4, { size: 12, weight: 600, tracking: 0.16, color: e.onGrid ? C.grey : C.ink, halo, align: 'right', clip: op });
      } else {
        text(label, left, e.y + P.s / 2 + 4, { size: 12, weight: 600, tracking: 0.16, color: e.onGrid ? C.grey : C.ink, halo, clip: op });
      }
    }
  }

  // ---------------------------------------------------------------- captions & ending
  function drawCaptions(t) {
    const p = ease(seg(t, 6.0, 6.25));
    if (p <= 0) return;
    text('种风格 · 逐帧渲染', W - M, 668, { size: 24, weight: 700, tracking: 0.02, align: 'right', clip: p });
  }

  function drawEndLine(t) {
    const p = ease(seg(t, 6.8, 7.05));
    if (p <= 0) return;
    cx.strokeStyle = C.ink; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(M, 862); cx.lineTo(M + 300 * p, 862); cx.stroke();
    text('用代码拍片', M, 930, { size: 46, weight: 700, tracking: 0.02, clip: p });
  }

  function drawFinalCut(t) {
    if (t < 9.4) return;
    const p = ease(seg(t, 9.4, 9.5));
    cx.strokeStyle = C.ink; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(M, 560); cx.lineTo(M + (W - 2 * M) * p, 560); cx.stroke();
  }

  // ---------------------------------------------------------------- frame
  function draw(t) {
    drawPaper(t);
    drawGrid(t);
    cx.save();
    applyCam(cx, t);
    // the system closes at 9.45 (everything but the end line leaves upward)
    const ex = ease(seg(t, 9.45, 9.65));
    if (ex > 0) {
      cx.translate(0, -70 * ex);
      cx.beginPath(); cx.rect(0, 120, W, 900 * (1 - ex)); cx.clip();
    }
    drawMasthead(t);
    drawRules(t);
    drawBeatCounter(t);
    drawGiant(t);
    drawWall(t);
    drawException(t);
    cx.restore();
    // end line, then it leaves too
    cx.save();
    applyCam(cx, t);
    const ex2 = ease(seg(t, 9.78, 9.92));
    if (ex2 > 0) {
      cx.translate(0, -46 * ex2);
      cx.beginPath(); cx.rect(0, 760, W, 260 * (1 - ex2)); cx.clip();
    }
    drawCaptions(t);
    drawEndLine(t);
    drawFinalCut(t);
    cx.restore();
  }

  // ---------------------------------------------------------------- TEXTS (reading-time contract)
  function boxes(t) {
    const out = [];
    const push = (id, s, x, y, size, weight, align, t0, t1, tracking) => {
      if (t < t0 || t > t1) return;
      const w = measure(s, size, weight || 400, tracking || 0);
      const sx = align === 'right' ? x - w : x;
      const a = toScreen(sx, y - size * 0.78, t);
      const b = toScreen(sx + w, y + size * 0.26, t);
      out.push({ id, text: s, x0: a.x, y0: a.y, x1: b.x, y1: b.y });
    };
    push('mast', 'LEMO-OPUSCAR', M, 136, 18, 700, 'left', 1.25, 9.45, 0.14);
    RULES.forEach((r, i) => push('rule' + (i + 1), r.t, COL2, RULE_Y[i], 52, 700, 'left', r.arrive, 9.45, 0.01));
    push('giant3', '3', W - M, 620, 620, 700, 'right', 2.1, 5.375, -0.02);
    push('giant3cap', '条规则', W - M, 668, 26, 700, 'right', 2.05, 5.375, 0.02);
    push('giant66', '66', W - M, 620, 540, 700, 'right', 6.3, 9.45, -0.02);
    push('cap66', '种风格 · 逐帧渲染', W - M, 668, 24, 700, 'right', 6.25, 9.45, 0.02);
    const o = wallOrigin();
    push('wallnote', '66 × STYLE.md', o.x, o.y + WROWS * TILE + (WROWS - 1) * TGAP + 34, 12, 400, 'left', 7.2, 9.45, 0.14);
    push('endline', '用代码拍片', M, 930, 46, 700, 'left', 7.1, 9.78, 0.02);
    return out;
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    cv = document.getElementById('c');
    cx = cv.getContext('2d');
    vw = window.innerWidth; vh = window.innerHeight;
    cv.width = vw; cv.height = vh;
    cv.style.width = vw + 'px';
    cv.style.height = vh + 'px';
    colW = (W - 2 * M - (COLS - 1) * GUT) / COLS;
    const sx = vw / W, sy = vh / H;
    window.DUR = DUR;
    window.EV = [];
    window.render = (t) => {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, vw, vh);
      cx.setTransform(sx, 0, 0, sy, 0, 0);
      draw(clamp(t, 0, DUR));
    };
    window.TEXTS = (t) => boxes(clamp(t, 0, DUR));
    window.render(0);
    const cn = '条规则一切上网格踩节拍留个例外种风格逐帧渲染用代码拍片';
    Promise.all([
      document.fonts.load('700 100px Inter', 'LEMO-OPUSCAR 0123456789'),
      document.fonts.load('400 100px Inter', 'LEMO-OPUSCAR 0123456789'),
      document.fonts.load('600 100px Inter', 'ON GRID OFF GRID'),
      document.fonts.load('700 100px "Noto Sans SC"', cn),
      document.fonts.load('400 100px "Noto Sans SC"', cn),
    ]).then(() => { window.render(0); window.READY = true; })
      .catch((e) => { console.error('font load failed', e); window.READY = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
