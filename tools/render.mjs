import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { serve } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ONLY_FRAMES = Number(process.env.ONLY_FRAMES || 0);   // 0 = full render
const START_AT = Number(process.env.START_AT || 0);          // seconds
const QUALITY = Number(process.env.QUALITY || 88);
const FILM = process.env.FILM || 'timeline.json';
const OUT_FILE = path.join(OUT_DIR, process.env.OUT_NAME || 'silent.mp4');

function ffmpeg(args, name) {
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  p.on('error', (e) => {
    console.error(`[${name}] spawn error:`, e.message);
  });
  return p;
}

const { server, port } = await serve(0, ROOT);
console.log(`[server] http://127.0.0.1:${port}`);

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
    '--mute-audio',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
  ],
});

const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.error('[page error]', m.text());
});
page.on('pageerror', (e) => console.error('[page exception]', e.message));

await page.setViewport({ width: 854, height: 480, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/index.html?t=${FILM}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
const meta = await page.evaluate(() => window.__meta);
console.log('[meta]', FILM, JSON.stringify(meta));

const totalFrames = ONLY_FRAMES > 0
  ? ONLY_FRAMES
  : Math.round(meta.duration * meta.fps);
const startFrame = Math.round(START_AT * meta.fps);
console.log(`[render] frames=${totalFrames} start=${startFrame} fps=${meta.fps} out=${OUT_FILE}`);

const enc = ffmpeg([
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(meta.fps), '-i', 'pipe:0',
  '-c:v', 'libx264', '-preset', 'medium', '-tune', 'film',
  '-crf', '24', '-maxrate', '1500k', '-bufsize', '3000k',
  '-pix_fmt', 'yuv420p', '-g', String(meta.fps * 2),
  '-movflags', '+faststart',
  OUT_FILE,
], 'ffmpeg');

const writeStdin = async (buf) => {
  if (!enc.stdin.write(buf)) {
    await new Promise((r) => enc.stdin.once('drain', r));
  }
};

const t0 = Date.now();
for (let i = 0; i < totalFrames; i++) {
  const t = (startFrame + i) / meta.fps;
  await page.evaluate((tt) => window.setTime(tt), t);
  const shot = await page.screenshot({ type: 'jpeg', quality: QUALITY, clip: { x: 0, y: 0, width: 854, height: 480 } });
  await writeStdin(shot);
  if (i % 120 === 0 || i === totalFrames - 1) {
    const el = (Date.now() - t0) / 1000;
    const rate = (i + 1) / Math.max(el, 0.001);
    const eta = (totalFrames - i - 1) / Math.max(rate, 0.001);
    console.log(`[frame] ${i + 1}/${totalFrames} ${rate.toFixed(2)} fps  eta ${(eta / 60).toFixed(1)} min  t=${t.toFixed(2)}s`);
  }
}

enc.stdin.end();
await new Promise((resolve, reject) => {
  enc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code))));
});

await browser.close();
server.close();

const size = fs.statSync(OUT_FILE).size;
console.log(`[done] ${OUT_FILE} ${(size / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
