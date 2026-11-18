import * as THREE from 'three';
import { rng, noise3, glow, pointCloud, addLights } from './visuals.js';

const TAU = Math.PI * 2;

function sail(w, h, color, bulge = 1) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 10);
  const pos = geo.attributes.position;
  const base = pos.array.slice();
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const k = (1 - Math.abs(x) / (w / 2)) * (1 - Math.abs(y) / (h / 2));
    pos.array[i * 3 + 2] = Math.cos((x / w) * Math.PI) * 3.2 * bulge * (0.4 + k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, glow(color, 0.25, { opacity: 0.96 }));
}

export const builders = {};

// ------------------------------------------------------------------ ship
builders.pirateShip = ({ palette }) => {
  const group = new THREE.Group();
  const hullMat = glow(palette[1], 0.28);
  const trimMat = glow(palette[3], 1.15);
  const sailMat = '#f3e9d2';

  const hull = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 62), hullMat);
  hull.position.y = -4;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(15, 22, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.position.set(0, -4, 40);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 1.4, 58), glow(palette[1], 0.4));
  deck.position.y = 1.2;

  // gunwale stripes
  for (const sx of [-15.4, 15.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 60), trimMat);
    rail.position.set(sx, 2.4, 0);
    group.add(rail);
  }
  group.add(hull, bow, deck);

  // portholes (glowing)
  const portGeo = new THREE.SphereGeometry(1.05, 12, 12);
  const portMat = glow(palette[3], 2.2);
  for (let i = 0; i < 6; i++) {
    for (const sx of [-15.2, 15.2]) {
      const p = new THREE.Mesh(portGeo, portMat);
      p.position.set(sx, 0, -22 + i * 9);
      group.add(p);
    }
  }

  // masts + sails
  const masts = [];
  const sailMeshes = [];
  const mastData = [
    { z: 16, h: 62, sails: 3 },
    { z: -14, h: 48, sails: 2 },
  ];
  for (const m of mastData) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, m.h, 12), glow(palette[1], 0.35));
    mast.position.set(0, m.h / 2 + 1, m.z);
    group.add(mast);
    masts.push(mast);
    for (let s = 0; s < m.sails; s++) {
      const w = 30 - s * 5;
      const h = 13;
      const sm = sail(w, h, sailMat, 1);
      sm.rotation.y = Math.PI / 2;
      sm.position.set(1.6, m.h - 10 - s * 15, m.z);
      group.add(sm);
      sailMeshes.push(sm);
    }
  }

  // pirate flag
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(12, 7, 6, 6), glow('#1a1a1a', 0.2, { opacity: 1 }));
  flag.rotation.y = Math.PI / 2;
  flag.position.set(1.6, 62, 16);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 12), glow('#ffffff', 0.9));
  skull.position.set(2.6, 63, 16);
  group.add(flag, skull);

  // bowsprit
  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 20, 8), glow(palette[1], 0.3));
  sprit.rotation.x = Math.PI / 2.6;
  sprit.position.set(0, 3, 48);
  group.add(sprit);

  addLights(group, palette);
  return {
    group,
    update(tl) {
      group.position.y = Math.sin(tl * 0.9) * 1.6;
      group.rotation.z = Math.sin(tl * 0.62) * 0.055;
      group.rotation.x = Math.sin(tl * 0.45) * 0.025;
      sailMeshes.forEach((s, i) => {
        s.scale.z = 1 + Math.sin(tl * 1.6 + i) * 0.18;
        s.rotation.z = Math.sin(tl * 1.1 + i * 0.7) * 0.03;
      });
      flag.rotation.z = Math.sin(tl * 3.2) * 0.1;
      skull.position.x = 2.6 + Math.sin(tl * 3.2) * 0.1;
    },
  };
};

