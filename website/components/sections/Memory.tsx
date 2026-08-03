'use client';

import { useRef, useSyncExternalStore } from 'react';
import { motion, useInView } from 'framer-motion';
import { useReducedMotion } from '@/lib/useReducedMotion';

const EASE = [0.22, 1, 0.36, 1] as const;

type LabelPos = 'left' | 'right' | 'above' | 'below';
type Sub = { label: string; x: number; y: number; labelPos?: LabelPos };
type Cluster = {
  label: string;
  x: number;
  y: number;
  labelPos: LabelPos;
  subs: Sub[];
  drift: [number, number];
  driftDur: number;
};
type Graph = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  ringR: number;
  markSize: number;
  wordSize: number;
  primarySize: number;
  subSize: number;
  spokeTrim: [number, number];
  subTrim: [number, number];
  clusters: Cluster[];
  cross: Array<[[number, number], [number, number]]>;
};

/** Hand-placed, deterministic composition — clockwise from the top. */
const DESKTOP: Graph = {
  w: 1000,
  h: 620,
  cx: 500,
  cy: 300,
  ringR: 66,
  markSize: 40,
  wordSize: 30,
  primarySize: 14.5,
  subSize: 12.5,
  spokeTrim: [78, 20],
  subTrim: [13, 10],
  clusters: [
    {
      label: 'Research', x: 455, y: 95, labelPos: 'above',
      subs: [
        { label: 'Local models', x: 345, y: 55, labelPos: 'above' },
        { label: 'Privacy', x: 570, y: 60, labelPos: 'right' },
      ],
      drift: [2.5, -2], driftDur: 12,
    },
    {
      label: 'Projects', x: 730, y: 165, labelPos: 'left',
      subs: [
        { label: 'App', x: 815, y: 105 },
        { label: 'Website', x: 855, y: 205 },
        { label: 'Beta', x: 770, y: 250 },
      ],
      drift: [-2, 2.5], driftDur: 10,
    },
    {
      label: 'Goals', x: 815, y: 390, labelPos: 'above',
      subs: [
        { label: 'Marathon', x: 905, y: 345 },
        { label: 'Ship v1', x: 885, y: 460 },
      ],
      drift: [2, 2], driftDur: 13,
    },
    {
      label: 'Preferences', x: 590, y: 535, labelPos: 'left',
      subs: [
        { label: 'Short answers', x: 700, y: 570 },
        { label: 'Dark mode', x: 545, y: 585 },
      ],
      drift: [-2.5, -1.5], driftDur: 11,
    },
    {
      label: 'Interests', x: 250, y: 465, labelPos: 'right',
      subs: [
        { label: 'Climbing', x: 150, y: 520 },
        { label: 'Science', x: 310, y: 555 },
        { label: 'Technology', x: 130, y: 425 },
      ],
      drift: [2, -2.5], driftDur: 14,
    },
    {
      label: 'Learning', x: 235, y: 200, labelPos: 'left',
      subs: [
        { label: 'AI', x: 140, y: 140 },
        { label: 'Design', x: 305, y: 100 },
        { label: 'Spanish', x: 120, y: 270 },
      ],
      drift: [-2, -2], driftDur: 9.5,
    },
  ],
  cross: [
    [[140, 140], [345, 55]],   // AI ↔ Local models
    [[855, 205], [885, 460]],  // Website ↔ Ship v1
    [[310, 555], [545, 585]],  // Science ↔ Dark mode
  ],
};

/** The same six-cluster composition as the desktop graph, re-laid for a
 *  portrait canvas — the phone used to get a thinned-out four-node version
 *  that read as half-drawn. Every label is hand-placed to clear its
 *  neighbours, the centre ring and the spokes at this aspect ratio. */
