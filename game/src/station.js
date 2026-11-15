// Frostline — Station Aurora: the map itself (expanded 120x90 m map).
// Builds every visible piece of the arctic research station from the
// navigation data in navgraph.js, so the meshes and the colliders can
// never drift apart. The backdrop — a ring of snowy peaks, a glacier
// face to the north, the frozen lake at the centre — is lit by the same
// sun/moon/hemisphere lights as the map, so it reads in daylight and
// at night under the aurora.
//
// Every collider carries a `kind`; station.js groups by kind instead
// of slicing by index, so the navgraph can grow without breaking the
// meshes.
import * as THREE from 'three';
import { COLLIDERS, SITES } from './navgraph.js';
import { PALETTE } from './palette.js';

// A soft noise texture, drawn once on a canvas: mostly white with
// faint grey-blue blotches, so it multiplies a material's colour into
// a subtly varied surface instead of a flat fill. Shared by the snow
// field and the station walls — same image, different repeats.
function makeNoiseTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 4 + Math.random() * 22;
    const v = 218 + Math.floor(Math.random() * 30);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v + 4},${v + 10},0.55)`);
    grad.addColorStop(1, `rgba(${v},${v + 4},${v + 10},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const noiseTex = makeNoiseTexture();
noiseTex.repeat.set(16, 12);

function mat(color, opts = {}) {
  // Walls get their own clone of the noise texture (repeat 1,1) so
  // the blotches read at building scale, not ground scale.
  const wallTex = noiseTex.clone();
  wallTex.needsUpdate = true;
  wallTex.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, map: wallTex, ...opts });
}

