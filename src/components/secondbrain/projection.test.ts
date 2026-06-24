import { rotate, project, facingAngles, VIEWER_Z, Vec3 } from './projection';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('rotate', () => {
  it('is identity at yaw=0 pitch=0', () => {
    const p = { x: 3, y: -4, z: 5 };
    const r = rotate(p, 0, 0);
    expect(close(r.x, 3) && close(r.y, -4) && close(r.z, 5)).toBe(true);
  });
  it('yaw of 90° swings the +x axis to +z (toward the viewer)', () => {
    const r = rotate({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
    expect(close(r.x, 0) && close(r.z, 1)).toBe(true);
  });
  it('preserves length (pure rotation)', () => {
    const p: Vec3 = { x: 12, y: -7, z: 9 };
    const r = rotate(p, 0.9, -0.4);
    expect(close(Math.hypot(p.x, p.y, p.z), Math.hypot(r.x, r.y, r.z), 1e-9)).toBe(true);
  });
});

describe('project', () => {
  const cam = { yaw: 0, pitch: 0, zoom: 1, cx: 100, cy: 100 };
  it('places the origin at the screen centre', () => {
    const pr = project({ x: 0, y: 0, z: 0 }, cam);
    expect(close(pr.x, 100) && close(pr.y, 100)).toBe(true);
  });
  it('makes nearer (high +z) points scale larger than farther ones', () => {
    const near = project({ x: 10, y: 0, z: 120 }, cam);
    const far = project({ x: 10, y: 0, z: -120 }, cam);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.depth).toBeGreaterThan(far.depth);
  });
  it('zoom multiplies the projected offset from centre', () => {
    const a = project({ x: 50, y: 0, z: 0 }, cam);
    const b = project({ x: 50, y: 0, z: 0 }, { ...cam, zoom: 2 });
    expect(close(b.x - cam.cx, (a.x - cam.cx) * 2)).toBe(true);
  });
});

describe('facingAngles', () => {
  it('produces angles that rotate a point onto the front face (+z, centred x/y)', () => {
    const p = { x: 80, y: -30, z: -40 };
    const { yaw, pitch } = facingAngles(p);
    const r = rotate(p, yaw, pitch);
    expect(close(r.x, 0, 1e-6) && close(r.y, 0, 1e-6)).toBe(true);
    expect(r.z).toBeGreaterThan(0); // now in front of the viewer
    expect(close(r.z, Math.hypot(p.x, p.y, p.z), 1e-6)).toBe(true);
  });
});

it('VIEWER_Z is large enough to keep perspective finite for in-globe points', () => {
  expect(VIEWER_Z).toBeGreaterThan(200);
});
