// Frostline — navigation data for Station Aurora (expanded map).
// Pure module: no three.js import, so a plain `node` test can import it
// and prove every waypoint segment is walkable. All coordinates are in
// metres; north is -z, east is +x. The station is 120 m wide (x -60..60)
// and 90 m deep (z -45..45) — about 3x the area of the old 70x50 map,
// so the two spawns sit ~80 m apart and no lane meets the enemy in the
// first seconds.
//
// Layout: attackers (Northwind) spawn south, defenders (Icefall) north.
// Site A, the Comms Array, sits north-west; site B, the Reactor Hall,
// north-east, with the crashed plane as its neighbour. Three lanes join
// them: the Research Complex west, the Frozen Lake centre, the Storage
// Yard east. A glacier ridge guards the north with one gap in the
// middle; a snow hill (south-west) and an observation tower (south-east)
// anchor the two southern corners.

// Axis-aligned solid boxes. {x0,z0} is the south-west corner,
// {x1,z1} the north-east corner, y1 the top height. Anything with
// y1 above 0.4 blocks a walking agent; anything above 1.0 blocks sight.
// `kind` tells station.js which mesh to build from the box.
export const COLLIDERS = [
  // Perimeter ice walls.
  { x0: -60, z0: -45, x1: -58.5, z1: 45, y1: 4, kind: 'wall' },
  { x0: 58.5, z0: -45, x1: 60, z1: 45, y1: 4, kind: 'wall' },
  { x0: -60, z0: -45, x1: 60, z1: -43.5, y1: 4, kind: 'wall' },
  { x0: -60, z0: 43.5, x1: 60, z1: 45, y1: 4, kind: 'wall' },
  // Research complex modules, west lane (gaps between them are the lane).
  { x0: -52, z0: -24, x1: -44, z1: -18, y1: 3.5, kind: 'hab' },
  { x0: -52, z0: -8, x1: -44, z1: -2, y1: 3.5, kind: 'hab' },
  { x0: -52, z0: 8, x1: -44, z1: 14, y1: 3.5, kind: 'hab' },
  { x0: -52, z0: 22, x1: -44, z1: 28, y1: 3.5, kind: 'hab' },
  // Storage Yard containers, east lane.
  { x0: 44, z0: -24, x1: 52, z1: -18, y1: 2.8, kind: 'container' },
  { x0: 44, z0: -8, x1: 52, z1: -2, y1: 2.8, kind: 'container' },
  { x0: 44, z0: 8, x1: 52, z1: 14, y1: 2.8, kind: 'container' },
  { x0: 44, z0: 22, x1: 52, z1: 28, y1: 2.8, kind: 'container' },
  // Reactor Hall, site B building.
  { x0: 32, z0: -32, x1: 48, z1: -22, y1: 7, kind: 'hall' },
  // Comms Array masts, site A (thin poles, small footprint).
  { x0: -44, z0: -30, x1: -43, z1: -29, y1: 10, kind: 'mast' },
  { x0: -38, z0: -31, x1: -37, z1: -30, y1: 7, kind: 'mast' },
  // Comms relay tower, just east of the centre lane.
  { x0: 4, z0: -16, x1: 6, z1: -14, y1: 9, kind: 'tower' },
  // Glacier ridge, north: two segments with a gap in the middle
  // (the only straight route from the north spawn to the sites).
  { x0: -22, z0: -36, x1: -8, z1: -33, y1: 5, kind: 'ridge' },
  { x0: 8, z0: -36, x1: 22, z1: -33, y1: 5, kind: 'ridge' },
  // Crashed plane, east-north: fuselage + one wing.
  { x0: 46, z0: -18, x1: 58, z1: -14, y1: 3.5, kind: 'plane' },
  { x0: 48, z0: -20, x1: 52, z1: -11, y1: 1.2, kind: 'plane' },
  // Low walls flanking the frozen lake, with gaps to walk through.
  { x0: -6, z0: 10, x1: -3, z1: 11, y1: 1.1, kind: 'barrier' },
  { x0: 3, z0: 10, x1: 6, z1: 11, y1: 1.1, kind: 'barrier' },
  { x0: -6, z0: -12, x1: -3, z1: -11, y1: 1.1, kind: 'barrier' },
  { x0: 3, z0: -12, x1: 6, z1: -11, y1: 1.1, kind: 'barrier' },
  // Supply crates.
  { x0: -29, z0: 7, x1: -26, z1: 10, y1: 1.2, kind: 'crate' },
  { x0: 26, z0: 7, x1: 29, z1: 10, y1: 1.2, kind: 'crate' },
  { x0: -28, z0: 19, x1: -25, z1: 22, y1: 1.2, kind: 'crate' },
  { x0: 25, z0: 19, x1: 28, z1: 22, y1: 1.2, kind: 'crate' },
  { x0: -38, z0: 26, x1: -35, z1: 29, y1: 1.2, kind: 'crate' },
  { x0: 35, z0: 26, x1: 38, z1: 29, y1: 1.2, kind: 'crate' },
  // Fuel tanks, south lanes.
  { x0: -26, z0: 32, x1: -22, z1: 36, y1: 3, kind: 'tank' },
  { x0: 22, z0: 32, x1: 26, z1: 36, y1: 3, kind: 'tank' },
  // Snow hill, south-west: a big drift to fight around.
  { x0: -50, z0: 20, x1: -38, z1: 32, y1: 2.5, kind: 'hill' },
  // Observation tower base, south-east (platform + hut above, visual).
  { x0: 15, z0: 40, x1: 17, z1: 42, y1: 4, kind: 'deck' },
];

