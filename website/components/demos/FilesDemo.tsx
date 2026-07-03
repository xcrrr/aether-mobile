'use client';
import { DemoPhone } from './kit/Phone';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, TypingDots, Composer, ComposerChip, FileCard,
  DemoKeyframes, type Block, blocksLen,
} from './kit/chat';

/*
 * Demo 3 — Files. A user-selected PDF becomes context: the chip shows exactly
 * what the app extracted (type, size, pages), and the answer cites what's in
 * the document — decisions, risks, page references. Thinking mode: the bigger
 * model takes a beat longer before it streams.
 */

const PROMPT = 'What are the key decisions and open risks?';

const REPLY: Block[] = [
  { kind: 'p', text: '**Decisions**' },
  { kind: 'li', text: 'Pricing change ships in October; current users keep their plan.' },
  { kind: 'li', text: 'Platform team folds into product — hiring paused until Q4.' },
  { kind: 'p', text: '**Risks**' },
  { kind: 'li', text: 'The churn assumption (p. 8) rests on a single quarter of data.' },
  { kind: 'li', text: 'No owner for the migration timeline past September.' },
  { kind: 'p', text: 'The open-questions list on p. 11 blocks the pricing change — worth settling first.' },
];
const REPLY_LEN = blocksLen(REPLY);

const CHIP_AT = 500;
const TYPE_A = 1300, TYPE_B = 2800;
const SEND = 2950;
const STREAM_A = 4400, STREAM_B = 10600;
const DURATION = 11000, HOLD = 3800;

export function FilesDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const revealed = burst(prog(t, STREAM_A, STREAM_B) * REPLY_LEN);
  const generating = t >= SEND + 150 && t < STREAM_B;

  return (
    <div ref={ref} data-demo-root style={{ display: 'flex', justifyContent: 'center' }}>
      <DemoKeyframes />
      <DemoPhone
        mode="Thinking"
        opacity={loopOpacity(t, DURATION, HOLD)}
        composer={
          <Composer
            value={sent ? '' : typed}
            caret={!sent && t >= TYPE_A && t < SEND}
            generating={generating}
            chip={!sent && t >= CHIP_AT && (
              <ComposerChip name="Q3-review.pdf" meta="PDF / 412 KB / 12p" />
            )}
          />
        }
      >
        {sent && (
          <UserTurn
            text={PROMPT}
            attachment={<FileCard name="Q3-review.pdf" meta="PDF / 412 KB / 12p" />}
          />
        )}
        {sent && (t < STREAM_A
          ? <TypingDots />
          : <AssistantTurn blocks={REPLY} revealed={revealed} />)}
      </DemoPhone>
    </div>
  );
}