// ------------------------------------------------------------------ ocean
builders.ocean = ({ palette, seed = 71 }) => {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(420, 420, 100, 100);
  const mesh = new THREE.Mesh(geo, glow(palette[1], 0.3, { flat: true }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -14;
  const base = geo.attributes.position.array.slice();
  const foam = pointCloud(5200, 190, ['#ffffff', palette[3]], 1.5, seed);
  foam.position.y = 4;
  group.add(mesh, foam);
  addLights(group, palette);
  const pos = geo.attributes.position;
  return {
    group,
    update(tl) {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const d = Math.sqrt(x * x + y * y);
        pos.array[i * 3 + 2] =
          Math.sin(d * 0.045 - tl * 1.15) * 6.4 +
          Math.sin(x * 0.03 + tl * 0.7) * 3.1 +
          Math.cos(y * 0.041 - tl * 0.9) * 2.4;
      }
      pos.needsUpdate = true;
      foam.rotation.y = tl * 0.06;
      foam.position.y = 2 + Math.sin(tl * 0.9) * 2;
    },
  };
};

// ------------------------------------------------------------- skull island
builders.skullIsland = ({ palette }) => {
  const group = new THREE.Group();
  const rock = glow(palette[1], 0.3, { flat: true });
  const base = new THREE.Mesh(new THREE.ConeGeometry(62, 40, 9), rock);
  base.position.y = -22;
  const bone = glow('#eae0c8', 0.5, { flat: true });
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(15, 20, 18), bone);
  cranium.position.set(0, 21, 0);
  cranium.scale.set(1, 0.95, 0.88);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(13, 5, 9), bone);
  jaw.position.set(0, 13, 2);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5, 4), glow('#1a1020', 0.05));
  nose.position.set(0, 19.5, 13);
  nose.rotation.x = Math.PI;
  group.add(base, cranium, jaw, nose);

  const socketMat = glow('#07030d', 0.02);
  const eyeMat = glow(palette[3], 2.6);
  const eyes = [];
  for (const sx of [-5.6, 5.6]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(4.4, 16, 16), socketMat);
    socket.position.set(sx, 23, 11.6);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 12), eyeMat);
    eye.position.set(sx, 23, 15.4);
    group.add(socket, eye);
    eyes.push(eye);
  }
  // teeth
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.2, 1.4), bone);
    t.position.set(-6 + i * 2, 11.6, 6.2);
    group.add(t);
  }
  // palms
  for (const [px, pz, s] of [[-40, 14, 1.2], [38, -6, 0.9], [-28, -26, 0.75]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.9, 34, 8), glow(palette[1], 0.32));
    trunk.position.set(px, -6, pz);
    trunk.rotation.z = 0.14;
    group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 4), glow(palette[2], 0.75, { flat: true }));
      const a = (i / 5) * TAU;
      leaf.position.set(px + Math.cos(a) * 6 * s, 11, pz + Math.sin(a) * 6 * s);
      leaf.rotation.set(Math.PI / 2.1, 0, a);
      leaf.scale.setScalar(s);
      group.add(leaf);
    }
  }
  addLights(group, palette);
  return {
    group,
    update(tl) {
      eyes.forEach((e, i) => {
        const on = 0.55 + 0.45 * Math.sin(tl * 2.4 + i * 1.4);
        e.material.emissiveIntensity = 1.4 + on * 2.6;
        e.scale.setScalar(1 + on * 0.18);
      });
      group.rotation.y = Math.sin(tl * 0.16) * 0.14;
    },
  };
};

