// Frostline — navigation data for Station Aurora.
// Pure module: no three.js import, so a plain `node` test can import it
// and prove every waypoint segment is walkable. All coordinates are in
// metres; north is -z, east is +x. The station is 70 m wide (x -35..35)
// and 50 m deep (z -25..25).
//
// Layout: attackers (Northwind) spawn south, defenders (Icefall) north.
// Site A, the Comms Array, sits north-west; site B, the Reactor Hall,
// north-east. Three lanes join them: Hab Row west, the Frozen Plaza
// centre, the Storage Yard east.

// Axis-aligned solid boxes. {x0,z0} is the south-west corner,
// {x1,z1} the north-east corner, y1 the top height. Anything with
// y1 above 0.4 blocks a walking agent; anything above 1.0 blocks sight.
export const COLLIDERS = [
  // Perimeter ice walls.
  { x0: -35, z0: -25, x1: -33.5, z1: 25, y1: 4 },
  { x0: 33.5, z0: -25, x1: 35, z1: 25, y1: 4 },
  { x0: -35, z0: -25, x1: 35, z1: -23.5, y1: 4 },
  { x0: -35, z0: 23.5, x1: 35, z1: 25, y1: 4 },
  // Hab Row modules, west lane (gaps between them are the lane).
  { x0: -18, z0: -21, x1: -14, z1: -17, y1: 3 },
  { x0: -18, z0: -3, x1: -14, z1: 3, y1: 3 },
  { x0: -18, z0: 7, x1: -14, z1: 13, y1: 3 },
  // Storage Yard containers, east lane.
  { x0: 12, z0: -21, x1: 16, z1: -17, y1: 2.6 },
  { x0: 12, z0: -3, x1: 16, z1: 3, y1: 2.6 },
  { x0: 12, z0: 7, x1: 16, z1: 13, y1: 2.6 },
  // Reactor Hall, site B building.
  { x0: 16, z0: -20, x1: 28, z1: -13, y1: 6 },
  // Comms Array masts, site A (thin poles, small footprint).
  { x0: -25, z0: -17, x1: -24, z1: -16, y1: 9 },
  { x0: -20, z0: -18, x1: -19, z1: -17, y1: 6 },
  // Comms relay tower, mid-north.
  { x0: -5, z0: -11, x1: -3, z1: -9, y1: 8 },
  // Low wall across the plaza, with a gap in the middle to walk through.
  { x0: -3, z0: -2, x1: -1, z1: -1, y1: 1.1 },
  { x0: 1, z0: -2, x1: 3, z1: -1, y1: 1.1 },
  // Supply crates.
  { x0: -6, z0: 6, x1: -4, z1: 8, y1: 1.2 },
  { x0: 4, z0: 6, x1: 6, z1: 8, y1: 1.2 },
  { x0: -8, z0: -8, x1: -6, z1: -6, y1: 1.2 },
  { x0: 6, z0: -8, x1: 8, z1: -6, y1: 1.2 },
  // Fuel tanks, south lanes.
  { x0: -11.5, z0: 14.5, x1: -8.5, z1: 17.5, y1: 3 },
  { x0: 8.5, z0: 14.5, x1: 11.5, z1: 17.5, y1: 3 },
];

// Waypoints the bots walk. Links are bidirectional.
export const NODES = [
  { id: 0, x: 0, z: 21, links: [1] },
  { id: 1, x: 0, z: 14, links: [0, 2, 6, 11] },
  { id: 2, x: 0, z: 6, links: [1, 3, 6, 11] },
  { id: 3, x: 0, z: 0, links: [2, 4, 23, 24] },
  { id: 4, x: 0, z: -6, links: [3, 5, 19, 20] },
  { id: 5, x: 0, z: -14, links: [4, 17, 18] },
  { id: 6, x: -6, z: 14, links: [1, 2, 7] },
  { id: 7, x: -12, z: 8, links: [6, 8] },
  { id: 8, x: -12, z: 0, links: [7, 9, 19, 23] },
  { id: 9, x: -12, z: -8, links: [8, 21] },
  { id: 10, x: -22, z: -10, links: [9, 21] },
  { id: 11, x: 8, z: 14, links: [1, 2, 12] },
  { id: 12, x: 10, z: 8, links: [11, 13] },
  { id: 13, x: 10, z: 0, links: [12, 14, 20, 24] },
  { id: 14, x: 10, z: -8, links: [13, 15, 22] },
  { id: 15, x: 22, z: -8, links: [14, 22, 18] },
  { id: 16, x: 0, z: -21, links: [17, 18] },
  { id: 17, x: -8, z: -18, links: [16, 5, 21] },
  { id: 18, x: 7, z: -18, links: [16, 5, 22, 15] },
  { id: 19, x: -8, z: -2, links: [4, 8, 23] },
  { id: 20, x: 8, z: -2, links: [4, 13, 24] },
  { id: 21, x: -12, z: -16, links: [9, 10, 17] },
  { id: 22, x: 12, z: -13, links: [14, 15, 18] },
  { id: 23, x: -6, z: 2, links: [3, 8, 19] },
  { id: 24, x: 6, z: 2, links: [3, 13, 20] },
];

export const SPAWNS = {
  north: [
    { x: 0, z: 21, yaw: 0 },
    { x: -2, z: 21, yaw: 0 },
    { x: 2, z: 21, yaw: 0 },
    { x: -4, z: 21, yaw: 0 },
    { x: 4, z: 21, yaw: 0 },
  ],
  ice: [
    { x: 0, z: -21, yaw: Math.PI },
    { x: -2, z: -21, yaw: Math.PI },
    { x: 2, z: -21, yaw: Math.PI },
    { x: -4, z: -21, yaw: Math.PI },
    { x: 4, z: -21, yaw: Math.PI },
  ],
};

export const SITES = {
  A: { x: -22, z: -10, r: 5, name: 'Comms Array' },
  B: { x: 22, z: -8, r: 5, name: 'Reactor Hall' },
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
