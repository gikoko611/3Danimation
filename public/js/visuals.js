import * as THREE from 'three';

// ---------------------------------------------------------------- helpers
const TAU = Math.PI * 2;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function noise3(x, y, z, seed) {
  return (
    Math.sin(x * 1.7 + seed) * Math.cos(y * 1.3 - seed * 0.7) * 0.5 +
    Math.sin(y * 2.3 + z * 1.1 + seed * 1.9) * 0.3 +
    Math.cos(z * 1.9 - x * 0.9 + seed * 0.3) * 0.2
  );
}

export function glow(color, emissiveIntensity = 1.1, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity,
    roughness: 0.35,
    metalness: 0.25,
    flatShading: opts.flat ?? false,
    wireframe: opts.wire ?? false,
    transparent: opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
  });
}

export function pointCloud(count, radius, colors, size = 2.2, seed = 1) {
  const r = rng(seed);
  const positions = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const theta = r() * TAU;
    const phi = Math.acos(2 * r() - 1);
    const rad = radius * Math.cbrt(r());
    positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = rad * Math.cos(phi);
    c.set(colors[Math.floor(r() * colors.length)]);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

export function addLights(group, palette) {
  const [bg, mid, a1, a2] = palette;
  group.add(new THREE.AmbientLight(new THREE.Color(mid), 0.55));
  const p1 = new THREE.PointLight(new THREE.Color(a1), 320, 400, 2);
  p1.position.set(40, 40, 60);
  const p2 = new THREE.PointLight(new THREE.Color(a2), 260, 400, 2);
  p2.position.set(-50, -30, 40);
  const p3 = new THREE.DirectionalLight(new THREE.Color(a1), 1.4);
  p3.position.set(0, 60, 80);
  group.add(p1, p2, p3);
  return { p1, p2, p3 };
}

// ---------------------------------------------------------------- builders
export const builders = {};

builders.starfield = ({ palette, seed = 7 }) => {
  const group = new THREE.Group();
  const stars = pointCloud(9000, 220, [palette[2], palette[3], '#ffffff'], 1.9, seed);
  group.add(stars);
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 32), glow(palette[3], 3.2));
  group.add(core);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      stars.rotation.y = tl * 0.05;
      stars.rotation.x = Math.sin(tl * 0.2) * 0.1;
      core.scale.setScalar(1 + Math.sin(tl * 2.2) * 0.12);
    },
  };
};

builders.particles = ({ palette, seed = 11 }) => {
  const group = new THREE.Group();
  const cloud = pointCloud(16000, 130, [palette[2], palette[3], '#ffffff'], 1.7, seed);
  group.add(cloud);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(55, 0.6, 8, 220), glow(palette[2], 2.0));
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      cloud.rotation.y = tl * 0.22;
      cloud.rotation.z = Math.sin(tl * 0.3) * 0.25;
      cloud.scale.setScalar(1 + Math.sin(tl * 0.8) * 0.08);
      ring.rotation.z = tl * 0.4;
      ring.rotation.y = tl * 0.2;
    },
  };
};

builders.torusKnot = ({ palette, seed = 3 }) => {
  const group = new THREE.Group();
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(22, 5.5, 260, 32, 2, 3),
    glow(palette[2], 1.5, { flat: true })
  );
  const wire = new THREE.Mesh(
    new THREE.TorusKnotGeometry(23.6, 6.1, 130, 16, 2, 3),
    glow(palette[3], 1.0, { wire: true, opacity: 0.35 })
  );
  const shell = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 24), glow(palette[3], 3.0));
  group.add(knot, wire, shell);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      knot.rotation.set(tl * 0.35, tl * 0.5, tl * 0.2);
      wire.rotation.set(-tl * 0.2, tl * 0.3, tl * 0.45);
      shell.scale.setScalar(1 + Math.sin(tl * 3) * 0.18);
    },
  };
};

builders.wave = ({ palette, seed = 5 }) => {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(220, 220, 110, 110);
  const mat = glow(palette[2], 0.55, { flat: true, wire: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2.6;
  group.add(mesh);
  const base = geo.attributes.position.array.slice();
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
          Math.sin(d * 0.09 - tl * 1.6) * 7.5 + Math.cos(x * 0.05 + tl) * 3.2 + Math.sin(y * 0.07 - tl * 0.8) * 2.6;
      }
      pos.needsUpdate = true;
      mesh.rotation.z = tl * 0.02;
    },
  };
};