// ------------------------------------------------------------- treasure
builders.treasureChest = ({ palette }) => {
  const group = new THREE.Group();
  const wood = glow(palette[1], 0.3);
  const gold = glow(palette[3], 1.8);
  const body = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 20), wood);
  body.position.y = -4;
  const lidGroup = new THREE.Group();
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 30, 20, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2;
  lid.position.set(0, 4, 0);
  lidGroup.add(lid);
  lidGroup.position.set(0, 4, -10);
  for (const sx of [-10, 0, 10]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.6, 17, 21), gold);
    band.position.set(sx, -4, 0);
    group.add(band);
  }
  // gold heap
  const coins = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.35, 10),
    gold,
    260
  );
  const r = rng(97);
  const dummy = new THREE.Object3D();
  const coinData = [];
  for (let i = 0; i < 260; i++) {
    const a = r() * TAU;
    const rad = r() * 13;
    coinData.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad * 0.6, y: Math.pow(r(), 1.6) * 9, rot: r() * TAU, sp: 0.4 + r() });
  }
  group.add(body, lidGroup, coins);

  const chestGlow = new THREE.PointLight(new THREE.Color(palette[3]), 260, 160, 2);
  chestGlow.position.set(0, 8, 0);
  group.add(chestGlow);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      lidGroup.rotation.x = -Math.min(1.15, Math.max(0, (tl - 1.2) * 0.9));
      chestGlow.intensity = 160 + Math.sin(tl * 5) * 40 + Math.max(0, tl - 2) * 40;
      for (let i = 0; i < 260; i++) {
        const c = coinData[i];
        dummy.position.set(c.x, c.y + Math.sin(tl * 2 + i) * 0.25 + Math.max(0, tl - 2) * 0.9, c.z);
        dummy.rotation.set(Math.PI / 2, c.rot + tl * c.sp, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        coins.setMatrixAt(i, dummy.matrix);
      }
      coins.instanceMatrix.needsUpdate = true;
    },
  };
};

// ------------------------------------------------------------- gold rain
builders.goldRain = ({ palette, seed = 101 }) => {
  const group = new THREE.Group();
  const N = 420;
  const coin = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.3, 9),
    glow(palette[3], 1.9),
    N
  );
  const dummy = new THREE.Object3D();
  const r = rng(seed);
  const data = [];
  for (let i = 0; i < N; i++) {
    data.push({ x: (r() - 0.5) * 150, z: (r() - 0.5) * 110, off: r() * 70, sp: 22 + r() * 26, spin: 2 + r() * 6, s: 0.7 + r() * 1.2 });
  }
  const sparkle = pointCloud(4000, 120, [palette[3], '#ffffff'], 1.3, seed + 1);
  const glowBall = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 24), glow(palette[3], 2.4));
  group.add(coin, sparkle, glowBall);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        const y = 60 - ((d.off + tl * d.sp) % 130);
        dummy.position.set(d.x, y, d.z);
        dummy.rotation.set(Math.PI / 2 + Math.sin(tl * d.spin) * 0.6, tl * d.spin, 0);
        dummy.scale.setScalar(d.s);
        dummy.updateMatrix();
        coin.setMatrixAt(i, dummy.matrix);
      }
      coin.instanceMatrix.needsUpdate = true;
      sparkle.rotation.y = tl * 0.12;
      glowBall.scale.setScalar(1 + Math.sin(tl * 1.8) * 0.12);
    },
  };
};

// ------------------------------------------------------------- parrots
function makeParrot(palette) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 14), glow(palette[2], 1.35, { flat: true }));
  body.scale.set(1, 1.15, 1.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), glow(palette[2], 1.5));
  head.position.set(0, 2.1, 1.5);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.1, 7), glow(palette[3], 1.9));
  beak.rotation.x = Math.PI / 2.1;
  beak.position.set(0, 1.9, 3.1);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.6, 6), glow(palette[3], 1.4));
  tail.rotation.x = -Math.PI / 2.2;
  tail.position.set(0, -0.4, -3.2);
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.2), glow(palette[3], 1.2, { opacity: 0.95 }));
    w.position.set(sx * 2.6, 0.4, 0);
    w.rotation.y = Math.PI / 2;
    g.add(w);
    wings.push({ mesh: w, sx });
  }
  g.add(body, head, beak, tail);
  return { g, wings };
}

