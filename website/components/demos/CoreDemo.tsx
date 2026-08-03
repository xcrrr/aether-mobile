'use client';
import { useEffect, useRef, useState } from 'react';
import { PhoneFrame } from '../phone/PhoneFrame';
import { DemoHeader } from './kit/Phone';
import { c, radius, sans, serif, type } from './kit/tokens';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, TypingDots, Composer, DemoKeyframes,
  type Block, blocksLen,
} from './kit/chat';
import { IconPenLine } from './kit/icons';

/*
 * Demo 5 — Core. Unlike the other tabs, Core has no in-chat surface: the app
 * saves facts silently in the background, and the only place a saved memory
 * is ever shown is the Core screen (reached from the sidebar), not the chat
 * bubble. So this recording is honest about being two scenes in one phone:
 * an ordinary chat exchange, then a crossfade into Core, where the new memory
 * appears as a node, gets a quiet "new memory" toast, and opens into the real
 * detail view — the verbatim evidence it was grounded in, plus Edit/Delete.
 * Nothing here is invented UI; it mirrors SecondBrainScreen's DetailSheet.
 */

const PROMPT = 'Marathon training starts today — my longest run so far is 9 miles.';

const REPLY: Block[] = [
  { kind: 'p', text: 'Nine miles is a solid base to build from. Keep the long runs easy, and taper the final three weeks before race day.' },
];
const REPLY_LEN = blocksLen(REPLY);

// Health/Fitness category color, mirrored from
// app/src/components/secondbrain/graphData.ts VISUAL_CATEGORY_COLORS.health —
// the graph's own token for this category, not invented for the site.
const HEALTH_COLOR = '#5FA98A';

const NEW_NODE = { x: 150, y: 96, label: 'Marathon' };
const DIM_NODES = [
  { x: 46, y: 42, label: 'Website' },
  { x: 232, y: 150, label: 'Climbing' },
];
const EDGE = (() => {
  const dx = DIM_NODES[0].x - NEW_NODE.x;
  const dy = DIM_NODES[0].y - NEW_NODE.y;
  return { len: Math.hypot(dx, dy), deg: Math.atan2(dy, dx) * (180 / Math.PI) };
})();

// Timeline (ms)
const TYPE_A = 650, TYPE_B = 3100;
const SEND = 3250;
const STREAM_A = 4300, STREAM_B = 7100;
const FADE_A = 8000, FADE_B = 8500;
const NODE_AT = 8850, NODE_DUR = 300;
const TOAST_AT = 9200, TOAST_DUR = 250;
const CARD_AT = 9750, CARD_DUR = 300;
const DURATION = 11000, HOLD = 3800;