builders.helix = ({ palette, seed = 9 }) => {
  const group = new THREE.Group();
  const N = 90;
  const matA = glow(palette[2], 1.6);
  const matB = glow(palette[3], 1.6);
  const geo = new THREE.SphereGeometry(1.5, 12, 12);
  const geoSmall = new THREE.SphereGeometry(0.8, 10, 10);
  const a = new THREE.InstancedMesh(geo, matA, N);
  const b = new THREE.InstancedMesh(geo, matB, N);
  const rungs = new THREE.InstancedMesh(geoSmall, glow('#ffffff', 1.4), N);
  const dummy = new THREE.Object3D();
  group.add(a, b, rungs);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const p = (i / N) * Math.PI * 6 + tl * 0.55;
        const y = (i / N - 0.5) * 90;
        dummy.position.set(Math.cos(p) * 16, y, Math.sin(p) * 16);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        a.setMatrixAt(i, dummy.matrix);
        dummy.position.set(Math.cos(p + Math.PI), y, Math.sin(p + Math.PI));
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
        dummy.position.set(Math.cos(p) * 8, y, Math.sin(p) * 8);
        dummy.updateMatrix();
        rungs.setMatrixAt(i, dummy.matrix);
      }
      a.instanceMatrix.needsUpdate = true;
      b.instanceMatrix.needsUpdate = true;
      rungs.instanceMatrix.needsUpdate = true;
      group.rotation.y = tl * 0.12;
    },
  };
};

builders.globeDots = ({ palette, seed = 13 }) => {
  const group = new THREE.Group();
  const count = 24000;
  const r = rng(seed);
  const positions = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = r();
    const v = r();
    const theta = u * TAU;
    const phi = Math.acos(2 * v - 1);
    const rad = 30 + Math.sin(theta * 9) * Math.cos(phi * 7) * 0.6;
    positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = rad * Math.cos(phi);
    positions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    c.set(r() > 0.86 ? palette[3] : palette[2]);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const globe = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 1.1, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })
  );
  group.add(globe);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(36, 0.35, 8, 200),
    glow(palette[3], 1.8, { opacity: 0.7 })
  );
  halo.rotation.x = Math.PI / 2.1;
  group.add(halo);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      globe.rotation.y = tl * 0.18;
      halo.rotation.z = tl * 0.35;
      halo.rotation.x = Math.PI / 2.1 + Math.sin(tl * 0.4) * 0.25;
      group.scale.setScalar(1 + Math.sin(tl * 0.6) * 0.05);
    },
  };
};

builders.terrain = ({ palette, seed = 17 }) => {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(300, 300, 90, 90);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.array[i * 3];
    const y = pos.array[i * 3 + 1];
    const h = noise3(x * 0.03, y * 0.03, 0, seed) * 22 + Math.sin(x * 0.01) * 8;
    pos.array[i * 3 + 2] = Math.max(h, -6);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, glow(palette[2], 0.35, { flat: true, opacity: 0.95 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -18;
  const wire = new THREE.Mesh(geo, glow(palette[3], 0.8, { wire: true, opacity: 0.22 }));
  wire.rotation.x = -Math.PI / 2;
  wire.position.copy(mesh.position);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 32), glow(palette[3], 3.0));
  sun.position.set(-60, 30, -120);
  group.add(mesh, wire, sun);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      sun.position.y = 26 + Math.sin(tl * 0.3) * 6;
      group.position.z = Math.sin(tl * 0.25) * 6;
    },
  };
};

