'use client';
import { useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { ChatReplayView } from '@/components/phone/ChatReplay';
import { resolveTimeline, type Beat } from '@/components/phone/useTypewriter';
import { conversation } from '@/content/script';
import { useReducedMotion } from '@/lib/useReducedMotion';

function activeBeatIndex(beats: Beat[], p: number): number {
  const t = resolveTimeline(beats, p);
  if (t.streamingIndex >= 0) return t.streamingIndex;
  return Math.max(0, t.shown.length - 1);
}

/** Captions stacked in place; only the active one is visible. Height is reserved
 *  by the longest caption so the layout never shifts. */
function Captions({ beats, activeIndex, started }: { beats: Beat[]; activeIndex: number; started: boolean }) {
  const captioned = beats
    .map((b, i) => ({ text: b.caption, i }))
    .filter((c): c is { text: string; i: number } => !!c.text);

  // The active caption is the last captioned beat at or before the active beat.
  let visible = captioned.length ? captioned[0].i : -1;
  for (const c of captioned) {
    if (c.i <= activeIndex) visible = c.i;
  }

  return (
    <div style={{ position: 'relative' }} aria-live="polite">
      {/* invisible sizer so the block reserves the tallest caption's height */}
      <p className="display-3" style={{ visibility: 'hidden', margin: 0 }} aria-hidden>
        {captioned.reduce((a, b) => (b.text.length > a.length ? b.text : a), '')}
      </p>
      {captioned.map((c) => {
        const active = started && c.i === visible;
        return (
          <p
            key={c.i}
            className="display-3"
            aria-hidden={!active}
            style={{
              position: 'absolute',
              inset: 0,
              margin: 0,
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.45s var(--ease), transform 0.45s var(--ease)',
            }}
          >
            {c.text}
          </p>
        );
      })}
    </div>
  );
}

function StaticStory({ beats }: { beats: Beat[] }) {
  return (
    <section id="demo" className="shell hairline-top" style={{ padding: '96px 0 112px' }}>
      <p className="eyebrow" style={{ marginBottom: 20 }}>See it work</p>
      <h2 className="display-2" style={{ maxWidth: 560 }}>A conversation, off the grid.</h2>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '56px 0 40px' }}>
        <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
          <ChatReplayView beats={beats} progress={1} />
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 18 }}>
        {beats.filter((b) => b.caption).map((b, i) => (
          <p key={i} className="body-copy">{b.caption}</p>
        ))}
      </div>
    </section>
  );
}

export function PhoneStory() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [p, setP] = useState(0);
  const lastQ = useRef(-1);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const q = Math.round(v * 300) / 300;
    if (q !== lastQ.current) {
      lastQ.current = q;
      setP(q);
    }
  });

  if (reduced) return <StaticStory beats={conversation} />;

  // Small dead zones so the phone settles before/after the conversation plays.
  const convo = Math.min(1, Math.max(0, (p - 0.05) / 0.87));
  const started = p > 0.02;
  const idx = activeBeatIndex(conversation, convo);

  return (
    <section id="demo" ref={ref} style={{ height: '340vh', position: 'relative' }} aria-label="Aether conversation demo">
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', background: '#242424' }}>
        <div className="shell story-grid">
          <div className="story-copy">
            <p
              className="eyebrow"
              style={{ marginBottom: 20, opacity: started ? 1 : 0, transition: 'opacity 0.4s var(--ease)' }}
            >
              See it work
            </p>
            <Captions beats={conversation} activeIndex={idx} started={started} />
            <p
              className="story-hint"
              aria-hidden={started}
              style={{
                marginTop: 20,
                fontSize: 13,
                color: 'var(--muted)',
                opacity: started ? 0 : 1,
                transition: 'opacity 0.4s var(--ease)',
              }}
            >
              Keep scrolling — the conversation plays as you go.
            </p>
          </div>
          <div className="story-phone">
            <div className="story-phone-inner">
              <ChatReplayView beats={conversation} progress={convo} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .story-grid {
          display: grid;
          grid-template-areas: 'phone' 'copy';
          grid-template-columns: 1fr;
          gap: 8px;
          align-items: center;
          justify-items: center;
          width: min(1040px, 100% - 40px);
          margin-inline: auto;
        }
        .story-copy { grid-area: copy; text-align: center; max-width: 480px; }
        .story-phone {
          grid-area: phone;
          /* footprint box: the scaled phone fits it exactly */
          width: calc(360px * var(--phone-scale, 0.58));
          height: calc(740px * var(--phone-scale, 0.58));
          position: relative;
        }
        .story-phone-inner {
          position: absolute;
          top: 0;
          left: 0;
          transform: scale(var(--phone-scale, 0.58));
          transform-origin: top left;
        }
        .story-grid { --phone-scale: 0.58; }
        @media (min-height: 700px) {
          .story-grid { --phone-scale: 0.64; }
        }
        @media (min-width: 920px) {
          .story-grid {
            grid-template-areas: 'copy phone';
            grid-template-columns: minmax(320px, 440px) auto;
            justify-content: center;
            gap: clamp(56px, 7vw, 112px);
            width: min(1040px, 100% - 64px);
            --phone-scale: 0.82;
          }
          .story-copy { text-align: left; }
        }
        @media (min-width: 920px) and (min-height: 860px) {
          .story-grid { --phone-scale: 0.94; }
        }
        @media (max-width: 919.9px) and (max-height: 640px) {
          .story-grid { --phone-scale: 0.5; }
        }
      `}</style>
    </section>
  );
}
