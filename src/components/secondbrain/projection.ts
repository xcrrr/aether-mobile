// Pure 3D → 2D projection for the Second Brain "globe" graph. Kept dependency-free
// and side-effect-free so the camera math is unit-testable without a renderer.

export interface Vec3 { x: number; y: number; z: number; }
export interface Projected {
  x: number;      // screen x (px)
  y: number;      // screen y (px)
  scale: number;  // perspective scale (1 = at the globe centre); >1 nearer, <1 farther
  depth: number;  // rotated z; larger = nearer the viewer (use to sort + fade)
}

/** Rotate a point: yaw about the Y axis, then pitch about the X axis. */
export function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const y2 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}

// Distance from the eye to the globe centre. Larger = weaker perspective (flatter
// globe); chosen so a node at the front face reads clearly bigger than one at the back.
export const VIEWER_Z = 520;

export interface Camera { yaw: number; pitch: number; zoom: number; cx: number; cy: number; }

export function project(p: Vec3, cam: Camera): Projected {
  const r = rotate(p, cam.yaw, cam.pitch);
  const denom = VIEWER_Z - r.z;
  const persp = VIEWER_Z / (denom <= 1 ? 1 : denom);
  const s = persp * cam.zoom;
  return { x: cam.cx + r.x * s, y: cam.cy + r.y * s, scale: s, depth: r.z };
}

/**
 * Yaw/pitch that bring a point to the front of the globe (facing the viewer), so a
 * tapped/searched memory can spin into view. Inverse of {@link rotate}'s orientation.
 */
export function facingAngles(p: Vec3): { yaw: number; pitch: number } {
  const yaw = Math.atan2(p.x, p.z);
  const pitch = Math.atan2(p.y, Math.hypot(p.x, p.z));
  return { yaw, pitch };
}