builders.cityBlocks = ({ palette, seed = 19 }) => {
  const group = new THREE.Group();
  const r = rng(seed);
  const N = 320;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = glow(palette[2], 0.5);
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const glowMat = glow(palette[3], 1.9, { wire: true, opacity: 0.35 });
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMat, N);
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < N; i++) {
    const gx = (i % 20) - 10;
    const gz = Math.floor(i / 20) - 8;
    const x = gx * 9 + (r() - 0.5) * 3;
    const z = gz * 9 + (r() - 0.5) * 3;
    const h = 6 + r() * 52 + Math.abs(gz) * 2;
    data.push({ x, z, h });
  }
  group.add(mesh, roofs);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        const grow = Math.min(1, Math.max(0.15, (tl - (i % 60) * 0.03) * 1.6));
        const h = d.h * grow;
        dummy.position.set(d.x, h / 2 - 20, d.z);
        dummy.scale.set(3.6, h, 3.6);
        dummy.rotation.y = 0;
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dummy.position.set(d.x, h - 20 + 0.4, d.z);
        dummy.scale.set(3.75, 0.8, 3.75);
        dummy.updateMatrix();
        roofs.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      roofs.instanceMatrix.needsUpdate = true;
      group.rotation.y = Math.sin(tl * 0.15) * 0.18 - 0.2;
    },
  };
};

builders.shards = ({ palette, seed = 23 }) => {
  const group = new THREE.Group();
  const r = rng(seed);
  const N = 220;
  const geo = new THREE.TetrahedronGeometry(1.6);
  const mesh = new THREE.InstancedMesh(
    geo,
    glow(palette[2], 1.2, { flat: true }),
    N
  );
  const mesh2 = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1.1),
    glow(palette[3], 1.5, { flat: true }),
    N
  );
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < N; i++) {
    data.push({
      radius: 18 + r() * 62,
      speed: 0.18 + r() * 0.55,
      offset: r() * TAU,
      y: (r() - 0.5) * 70,
      spin: 0.5 + r() * 2.5,
    });
  }
  group.add(mesh, mesh2);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        const a = d.offset + tl * d.speed;
        dummy.position.set(Math.cos(a) * d.radius, d.y + Math.sin(a * 2 + i) * 3, Math.sin(a) * d.radius);
        dummy.rotation.set(tl * d.spin, tl * d.spin * 0.7, a);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dummy.position.multiplyScalar(0.82);
        dummy.scale.setScalar(0.8);
        dummy.updateMatrix();
        mesh2.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh2.instanceMatrix.needsUpdate = true;
    },
  };
};

builders.tunnel = ({ palette, seed = 29 }) => {
  const group = new THREE.Group();
  const N = 44;
  const geo = new THREE.TorusGeometry(26, 0.55, 8, 96);
  const mesh = new THREE.InstancedMesh(geo, glow(palette[2], 1.7), N);
  const mesh2 = new THREE.InstancedMesh(
    new THREE.TorusGeometry(22, 0.25, 6, 72),
    glow(palette[3], 1.5, { opacity: 0.8 }),
    N
  );
  const dummy = new THREE.Object3D();
  group.add(mesh, mesh2);
  addLights(group, palette);
  const span = 420;
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const base = (i / N) * span;
        const z = -((base + tl * 55) % span) + 60;
        const scale = 0.55 + (1 - Math.abs(z) / span) * 0.75;
        dummy.position.set(Math.sin(i * 0.7 + tl) * 1.5, Math.cos(i * 0.5) * 1.5, z);
        dummy.scale.setScalar(scale);
        dummy.rotation.z = tl * 0.3 + i * 0.12;
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dummy.rotation.z = -tl * 0.45 + i * 0.2;
        dummy.scale.setScalar(scale * 0.92);
        dummy.updateMatrix();
        mesh2.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh2.instanceMatrix.needsUpdate = true;
    },
  };
};

builders.ribbon = ({ palette, seed = 31 }) => {
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 26; i++) {
    const a = (i / 26) * TAU * 1.6;
    pts.push(new THREE.Vector3(Math.cos(a) * 44, Math.sin(a * 1.6) * 26, Math.sin(a) * 44));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.6);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 1.5, 12, true), glow(palette[2], 1.8));
  const tube2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.45, 8, true), glow(palette[3], 2.4));
  const cloud = pointCloud(6000, 90, [palette[2], palette[3]], 1.6, seed);
  group.add(tube, tube2, cloud);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      tube.rotation.set(Math.sin(tl * 0.25) * 0.3, tl * 0.3, tl * 0.08);
      tube2.rotation.copy(tube.rotation);
      cloud.rotation.y = -tl * 0.15;
      group.scale.setScalar(1 + Math.sin(tl * 0.5) * 0.06);
    },
  };
};

