'use client';
import { DemoPhone } from './kit/Phone';
import { c, radius } from './kit/tokens';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, TypingDots, Composer, ComposerChip, VisionBadge,
  DemoKeyframes, type Block, blocksLen,
} from './kit/chat';

/*
 * Demo 2 — See. A whiteboard photo lands in the composer, the vision badge
 * confirms the model can read it, and the answer is grounded in what's on
 * the board. Same chat surface — image understanding is not a separate mode.
 */

const PROMPT = 'Turn this into clear action points.';

const REPLY: Block[] = [
  { kind: 'p', text: 'From the board:' },
  { kind: 'li', text: '**Beta scope** — the sync item is marked “later”; cut it from this release.' },
  { kind: 'li', text: '**Onboarding** — Priya owns the new flow, first draft by Friday.' },
  { kind: 'li', text: '**Metrics** — track first-week retention, not raw downloads.' },
  { kind: 'p', text: 'The circled note — “under 3 screens” — reads like the hard constraint.' },
];
const REPLY_LEN = blocksLen(REPLY);

const CHIP_AT = 500, BADGE_AT = 950;
const TYPE_A = 1400, TYPE_B = 2900;
const SEND = 3050;
const STREAM_A = 4200, STREAM_B = 9400;
const DURATION = 9800, HOLD = 3800;

/** A believable whiteboard photo, drawn deterministically — marker scrawl,
 *  one boxed heading, an arrow, and a red-circled constraint. */
function WhiteboardImage({ size }: { size: number }) {
  const slate = '#33415C';
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" aria-hidden style={{ display: 'block' }}>
      <rect width="220" height="220" fill="#57534C" />
      <g transform="rotate(-1.6 110 110)">
        <rect x="14" y="18" width="192" height="184" rx="3" fill="#F1F0EB" />
        <rect x="14" y="18" width="192" height="184" rx="3" fill="none" stroke="#C9C6BE" strokeWidth="2.5" />
        {/* title scrawl + underline */}
        <path d="M30 42 q10 -6 22 -3 q12 3 24 -2 q10 -4 20 0" fill="none" stroke={slate} strokeWidth="4" strokeLinecap="round" />
        <path d="M30 52 q30 3 64 0" fill="none" stroke={slate} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        {/* boxed "beta" cluster */}
        <rect x="27" y="66" width="76" height="34" rx="4" fill="none" stroke={slate} strokeWidth="2.2" />
        <path d="M34 78 q12 -4 26 -1 q14 3 28 -1" fill="none" stroke={slate} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M34 89 q16 3 40 0" fill="none" stroke={slate} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        {/* arrow from box to second cluster */}
        <path d="M105 86 q26 6 34 26" fill="none" stroke={slate} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M136 104 l3 9 l-9 -2" fill="none" stroke={slate} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* second cluster (onboarding) */}
        <path d="M124 124 q14 -4 30 -1 q14 2 28 -2" fill="none" stroke={slate} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M124 135 q18 3 44 -1" fill="none" stroke={slate} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        <path d="M124 146 q14 2 34 0" fill="none" stroke={slate} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
        {/* third cluster (metrics) with bullet dots */}
        <circle cx="33" cy="122" r="2.4" fill={slate} />
        <path d="M42 121 q14 -3 30 0" fill="none" stroke={slate} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="33" cy="138" r="2.4" fill={slate} />
        <path d="M42 137 q18 -3 38 1" fill="none" stroke={slate} strokeWidth="2.4" strokeLinecap="round" />
        {/* red-circled constraint bottom */}
        <path d="M52 172 q16 -5 34 -2 q16 3 32 -2" fill="none" stroke={slate} strokeWidth="2.6" strokeLinecap="round" />
        <ellipse cx="86" cy="171" rx="48" ry="15" fill="none" stroke="#B23A48" strokeWidth="2.6" transform="rotate(-2 86 171)" />
      </g>
    </svg>
  );
}

export function SeeDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const revealed = burst(prog(t, STREAM_A, STREAM_B) * REPLY_LEN);
  const generating = t >= SEND + 150 && t < STREAM_B;

  return (
    <div ref={ref} data-demo-root style={{ display: 'flex', justifyContent: 'center' }}>
      <DemoKeyframes />
      <DemoPhone
        mode="Fast"
        opacity={loopOpacity(t, DURATION, HOLD)}
        composer={
          <Composer
            value={sent ? '' : typed}
            caret={!sent && t >= TYPE_A && t < SEND}
            generating={generating}
            chip={!sent && t >= CHIP_AT && (
              <ComposerChip
                name="whiteboard.jpg"
                meta="Image / 1.4 MB"
                thumb={
                  <span style={{ width: 40, height: 40, borderRadius: radius.sm, overflow: 'hidden', flex: 'none', background: c.bg }}>
                    <WhiteboardImage size={40} />
                  </span>
                }
              />
            )}
            badge={!sent && t >= BADGE_AT && <VisionBadge />}
          />
        }
      >
        {sent && (
          <UserTurn
            text={PROMPT}
            attachment={
              <span style={{ width: 220, height: 220, borderRadius: radius.lg, overflow: 'hidden', display: 'block' }}>
                <WhiteboardImage size={220} />
              </span>
            }
          />
        )}
        {sent && (t < STREAM_A
          ? <TypingDots />
          : <AssistantTurn blocks={REPLY} revealed={revealed} />)}
      </DemoPhone>
    </div>
  );
}
