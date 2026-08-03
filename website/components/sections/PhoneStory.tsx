'use client';
import { useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { ChatReplayView } from '@/components/phone/ChatReplay';
import { conversation, missionScenes } from '@/content/script';
import { useReducedMotion } from '@/lib/useReducedMotion';

type Scene = { headline: string; body: string };

/** Scenes stacked in place; only the active one is visible. Height is reserved
 *  by the longest headline/body pair so the layout never shifts. */
function MissionCopy({ scenes, activeIndex, started }: { scenes: Scene[]; activeIndex: number; started: boolean }) {
  return (
    <div style={{ position: 'relative' }} aria-live="polite">
      {/* invisible sizer so the block reserves the tallest scene's height */}
      <div style={{ visibility: 'hidden' }} aria-hidden>
        <p className="display-3" style={{ margin: 0 }}>
          {scenes.reduce((a, b) => (b.headline.length > a.headline.length ? b : a)).headline}
        </p>
        <p className="body-copy">
          {scenes.reduce((a, b) => (b.body.length > a.body.length ? b : a)).body}
        </p>
      </div>
      {scenes.map((s, i) => {
        const active = started && i === activeIndex;
        return (
          <div
            key={i}
            aria-hidden={!active}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.45s var(--ease), transform 0.45s var(--ease)',
            }}
          >
            <p className="display-3" style={{ margin: 0 }}>{s.headline}</p>
            <p className="body-copy">{s.body}</p>
          </div>
        );
      })}
    </div>
  );
}

function StaticStory() {
  return (
    <section id="mission" className="shell hairline-top" style={{ padding: '96px 0 112px' }}>
      <h2 className="display-2" style={{ maxWidth: 560 }}>Aether&rsquo;s mission</h2>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '56px 0 40px' }}>
        <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
          <ChatReplayView beats={conversation} progress={1} />
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 28 }}>
        {missionScenes.map((s, i) => (
          <div key={i}>
            <p className="display-3" style={{ margin: 0 }}>{s.headline}</p>
            <p className="body-copy" style={{ marginTop: 12 }}>{s.body}</p>
          </div>
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

  if (reduced) return <StaticStory />;

  // Small dead zones so the phone settles before/after the conversation plays.
  const convo = Math.min(1, Math.max(0, (p - 0.05) / 0.87));
  const started = p > 0.02;
  const sceneIdx = Math.min(missionScenes.length - 1, Math.floor(convo * missionScenes.length));

  return (
    <section id="mission" ref={ref} className="story-section" aria-label="Aether's mission: your phone is enough">
      <div className="story-pane">
        <div className="shell story-grid">
          <div className="story-copy">
            <MissionCopy scenes={missionScenes} activeIndex={sceneIdx} started={started} />
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
              Keep scrolling.
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
        /* svh, not vh: on mobile browsers vh is the *largest* viewport, so a
           100vh pane is taller than what's actually visible and the pinned
           phone gets cropped by the chrome. svh always fits. */
        .story-section {
          position: relative;
          height: 300vh;
          height: 300svh;
        }
        .story-pane {
          position: sticky;
          top: 0;
          height: 100vh;
          height: 100svh;
          overflow: hidden;
          display: flex;
          align-items: center;
          background: #242424;
          /* the topbar is sticky and floats over this pane — reserve its height
             so the phone is centred in the space the reader can actually see */
          padding-top: var(--nav-h);
          box-sizing: border-box;
        }
        .story-grid {
          display: grid;
          grid-template-areas: 'phone' 'copy';
          grid-template-columns: 1fr;
          gap: 14px;
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
        /* Portrait: the phone has to share the fold with its caption, so the
           scale steps track viewport height instead of a single breakpoint. */
        .story-grid { --phone-scale: 0.46; }
        .story-copy .display-3 { font-size: 22px; }
        .story-copy .body-copy { font-size: 14.5px; line-height: 1.5; margin-top: 12px; }
        @media (min-height: 700px) { .story-grid { --phone-scale: 0.56; } }
        @media (min-height: 760px) { .story-grid { --phone-scale: 0.6; } }
        @media (min-height: 820px) { .story-grid { --phone-scale: 0.66; } }
        @media (min-height: 900px) { .story-grid { --phone-scale: 0.7; } }
        @media (min-width: 920px) {
          .story-section { height: 340vh; height: 340svh; }
          .story-grid {
            grid-template-areas: 'copy phone';
            grid-template-columns: minmax(320px, 440px) auto;
            justify-content: center;
            gap: clamp(56px, 7vw, 112px);
            width: min(1040px, 100% - 64px);
            --phone-scale: 0.82;
          }
          .story-copy { text-align: left; }
          .story-copy .display-3 { font-size: clamp(22px, 2.6vw, 28px); }
          .story-copy .body-copy { font-size: 16px; line-height: 1.65; margin-top: 16px; }
        }
        @media (min-width: 920px) and (min-height: 860px) {
          .story-grid { --phone-scale: 0.94; }
        }
      `}</style>
    </section>
  );
}