function IconBack({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconTrash({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

/** The real app's Core header: back, title + subtitle, mirrors SecondBrainScreen's top bar. */
function CoreHeader() {
  return (
    <div style={{
      position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12,
      padding: '40px 14px 14px', background: c.bg, borderBottom: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 24, display: 'flex', color: c.textMuted }}><IconBack size={19} /></span>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15, color: c.text }}>Core</div>
        <div style={{ fontFamily: sans, fontSize: 11, color: c.textMuted, marginTop: 1 }}>Your connected context</div>
      </div>
      <span style={{ width: 24 }} />
    </div>
  );
}

/** Quiet "N new memory" pill — same text the real toast on SecondBrainScreen shows. */
function NewMemoryToast({ opacity }: { opacity: number }) {
  return (
    <div style={{
      position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      borderRadius: radius.full, background: c.violetDim, border: '1px solid rgba(124,58,237,0.14)',
      opacity, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.violet }} />
      <span style={{ ...type.chip, color: c.violet }}>1 new memory</span>
    </div>
  );
}

/** A sliver of the knowledge graph: two quiet existing nodes, and the fact
 *  that was just saved landing in, connected, and named. */
function GraphMini({ reveal }: { reveal: number }) {
  return (
    <div style={{ position: 'relative', height: 200, margin: '30px 20px 0' }}>
      {DIM_NODES.map((n) => (
        <div key={n.label}>
          <div style={{
            position: 'absolute', left: n.x - 4, top: n.y - 4, width: 8, height: 8,
            borderRadius: '50%', background: c.textMuted, opacity: 0.4,
          }} />
          <div style={{
            position: 'absolute', left: n.x + 9, top: n.y - 7, ...type.caption, color: c.textMuted, opacity: 0.55,
          }}>
            {n.label}
          </div>
        </div>
      ))}

      {reveal > 0 && (
        <>
          <div style={{
            position: 'absolute', left: NEW_NODE.x, top: NEW_NODE.y, width: EDGE.len, height: 1,
            background: c.border, transformOrigin: '0 0', transform: `rotate(${EDGE.deg}deg)`, opacity: reveal,
          }} />
          <div style={{
            position: 'absolute', left: NEW_NODE.x - 14, top: NEW_NODE.y - 14, width: 28, height: 28,
            borderRadius: '50%', border: `1px solid ${HEALTH_COLOR}`, opacity: reveal,
            animation: reveal >= 1 ? 'demoPulse 1.6s ease-in-out infinite' : undefined,
          }} />
          <div style={{
            position: 'absolute', left: NEW_NODE.x - 7, top: NEW_NODE.y - 7, width: 14, height: 14,
            borderRadius: '50%', background: HEALTH_COLOR,
            transform: `scale(${0.5 + reveal * 0.5})`, opacity: reveal,
          }} />
          <div style={{
            position: 'absolute', left: NEW_NODE.x + 13, top: NEW_NODE.y - 7, ...type.label, color: c.text, opacity: reveal,
          }}>
            {NEW_NODE.label}
          </div>
        </>
      )}
    </div>
  );
}

/** The bottom sheet a tapped node opens into — mirrors DetailSheet's "why this
 *  was saved" evidence quote and its Edit / Delete actions. */
function DetailCard({ reveal }: { reveal: number }) {
  if (reveal <= 0) return null;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: c.bgCard, borderTop: `1px solid ${c.border}`, borderRadius: '16px 16px 0 0',
      padding: '10px 18px 18px', opacity: reveal, transform: `translateY(${(1 - reveal) * 36}px)`,
    }}>
      <div style={{ width: 36, height: 3, borderRadius: 999, background: c.border, margin: '0 auto 14px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: HEALTH_COLOR }} />
        <span style={{ ...type.label, color: c.text, fontSize: 15 }}>Marathon</span>
      </div>
      <div style={{ ...type.metadata, color: c.textMuted, marginTop: 3 }}>Health / Fitness · added just now</div>

      <div style={{ ...type.metadata, color: c.textMuted, marginTop: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Why this was saved
      </div>
      <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14, lineHeight: '21px', color: c.text, marginTop: 6 }}>
        “{PROMPT}”
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1,
          border: `1px solid ${c.border}`, borderRadius: radius.md, padding: '9px 0',
          ...type.label, color: c.text,
        }}>
          <IconPenLine size={13} strokeWidth={1.8} /> Edit
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1,
          border: `1px solid ${c.danger}`, borderRadius: radius.md, padding: '9px 0',
          ...type.label, color: c.danger,
        }}>
          <IconTrash size={13} /> Delete
        </span>
      </div>
    </div>
  );
}

export function CoreDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });
  const wrap = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 360)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const revealed = burst(prog(t, STREAM_A, STREAM_B) * REPLY_LEN);
  const generating = t >= SEND + 150 && t < STREAM_B;

  const chatOpacity = 1 - prog(t, FADE_A, FADE_B);
  const coreOpacity = prog(t, FADE_A, FADE_B);
  const nodeReveal = prog(t, NODE_AT, NODE_AT + NODE_DUR);
  const toastOpacity = prog(t, TOAST_AT, TOAST_AT + TOAST_DUR);
  const cardReveal = prog(t, CARD_AT, CARD_AT + CARD_DUR);

  return (
    <div ref={ref} data-demo-root style={{ display: 'flex', justifyContent: 'center' }}>
      <DemoKeyframes />
      <div ref={wrap} style={{ width: '100%', maxWidth: 360, height: 740 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 360, opacity: loopOpacity(t, DURATION, HOLD) }}>
          <PhoneFrame>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <div style={{ position: 'absolute', inset: 0, opacity: chatOpacity, display: 'flex', flexDirection: 'column' }}>
                <DemoHeader mode="Fast" />
                <div style={{
                  position: 'relative', flex: 1, overflow: 'hidden',
                  padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                }}>
                  <div>
                    {sent && <UserTurn text={PROMPT} />}
                    {sent && (t < STREAM_A
                      ? <TypingDots />
                      : <AssistantTurn blocks={REPLY} revealed={revealed} />)}
                  </div>
                </div>
                <div style={{ position: 'relative', padding: '0 12px 10px' }}>
                  <Composer
                    value={sent ? '' : typed}
                    caret={!sent && t >= TYPE_A && t < SEND}
                    generating={generating}
                  />
                </div>
              </div>

              <div style={{ position: 'absolute', inset: 0, opacity: coreOpacity, display: 'flex', flexDirection: 'column' }}>
                <CoreHeader />
                <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                  <NewMemoryToast opacity={toastOpacity} />
                  <GraphMini reveal={nodeReveal} />
                  <DetailCard reveal={cardReveal} />
                </div>
              </div>
            </div>
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}
