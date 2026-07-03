'use client';
import { DemoPhone } from './kit/Phone';
import { c } from './kit/tokens';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, StatusTurn, Composer, ActionPill,
  DemoKeyframes, type Block, blocksLen,
} from './kit/chat';
import { IconGlobe, IconMic, IconPaperclip, IconSparkles } from './kit/icons';

/*
 * Demo 4 — Research. The one deliberately-online mode: the Research pill is
 * lit, the app narrates its real pipeline in place (search → read n/3 →
 * write), and the answer lands with numbered citations plus the sources list
 * exactly as formatResearchMarkdown renders them.
 */

const PROMPT = 'What’s new in small on-device language models for Android?';

const ANSWER: Block[] = [
  { kind: 'p', text: 'The center of gravity is small multimodal models. Gemma’s 2–4B releases now run fully on-device on recent Android phones through LiteRT, with vision folded into the same model file [1].' },
  { kind: 'p', text: 'Hardware moved too: NPU delegation is a first-class path on Android now, and 2026 flagship chips roughly double token speed for quantized models [2][3]. The practical ceiling is still memory — 4B-class models want about 4 GB of free RAM.' },
  { kind: 'hr' },
  { kind: 'p', text: '**Sources**' },
  { kind: 'sources', items: [
    'Gemma — ai.google.dev',
    'On-device AI — developer.android.com',
    'AI Engine — qualcomm.com',
  ] },
];
const ANSWER_LEN = blocksLen(ANSWER);

const TYPE_A = 700, TYPE_B = 2500;
const SEND = 2650;
const STATUSES: Array<[number, string]> = [
  [2850, 'Searching the web'],
  [4300, 'Reading sources 0/3'],
  [5100, 'Reading sources 1/3'],
  [5900, 'Reading sources 2/3'],
  [6600, 'Reading sources 3/3'],
  [7200, 'Writing answer from 3 sources'],
];
const STREAM_A = 8300, STREAM_B = 15300;
const DURATION = 15700, HOLD = 4200;

function statusAt(t: number): string {
  let s = STATUSES[0][1];
  for (const [at, label] of STATUSES) if (t >= at) s = label;
  return s;
}

export function ResearchDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const revealed = burst(prog(t, STREAM_A, STREAM_B) * ANSWER_LEN);
  const generating = t >= STATUSES[0][0] && t < STREAM_B;

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
            placeholder="Research the web..."
            generating={generating}
            barOpen
            pills={
              <>
                <span style={{ opacity: 0.5 }}>
                  <ActionPill icon={<IconPaperclip size={17} strokeWidth={1.8} color={c.border} />} label="Attach" />
                </span>
                <ActionPill icon={<IconGlobe size={17} strokeWidth={1.8} />} label="Research" active />
                <ActionPill icon={<IconSparkles size={17} strokeWidth={1.8} />} label="Task" />
                <ActionPill icon={<IconMic size={17} strokeWidth={1.8} />} label="Voice" />
              </>
            }
          />
        }
      >
        {sent && <UserTurn text={PROMPT} />}
        {sent && t >= STATUSES[0][0] && (t < STREAM_A
          ? <StatusTurn text={statusAt(t)} />
          : <AssistantTurn blocks={ANSWER} revealed={revealed} />)}
      </DemoPhone>
    </div>
  );
}