builders.parrotFlock = ({ palette, seed = 131 }) => {
  const group = new THREE.Group();
  const r = rng(seed);
  const birds = [];
  for (let i = 0; i < 8; i++) {
    const { g, wings } = makeParrot(palette);
    const rad = 24 + r() * 46;
    birds.push({ g, wings, rad, sp: (0.35 + r() * 0.7) * (r() > 0.5 ? 1 : -1), off: r() * TAU, y: (r() - 0.5) * 44, flap: 4 + r() * 5 });
    group.add(g);
  }
  const dust = pointCloud(3000, 110, [palette[3], palette[2]], 1.4, seed + 3);
  group.add(dust);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      birds.forEach((b, i) => {
        const a = b.off + tl * b.sp;
        b.g.position.set(Math.cos(a) * b.rad, b.y + Math.sin(a * 2.3 + i) * 6, Math.sin(a) * b.rad);
        b.g.rotation.y = -a + Math.PI / 2;
        b.g.rotation.z = Math.sin(tl * 1.4 + i) * 0.2;
        const flap = Math.sin(tl * b.flap + i) * 0.75;
        b.wings.forEach(({ mesh, sx }) => {
          mesh.rotation.z = sx * flap;
        });
      });
      dust.rotation.y = tl * 0.1;
    },
  };
};

// ------------------------------------------------------------- cannon fire
builders.cannonFire = ({ palette, seed = 137 }) => {
  const group = new THREE.Group();
  const N = 14;
  const ballGeo = new THREE.SphereGeometry(2.1, 14, 14);
  const balls = new THREE.InstancedMesh(ballGeo, glow('#1c1c24', 0.35), N);
  const dummy = new THREE.Object3D();
  const r = rng(seed);
  const data = [];
  for (let i = 0; i < N; i++) {
    data.push({ t0: (i / N) * 4.2 + r() * 0.5, vz: 46 + r() * 16, vx: (r() - 0.5) * 18, side: r() > 0.5 ? 1 : -1 });
  }
  const smoke = pointCloud(9000, 70, ['#d8d8e0', palette[3]], 3.4, seed + 2);
  smoke.material.opacity = 0.5;
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.4, 16, 12),
    glow(palette[1], 0.4)
  );
  muzzle.rotation.x = Math.PI / 2.6;
  muzzle.position.set(0, -6, 26);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 16), glow(palette[3], 3.4));
  flash.position.set(0, 2, 34);
  group.add(balls, smoke, muzzle, flash);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        const life = ((tl - d.t0) % 4.2 + 4.2) % 4.2;
        const x = d.vx * life * d.side;
        const y = -6 + d.vz * life - 9.8 * life * life * 0.5;
        dummy.position.set(x, y, 26 + life * 26);
        dummy.rotation.set(life * 3, life * 2, 0);
        dummy.scale.setScalar(life > 3.9 ? 0.001 : 1);
        dummy.updateMatrix();
        balls.setMatrixAt(i, dummy.matrix);
      }
      balls.instanceMatrix.needsUpdate = true;
      smoke.rotation.y = tl * 0.25;
      smoke.position.z = 30 + Math.sin(tl * 0.5) * 6;
      const f = Math.max(0, Math.sin(tl * 6.2));
      flash.scale.setScalar(0.4 + f * 1.5);
      flash.material.emissiveIntensity = 1.4 + f * 4;
    },
  };
};

// ------------------------------------------------------------- kraken
builders.kraken = ({ palette, seed = 149 }) => {
  const group = new THREE.Group();
  const skin = glow(palette[1], 0.45, { flat: true });
  const suck = glow(palette[3], 1.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(19, 24, 20), skin);
  head.scale.set(1, 1.25, 0.9);
  head.position.y = 26;
  group.add(head);
  for (const sx of [-7, 7]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(4.4, 16, 16), glow('#fff8e7', 0.9));
    eye.position.set(sx, 32, 15);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 12), glow('#12060f', 0.05));
    pupil.position.set(sx, 32, 18.6);
    group.add(eye, pupil);
  }
  const arms = [];
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {
    const pts = [];
    const a = (i / 7) * TAU;
    for (let s = 0; s <= 6; s++) {
      const u = s / 6;
      pts.push(new THREE.Vector3(
        Math.cos(a) * (10 + u * 46),
        16 - u * u * 34,
        Math.sin(a) * (10 + u * 46)
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 60, 4.2 - i * 0.1, 8, false);
    const arm = new THREE.Mesh(geo, skin);
    group.add(arm);
    arms.push({ arm, a, phase: r() * TAU, geo, curve });
    for (let s = 1; s < 5; s++) {
      const p = curve.getPoint(s / 5);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 8), suck);
      dot.position.copy(p);
      group.add(dot);
    }
  }
  addLights(group, palette);
  return {
    group,
    update(tl) {
      head.position.y = 26 + Math.sin(tl * 0.8) * 3.2;
      head.rotation.y = Math.sin(tl * 0.4) * 0.18;
      arms.forEach((o, i) => {
        o.arm.rotation.y = Math.sin(tl * 0.6 + o.phase) * 0.22;
        o.arm.rotation.z = Math.sin(tl * 0.9 + i) * 0.06;
      });
    },
  };
};

