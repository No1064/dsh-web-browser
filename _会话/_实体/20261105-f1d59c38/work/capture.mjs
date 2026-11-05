import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const URL_SCENE = 'http://127.0.0.1:8777/work/scene.html';
const OUT_DIR = fileURLToPath(new URL('./previews/', import.meta.url));
const FRAMES_DIR = fileURLToPath(new URL('./frames/', import.meta.url));

const args = process.argv.slice(2);
const mode = args[0] || 'preview';           // preview | frames
const dpr = Number((args.find(a => a.startsWith('--dpr=')) || '--dpr=1').split('=')[1]);
const times = (args.find(a => a.startsWith('--times=')) || '').split('=')[1];
const fps = Number((args.find(a => a.startsWith('--fps=')) || '--fps=30').split('=')[1]);
const start = Number((args.find(a => a.startsWith('--start=')) || '--start=0').split('=')[1]);
const end = Number((args.find(a => a.startsWith('--end=')) || '--end=30').split('=')[1]);
const offset = Number((args.find(a => a.startsWith('--offset=')) || '--offset=0').split('=')[1]);

const get = url => new Promise((res, rej) => {
  http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { res, rej } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (mode === 'frames') fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const profile = '/tmp/chrome-cdp-' + Date.now();
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--disable-crash-reporter', '--disable-breakpad',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    '--window-size=1080,1920',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  let targets = null;
  for (let i = 0; i < 100; i++) {
    await sleep(150);
    try {
      const list = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
      const page = list.find(x => x.type === 'page');
      if (page) { targets = page; break; }
    } catch { }
  }
  if (!targets) throw new Error('no chrome target');

  const cdp = await CDP.connect(targets.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1080, height: 1920, deviceScaleFactor: dpr, mobile: false,
  });
  await cdp.send('Page.navigate', { url: URL_SCENE });

  // wait ready
  let ready = false;
  for (let i = 0; i < 300; i++) {
    await sleep(120);
    const r = await cdp.send('Runtime.evaluate', { expression: 'window.__ready===true ? "y" : (window.__err||"n")', returnByValue: true });
    if (r.result.value === 'y') { ready = true; break; }
    if (r.result.value && r.result.value !== 'n') throw new Error('scene error: ' + r.result.value);
  }
  if (!ready) throw new Error('scene not ready');
  await sleep(400);

  const shot = async (t, file, fmt = 'png') => {
    const ev = await cdp.send('Runtime.evaluate', { expression: `window.renderAt(${t}); 1` });
    if (ev.exceptionDetails) console.log('RENDER ERROR', JSON.stringify(ev.exceptionDetails.exception && ev.exceptionDetails.exception.description || ev.exceptionDetails.text));
    await sleep(16);
    const res = await cdp.send('Page.captureScreenshot', {
      format: fmt, quality: fmt === 'jpeg' ? 94 : undefined, fromSurface: true, captureBeyondViewport: false,
    });
    fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  };

  if (mode === 'preview') {
    const ts = (times || '1,2,4,5.5,7.5,9,11,13,15.5,18,21,22,25,27').split(',').map(Number);
    for (const t of ts) {
      const f = OUT_DIR + `t_${t.toFixed(2).padStart(5, '0')}.png`;
      await shot(t, f, 'png');
      console.log('preview', t, f);
    }
  } else {
    const total = Math.round((end - start) * fps);
    const t0 = Date.now();
    for (let i = 0; i < total; i++) {
      const t = start + i / fps;
      const f = FRAMES_DIR + 'f_' + String(i + offset).padStart(5, '0') + '.jpg';
      await shot(t, f, 'jpeg');
      if (i % 60 === 0) console.log('frame', i + '/' + total, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    console.log('done', total, 'frames in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  cdp.close();
  chrome.kill('SIGKILL');
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
