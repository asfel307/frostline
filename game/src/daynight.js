// Frostline — day/night cycle: one full day every 6 minutes of game
// time, so a single match visibly moves through dawn, day, dusk and
// night. Every lighting value is lerped between keyframes (smoothstep,
// never a jump), and the sun is a warm pale disc — never a blinding
// white — so the day stays as easy on the eyes as the night.
//
// The module owns the sun (light + disc) and drives the pieces
// station.js built (hemisphere + moon light, moon disc, stars, aurora
// shader, ground, window lights) through the handles buildStation
// returns. Nothing here touches gameplay: hitboxes, speeds, damage
// and round logic are all elsewhere.
import * as THREE from 'three';

// One full day per 6 minutes: fast enough that a match shows the
// change, slow enough that no single round whips through it.
export const CYCLE_SECONDS = 360;
// The match opens just before dawn, so the first round walks the
// player from night into morning light.
export const START_HOUR = 5.5;

// Keyframes: [hour, sky, fog, hemiSky, hemiGround, hemiInt,
//   sunColor, sunInt, moonInt, aurora, stars, snow, windowInt, day]
// `day` is 0 at full night, 1 at full day — the HUD reads it.
const KEYS = [
  [0.0, 0x050914, 0x0a1328, 0x16294d, 0x0a0f1c, 0.65, 0x000000, 0.00, 0.85, 1.00, 0.60, 0xb9c9dd, 14, 0.00],
  [4.5, 0x050914, 0x0a1328, 0x16294d, 0x0a0f1c, 0.65, 0x000000, 0.00, 0.85, 1.00, 0.60, 0xb9c9dd, 14, 0.00],
  [5.5, 0x1a2038, 0x1e2438, 0x2a3454, 0x141824, 0.70, 0xe8a06a, 0.15, 0.60, 0.70, 0.40, 0xbcc9db, 12, 0.05],
  [6.5, 0x5a4a58, 0x4a3f52, 0x6a5a72, 0x2a2438, 0.85, 0xf2b078, 0.80, 0.20, 0.25, 0.08, 0xc9d4e2, 7, 0.35],
  [8.0, 0x7fa8c9, 0x9ab4c8, 0x8fb4d4, 0x5a6a7a, 1.05, 0xf2d8a8, 1.50, 0.00, 0.00, 0.00, 0xdfe8f2, 3, 0.90],
  [12.0, 0x86b0d0, 0xa8c0d4, 0x9abfdd, 0x66707e, 1.15, 0xf6e2b8, 1.70, 0.00, 0.00, 0.00, 0xe4ecf5, 2, 1.00],
  [16.0, 0x7fa8c9, 0x9ab4c8, 0x8fb4d4, 0x5a6a7a, 1.05, 0xf2d8a8, 1.50, 0.00, 0.00, 0.00, 0xdfe8f2, 3, 0.90],
  [17.5, 0x6a4a52, 0x54404e, 0x74585f, 0x2e2630, 0.90, 0xf09a62, 0.90, 0.10, 0.20, 0.05, 0xcdd6e4, 6, 0.40],
  [19.0, 0x241e38, 0x222038, 0x32344f, 0x161824, 0.75, 0xe88a5a, 0.20, 0.40, 0.60, 0.30, 0xc0cddd, 10, 0.08],
  [20.5, 0x050914, 0x0a1328, 0x16294d, 0x0a0f1c, 0.65, 0x000000, 0.00, 0.85, 1.00, 0.60, 0xb9c9dd, 14, 0.00],
  [24.0, 0x050914, 0x0a1328, 0x16294d, 0x0a0f1c, 0.65, 0x000000, 0.00, 0.85, 1.00, 0.60, 0xb9c9dd, 14, 0.00],
];

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function sample(hour) {
  // Find the surrounding keyframes (wrapping past midnight).
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (hour - a[0]) / (b[0] - a[0]))));
  const mix = (idx) => a[idx] + (b[idx] - a[idx]) * t;
  const col = (idx) => _c1.setHex(a[idx]).lerp(_c2.setHex(b[idx]), t).clone();
  return {
    sky: col(1),
    fog: col(2),
    hemiSky: col(3),
    hemiGround: col(4),
    hemiInt: mix(5),
    sunColor: col(6),
    sunInt: mix(7),
    moonInt: mix(8),
    aurora: mix(9),
    stars: mix(10),
    snow: col(11),
    windowInt: mix(12),
    day: mix(13),
  };
}

