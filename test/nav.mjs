// Node test: every waypoint segment must be walkable, every spawn must
// reach every site, and every site must be inside the map. Run with:
//   node test/nav.mjs
import { COLLIDERS, NODES, SPAWNS, SITES, segmentBlocked, findPath, nearestNode } from '../game/src/navgraph.js';

let bad = 0;
for (const node of NODES) {
  for (const link of node.links) {
    const other = NODES[link];
    if (segmentBlocked(node.x, node.z, other.x, other.z, 0.35)) {
      console.log(`BLOCKED segment ${node.id}(${node.x},${node.z}) -> ${link}(${other.x},${other.z})`);
      bad += 1;
    }
  }
  // No waypoint may sit inside a solid.
  if (segmentBlocked(node.x, node.z, node.x, node.z, 0.35)) {
    console.log(`NODE ${node.id} inside a collider`);
    bad += 1;
  }
}
for (const [team, list] of Object.entries(SPAWNS)) {
  for (const s of list) {
    for (const site of Object.values(SITES)) {
      const from = nearestNode(s.x, s.z).id;
      const to = nearestNode(site.x, site.z).id;
      const path = findPath(from, to);
      if (path.length < 2 || path[path.length - 1] !== to) {
        console.log(`NO PATH ${team} spawn (${s.x},${s.z}) -> ${site.name}`);
        bad += 1;
      }
    }
  }
}
console.log(`colliders: ${COLLIDERS.length}, nodes: ${NODES.length}, blocked segments: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
