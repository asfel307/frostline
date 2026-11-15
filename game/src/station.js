// Frostline — Station Aurora: the map itself.
// Builds every visible piece of the arctic research station from the
// navigation data in navgraph.js, so the meshes and the colliders can
// never drift apart. Night scene: cold moonlight, warm window lights,
// cyan site beacons and an aurora ribbon in the northern sky.
import * as THREE from 'three';
import { COLLIDERS, SITES } from './navgraph.js';
import { PALETTE } from './palette.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
}

function box(w, h, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

// A window strip: a thin warm-glowing plane stuck on a wall face.
function windows(group, x, y, z, count, gap, face) {
  const geo = new THREE.PlaneGeometry(1.1, 0.8);
  const m = new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm });
  for (let i = 0; i < count; i += 1) {
    const w = new THREE.Mesh(geo, m);
    const off = (i - (count - 1) / 2) * gap;
    if (face === 'east') {
      w.position.set(x + 0.03, y, z + off);
      w.rotation.y = Math.PI / 2;
    } else {
      w.position.set(x + off, y, z + 0.03);
    }
    group.add(w);
  }
}

export function buildStation(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const animated = { aurora: null, towerBeacon: null, rings: {} };

  // Ground: snow field, slightly blue in the dark.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 50),
    new THREE.MeshStandardMaterial({ color: PALETTE.snow, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  // Helipad: dark circle with an H, centre of the plaza.
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(4, 40),
    new THREE.MeshStandardMaterial({ color: 0x2b3648, roughness: 0.9 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.02, 0);
  g.add(pad);
  const hBar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 4.5),
    new THREE.MeshBasicMaterial({ color: PALETTE.hazard }),
  );
  hBar.rotation.x = -Math.PI / 2;
  hBar.position.set(0, 0.04, 0);
  g.add(hBar);
  const hCross = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.5),
    new THREE.MeshBasicMaterial({ color: PALETTE.hazard }),
  );
  hCross.rotation.x = -Math.PI / 2;
  hCross.position.set(0, 0.04, 0);
  g.add(hCross);

  // Perimeter ice walls, from the collider data.
  const iceMat = mat(PALETTE.ice, { roughness: 0.4, metalness: 0.1 });
  for (const c of COLLIDERS.slice(0, 4)) {
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    g.add(box(w, c.y1, d, (c.x0 + c.x1) / 2, c.y1 / 2, (c.z0 + c.z1) / 2, iceMat));
  }

  // Hab Row modules (west): dark steel boxes with warm windows facing east.
  const habMat = mat(PALETTE.steelDark, { roughness: 0.7 });
  const habTrim = mat(PALETTE.steelLight, { roughness: 0.5 });
  for (const c of COLLIDERS.slice(4, 7)) {
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, cx, c.y1 / 2, cz, habMat));
    g.add(box(c.x1 - c.x0 + 0.2, 0.25, c.z1 - c.z0 + 0.2, cx, c.y1 + 0.1, cz, habTrim));
    windows(g, c.x1, 1.7, cz, 3, 1.6, 'east');
  }

  // Storage Yard containers (east): corrugated steel in cold tones.
  const contMats = [mat(0x51697f), mat(0x6b5a44), mat(0x44586b)];
  COLLIDERS.slice(7, 10).forEach((c, i) => {
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, cx, c.y1 / 2, cz, contMats[i % 3]));
    g.add(box(0.15, c.y1, c.z1 - c.z0, c.x0 + 0.1, c.y1 / 2, cz, mat(PALETTE.steelLight)));
  });

  // Reactor Hall (site B): tall hall with glowing cyan vents and a pipe run.
  const hall = COLLIDERS[10];
  const hallMat = mat(0x37455a, { roughness: 0.6, metalness: 0.2 });
  g.add(box(hall.x1 - hall.x0, hall.y1, hall.z1 - hall.z0, 22, hall.y1 / 2, -16.5, hallMat));
  const ventMat = new THREE.MeshBasicMaterial({ color: PALETTE.aurora });
  for (let i = 0; i < 4; i += 1) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), ventMat);
    v.position.set(18.5 + i * 2.4, 4.6, -12.94);
    g.add(v);
  }
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 12, 12),
    mat(PALETTE.steelLight, { metalness: 0.4 }),
  );
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(22, 5.6, -12.6);
  g.add(pipe);

  // Comms Array masts (site A): two dishes on poles.
  const mastMat = mat(PALETTE.steel, { metalness: 0.35 });
  for (const c of COLLIDERS.slice(11, 13)) {
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, c.y1, 10), mastMat);
    pole.position.set(cx, c.y1 / 2, cz);
    g.add(pole);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, 0.9),
      mat(PALETTE.ice, { roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }),
    );
    dish.position.set(cx, c.y1 + 0.4, cz);
    dish.rotation.x = Math.PI * 0.72;
    dish.rotation.z = 0.5;
    g.add(dish);
  }

  // Relay tower, mid-north: thin mast with a blinking red beacon.
  const tower = COLLIDERS[13];
  const tx = (tower.x0 + tower.x1) / 2;
  const tz = (tower.z0 + tower.z1) / 2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, tower.y1, 8), mastMat);
  mast.position.set(tx, tower.y1 / 2, tz);
  g.add(mast);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  beacon.position.set(tx, tower.y1 + 0.3, tz);
  g.add(beacon);
  animated.towerBeacon = beacon;

  // Low plaza wall (two pieces, gap in the middle).
  const wallMat = mat(PALETTE.rock);
  for (const c of COLLIDERS.slice(14, 16)) {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, (c.x0 + c.x1) / 2, c.y1 / 2, (c.z0 + c.z1) / 2, wallMat));
  }

  // Supply crates.
  const crateMat = mat(0x7a6a4e, { roughness: 0.9 });
  for (const c of COLLIDERS.slice(16, 20)) {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, (c.x0 + c.x1) / 2, c.y1 / 2, (c.z0 + c.z1) / 2, crateMat));
  }

  // Fuel tanks: squat cylinders with hazard bands.
  const tankMat = mat(0x8a4a3a, { roughness: 0.6, metalness: 0.2 });
  for (const c of COLLIDERS.slice(20, 22)) {
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, c.y1, 18), tankMat);
    tank.position.set(cx, c.y1 / 2, cz);
    g.add(tank);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.42, 0.3, 18),
      new THREE.MeshBasicMaterial({ color: PALETTE.hazard }),
    );
    band.position.set(cx, c.y1 - 0.5, cz);
    g.add(band);
  }

  // Site rings: glowing circles on the snow marking the plant zones.
  for (const [key, site] of Object.entries(SITES)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.r - 0.8, site.r, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.aurora, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.05, site.z);
    g.add(ring);
    animated.rings[key] = ring;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.aurora }),
    );
    pole.position.set(site.x, 1.6, site.z);
    g.add(pole);
  }

  // Moon: a pale disc low in the northern sky.
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false }),
  );
  moon.position.set(-38, 46, -85);
  moon.lookAt(0, 0, 0);
  g.add(moon);

  // Stars.
  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.42 + 0.08;
    const r = 130;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.9, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false }));
  g.add(stars);

  // Aurora: a wide ribbon in the northern sky, animated by a shader.
  const auroraUniforms = { uTime: { value: 0 } };
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: auroraUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(uv.x * 6.0 + uTime * 0.25) * 1.6;
        p.z += cos(uv.x * 4.0 + uTime * 0.18) * 1.2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float band = sin(vUv.x * 9.0 + uTime * 0.35 + sin(vUv.x * 4.0) * 2.0);
        float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float glow = 0.5 + 0.5 * band;
        vec3 green = vec3(0.25, 1.0, 0.65);
        vec3 cyan = vec3(0.2, 0.85, 1.0);
        vec3 col = mix(green, cyan, vUv.y);
        gl_FragColor = vec4(col, edge * (0.18 + 0.30 * glow));
      }`,
  });
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(110, 22, 48, 1), auroraMat);
  aurora.position.set(0, 34, -72);
  aurora.rotation.x = 0.25;
  g.add(aurora);
  animated.aurora = auroraUniforms;

  // Lights: cold moonlight, sky fill, warm windows, cyan site beacons.
  scene.add(new THREE.HemisphereLight(0x16294d, 0x0a0f1c, 0.85));
  const moonLight = new THREE.DirectionalLight(0xbcd3ff, 1.15);
  moonLight.position.set(30, 45, -20);
  scene.add(moonLight);
  for (const [x, z] of [[-16, -15.5], [-16, 0], [-16, 10]]) {
    const warm = new THREE.PointLight(PALETTE.windowWarm, 26, 20, 2);
    warm.position.set(x + 2.2, 2.2, z);
    scene.add(warm);
  }
  for (const site of Object.values(SITES)) {
    const beaconLight = new THREE.PointLight(PALETTE.aurora, 16, 15, 2);
    beaconLight.position.set(site.x, 3.4, site.z);
    scene.add(beaconLight);
  }

  return {
    group: g,
    update(t) {
      animated.aurora.uTime.value = t;
      animated.towerBeacon.material.color.setHex(Math.sin(t * 3.0) > 0 ? 0xff4444 : 0x551111);
      for (const ring of Object.values(animated.rings)) {
        ring.material.opacity = 0.35 + 0.18 * Math.sin(t * 1.6);
      }
    },
  };
}