const MOBILE: Graph = {
  w: 380,
  h: 606,
  cx: 190,
  cy: 318,
  ringR: 54,
  markSize: 32,
  wordSize: 24,
  primarySize: 13.5,
  subSize: 11.5,
  spokeTrim: [64, 14],
  subTrim: [11, 8],
  clusters: [
    {
      label: 'Research', x: 176, y: 112, labelPos: 'above',
      subs: [
        { label: 'Local models', x: 196, y: 46, labelPos: 'above' },
        { label: 'Privacy', x: 262, y: 74, labelPos: 'right' },
      ],
      drift: [2, -1.5], driftDur: 12,
    },
    {
      label: 'Projects', x: 300, y: 196, labelPos: 'right',
      subs: [
        { label: 'App', x: 346, y: 140, labelPos: 'above' },
        { label: 'Website', x: 338, y: 252, labelPos: 'below' },
      ],
      drift: [-1.5, 2], driftDur: 10,
    },
    {
      label: 'Goals', x: 302, y: 400, labelPos: 'right',
      subs: [
        { label: 'Marathon', x: 340, y: 462, labelPos: 'below' },
        { label: 'Ship v1', x: 276, y: 496, labelPos: 'below' },
      ],
      drift: [1.5, 1.5], driftDur: 13,
    },
    {
      label: 'Preferences', x: 166, y: 486, labelPos: 'right',
      subs: [
        { label: 'Short answers', x: 120, y: 556, labelPos: 'below' },
        { label: 'Dark mode', x: 232, y: 552, labelPos: 'below' },
      ],
      drift: [-2, -1.5], driftDur: 11,
    },
    {
      label: 'Interests', x: 82, y: 384, labelPos: 'left',
      subs: [
        { label: 'Climbing', x: 44, y: 452, labelPos: 'below' },
        { label: 'Science', x: 118, y: 300, labelPos: 'left' },
      ],
      drift: [1.5, -2], driftDur: 14,
    },
    {
      label: 'Learning', x: 84, y: 196, labelPos: 'left',
      subs: [
        { label: 'AI', x: 46, y: 138, labelPos: 'left' },
        { label: 'Design', x: 118, y: 140, labelPos: 'right' },
      ],
      drift: [-1.5, -1.5], driftDur: 9.5,
    },
  ],
  cross: [
    [[46, 138], [196, 46]],    // AI ↔ Local models
    [[262, 74], [346, 140]],   // Privacy ↔ App
    [[82, 384], [166, 486]],   // Interests ↔ Preferences
  ],
};

function trimLine(x1: number, y1: number, x2: number, y2: number, t1: number, t2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return { x1: x1 + ux * t1, y1: y1 + uy * t1, x2: x2 - ux * t2, y2: y2 - uy * t2 };
}

function labelAttrs(x: number, y: number, pos: LabelPos, size: number) {
  switch (pos) {
    case 'right': return { x: x + 11, y: y + 4, textAnchor: 'start' as const };
    case 'left': return { x: x - 11, y: y + 4, textAnchor: 'end' as const };
    case 'above': return { x, y: y - 13, textAnchor: 'middle' as const };
    case 'below': return { x, y: y + size + 8, textAnchor: 'middle' as const };
  }
}

