import * as THREE from 'three';
const TL = new URLSearchParams(location.search).get('t') || 'timeline.json';
const visualsMod = TL.includes('pirates') ? await import('./visuals-pirates.js') : await import('./visuals.js');
const buildScene = visualsMod.buildScene;

const FPS = 24;
const SCENE_SECONDS = 10;
const W = 854;
const H = 480;

const canvas = document.getElementById('c');
const subtitleEl = document.getElementById('subtitle');
const sceneNoEl = document.getElementById('sceneNo');
const sceneNameEl = document.getElementById('sceneName');
const fadeEl = document.getElementById('fade');
const timecodeEl = document.getElementById('timecode');
const progressEl = document.getElementById('progress');
const wmEl = document.getElementById('wmText');
const stageEl = document.getElementById('stage');

const CAM_DIST = {
  starfield: 210, particles: 150, torusKnot: 115, wave: 160, helix: 145,
  globeDots: 135, terrain: 200, cityBlocks: 180, shards: 160, tunnel: 95,
  ribbon: 160, vortex: 165, crystal: 150, gateArch: 130, blobMorph: 105,
  lattice: 175, ringsWorld: 165, fractalTree: 165,
};

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, W / H, 0.5, 2000);

let timeline = null;
let currentIndex = -1;
let currentBuilt = null;

function disposeCurrent() {
  if (!currentBuilt) return;
  currentBuilt.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
  scene.remove(currentBuilt.group);
  currentBuilt = null;
}

function ensureScene(idx) {
  if (idx === currentIndex) return;
  disposeCurrent();
  const s = timeline.scenes[idx];
  currentIndex = idx;
  const seed = 13 + idx * 97;
  currentBuilt = buildScene(s.type, s.palette, seed);
  scene.add(currentBuilt.group);

  // background wash from palette
  const [bg, mid, a1, a2] = s.palette;
  stageEl.style.background =
    `radial-gradient(circle at 50% 58%, ${mix(mid, a1, 0.35)} 0%, ${mid} 38%, ${bg} 74%, #000003 100%)`;
  scene.fog = new THREE.Fog(new THREE.Color(bg), 120, 420);

  sceneNoEl.textContent = String(idx + 1).padStart(2, '0');
  sceneNameEl.textContent = s.type.toUpperCase();
  subtitleEl.textContent = s.mm;
}

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
function mix(a, b, t) {
  _c1.set(a);
  _c2.set(b);
  return '#' + _c1.lerp(_c2, t).getHexString();
}

function camRig(cam, s, tl, idx) {
  const d = CAM_DIST[s.type] ?? 150;
  const p = tl / SCENE_SECONDS;
  switch (cam) {
    case 'orbit': {
      const a = tl * 0.28 + idx;
      const r = d * (0.95 - p * 0.22);
      camera.position.set(Math.cos(a) * r, 34 + Math.sin(tl * 0.5) * 16 + p * 10, Math.sin(a) * r);
      camera.lookAt(0, Math.sin(tl * 0.6) * 5, 0);
      break;
    }
    case 'crane': {
      const a = tl * 0.16 + idx;
      const r = d * (0.9 - p * 0.18);
      camera.position.set(Math.cos(a) * r * 0.7, -30 + p * 130, Math.sin(a) * r * 0.7);
      camera.lookAt(0, -10 + p * 25, 0);
      break;
    }
    case 'flythrough': {
      const z = d * 0.95 - p * d * 1.5;
      camera.position.set(Math.sin(tl * 0.35) * 28, 22 + Math.sin(tl * 0.5) * 12, z);
      camera.lookAt(Math.sin(tl * 0.25) * 12, 0, z - 120);
      break;
    }
    default: { // dolly
      const r = d * (1.02 - p * 0.55);
      camera.position.set(Math.sin(tl * 0.2) * 22, 26 - p * 12, r);
      camera.lookAt(0, Math.sin(tl * 0.4) * 4, 0);
    }
  }
  camera.updateProjectionMatrix();
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function setTime(t) {
  const idx = Math.min(timeline.scenes.length - 1, Math.floor(t / SCENE_SECONDS));
  const tl = t - idx * SCENE_SECONDS;
  ensureScene(idx);
  const s = timeline.scenes[idx];

  if (currentBuilt.update) currentBuilt.update(tl);

  camRig(s.cam, s, tl, idx);
  renderer.render(scene, camera);

  // subtitle in/out
  const sIn = clamp01((tl - 0.55) / 0.45);
  const sOut = clamp01((8.85 - tl) / 0.45);
  subtitleEl.style.opacity = String(Math.min(sIn, sOut));

  // dip to black at cuts
  const fIn = clamp01((0.34 - tl) / 0.34);
  const fOut = clamp01((tl - (SCENE_SECONDS - 0.22)) / 0.22);
  fadeEl.style.opacity = String(Math.max(fIn, fOut) * 0.92);

  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  timecodeEl.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  progressEl.style.width = `${(t / (timeline.scenes.length * SCENE_SECONDS)) * 100}%`;
}

async function boot() {
  timeline = await (await fetch('/' + TL)).json();
  wmEl.textContent = timeline.watermark;
  if (await document.fonts.ready) { /* fonts loaded */ }
  await document.fonts.load('400 25px MM');
  await document.fonts.load('700 15px MM');
  await document.fonts.load('700 13px EN');
  setTime(0);
  window.setTime = (t) => { setTime(t); return true; };
  window.__meta = {
    fps: FPS, width: W, height: H, sceneSeconds: SCENE_SECONDS,
    sceneCount: timeline.scenes.length,
    duration: timeline.scenes.length * SCENE_SECONDS,
  };
  window.__ready = true;
}

boot();
