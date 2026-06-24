import { Vec3 } from './projection';

// Deterministic 3D force-directed layout for the memory globe. No randomness, so a
// given set of nodes/links always lays out the same way (stable across re-renders)
// and the math is unit-testable. Runs once in a useMemo — O(n²) per iteration is
// fine for the tens–low-hundreds of memories a Second Brain holds.

export interface LayoutInput { id: string }
export interface LayoutEdge { source: string; target: string }

interface Opts {
  radius?: number;      // target globe radius
  iterations?: number;  // relaxation steps
}

const GOLDEN = Math.PI * (1 + Math.sqrt(5));

export function forceLayout(
  nodes: LayoutInput[],
  links: LayoutEdge[],
  opts: Opts = {},
): Map<string, Vec3> {
  const R = opts.radius ?? 130;
  const pos = new Map<string, Vec3>();
  const N = nodes.length;
  if (N === 0) return pos;
  if (N === 1) { pos.set(nodes[0].id, { x: 0, y: 0, z: 0 }); return pos; }

  // Seed evenly on a sphere (Fibonacci lattice) — deterministic, no clumping.
  nodes.forEach((n, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
    const theta = GOLDEN * i;
    pos.set(n.id, {
      x: R * Math.sin(phi) * Math.cos(theta),
      y: R * Math.sin(phi) * Math.sin(theta),
      z: R * Math.cos(phi),
    });
  });

  const ids = nodes.map((n) => n.id);
  const present = new Set(ids);
  const edges = links.filter((l) => present.has(l.source) && present.has(l.target));

  const vel = new Map<string, Vec3>(ids.map((id) => [id, { x: 0, y: 0, z: 0 }]));
  const iterations = opts.iterations ?? Math.min(400, 160 + N * 4);

  const K_REP = 9000;   // node-node repulsion
  const K_SPRING = 0.04; // pull along links
  const REST = 64;       // link rest length
  const K_GRAV = 0.02;   // centring pull (keeps it a ball, not a cloud)
  const DAMP = 0.86;
  const STEP = 0.5;
  const MIN_D = 6;       // clamp so coincident nodes don't explode

  for (let it = 0; it < iterations; it++) {
    const force = new Map<string, Vec3>(ids.map((id) => [id, { x: 0, y: 0, z: 0 }]));

    // Repulsion (every pair).
    for (let i = 0; i < N; i++) {
      const a = pos.get(ids[i])!;
      const fa = force.get(ids[i])!;
      for (let j = i + 1; j < N; j++) {
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        let d = Math.hypot(dx, dy, dz);
        if (d < MIN_D) { d = MIN_D; dx = MIN_D; dy = 0; dz = 0; }
        const f = K_REP / (d * d);
        const ux = dx / d, uy = dy / d, uz = dz / d;
        fa.x += ux * f; fa.y += uy * f; fa.z += uz * f;
        const fb = force.get(ids[j])!;
        fb.x -= ux * f; fb.y -= uy * f; fb.z -= uz * f;
      }
    }

    // Springs (links pull toward REST length).
    for (const e of edges) {
      const a = pos.get(e.source)!, b = pos.get(e.target)!;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.hypot(dx, dy, dz) || MIN_D;
      const f = K_SPRING * (d - REST);
      const ux = dx / d, uy = dy / d, uz = dz / d;
      const fa = force.get(e.source)!, fb = force.get(e.target)!;
      fa.x += ux * f; fa.y += uy * f; fa.z += uz * f;
      fb.x -= ux * f; fb.y -= uy * f; fb.z -= uz * f;
    }

    // Gravity toward the centre.
    for (const id of ids) {
      const p = pos.get(id)!, f = force.get(id)!;
      f.x -= K_GRAV * p.x; f.y -= K_GRAV * p.y; f.z -= K_GRAV * p.z;
    }

    // Integrate (velocity + damping).
    for (const id of ids) {
      const v = vel.get(id)!, f = force.get(id)!, p = pos.get(id)!;
      v.x = (v.x + f.x) * DAMP; v.y = (v.y + f.y) * DAMP; v.z = (v.z + f.z) * DAMP;
      p.x += v.x * STEP; p.y += v.y * STEP; p.z += v.z * STEP;
    }
  }

  // Recentre on the centroid so the globe sits at the origin.
  let cx = 0, cy = 0, cz = 0;
  for (const id of ids) { const p = pos.get(id)!; cx += p.x; cy += p.y; cz += p.z; }
  cx /= N; cy /= N; cz /= N;
  for (const id of ids) { const p = pos.get(id)!; p.x -= cx; p.y -= cy; p.z -= cz; }

  return pos;
}