// ------------------------------------------------------------- storm
builders.stormClouds = ({ palette, seed = 151 }) => {
  const group = new THREE.Group();
  const r = rng(seed);
  const N = 46;
  const cloud = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    glow(palette[1], 0.18, { flat: true }),
    N
  );
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < N; i++) {
    data.push({
      x: (r() - 0.5) * 260,
      y: 34 + r() * 30,
      z: (r() - 0.5) * 200,
      s: 14 + r() * 26,
      sp: 0.6 + r() * 1.4,
    });
  }
  const rain = pointCloud(12000, 150, ['#cfe8ff', palette[3]], 1.15, seed + 5);
  rain.material.opacity = 0.75;
  group.add(cloud, rain);
  const flash = new THREE.PointLight(new THREE.Color(palette[3]), 0, 500, 2);
  flash.position.set(0, 60, 0);
  group.add(flash);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        dummy.position.set(d.x + Math.sin(tl * 0.3 * d.sp) * 10, d.y, d.z);
        dummy.scale.set(d.s, d.s * 0.55, d.s);
        dummy.updateMatrix();
        cloud.setMatrixAt(i, dummy.matrix);
      }
      cloud.instanceMatrix.needsUpdate = true;
      rain.position.y = -((tl * 60) % 60);
      rain.rotation.y = tl * 0.05;
      const strike = Math.sin(tl * 3.1) > 0.965 ? 1 : 0;
      flash.intensity = strike * (2400 + Math.sin(tl * 60) * 900);
    },
  };
};

// ------------------------------------------------------------- wheel
builders.shipWheel = ({ palette }) => {
  const group = new THREE.Group();
  const wood = glow(palette[1], 0.35);
  const brass = glow(palette[3], 1.5);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(17, 1.5, 10, 64), wood);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.9, 8, 48), brass);
  group.add(rim, rim2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 34, 8), wood);
    spoke.rotation.z = a;
    group.add(spoke);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 10), brass);
    knob.position.set(Math.cos(a) * 18.5, Math.sin(a) * 18.5, 0);
    group.add(knob);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 6, 16), brass);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      group.rotation.z = Math.sin(tl * 1.3) * 0.5 + tl * 0.25;
      group.rotation.y = Math.sin(tl * 0.35) * 0.5;
      group.position.y = Math.sin(tl * 0.9) * 1.5;
    },
  };
};

// ------------------------------------------------------------- barrels
builders.barrels = ({ palette, seed = 157 }) => {
  const group = new THREE.Group();
  const r = rng(seed);
  const N = 16;
  const geo = new THREE.CylinderGeometry(4.4, 4.4, 10, 14);
  const mesh = new THREE.InstancedMesh(geo, glow(palette[1], 0.32), N);
  const hoop = new THREE.InstancedMesh(new THREE.TorusGeometry(4.5, 0.42, 6, 18), glow(palette[3], 1.3), N * 2);
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < N; i++) {
    data.push({ rad: 12 + r() * 48, ang: r() * TAU, y: (r() - 0.5) * 26, sp: (r() - 0.5) * 1.6, spin: r() * 3 });
  }
  group.add(mesh, hoop);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        const a = d.ang + tl * d.sp * 0.4;
        const x = Math.cos(a) * d.rad;
        const z = Math.sin(a) * d.rad;
        const y = d.y + Math.sin(tl * 1.1 + i) * 3;
        dummy.position.set(x, y, z);
        dummy.rotation.set(Math.PI / 2, d.spin + tl * 1.4, a);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        for (let k = 0; k < 2; k++) {
          dummy.position.set(x, y + (k ? 3.6 : -3.6), z);
          dummy.updateMatrix();
          hoop.setMatrixAt(i * 2 + k, dummy.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      hoop.instanceMatrix.needsUpdate = true;
    },
  };
};