function box(w, h, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A window strip: a thin warm-glowing plane stuck on a wall face.
function windows(group, wmat, x, y, z, count, gap, face) {
  const geo = new THREE.PlaneGeometry(1.1, 0.8);
  for (let i = 0; i < count; i += 1) {
    const w = new THREE.Mesh(geo, wmat);
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

const byKind = (kind) => COLLIDERS.filter((c) => c.kind === kind);
const cx = (c) => (c.x0 + c.x1) / 2;
const cz = (c) => (c.z0 + c.z1) / 2;

export function buildStation(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const animated = { aurora: null, towerBeacon: null, rings: {} };
  const handles = { windowLights: [] };

  // Ground: snow field, slightly blue in the dark. The noise map
  // gives the snow drifts; the day/night cycle tints its colour.
  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.snow, roughness: 0.95, metalness: 0, map: noiseTex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  handles.groundMat = groundMat;

  // Frozen lake, centre of the map: a glossy pale-blue disc on the
  // snow, with a darker heart and ice shards around its rim. It is
  // flat and walkable — a risky open crossing between the lanes.
  const lakeMat = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.15, metalness: 0.15 });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(9.5, 48), lakeMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, 0.015, 0);
  lake.receiveShadow = true;
  g.add(lake);
  const lakeCore = new THREE.Mesh(
    new THREE.CircleGeometry(6, 40),
    new THREE.MeshStandardMaterial({ color: 0x7fb0cc, roughness: 0.12, metalness: 0.15 }),
  );
  lakeCore.rotation.x = -Math.PI / 2;
  lakeCore.position.set(0, 0.02, 0);
  lakeCore.receiveShadow = true;
  g.add(lakeCore);
  const shardMat = mat(0xa8c8e0, { roughness: 0.3, metalness: 0.05 });
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const r = 10.2 + (i % 3) * 0.7;
    const h = 0.6 + ((i * 37) % 10) / 10 * 0.9;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.45, h, 5), shardMat);
    shard.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    shard.rotation.set(((i * 13) % 10) / 10 * 0.3 - 0.15, a, ((i * 29) % 10) / 10 * 0.3 - 0.15);
    shard.castShadow = true;
    shard.receiveShadow = true;
    g.add(shard);
  }

  // Helipad: dark circle with an H, on the snow just south of the lake.
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(4, 40),
    new THREE.MeshStandardMaterial({ color: 0x2b3648, roughness: 0.9 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.03, 18);
  pad.receiveShadow = true;
  g.add(pad);
  const hBar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 4.5),
    new THREE.MeshBasicMaterial({ color: PALETTE.hazard }),
  );
  hBar.rotation.x = -Math.PI / 2;
  hBar.position.set(0, 0.05, 18);
  g.add(hBar);
  const hCross = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.5),
    new THREE.MeshBasicMaterial({ color: PALETTE.hazard }),
  );
  hCross.rotation.x = -Math.PI / 2;
  hCross.position.set(0, 0.05, 18);
  g.add(hCross);

  // Perimeter ice walls, from the collider data.
  const iceMat = mat(PALETTE.ice, { roughness: 0.4, metalness: 0.1 });
  for (const c of byKind('wall')) {
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    g.add(box(w, c.y1, d, (c.x0 + c.x1) / 2, c.y1 / 2, (c.z0 + c.z1) / 2, iceMat));
  }

  // Research complex modules (west): dark steel boxes with warm
  // windows facing east, one per module.
  const habMat = mat(PALETTE.steelDark, { roughness: 0.7 });
  const habTrim = mat(PALETTE.steelLight, { roughness: 0.5 });
  // One shared window material; the day/night cycle dims it by day.
  const windowMat = new THREE.MeshBasicMaterial({ color: PALETTE.windowWarm });
  handles.windowMat = windowMat;
  for (const c of byKind('hab')) {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, cx(c), c.y1 / 2, cz(c), habMat));
    g.add(box(c.x1 - c.x0 + 0.2, 0.25, c.z1 - c.z0 + 0.2, cx(c), c.y1 + 0.1, cz(c), habTrim));
    windows(g, windowMat, c.x1, 1.7, cz(c), 3, 1.6, 'east');
    const warm = new THREE.PointLight(PALETTE.windowWarm, 14, 20, 2);
    warm.position.set(c.x1 + 2.2, 2.2, cz(c));
    scene.add(warm);
    handles.windowLights.push(warm);
  }

  // Storage Yard containers (east): corrugated steel in cold tones.
  const contMats = [mat(0x51697f), mat(0x6b5a44), mat(0x44586b)];
  byKind('container').forEach((c, i) => {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, cx(c), c.y1 / 2, cz(c), contMats[i % 3]));
    g.add(box(0.15, c.y1, c.z1 - c.z0, c.x0 + 0.1, c.y1 / 2, cz(c), mat(PALETTE.steelLight)));
  });

  // Reactor Hall (site B): tall hall with glowing cyan vents and a
  // pipe run on its south face.
  const hall = byKind('hall')[0];
  const hallMat = mat(0x37455a, { roughness: 0.6, metalness: 0.2 });
  g.add(box(hall.x1 - hall.x0, hall.y1, hall.z1 - hall.z0, cx(hall), hall.y1 / 2, cz(hall), hallMat));
  const ventMat = new THREE.MeshBasicMaterial({ color: PALETTE.aurora });
  for (let i = 0; i < 4; i += 1) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), ventMat);
    v.position.set(cx(hall) - 5.4 + i * 3.6, 5.5, hall.z1 + 0.06);
    g.add(v);
  }
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 12, 12),
    mat(PALETTE.steelLight, { metalness: 0.4 }),
  );
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(cx(hall), 6.4, hall.z1 + 0.5);
  pipe.castShadow = true;
  pipe.receiveShadow = true;
  g.add(pipe);

  // Comms Array masts (site A): two dishes on poles.
  const mastMat = mat(PALETTE.steel, { metalness: 0.35 });
  for (const c of byKind('mast')) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, c.y1, 10), mastMat);
    pole.position.set(cx(c), c.y1 / 2, cz(c));
    pole.castShadow = true;
    pole.receiveShadow = true;
    g.add(pole);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, 0.9),
      mat(PALETTE.ice, { roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }),
    );
    dish.position.set(cx(c), c.y1 + 0.4, cz(c));
    dish.rotation.x = Math.PI * 0.72;
    dish.rotation.z = 0.5;
    dish.castShadow = true;
    dish.receiveShadow = true;
    g.add(dish);
  }

  // Relay tower, just east of the centre lane: thin mast with a
  // steady dim red beacon (never blinking).
  const tower = byKind('tower')[0];
  const tx = cx(tower);
  const tz = cz(tower);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, tower.y1, 8), mastMat);
  mast.position.set(tx, tower.y1 / 2, tz);
  mast.castShadow = true;
  mast.receiveShadow = true;
  g.add(mast);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x8a2a22 }),
  );
  beacon.position.set(tx, tower.y1 + 0.3, tz);
  g.add(beacon);
  animated.towerBeacon = beacon;

  // Glacier ridge, north: two tall ice walls with a gap between them.
  const ridgeMat = mat(0x8fc0d8, { roughness: 0.35, metalness: 0.05 });
  for (const c of byKind('ridge')) {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, cx(c), c.y1 / 2, cz(c), ridgeMat));
    // A jagged crest on top, so the ridge is not a flat slab.
    g.add(box((c.x1 - c.x0) * 0.55, 1.4, (c.z1 - c.z0) * 0.7, cx(c) - 2, c.y1 + 0.6, cz(c), ridgeMat));
  }

  // Crashed plane, east-north: fuselage lying nose-down, one wing
  // across it, tail fin at the far end.
  const planeMetal = mat(0x7a828c, { roughness: 0.55, metalness: 0.5 });
  const planeDark = mat(0x4a525c, { roughness: 0.6, metalness: 0.4 });
  const fuse = byKind('plane')[0];
  const wing = byKind('plane')[1];
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, fuse.x1 - fuse.x0, 12), planeMetal);
  fuselage.rotation.z = Math.PI / 2 + 0.1;
  fuselage.position.set(cx(fuse), 1.7, cz(fuse));
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.5, 12), planeDark);
  nose.rotation.z = Math.PI / 2 + 0.1;
  nose.position.set(fuse.x0 - 0.8, 1.1, cz(fuse));
  nose.castShadow = true;
  g.add(nose);
  const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(wing.x1 - wing.x0, 0.25, wing.z1 - wing.z0), planeDark);
  wingMesh.position.set(cx(wing), 1.3, cz(wing));
  wingMesh.rotation.y = 0.12;
  wingMesh.castShadow = true;
  wingMesh.receiveShadow = true;
  g.add(wingMesh);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 2.5), planeMetal);
  fin.position.set(fuse.x1 - 1.2, 3.4, cz(fuse));
  fin.rotation.z = -0.2;
  fin.castShadow = true;
  g.add(fin);

  // Low plaza walls flanking the lake (two pairs, gaps to walk through).
  const wallMat = mat(PALETTE.rock);
  for (const c of byKind('barrier')) {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, (c.x0 + c.x1) / 2, c.y1 / 2, (c.z0 + c.z1) / 2, wallMat));
  }

  // Supply crates.
  const crateMat = mat(0x7a6a4e, { roughness: 0.9 });
  for (const c of byKind('crate')) {
    g.add(box(c.x1 - c.x0, c.y1, c.z1 - c.z0, (c.x0 + c.x1) / 2, c.y1 / 2, (c.z0 + c.z1) / 2, crateMat));
  }

  // Fuel tanks: squat cylinders with hazard bands.
  const tankMat = mat(0x8a4a3a, { roughness: 0.6, metalness: 0.2 });
  for (const c of byKind('tank')) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, c.y1, 18), tankMat);
    tank.position.set(cx(c), c.y1 / 2, cz(c));
    tank.castShadow = true;
    tank.receiveShadow = true;
    g.add(tank);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.42, 0.3, 18),
      new THREE.MeshBasicMaterial({ color: PALETTE.hazard }),
    );
    band.position.set(cx(c), c.y1 - 0.5, cz(c));
    g.add(band);
  }

  // Snow hill, south-west: a big four-sided drift to fight around.
  const hill = byKind('hill')[0];
  const hillMesh = new THREE.Mesh(
    new THREE.ConeGeometry(8, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.95, metalness: 0, flatShading: true }),
  );
  hillMesh.position.set(cx(hill), 1.4, cz(hill));
  hillMesh.rotation.y = Math.PI / 4;
  hillMesh.castShadow = true;
  hillMesh.receiveShadow = true;
  g.add(hillMesh);

  // Observation tower, south-east: legs, a platform and a hut with a
  // warm window, high above the south lane.
  const deck = byKind('deck')[0];
  const deckMat = mat(PALETTE.steelDark, { roughness: 0.7 });
  for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4, 8), deckMat);
    leg.position.set(cx(deck) + lx, 2, cz(deck) + lz);
    leg.castShadow = true;
    g.add(leg);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), deckMat);
  platform.position.set(cx(deck), 4.1, cz(deck));
  platform.castShadow = true;
  platform.receiveShadow = true;
  g.add(platform);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.2), mat(PALETTE.steelLight, { roughness: 0.6 }));
  hut.position.set(cx(deck), 5.1, cz(deck));
  hut.castShadow = true;
  hut.receiveShadow = true;
  g.add(hut);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.9, flatShading: true }),
  );
  roof.position.set(cx(deck), 6.5, cz(deck));
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const hutWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), windowMat);
  hutWindow.position.set(cx(deck), 5.2, cz(deck) - 1.12);
  hutWindow.rotation.y = Math.PI;
  g.add(hutWindow);

  // Site rings: glowing circles on the snow marking the plant zones.
  for (const [key, site] of Object.entries(SITES)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.r - 0.8, site.r, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.aurora, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
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

  // ---- Backdrop: mountains, glacier, sky -------------------------------
  // A ring of faceted peaks beyond the walls. The two north-centre
  // peaks are deliberately low, so the aurora shows through the gap
  // between them. All standard materials: the day/night lights tint
  // them automatically, warm at noon, cold blue at night.
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.95, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.9, flatShading: true });
  const peaks = [
    [-95, -72, 48, 26], [-60, -82, 55, 30], [-28, -85, 30, 22], [5, -88, 32, 24],
    [38, -84, 52, 28], [72, -78, 58, 30], [100, -68, 45, 26],
    [102, -30, 50, 28], [105, 8, 62, 32], [98, 45, 48, 26],
    [85, 82, 55, 30], [45, 90, 48, 28], [5, 86, 60, 32], [-38, 90, 52, 28], [-82, 82, 58, 30],
    [-100, 42, 50, 28], [-104, 0, 64, 32], [-98, -38, 46, 26],
  ];
  for (const [px, pz, ph, pr] of peaks) {
    const rock = new THREE.Mesh(new THREE.ConeGeometry(pr, ph, 7), rockMat);
    rock.position.set(px, ph / 2 - 1, pz);
    rock.rotation.y = (px * 7 + pz * 3) % Math.PI;
    g.add(rock);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(pr * 0.45, ph * 0.42, 7), capMat);
    cap.position.set(px, ph * 0.79 - 1, pz);
    cap.rotation.y = rock.rotation.y;
    g.add(cap);
  }

  // Glacier face, far north: a wide pale-blue ice wall with dark
  // crevasse stripes, low enough that the aurora clears it.
  const glacierMat = mat(0x7fb4d4, { roughness: 0.35, metalness: 0.05 });
  const glacier = new THREE.Mesh(new THREE.BoxGeometry(140, 22, 7), glacierMat);
  glacier.position.set(0, 11, -92.5);
  g.add(glacier);
  const crevasseMat = new THREE.MeshBasicMaterial({ color: 0x2e5f7a });
  for (const [sx, sw, sh] of [[-52, 2.5, 14], [-28, 1.8, 18], [-4, 3, 12], [22, 2, 16], [48, 2.6, 13]]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.4), crevasseMat);
    stripe.position.set(sx, sh / 2 + 1, -88.9);
    g.add(stripe);
  }
  // A smaller glacier shoulder to the west, for depth.
  const glacierW = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 6), glacierMat);
  glacierW.position.set(-90, 7, -57);
  g.add(glacierW);

  // Moon: a pale disc in the northern sky. The day/night cycle moves
  // it along its arc and hides it once the sun is up.
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshBasicMaterial({ color: 0xc8d6e8, fog: false }),
  );
  moon.position.set(-38, 46, -85);
  moon.lookAt(0, 0, 0);
  g.add(moon);
  handles.moon = moon;

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
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xb8c8e0, size: 0.9, sizeAttenuation: false, transparent: true, opacity: 0.6, fog: false }));
  g.add(stars);
  handles.stars = stars;

  // Aurora: a wide ribbon in the northern sky, animated by a shader,
  // now broad enough to span the bigger map and set behind the
  // glacier, so it rises above the low north-centre peaks.
  // uOpacity is driven by the day/night cycle — full at night, zero
  // by day — so the ribbon fades with the stars instead of vanishing.
  const auroraUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 } };
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
      uniform float uOpacity;
      void main() {
        float band = sin(vUv.x * 9.0 + uTime * 0.35 + sin(vUv.x * 4.0) * 2.0);
        float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float glow = 0.5 + 0.5 * band;
        vec3 green = vec3(0.18, 0.72, 0.50);
        vec3 cyan = vec3(0.16, 0.60, 0.75);
        vec3 col = mix(green, cyan, vUv.y);
        gl_FragColor = vec4(col, edge * (0.10 + 0.16 * glow) * uOpacity);
      }`,
  });
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(200, 24, 48, 1), auroraMat);
  aurora.position.set(0, 42, -105);
  aurora.rotation.x = 0.25;
  g.add(aurora);
  animated.aurora = auroraUniforms;
  handles.auroraMat = auroraMat;
  handles.auroraMesh = aurora;

  // Lights: cold moonlight, sky fill, warm windows, cyan site beacons.
  // The hemisphere + moon light are driven by the day/night cycle.
  const hemi = new THREE.HemisphereLight(0x16294d, 0x0a0f1c, 0.65);
  scene.add(hemi);
  handles.hemi = hemi;
  const moonLight = new THREE.DirectionalLight(0xbcd3ff, 0.85);
  moonLight.position.set(30, 45, -20);
  scene.add(moonLight);
  handles.moonLight = moonLight;
  for (const site of Object.values(SITES)) {
    const beaconLight = new THREE.PointLight(PALETTE.aurora, 7, 15, 2);
    beaconLight.position.set(site.x, 3.4, site.z);
    scene.add(beaconLight);
  }

  return {
    group: g,
    handles,
    update(t) {
      animated.aurora.uTime.value = t;
      // Tower beacon: steady dim red, never blinking (blinking lights
      // are hard on the eyes).
      animated.towerBeacon.material.color.setHex(0x8a2a22);
      for (const ring of Object.values(animated.rings)) {
        ring.material.opacity = 0.22 + 0.08 * Math.sin(t * 1.6);
      }
    },
  };
}