builders.vortex = ({ palette, seed = 37 }) => {
  const group = new THREE.Group();
  const N = 18000;
  const r = rng(seed);
  const positions = new Float32Array(N * 3);
  const cols = new Float32Array(N * 3);
  const base = [];
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    base.push({ rad: 6 + Math.pow(r(), 0.6) * 70, ang: r() * TAU, y: (r() - 0.5) * 90, spd: 0.4 + r() * 1.6 });
    c.set(r() > 0.7 ? palette[3] : palette[2]);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  const core = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 32), glow(palette[3], 3.2));
  group.add(points, core);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      const pos = geo.attributes.position;
      for (let i = 0; i < N; i++) {
        const b = base[i];
        const squeeze = 1 - Math.min(0.85, tl * 0.06);
        const a = b.ang + tl * b.spd;
        pos.array[i * 3] = Math.cos(a) * b.rad * squeeze;
        pos.array[i * 3 + 1] = b.y * (0.4 + squeeze * 0.7) + Math.sin(a * 3) * 2;
        pos.array[i * 3 + 2] = Math.sin(a) * b.rad * squeeze;
      }
      pos.needsUpdate = true;
      core.scale.setScalar(1 + Math.sin(tl * 4) * 0.2);
    },
  };
};

builders.crystal = ({ palette, seed = 41 }) => {
  const group = new THREE.Group();
  const r = rng(seed);
  const N = 90;
  const mesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(3, 0),
    glow(palette[2], 1.3, { flat: true, opacity: 0.9 }),
    N
  );
  const mesh2 = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(3, 0),
    glow(palette[3], 1.1, { wire: true, opacity: 0.4 }),
    N
  );
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < N; i++) {
    const a = r() * TAU;
    const rad = 4 + r() * 46;
    data.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, y: (r() - 0.5) * 70, s: 0.4 + r() * 1.9, sp: r() * 2 });
  }
  group.add(mesh, mesh2);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      for (let i = 0; i < N; i++) {
        const d = data[i];
        dummy.position.set(d.x, d.y + Math.sin(tl * 0.8 + i) * 2.5, d.z);
        dummy.rotation.set(tl * d.sp + i, tl * d.sp * 0.6, i * 0.3);
        dummy.scale.setScalar(d.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(d.s * 1.06);
        dummy.updateMatrix();
        mesh2.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh2.instanceMatrix.needsUpdate = true;
      group.rotation.y = tl * 0.14;
    },
  };
};

builders.gateArch = ({ palette, seed = 43 }) => {
  const group = new THREE.Group();
  const N = 16;
  const arcs = [];
  for (let i = 0; i < N; i++) {
    const geo = new THREE.TorusGeometry(24 - i * 0.7, 0.6, 8, 100, Math.PI);
    const mat = glow(i % 2 ? palette[3] : palette[2], 1.8, { opacity: 0.95 });
    const m = new THREE.Mesh(geo, mat);
    m.position.z = -i * 22;
    m.position.y = 6;
    group.add(m);
    arcs.push(m);
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 420, 1, 1),
    glow(palette[1], 0.25, { wire: true, opacity: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -20, -140);
  group.add(floor);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      arcs.forEach((m, i) => {
        m.scale.setScalar(1 + Math.sin(tl * 1.4 - i * 0.4) * 0.05);
        m.rotation.z = Math.sin(tl * 0.4 + i * 0.2) * 0.08;
      });
      group.position.z = ((tl * 26) % 22);
    },
  };
};

builders.blobMorph = ({ palette, seed = 47 }) => {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(26, 5);
  const base = geo.attributes.position.array.slice();
  const mat = glow(palette[2], 1.0, { flat: true, opacity: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  const wire = new THREE.Mesh(geo, glow(palette[3], 1.4, { wire: true, opacity: 0.16 }));
  group.add(mesh, wire);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const z = base[i * 3 + 2];
        const n = noise3(x * 0.05, y * 0.05 + tl * 0.5, z * 0.05 - tl * 0.35, seed);
        const k = 1 + n * 0.32;
        pos.array[i * 3] = x * k;
        pos.array[i * 3 + 1] = y * k;
        pos.array[i * 3 + 2] = z * k;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      group.rotation.y = tl * 0.25;
      group.rotation.x = Math.sin(tl * 0.3) * 0.2;
    },
  };
};