export function phaseLabel(hour) {
  if (hour >= 5 && hour < 7) return 'FAJAR';
  if (hour >= 7 && hour < 17) return 'SIANG';
  if (hour >= 17 && hour < 19.5) return 'SENJA';
  return 'MALAM';
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Sun arc: rises east (+x), noon high, sets west (-x). The arc runs
// high enough that the disc clears the mountain ring at noon.
function sunPos(hour, out) {
  const th = ((hour - 6) / 12) * Math.PI;
  out.set(Math.cos(th) * 85, Math.sin(th) * 75 + 8, -25);
  return out;
}
function moonPos(hour, out) {
  const ph = (((hour - 18 + 24) % 24) / 12) * Math.PI;
  out.set(Math.cos(ph) * 75, Math.sin(ph) * 70 + 10, -70);
  return out;
}

export function createDayNight(scene, refs) {
  // refs: { hemi, moonLight, moon, stars, auroraMat, auroraMesh,
  //   groundMat, windowLights, windowMat } — everything station.js
  //   built that the time of day must move.
  const sunLight = new THREE.DirectionalLight(0xf2d8a8, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -70;
  sunLight.shadow.camera.right = 70;
  sunLight.shadow.camera.top = 70;
  sunLight.shadow.camera.bottom = -70;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 320;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // The moon light also casts, so night scenes keep soft shadows.
  refs.moonLight.castShadow = true;
  refs.moonLight.shadow.mapSize.set(1024, 1024);
  refs.moonLight.shadow.camera.left = -70;
  refs.moonLight.shadow.camera.right = 70;
  refs.moonLight.shadow.camera.top = 70;
  refs.moonLight.shadow.camera.bottom = -70;
  refs.moonLight.shadow.camera.near = 5;
  refs.moonLight.shadow.camera.far = 320;
  refs.moonLight.shadow.bias = -0.0005;
  refs.moonLight.shadow.normalBias = 0.03;
  scene.add(refs.moonLight.target);

  // Sun disc: warm pale gold, never white — a soft glow, not a glare.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2d8a8, fog: false, transparent: true, opacity: 0.95 }),
  );
  scene.add(sunDisc);
  const sunHalo = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2d8a8, fog: false, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(sunHalo);

  const _sun = new THREE.Vector3();
  const _moon = new THREE.Vector3();
  let startHour = START_HOUR;
  const state = { hour: START_HOUR, label: 'MALAM', dayFactor: 0, clock: '05:30' };

  return {
    state,
    setStartHour(h) {
      startHour = ((h % 24) + 24) % 24;
    },
    update(gameTime) {
      const hour = (startHour + (gameTime / CYCLE_SECONDS) * 24) % 24;
      const k = sample(hour);
      state.hour = hour;
      state.label = phaseLabel(hour);
      state.dayFactor = k.day;
      state.clock = formatClock(hour);

      // Sky + fog + ground tint follow the keyframes.
      scene.background.copy(k.sky);
      scene.fog.color.copy(k.fog);
      refs.groundMat.color.copy(k.snow);

      // Sky fill + moonlight.
      refs.hemi.color.copy(k.hemiSky);
      refs.hemi.groundColor.copy(k.hemiGround);
      refs.hemi.intensity = k.hemiInt;
      refs.moonLight.intensity = k.moonInt;
      refs.moonLight.color.setHex(0xbcd3ff);

      // Sun: position on its arc, light + disc follow the keyframes.
      sunPos(hour, _sun);
      sunLight.position.copy(_sun);
      sunLight.color.copy(k.sunColor);
      sunLight.intensity = k.sunInt;
      sunLight.castShadow = k.sunInt > 0.15;
      sunDisc.position.copy(_sun);
      sunDisc.lookAt(0, 0, 0);
      sunDisc.visible = k.sunInt > 0.02;
      sunDisc.material.color.copy(k.sunColor);
      sunHalo.position.copy(_sun);
      sunHalo.lookAt(0, 0, 0);
      sunHalo.visible = k.sunInt > 0.02;
      sunHalo.material.color.copy(k.sunColor);
      refs.moonLight.castShadow = k.moonInt > 0.15;

      // Moon disc rides its own arc; hidden once the sun takes over.
      // The moon light rides with it, so night shadows track the moon.
      moonPos(hour, _moon);
      refs.moon.position.copy(_moon);
      refs.moon.lookAt(0, 0, 0);
      refs.moon.visible = k.moonInt > 0.02;
      refs.moonLight.position.copy(_moon);

      // Stars + aurora fade out by day, back by night.
      refs.stars.material.opacity = 0.6 * k.stars;
      refs.stars.visible = k.stars > 0.01;
      refs.auroraMat.uniforms.uOpacity.value = k.aurora;
      refs.auroraMesh.visible = k.aurora > 0.01;

      // Window lights burn bright at night, dim to a faint glow by day.
      for (const w of refs.windowLights) w.intensity = k.windowInt;
    },
  };
}