// Waypoints the bots walk. Links are bidirectional.
// Spines: centre x=0, west x=-32, east x=24, cross-links at z 22/14/0/-8.
export const NODES = [
  { id: 0, x: 0, z: 40, links: [1, 2, 3] },
  { id: 1, x: -8, z: 38, links: [0, 6, 3, 4] },
  { id: 2, x: 8, z: 38, links: [0, 7, 3, 5] },
  { id: 3, x: 0, z: 30, links: [0, 1, 2, 8, 35, 36] },
  { id: 4, x: -32, z: 26, links: [1, 6, 15, 35] },
  { id: 5, x: 24, z: 26, links: [2, 7, 19, 36] },
  { id: 6, x: -40, z: 38, links: [1, 4] },
  { id: 7, x: 44, z: 38, links: [2, 5] },
  { id: 8, x: 0, z: 22, links: [3, 9, 31, 32] },
  { id: 9, x: 0, z: 12, links: [8, 10, 31, 32] },
  { id: 10, x: 0, z: 0, links: [9, 11, 16, 20] },
  { id: 11, x: 0, z: -10, links: [10, 12, 33, 34] },
  { id: 12, x: 0, z: -20, links: [11, 13, 33] },
  { id: 13, x: 0, z: -28, links: [12, 14, 25, 26] },
  { id: 14, x: 0, z: -38, links: [13, 27, 28] },
  { id: 15, x: -32, z: 14, links: [4, 16, 31, 35] },
  { id: 16, x: -32, z: 0, links: [15, 17, 10, 33] },
  { id: 17, x: -32, z: -14, links: [16, 18, 33] },
  { id: 18, x: -32, z: -26, links: [17, 23, 25] },
  { id: 19, x: 24, z: 14, links: [5, 20, 32, 36] },
  { id: 20, x: 24, z: 0, links: [19, 21, 10, 34] },
  { id: 21, x: 24, z: -14, links: [20, 22, 34, 24] },
  { id: 22, x: 24, z: -26, links: [21, 26] },
  { id: 23, x: -40, z: -20, links: [18, 29, 25] },
  { id: 24, x: 40, z: -14, links: [21] },
  { id: 25, x: -16, z: -30, links: [13, 18, 23] },
  { id: 26, x: 16, z: -30, links: [13, 22, 30] },
  { id: 27, x: -16, z: -40, links: [14, 29] },
  { id: 28, x: 16, z: -40, links: [14, 30] },
  { id: 29, x: -40, z: -38, links: [23, 27] },
  { id: 30, x: 40, z: -38, links: [28, 26] },
  { id: 31, x: -16, z: 14, links: [8, 9, 15, 35] },
  { id: 32, x: 16, z: 14, links: [8, 9, 19, 36] },
  { id: 33, x: -16, z: -8, links: [11, 12, 16, 17] },
  { id: 34, x: 16, z: -8, links: [11, 20, 21] },
  { id: 35, x: -16, z: 22, links: [3, 4, 15, 31] },
  { id: 36, x: 16, z: 22, links: [3, 5, 19, 32] },
];

export const SPAWNS = {
  north: [
    { x: 0, z: 40, yaw: 0 },
    { x: -3, z: 40, yaw: 0 },
    { x: 3, z: 40, yaw: 0 },
    { x: -6, z: 40, yaw: 0 },
    { x: 6, z: 40, yaw: 0 },
  ],
  ice: [
    { x: 0, z: -40, yaw: Math.PI },
    { x: -3, z: -40, yaw: Math.PI },
    { x: 3, z: -40, yaw: Math.PI },
    { x: -6, z: -40, yaw: Math.PI },
    { x: 6, z: -40, yaw: Math.PI },
  ],
};

export const SITES = {
  A: { x: -40, z: -26, r: 5, name: 'Comms Array' },
  B: { x: 40, z: -18, r: 5, name: 'Reactor Hall' },
};

const BY_ID = new Map(NODES.map((n) => [n.id, n]));

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// True when the straight segment between two ground points would push a
// walker of the given radius into a solid that is tall enough to block.
export function segmentBlocked(ax, az, bx, bz, radius, minHeight = 0.4) {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / 0.3));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const c of COLLIDERS) {
      if (c.y1 <= minHeight) continue;
      if (x > c.x0 - radius && x < c.x1 + radius && z > c.z0 - radius && z < c.z1 + radius) return true;
    }
  }
  return false;
}

// True when two points can see each other: no tall solid crosses the line.
export function lineOfSight(ax, az, bx, bz) {
  return !segmentBlocked(ax, az, bx, bz, 0.05, 1.0);
}

export function nearestNode(x, z) {
  let best = NODES[0];
  let bestD = Infinity;
  for (const n of NODES) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

// A* over the waypoint graph. Returns an array of node ids, start to goal.
export function findPath(fromId, toId) {
  if (fromId === toId) return [fromId];
  const open = [{ id: fromId, f: 0 }];
  const came = new Map();
  const g = new Map([[fromId, 0]]);
  const closed = new Set();
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.id === toId) {
      const path = [toId];
      let at = toId;
      while (came.has(at)) {
        at = came.get(at);
        path.unshift(at);
      }
      return path;
    }
    closed.add(cur.id);
    const node = BY_ID.get(cur.id);
    for (const link of node.links) {
      if (closed.has(link)) continue;
      const ng = g.get(cur.id) + dist(node, BY_ID.get(link));
      if (ng < (g.get(link) ?? Infinity)) {
        g.set(link, ng);
        came.set(link, cur.id);
        const h = dist(BY_ID.get(link), BY_ID.get(toId));
        const found = open.find((o) => o.id === link);
        if (found) found.f = ng + h;
        else open.push({ id: link, f: ng + h });
      }
    }
  }
  return [fromId];
}