builders.lattice = ({ palette, seed = 53 }) => {
  const group = new THREE.Group();
  const size = 62;
  const step = 14;
  const verts = [];
  for (let x = -size; x <= size; x += step) {
    for (let y = -size; y <= size; y += step) {
      for (let z = -size; z <= size; z += step) {
        if (x !== -size && x !== size && y !== -size && y !== size && z !== -size && z !== size) continue;
        if (x === -size || x === size) verts.push(x, y, z, x, y + step, z);
        if (y === -size || y === size) verts.push(x, y, z, x + step, y, z);
        if (z === -size || z === size) verts.push(x, y, z, x, y, z + step);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: new THREE.Color(palette[2]), transparent: true, opacity: 0.32 })
  );
  const lines2 = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: new THREE.Color(palette[3]), transparent: true, opacity: 0.2 })
  );
  lines2.scale.setScalar(0.62);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 1), glow(palette[3], 2.2, { wire: true }));
  group.add(lines, lines2, core);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      lines.rotation.set(tl * 0.15, tl * 0.22, tl * 0.05);
      lines2.rotation.set(-tl * 0.25, tl * 0.3, -tl * 0.1);
      core.rotation.set(tl * 0.8, tl * 0.6, 0);
      core.scale.setScalar(1 + Math.sin(tl * 2) * 0.12);
    },
  };
};

builders.ringsWorld = ({ palette, seed = 59 }) => {
  const group = new THREE.Group();
  const rings = [];
  for (let i = 0; i < 12; i++) {
    const rad = 12 + i * 6.5;
    const geo = new THREE.TorusGeometry(rad, 0.32 + i * 0.03, 8, 160);
    const m = new THREE.Mesh(geo, glow(i % 2 ? palette[2] : palette[3], 1.7, { opacity: 0.9 }));
    m.rotation.x = Math.PI / 2 + (i - 6) * 0.06;
    m.rotation.z = i * 0.18;
    group.add(m);
    rings.push(m);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(5.5, 32, 32), glow(palette[3], 3.0));
  const dust = pointCloud(7000, 110, [palette[2], palette[3]], 1.5, seed);
  group.add(core, dust);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      rings.forEach((m, i) => {
        m.rotation.z = i * 0.18 + tl * (0.1 + i * 0.02) * (i % 2 ? 1 : -1);
        m.rotation.y = Math.sin(tl * 0.3 + i * 0.4) * 0.25;
        m.scale.setScalar(1 + Math.sin(tl * 1.2 + i * 0.5) * 0.03);
      });
      core.scale.setScalar(1 + Math.sin(tl * 2.4) * 0.15);
      dust.rotation.y = tl * 0.1;
      group.rotation.x = Math.sin(tl * 0.2) * 0.12;
    },
  };
};

builders.fractalTree = ({ palette, seed = 61 }) => {
  const group = new THREE.Group();
  const verts = [];
  const branch = (x, y, z, dx, dy, dz, len, depth) => {
    const nx = x + dx * len;
    const ny = y + dy * len;
    const nz = z + dz * len;
    verts.push(x, y, z, nx, ny, nz);
    if (depth <= 0) return;
    const n = 2 + (depth % 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + depth;
      const spread = 0.55;
      branch(
        nx,
        ny,
        nz,
        dx + Math.cos(a) * spread,
        dy + 0.6,
        dz + Math.sin(a) * spread,
        len * 0.72,
        depth - 1
      );
    }
  };
  branch(0, -50, 0, 0, 1, 0, 26, 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: new THREE.Color(palette[2]), transparent: true, opacity: 0.55 })
  );
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: new THREE.Color(palette[3]), size: 2.4, transparent: true, opacity: 0.85, depthWrite: false })
  );
  group.add(lines, points);
  addLights(group, palette);
  return {
    group,
    update(tl) {
      group.rotation.y = tl * 0.22;
      lines.scale.setScalar(0.9 + Math.sin(tl * 0.7) * 0.08);
      points.scale.copy(lines.scale);
      points.rotation.y = -tl * 0.1;
    },
  };
};

export function buildScene(type, palette, seed) {
  const fn = builders[type] || builders.particles;
  const built = fn({ palette, seed });
  return built;
}