// ------------------------------------------------------------- moon cheese
builders.moonCheese = ({ palette, seed = 163 }) => {
  const group = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 28), glow('#ffe9a8', 1.5));
  moon.position.set(0, 42, -60);
  group.add(moon);
  const r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const b = Math.acos(2 * r() - 1);
    const rad = 34;
    const hole = new THREE.Mesh(
      new THREE.SphereGeometry(2.2 + r() * 4.2, 10, 10),
      glow('#e2b96a', 0.35, { flat: true })
    );
    hole.position.set(
      Math.sin(b) * Math.cos(a) * rad * 0.92,
      42 + Math.cos(b) * rad * 0.92,
      -60 + Math.sin(b) * Math.sin(a) * rad * 0.92
    );
    group.add(hole);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 300, 60, 40), glow(palette[1], 0.4, { flat: true }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -18;
  const waveBase = sea.geometry.attributes.position.array.slice();
  group.add(sea);
  addLights(group, palette);
  const pos = sea.geometry.attributes.position;
  return {
    group,
    update(tl) {
      for (let i = 0; i < pos.count; i++) {
        const x = waveBase[i * 3];
        const y = waveBase[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.05 + tl * 1.2) * 2.4 + Math.cos(y * 0.06 - tl) * 1.9;
      }
      pos.needsUpdate = true;
      moon.rotation.y = tl * 0.1;
    },
  };
};

// ------------------------------------------------------------- compass
builders.compassRose = ({ palette }) => {
  const group = new THREE.Group();
  const brass = glow(palette[3], 1.4);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 1.2, 8, 72), brass);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(19, 0.6, 8, 64), glow(palette[2], 1.2));
  group.add(ring, ring2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, i % 4 === 0 ? 5 : 2.2, 0.5), brass);
    tick.position.set(Math.cos(a) * 21.5, Math.sin(a) * 21.5, 0);
    tick.rotation.z = a;
    group.add(tick);
  }
  const needle = new THREE.Group();
  const n1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 20, 4), glow('#ff4d6d', 2.1, { flat: true }));
  n1.position.y = 10;
  const n2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 20, 4), glow('#f0f4ff', 1.2, { flat: true }));
  n2.position.y = -10;
  n2.rotation.z = Math.PI;
  needle.add(n1, n2);
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 14), brass);
  group.add(needle, pivot);
  const dust = pointCloud(2600, 80, [palette[3], palette[2]], 1.3, 167);
  group.add(dust);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      needle.rotation.z = Math.sin(tl * 1.7) * 1.4 + Math.sin(tl * 0.5) * 0.6;
      group.rotation.z = Math.sin(tl * 0.25) * 0.1;
      dust.rotation.z = tl * 0.08;
    },
  };
};

// ------------------------------------------------------------- rigging/rope
builders.rigging = ({ palette, seed = 173 }) => {
  const group = new THREE.Group();
  const verts = [];
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const x1 = (r() - 0.5) * 120;
    const z1 = (r() - 0.5) * 120;
    verts.push(x1, -40, z1, x1 * 0.2, 40 + r() * 30, z1 * 0.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: new THREE.Color(palette[2]), transparent: true, opacity: 0.45,
  }));
  const knots = new THREE.Points(geo, new THREE.PointsMaterial({
    color: new THREE.Color(palette[3]), size: 2.6, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  group.add(lines, knots);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      group.rotation.y = tl * 0.14;
      group.position.y = Math.sin(tl * 0.7) * 3;
      knots.scale.setScalar(1 + Math.sin(tl * 2) * 0.1);
    },
  };
};

import { builders as baseBuilders } from './visuals.js';

export function buildScene(type, palette, seed) {
  const fn = builders[type] || baseBuilders[type] || baseBuilders.particles;
  return fn({ palette, seed });
}
