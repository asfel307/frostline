// Frostline — effects: tracers, muzzle flash, impact sparks, falling
// snow and the planted-charge glow. Everything is pooled: no new
// objects are made in the hot loop, meshes are reused and hidden when
// their life runs out.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// A soft round dot, drawn once on a canvas and reused as the sprite
// for snow and sparks: raw THREE.Points render as hard squares, which
// look like floating paper at close range.
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

const TRACER_POOL = 24;
const SPARK_POOL = 10;

export function createEffects(scene) {
  const dotTex = makeDotTexture();
  // Tracers: one LineSegments with a fixed vertex buffer, segments are
  // written into it and fade by shrinking their life.
  const tracerGeo = new THREE.BufferGeometry();
  const tracerPos = new Float32Array(TRACER_POOL * 2 * 3);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracerMat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9 });
  const tracers = new THREE.LineSegments(tracerGeo, tracerMat);
  tracers.frustumCulled = false;
  scene.add(tracers);
  const tracerLife = new Float32Array(TRACER_POOL);
  let tracerNext = 0;

  // Impact sparks: small point clouds, one per burst.
  const sparks = [];
  for (let i = 0; i < SPARK_POOL; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe9a8, size: 3, sizeAttenuation: false, map: dotTex, transparent: true, opacity: 0, depthWrite: false }));
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    sparks.push({ pts, life: 0, vel: new Float32Array(12 * 3) });
  }
  let sparkNext = 0;

  // Muzzle flash: a sprite plus a point light at the gun.
  const flashMat = new THREE.SpriteMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.set(0.7, 0.7, 1);
  scene.add(flash);
  const flashLight = new THREE.PointLight(0xffc070, 0, 9, 2);
  scene.add(flashLight);
  let flashLife = 0;

  // Snow: points drifting down in a box around the origin, wrapping.
  const SNOW_N = 1400;
  const snowPos = new Float32Array(SNOW_N * 3);
  const snowVel = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i += 1) {
    snowPos[i * 3] = (Math.random() - 0.5) * 90;
    snowPos[i * 3 + 1] = Math.random() * 26;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    snowVel[i] = 1.2 + Math.random() * 1.6;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  // sizeAttenuation off: every flake is the same few pixels on screen,
  // so a flake drifting past the camera never balloons into a blob.
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xeaf2fb, size: 2.5, sizeAttenuation: false, map: dotTex, transparent: true, opacity: 0.85, depthWrite: false }));
  snow.frustumCulled = false;
  scene.add(snow);

  // Planted charge glow: a pulsing cyan light, hidden until the plant.
  const bombLight = new THREE.PointLight(PALETTE.aurora, 0, 14, 2);
  scene.add(bombLight);
  const bombBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.5, 2.6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.aurora, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  scene.add(bombBeacon);

  return {
    addTracer(from, to, color) {
      const i = tracerNext;
      tracerNext = (tracerNext + 1) % TRACER_POOL;
      tracerPos[i * 6] = from.x;
      tracerPos[i * 6 + 1] = from.y;
      tracerPos[i * 6 + 2] = from.z;
      tracerPos[i * 6 + 3] = to.x;
      tracerPos[i * 6 + 4] = to.y;
      tracerPos[i * 6 + 5] = to.z;
      tracerLife[i] = 0.09;
      tracerGeo.attributes.position.needsUpdate = true;
      tracerMat.color.setHex(color ?? 0x9fd8ff);
    },
    addSparks(at) {
      const s = sparks[sparkNext];
      sparkNext = (sparkNext + 1) % SPARK_POOL;
      const pos = s.pts.geometry.attributes.position.array;
      for (let i = 0; i < 12; i += 1) {
        pos[i * 3] = at.x;
        pos[i * 3 + 1] = at.y;
        pos[i * 3 + 2] = at.z;
        const a = Math.random() * Math.PI * 2;
        const e = (Math.random() - 0.5) * Math.PI;
        const sp = 2 + Math.random() * 4;
        s.vel[i * 3] = Math.cos(a) * Math.cos(e) * sp;
        s.vel[i * 3 + 1] = Math.sin(e) * sp + 1.5;
        s.vel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * sp;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
      s.pts.visible = true;
      s.pts.material.opacity = 1;
      s.life = 0.35;
    },
    muzzle(at) {
      flash.position.copy(at);
      flash.material.opacity = 0.95;
      flashLight.position.copy(at);
      flashLight.intensity = 14;
      flashLife = 0.05;
    },
    setBomb(x, z, on, t) {
      bombLight.position.set(x, 1.2, z);
      bombLight.intensity = on ? 10 + 6 * Math.sin(t * 6) : 0;
      bombBeacon.position.set(x, 1.3, z);
      bombBeacon.material.opacity = on ? 0.25 + 0.12 * Math.sin(t * 6) : 0;
    },
    update(dt, t) {
      // Fade tracers by collapsing finished segments to a point.
      for (let i = 0; i < TRACER_POOL; i += 1) {
        if (tracerLife[i] > 0) {
          tracerLife[i] -= dt;
          if (tracerLife[i] <= 0) {
            tracerPos[i * 6 + 3] = tracerPos[i * 6];
            tracerPos[i * 6 + 4] = tracerPos[i * 6 + 1];
            tracerPos[i * 6 + 5] = tracerPos[i * 6 + 2];
          }
        }
      }
      tracerGeo.attributes.position.needsUpdate = true;
      for (const s of sparks) {
        if (s.life > 0) {
          s.life -= dt;
          const pos = s.pts.geometry.attributes.position.array;
          for (let i = 0; i < 12; i += 1) {
            pos[i * 3] += s.vel[i * 3] * dt;
            pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
            pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
            s.vel[i * 3 + 1] -= 9 * dt;
          }
          s.pts.geometry.attributes.position.needsUpdate = true;
          s.pts.material.opacity = Math.max(0, s.life / 0.35);
          if (s.life <= 0) s.pts.visible = false;
        }
      }
      if (flashLife > 0) {
        flashLife -= dt;
        if (flashLife <= 0) {
          flash.material.opacity = 0;
          flashLight.intensity = 0;
        }
      }
      // Snow falls and wraps inside its box.
      const p = snowGeo.attributes.position.array;
      for (let i = 0; i < SNOW_N; i += 1) {
        p[i * 3 + 1] -= snowVel[i] * dt;
        p[i * 3] += Math.sin(t * 0.7 + i) * 0.15 * dt;
        if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 26;
      }
      snowGeo.attributes.position.needsUpdate = true;
    },
  };
}
