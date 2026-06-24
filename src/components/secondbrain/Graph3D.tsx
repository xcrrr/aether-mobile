import { Fragment, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { GraphData } from './graphData';
import { forceLayout } from './forceLayout';
import { project, facingAngles, Camera, Vec3 } from './projection';
import { fonts } from '@/theme';

interface Props { data: GraphData; onNodeTap: (key: string) => void; focusKey?: string | null; }

// Pure near-black void — the whole Obsidian look depends on nodes glowing against nothing.
const VOID = '#0D0D0D';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
// Shortest signed delta between two angles (avoids the globe taking the long way round).
const angleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Blend two #rrggbb hex colours (t=0 → a, t=1 → b). Used to tint a highlighted edge
// toward the midpoint of the two memories it connects.
const blendHex = (a: string, b: string, t = 0.5) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
};

export function Graph3D({ data, onNodeTap, focusKey }: Props) {
  // Stable 3D positions for the current memory set (recomputed only when data changes).
  const positions = useMemo(() => forceLayout(data.nodes, data.links), [data]);

  // Degree (connection count) per node — drives node size, like Obsidian's graph.
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const l of data.links) {
      d.set(l.source, (d.get(l.source) ?? 0) + 1);
      d.set(l.target, (d.get(l.target) ?? 0) + 1);
    }
    return d;
  }, [data]);

  // Unique node colours → one cached radial-gradient def each (the soft glow sprite).
  const palette = useMemo(() => {
    const seen = new Map<string, string>();
    let i = 0;
    for (const n of data.nodes) if (!seen.has(n.color)) seen.set(n.color, `glow${i++}`);
    return seen;
  }, [data]);

  // Selection set: the focused memory + its direct neighbours. Everything else dims.
  const neighbours = useMemo(() => {
    if (!focusKey) return null;
    const set = new Set<string>([focusKey]);
    for (const l of data.links) {
      if (l.source === focusKey) set.add(l.target);
      if (l.target === focusKey) set.add(l.source);
    }
    return set;
  }, [focusKey, data]);

  // Read the layout dimensions synchronously inside the handler. Dereferencing
  // e.nativeEvent later (e.g. from a reducer running in React's render phase)
  // crashes with "Cannot read property 'layout' of null" because RN has already
  // recycled the SyntheticEvent by then — especially under the New Architecture.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  // Camera lives in a ref; a counter forces re-render each animation frame so the
  // 3D projection (which must run in JS, per-node) repaints smoothly.
  const cam = useRef({ yaw: 0.6, pitch: -0.32, zoom: 1 });
  const [, bump] = useReducer((n: number) => (n + 1) % 1e9, 0);

  const interacting = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTween = useRef<{ fromYaw: number; toYaw: number; fromPitch: number; toPitch: number; t0: number } | null>(null);

  // Screen-space node hits for tap detection, refreshed every render.
  const hits = useRef<{ key: string; x: number; y: number; r: number }[]>([]);

  // ── Animation loop: idle auto-spin + focus tween ──────────────────────────
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const now = Date.now();
      const c = cam.current;
      const ft = focusTween.current;
      if (ft) {
        const k = Math.min(1, (now - ft.t0) / 600);
        const e = easeOut(k);
        c.yaw = ft.fromYaw + angleDelta(ft.fromYaw, ft.toYaw) * e;
        c.pitch = ft.fromPitch + (ft.toPitch - ft.fromPitch) * e;
        bump();
        if (k >= 1) focusTween.current = null;
      } else if (!interacting.current) {
        c.yaw += 0.0014; // slow autorotate (Obsidian-like idle drift)
        bump();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Spin a chosen memory to the front of the globe (list/search/tap).
  useEffect(() => {
    if (!focusKey) return;
    const p = positions.get(focusKey);
    if (!p) return;
    const target = facingAngles(p);
    interacting.current = true;
    focusTween.current = {
      fromYaw: cam.current.yaw, toYaw: target.yaw,
      fromPitch: cam.current.pitch, toPitch: target.pitch, t0: Date.now(),
    };
    scheduleResume();
  }, [focusKey, positions]);

  // ── Gestures via core PanResponder (no reanimated/RNGH — bulletproof) ──────
  const holdSpin = () => {
    interacting.current = true;
    focusTween.current = null;
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };
  const scheduleResume = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => { interacting.current = false; }, 3000);
  };
  const tapAt = (x: number, y: number) => {
    let best: { key: string; d: number } | null = null;
    for (const hh of hits.current) {
      const d = Math.hypot(hh.x - x, hh.y - y);
      if (d <= hh.r + 14 && (!best || d < best.d)) best = { key: hh.key, d };
    }
    if (best) onNodeTap(best.key);
  };

  // Per-gesture scratch state (refs so the responder callbacks stay stable).
  const g = useRef({ lastDx: 0, lastDy: 0, startZoom: 1, startDist: 0, moved: false }).current;
  const touchDist = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches;
    if (t.length < 2) return 0;
    return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        holdSpin();
        g.lastDx = 0; g.lastDy = 0; g.moved = false;
        g.startZoom = cam.current.zoom; g.startDist = 0;
      },
      onPanResponderMove: (e, gs) => {
        const c = cam.current;
        if (e.nativeEvent.touches.length >= 2) {
          const d = touchDist(e);
          if (!g.startDist) g.startDist = d;
          if (g.startDist > 0) c.zoom = Math.max(0.45, Math.min(3.2, g.startZoom * (d / g.startDist)));
        } else {
          const ddx = gs.dx - g.lastDx, ddy = gs.dy - g.lastDy;
          g.lastDx = gs.dx; g.lastDy = gs.dy;
          c.yaw += ddx * 0.006;
          c.pitch = Math.max(-1.3, Math.min(1.3, c.pitch + ddy * 0.006));
        }
        if (Math.hypot(gs.dx, gs.dy) > 6) g.moved = true;
        bump();
      },
      onPanResponderRelease: (e, gs) => {
        g.startDist = 0;
        scheduleResume();
        if (!g.moved && Math.hypot(gs.dx, gs.dy) < 6) {
          tapAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        }
      },
      onPanResponderTerminate: () => { g.startDist = 0; scheduleResume(); },
    }),
  ).current;

  // ── Projection (runs every frame; cheap per node) ─────────────────────────
  const { w, h } = size;
  const camera: Camera = { ...cam.current, cx: w / 2, cy: h / 2 };
  const R = 130;

  const projected = useMemo(() => {
    if (!w || !h) return { nodes: [] as any[], links: [] as any[] };
    const np = data.nodes.map((n) => {
      const pos = positions.get(n.id) ?? ({ x: 0, y: 0, z: 0 } as Vec3);
      const pr = project(pos, camera);
      // Depth fog: nodes at the back fade and shrink.
      const t = (pr.depth + R) / (2 * R); // 0 (far) … 1 (near)
      const fog = 0.35 + 0.65 * Math.max(0, Math.min(1, t));
      // Node size driven by connection count (Obsidian's hubs read bigger), with the
      // identity memories nudged up. World radius is then perspective-scaled.
      const deg = degree.get(n.id) ?? 0;
      let world = 3.5 + Math.sqrt(deg + 1) * 1.6;
      if (n.category === 'identity') world += 2.5;
      world = Math.min(world, 13);
      const r = world * pr.scale * (n.recent ? 1.2 : 1);
      return { n, pr, fog, r };
    }).filter((x) => Number.isFinite(x.pr.x) && Number.isFinite(x.pr.y) && Number.isFinite(x.r) && x.r > 0);
    np.sort((a, b) => a.pr.depth - b.pr.depth); // far first, near painted on top
    const idx = new Map(np.map((x) => [x.n.id, x]));
    const links = data.links.map((l) => {
      const a = idx.get(l.source), b = idx.get(l.target);
      if (!a || !b) return null;
      return { a, b };
    }).filter(Boolean) as any[];
    return { nodes: np, links };
    // camera is intentionally read fresh each render (cam.current mutates in place)
  }, [data, positions, degree, w, h, camera.yaw, camera.pitch, camera.zoom]);

  // Refresh tap hit-targets from the latest projection.
  hits.current = projected.nodes.map((x) => ({ key: x.n.id, x: x.pr.x, y: x.pr.y, r: x.r }));

  // The single floating label belongs to the focused memory (no permanent clutter).
  const focused = focusKey ? projected.nodes.find((x) => x.n.id === focusKey) : null;

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <View style={styles.fill} {...responder.panHandlers}>
          {w > 0 && h > 0 && (
            <Svg width={w} height={h}>
              <Defs>
                {[...palette.entries()].map(([color, id]) => (
                  <RadialGradient key={id} id={id} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={color} stopOpacity={1} />
                    <Stop offset="0.45" stopColor={color} stopOpacity={0.35} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                  </RadialGradient>
                ))}
              </Defs>

              {/* Edges — faint white hairlines; the connected ones light up on selection. */}
              {projected.links.map((l, i) => {
                const conn = neighbours
                  ? (neighbours.has(l.a.n.id) && neighbours.has(l.b.n.id) && (l.a.n.id === focusKey || l.b.n.id === focusKey))
                  : false;
                const dimmed = !!neighbours && !conn;
                const stroke = conn ? blendHex(l.a.n.color, l.b.n.color) : '#FFFFFF';
                const opacity = conn ? 0.55 : dimmed ? 0.03 : 0.07 + 0.05 * Math.min(l.a.fog, l.b.fog);
                return (
                  <Line
                    key={`l${i}`}
                    x1={l.a.pr.x} y1={l.a.pr.y} x2={l.b.pr.x} y2={l.b.pr.y}
                    stroke={stroke} strokeOpacity={opacity}
                    strokeWidth={conn ? 1.4 : 0.9}
                  />
                );
              })}

              {/* Nodes — three stacked layers per node: outer halo, mid glow, solid core. */}
              {projected.nodes.map(({ n, pr, fog, r }) => {
                const sel = neighbours?.has(n.id);
                const isFocus = n.id === focusKey;
                const dim = !!neighbours && !sel;
                // Glow intensity ramps with selection; everything not connected dims away.
                const haloOp = (isFocus ? 0.45 : sel ? 0.28 : dim ? 0.05 : 0.16) * fog;
                const midOp = (isFocus ? 0.7 : sel ? 0.5 : dim ? 0.12 : 0.34) * fog;
                const coreOp = dim ? 0.18 : n.recent ? 1 : fog;
                const gid = palette.get(n.color)!;
                return (
                  <Fragment key={`n${n.id}`}>
                    <Circle cx={pr.x} cy={pr.y} r={r * 4} fill={`url(#${gid})`} fillOpacity={haloOp} />
                    <Circle cx={pr.x} cy={pr.y} r={r * 2} fill={`url(#${gid})`} fillOpacity={midOp} />
                    <Circle
                      cx={pr.x} cy={pr.y} r={r}
                      fill={n.recent ? '#F4F0FF' : n.color}
                      fillOpacity={coreOp}
                      stroke={isFocus ? '#FFFFFF' : n.recent ? '#FFFFFF' : undefined}
                      strokeOpacity={isFocus ? 0.9 : n.recent ? 0.7 : 0}
                      strokeWidth={isFocus ? 1.4 : n.recent ? 1 : 0}
                    />
                  </Fragment>
                );
              })}
            </Svg>
          )}

          {/* Node names — short captions under front-facing nodes, fading with depth so
              the back of the globe stays clean. RN Text overlay (not SVG <Text>, which
              threw "layout of null" on device under the New Architecture). Hidden for
              nodes dimmed by a selection. */}
          {w > 0 && h > 0 && projected.nodes.map(({ n, pr, fog, r }) => {
            const dim = !!neighbours && !neighbours.has(n.id);
            if (dim) return null;
            const isFocus = n.id === focusKey;
            // Only label nodes near the front (or recent/focused) — keeps it legible.
            if (!isFocus && !n.recent && fog < 0.78) return null;
            const op = isFocus ? 1 : Math.max(0, Math.min(1, (fog - 0.55) / 0.45));
            return (
              <Text
                key={`lbl${n.id}`}
                numberOfLines={1}
                style={[
                  styles.nodeLabel,
                  {
                    left: pr.x - 70,
                    top: pr.y + r + 3,
                    opacity: op,
                    color: n.recent ? '#F4F0FF' : '#E8E8F0',
                    fontSize: Math.max(9, Math.min(12.5, 10.5 * pr.scale)),
                  },
                ]}
              >
                {n.label}
              </Text>
            );
          })}

          {/* Focused memory also gets a framed card with its category, just above. */}
          {focused && (
            <View
              pointerEvents="none"
              style={[styles.labelCard, { left: focused.pr.x - 90, top: focused.pr.y - focused.r - 46 }]}
            >
              <Text numberOfLines={2} style={styles.labelText}>{focused.n.label}</Text>
              <Text style={[styles.labelCat, { color: focused.n.color }]}>{focused.n.category}</Text>
            </View>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: VOID },
  labelCard: {
    position: 'absolute',
    width: 180,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(13,13,13,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  labelText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', letterSpacing: 0.1, textAlign: 'center', fontFamily: fonts.display },
  labelCat: { fontSize: 11, fontWeight: '400', marginTop: 2, textAlign: 'center', textTransform: 'capitalize' },
  nodeLabel: {
    position: 'absolute',
    width: 140,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontWeight: '500',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
