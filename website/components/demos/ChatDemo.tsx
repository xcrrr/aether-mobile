'use client';
import { DemoPhone } from './kit/Phone';
import { c, serif, sans } from './kit/tokens';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, TypingDots, Composer, DemoKeyframes,
  type Block, blocksLen,
} from './kit/chat';

/*
 * Demo 1 — Chat. A local, everyday exchange: greeting screen, a real prompt
 * typed into the composer, dots while the model spins up, a streamed reply
 * that settles. Fast mode, exactly as the app opens.
 */

const PROMPT = 'Help me plan a realistic week around my exam and two deadlines.';

const REPLY: Block[] = [
  { kind: 'p', text: 'Here’s a shape that fits without burning you out:' },
  { kind: 'li', text: '**Mon–Tue** — exam prep first, 90 minutes before anything else.' },
  { kind: 'li', text: '**Wed** — finish the report draft; it has the least slack.' },
  { kind: 'li', text: '**Thu** — buffer: flashcards, close out the second deadline.' },
  { kind: 'li', text: '**Fri** — full run-through, then stop by six.' },
  { kind: 'p', text: 'Want Thursday broken into an hour-by-hour plan?' },
];
const REPLY_LEN = blocksLen(REPLY);

// Timeline (ms)
const TYPE_A = 600, TYPE_B = 2400;
const SEND = 2550;
const DOTS_A = 2750, STREAM_A = 3700, STREAM_B = 9200;
const DURATION = 9600, HOLD = 3800;

function EmptyState({ opacity }: { opacity: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 20px',
      opacity, transition: 'opacity 240ms var(--ease)', pointerEvents: 'none',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-white.png" alt="" width={44} height={44} style={{ opacity: 0.92 }} />
      <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 24, color: c.text }}>Hello, Adam</div>
      <div style={{ fontFamily: sans, fontSize: 14, lineHeight: '21px', color: c.textMuted, textAlign: 'center', maxWidth: 260 }}>
        Ask a question, attach a file, or start with a rough idea.
      </div>
    </div>
  );
}

export function ChatDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const revealed = burst(prog(t, STREAM_A, STREAM_B) * REPLY_LEN);
  const generating = t >= DOTS_A && t < STREAM_B;

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
          />
        }
      >
        <EmptyState opacity={sent ? 0 : 1} />
        {sent && <UserTurn text={PROMPT} />}
        {sent && (t < STREAM_A
          ? <TypingDots />
          : <AssistantTurn blocks={REPLY} revealed={revealed} />)}
      </DemoPhone>
    </div>
  );
}