const COMPACT_QUERY = '(max-width: 640px)';
function subscribeCompact(cb: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function useCompact() {
  return useSyncExternalStore(subscribeCompact, () => window.matchMedia(COMPACT_QUERY).matches, () => false);
}

// Reveal cadence: the whole graph has to be drawn before a normal scroll
// carries it off screen, so clusters land ~a third of a second apart.
const clusterBase = (i: number) => 0.4 + i * 0.34;

function BrainGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const compact = useCompact();
  const inView = useInView(ref, { once: true, amount: compact ? 0.2 : 0.35 });
  const show = reduced || inView;
  const g = compact ? MOBILE : DESKTOP;
  const crossBase = clusterBase(g.clusters.length - 1) + 1.2;

  const fade = (delay: number, dur = 0.65, fromY = 8) => ({
    initial: reduced ? (false as const) : { opacity: 0, y: fromY },
    animate: show ? { opacity: 1, y: 0 } : { opacity: 0, y: fromY },
    transition: reduced
      ? { duration: 0 }
      : { delay, duration: dur, ease: EASE },
  });

  const draw = (delay: number, dur: number, toOpacity: number) => ({
    initial: reduced ? (false as const) : { pathLength: 0, opacity: 0 },
    animate: show ? { pathLength: 1, opacity: toOpacity } : { pathLength: 0, opacity: 0 },
    transition: reduced
      ? { duration: 0 }
      : {
          pathLength: { delay, duration: dur, ease: EASE },
          opacity: { delay, duration: Math.min(dur, 0.5) },
        },
  });

  return (
    <div ref={ref} className="sb-wrap">
      <svg
        viewBox={`0 0 ${g.w} ${g.h}`}
        role="img"
        aria-label="Aether at the center of a growing network of remembered context — projects, learning, interests, goals, preferences, research."
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        {/* center: logo + wordmark inside a quiet ring */}
        <motion.g {...fade(0, 0.9, 0)}>
          <circle
            className="sb-breathe"
            cx={g.cx}
            cy={g.cy}
            r={g.ringR}
            fill="none"
            stroke="#2c2c2c"
            strokeWidth={1}
          />
          <image
            href="/logo-white.png"
            x={g.cx - g.markSize / 2}
            y={g.cy - g.ringR + 10}
            width={g.markSize}
            height={g.markSize}
            opacity={0.92}
          />
          <text
            x={g.cx}
            y={g.cy + g.ringR / 2}
            textAnchor="middle"
            fontFamily="var(--font-serif-stack)"
            fontWeight={500}
            fontSize={g.wordSize}
            fill="#f0efec"
            style={{ letterSpacing: '-0.01em' }}
          >
            Aether
          </text>
        </motion.g>

        {g.clusters.map((c, i) => {
          const base = clusterBase(i);
          const spoke = trimLine(g.cx, g.cy, c.x, c.y, g.spokeTrim[0], g.spokeTrim[1]);
          const cLabel = labelAttrs(c.x, c.y, c.labelPos, g.primarySize);
          return (
            <g
              key={c.label}
              className="sb-drift"
              style={{
                '--sb-dx': `${c.drift[0]}px`,
                '--sb-dy': `${c.drift[1]}px`,
                '--sb-dur': `${c.driftDur}s`,
                '--sb-delay': `${-i * 1.7}s`,
              } as React.CSSProperties}
            >
              <motion.line
                {...spoke}
                stroke="#464646"
                strokeWidth={1}
                {...draw(base + 0.3, 0.9, 1)}
              />
              <motion.g {...fade(base)}>
                <circle cx={c.x} cy={c.y} r={4.5} fill="#d6d5d1" />
                <text
                  {...cLabel}
                  fontFamily="var(--font-sans-stack)"
                  fontWeight={500}
                  fontSize={g.primarySize}
                  fill="#ecebe7"
                >
                  {c.label}
                </text>
              </motion.g>
              {c.subs.map((s, j) => {
                const subDelay = base + 0.55 + j * 0.16;
                const line = trimLine(c.x, c.y, s.x, s.y, g.subTrim[0], g.subTrim[1]);
                const sLabel = labelAttrs(
                  s.x,
                  s.y,
                  s.labelPos ?? (s.x >= g.cx ? 'right' : 'left'),
                  g.subSize,
                );
                return (
                  <g key={s.label}>
                    <motion.line
                      {...line}
                      stroke="#3c3c3c"
                      strokeWidth={1}
                      {...draw(subDelay + 0.18, 0.6, 1)}
                    />
                    <motion.g {...fade(subDelay, 0.6, 6)}>
                      <circle cx={s.x} cy={s.y} r={3} fill="#8f8f8a" />
                      <text
                        {...sLabel}
                        fontFamily="var(--font-sans-stack)"
                        fontSize={g.subSize}
                        fill="#97968f"
                      >
                        {s.label}
                      </text>
                    </motion.g>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* late, quiet connections between groups */}
        {g.cross.map(([[x1, y1], [x2, y2]], k) => {
          const line = trimLine(x1, y1, x2, y2, 16, 16);
          return (
            <motion.line
              key={k}
              {...line}
              stroke="#4a4a4a"
              strokeWidth={1}
              strokeDasharray="2 6"
              {...draw(crossBase + k * 0.4, 1.4, 0.55)}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function Memory() {
  return (
    <section id="memory" className="ink hairline-top" style={{ background: 'var(--bg)' }}>
      <div className="shell" style={{ padding: '104px 0 72px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Core · Aether’s memory</p>
          <h2 className="display-2">It remembers what matters.</h2>
          <p className="body-copy" style={{ marginTop: 20, fontSize: 17 }}>
            Over time, scattered context becomes structured understanding — held in Core,
            on your phone, yours to read, correct, or delete.
          </p>
        </div>
        <BrainGraph />
      </div>

      <style>{`
        .sb-wrap {
          max-width: 1000px;
          margin: 40px auto 0;
        }
        .sb-drift {
          animation: sbDrift var(--sb-dur, 11s) ease-in-out infinite alternate;
          animation-delay: var(--sb-delay, 0s);
        }
        @keyframes sbDrift {
          from { transform: translate(0px, 0px); }
          to { transform: translate(var(--sb-dx, 2px), var(--sb-dy, -2px)); }
        }
        .sb-breathe {
          animation: sbBreathe 9s ease-in-out infinite alternate;
        }
        @keyframes sbBreathe {
          from { opacity: 0.55; }
          to { opacity: 1; }
        }
        @media (max-width: 640px) {
          .sb-wrap { margin-top: 28px; }
        }
      `}</style>
    </section>
  );
}
